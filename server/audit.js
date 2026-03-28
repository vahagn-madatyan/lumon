import { getDb, getTestDb } from "./db.js";

// ---------------------------------------------------------------------------
// Internal: lazy DB access (same pattern as pipeline.js / external-actions.js)
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
    if (!_fallbackDb) {
      _fallbackDb = getTestDb(":memory:");
    }
    return _fallbackDb;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Persist an audit event to the audit_events table.
 * @param {string} projectId
 * @param {string} eventType
 * @param {*} data — will be JSON.stringify'd
 * @param {string|null} [actor=null]
 * @returns {{ id: number, projectId: string, eventType: string, data: *, timestamp: string, actor: string|null }}
 */
export function logEvent(projectId, eventType, data, actor = null) {
  const db = getDatabase();
  const dataStr = data != null ? JSON.stringify(data) : null;
  const info = db
    .prepare(
      `INSERT INTO audit_events (projectId, eventType, data, actor)
       VALUES (?, ?, ?, ?)`,
    )
    .run(projectId, eventType, dataStr, actor);

  // Return the full row so callers can confirm persistence
  const row = db
    .prepare("SELECT * FROM audit_events WHERE id = ?")
    .get(info.lastInsertRowid);
  return {
    id: row.id,
    projectId: row.projectId,
    eventType: row.eventType,
    data: row.data ? JSON.parse(row.data) : null,
    timestamp: row.timestamp,
    actor: row.actor ?? null,
  };
}

/**
 * Query audit events with optional filters.
 * @param {object} [opts]
 * @param {string} [opts.projectId]
 * @param {string} [opts.eventType]
 * @param {string} [opts.since] — ISO-8601 lower bound (inclusive)
 * @param {string} [opts.until] — ISO-8601 upper bound (inclusive)
 * @param {number} [opts.limit=100]
 * @returns {Array<{ id: number, projectId: string, eventType: string, data: *, timestamp: string, actor: string|null }>}
 */
export function getEvents({
  projectId,
  eventType,
  since,
  until,
  limit = 100,
} = {}) {
  const db = getDatabase();
  const clauses = [];
  const params = [];

  if (projectId) {
    clauses.push("projectId = ?");
    params.push(projectId);
  }
  if (eventType) {
    clauses.push("eventType = ?");
    params.push(eventType);
  }
  if (since) {
    clauses.push("timestamp >= ?");
    params.push(since);
  }
  if (until) {
    clauses.push("timestamp <= ?");
    params.push(until);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const sql = `SELECT * FROM audit_events ${where} ORDER BY timestamp DESC LIMIT ?`;
  params.push(limit);

  return db
    .prepare(sql)
    .all(...params)
    .map((row) => ({
      id: row.id,
      projectId: row.projectId,
      eventType: row.eventType,
      data: row.data ? JSON.parse(row.data) : null,
      timestamp: row.timestamp,
      actor: row.actor ?? null,
    }));
}

/**
 * Aggregate cost and token data from the build_agents telemetry column.
 *
 * Returns per-project summaries of total cost, token counts, and invocation
 * counts. When `projectId` is provided, filters to that single project.
 *
 * @param {string|null} [projectId=null]
 * @returns {Array<{ projectId: string, totalCostUsd: number, tokensInput: number, tokensOutput: number, invocations: number }>}
 */
export function getCostSummary(projectId = null) {
  const db = getDatabase();

  let sql = `
    SELECT
      projectId,
      SUM(COALESCE(json_extract(telemetry, '$.costUsd'), 0))            AS totalCostUsd,
      SUM(COALESCE(json_extract(telemetry, '$.tokens.input'), 0))       AS tokensInput,
      SUM(COALESCE(json_extract(telemetry, '$.tokens.output'), 0))      AS tokensOutput,
      COUNT(*)                                                           AS invocations
    FROM build_agents
  `;
  const params = [];

  if (projectId) {
    sql += " WHERE projectId = ?";
    params.push(projectId);
  }

  // Filter out rows with NULL telemetry entirely so COALESCE handles the
  // remaining json_extract gracefully.
  sql += projectId ? " AND telemetry IS NOT NULL" : " WHERE telemetry IS NOT NULL";
  sql += " GROUP BY projectId ORDER BY projectId";

  return db
    .prepare(sql)
    .all(...params)
    .map((row) => ({
      projectId: row.projectId,
      totalCostUsd: row.totalCostUsd ?? 0,
      tokensInput: row.tokensInput ?? 0,
      tokensOutput: row.tokensOutput ?? 0,
      invocations: row.invocations ?? 0,
    }));
}

/**
 * Delete all rows from audit_events. Used for test cleanup.
 */
export function clear() {
  const db = getDatabase();
  db.prepare("DELETE FROM audit_events").run();
}
