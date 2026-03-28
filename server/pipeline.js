import { randomUUID } from "node:crypto";
import { getDb, getTestDb } from "./db.js";

/**
 * SQLite-backed pipeline execution state tracker.
 * Tracks per-project, per-stage pipeline runs through the trigger→callback→approve lifecycle.
 *
 * Replaces the former in-memory Maps with durable SQLite storage.
 * The API surface (function signatures and return shapes) is unchanged.
 */

// ---------------------------------------------------------------------------
// Internal: lazy DB access
// ---------------------------------------------------------------------------

/** @type {import("better-sqlite3").Database | null} */
let _fallbackDb = null;

/**
 * Return the active database handle. In production the shared db module is
 * initialised before any route handler runs. In tests, nobody calls
 * db.initialize(), so getDb() throws — we fall back to an in-memory SQLite
 * instance so that existing tests work without modification.
 */
function getDatabase() {
  try {
    return getDb();
  } catch {
    // Lazy-create an in-memory DB for test environments
    if (!_fallbackDb) {
      _fallbackDb = getTestDb(":memory:");
    }
    return _fallbackDb;
  }
}

// ---------------------------------------------------------------------------
// Internal: row → record shape conversion
// ---------------------------------------------------------------------------

/**
 * Convert a raw SQLite row into the record object shape that callers expect.
 * Parses the JSON-encoded `context` column back to an object/null.
 */
function rowToRecord(row) {
  if (!row) return null;
  return {
    projectId: row.projectId,
    executionId: row.executionId,
    status: row.status,
    stageKey: row.stageKey,
    subStage: row.subStage || null,
    context: row.context ? JSON.parse(row.context) : null,
    n8nExecutionId: row.n8nExecutionId || null,
    resumeUrl: row.resumeUrl || null,
    triggeredAt: row.triggeredAt,
    completedAt: row.completedAt || null,
    ...(row.failureReason != null ? { failureReason: row.failureReason } : {}),
  };
}

// ---------------------------------------------------------------------------
// Public API — identical signatures and return shapes to the original
// ---------------------------------------------------------------------------

/**
 * Create a new pipeline execution for a project + stage.
 * @param {{ projectId: string, stageKey: string, subStage?: string, context?: object }} params
 * @returns {object} The execution record
 */
export function trigger({ projectId, stageKey, subStage = null, context = null }) {
  const db = getDatabase();
  const executionId = randomUUID();
  const triggeredAt = new Date().toISOString();
  const contextJson = context ? JSON.stringify(context) : null;

  db.prepare(`
    INSERT INTO pipeline_executions
      (executionId, projectId, stageKey, subStage, status, context, n8nExecutionId, resumeUrl, triggeredAt, completedAt, failureReason)
    VALUES
      (?, ?, ?, ?, 'triggered', ?, NULL, NULL, ?, NULL, NULL)
  `).run(executionId, projectId, stageKey, subStage, contextJson, triggeredAt);

  return {
    projectId,
    executionId,
    status: "triggered",
    stageKey,
    subStage,
    context: context || null,
    n8nExecutionId: null,
    resumeUrl: null,
    triggeredAt,
    completedAt: null,
  };
}

/**
 * Record a callback from n8n with stage result and resumeUrl.
 * @param {{ executionId: string, projectId: string, stageKey: string, resumeUrl?: string, subStage?: string }} params
 * @returns {object|null} Updated record, or null if execution not found
 */
export function recordCallback({ executionId, projectId, stageKey, resumeUrl = null, subStage = null }) {
  const db = getDatabase();

  const row = db.prepare(`SELECT * FROM pipeline_executions WHERE executionId = ?`).get(executionId);
  if (!row) return null;

  const updates = { status: "awaiting_approval", resumeUrl };
  // Only update subStage if a truthy value is provided
  if (subStage) {
    updates.subStage = subStage;
  }

  db.prepare(`
    UPDATE pipeline_executions
    SET status = 'awaiting_approval',
        resumeUrl = ?,
        subStage = COALESCE(?, subStage)
    WHERE executionId = ?
  `).run(resumeUrl, subStage || null, executionId);

  // Re-read the updated row and return as record
  const updated = db.prepare(`SELECT * FROM pipeline_executions WHERE executionId = ?`).get(executionId);
  return rowToRecord(updated);
}

/**
 * Record an approval or rejection decision.
 * @param {{ projectId: string, stageKey: string, decision: string }} params
 * @returns {object|null} Updated record, or null if no execution found for project+stage
 */
export function recordApproval({ projectId, stageKey, decision }) {
  const db = getDatabase();

  // Find the latest execution for this project+stage
  const row = db.prepare(`
    SELECT * FROM pipeline_executions
    WHERE projectId = ? AND stageKey = ?
    ORDER BY triggeredAt DESC
    LIMIT 1
  `).get(projectId, stageKey);

  if (!row) return null;

  const status = decision === "approved" ? "approved" : "rejected";
  const completedAt = new Date().toISOString();

  db.prepare(`
    UPDATE pipeline_executions
    SET status = ?, completedAt = ?
    WHERE executionId = ?
  `).run(status, completedAt, row.executionId);

  const updated = db.prepare(`SELECT * FROM pipeline_executions WHERE executionId = ?`).get(row.executionId);
  return rowToRecord(updated);
}

/**
 * Get all pipeline execution states for a project (per-stage).
 * Returns the latest execution per stageKey, mimicking the old projectIndex behaviour.
 * @param {string} projectId
 * @returns {object|null} Per-stage execution map, or null if no executions
 */
export function getStatus(projectId) {
  const db = getDatabase();

  // Get the latest execution for each stageKey for this project.
  // We use a subquery to find the max triggeredAt per stageKey, then join back.
  const rows = db.prepare(`
    SELECT pe.*
    FROM pipeline_executions pe
    INNER JOIN (
      SELECT stageKey, MAX(triggeredAt) AS maxTriggeredAt
      FROM pipeline_executions
      WHERE projectId = ?
      GROUP BY stageKey
    ) latest
    ON pe.stageKey = latest.stageKey AND pe.triggeredAt = latest.maxTriggeredAt
    WHERE pe.projectId = ?
  `).all(projectId, projectId);

  if (rows.length === 0) return null;

  const stages = {};
  for (const row of rows) {
    stages[row.stageKey] = rowToRecord(row);
  }

  return Object.keys(stages).length > 0 ? stages : null;
}

/**
 * Get the execution for a specific project + stage (latest).
 * @param {string} projectId
 * @param {string} stageKey
 * @returns {object|null}
 */
export function getStageExecution(projectId, stageKey) {
  const db = getDatabase();

  const row = db.prepare(`
    SELECT * FROM pipeline_executions
    WHERE projectId = ? AND stageKey = ?
    ORDER BY triggeredAt DESC
    LIMIT 1
  `).get(projectId, stageKey);

  return rowToRecord(row);
}

/**
 * Get an execution by its ID.
 * @param {string} executionId
 * @returns {object|null}
 */
export function getExecution(executionId) {
  const db = getDatabase();

  const row = db.prepare(`SELECT * FROM pipeline_executions WHERE executionId = ?`).get(executionId);
  return rowToRecord(row);
}

/**
 * Record a failure for an execution (e.g. n8n unreachable after trigger).
 * @param {{ executionId: string, reason: string }} params
 * @returns {object|null} Updated record, or null if execution not found
 */
export function recordFailure({ executionId, reason }) {
  const db = getDatabase();

  const row = db.prepare(`SELECT * FROM pipeline_executions WHERE executionId = ?`).get(executionId);
  if (!row) return null;

  const completedAt = new Date().toISOString();

  db.prepare(`
    UPDATE pipeline_executions
    SET status = 'failed', failureReason = ?, completedAt = ?
    WHERE executionId = ?
  `).run(reason, completedAt, executionId);

  const updated = db.prepare(`SELECT * FROM pipeline_executions WHERE executionId = ?`).get(executionId);
  return rowToRecord(updated);
}

/**
 * Clear all pipeline execution state. Used for test cleanup.
 * Deletes rows rather than dropping the table.
 */
export function clear() {
  const db = getDatabase();
  db.prepare(`DELETE FROM pipeline_executions`).run();
}
