import { randomUUID } from "node:crypto";
import { getDb, getTestDb } from "./db.js";

// ---------------------------------------------------------------------------
// Internal: lazy DB access (same pattern as pipeline.js from T02)
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
      _fallbackDb = getTestDb();
    }
    return _fallbackDb;
  }
}

// ---------------------------------------------------------------------------
// Internal: row → record conversion
// ---------------------------------------------------------------------------

function rowToRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type,
    params: row.params ? JSON.parse(row.params) : {},
    status: row.status,
    requestedAt: row.requestedAt,
    confirmedAt: row.confirmedAt ?? null,
    executedAt: row.executedAt ?? null,
    completedAt: row.completedAt ?? null,
    result: row.result ? JSON.parse(row.result) : null,
    error: row.error ?? null,
  };
}

// ---------------------------------------------------------------------------
// State lifecycle
// ---------------------------------------------------------------------------

/**
 * Create a new pending external action.
 * @param {{ projectId: string, type: string, params: object }} opts
 * @returns {object} The created action record
 */
export function requestAction({ projectId, type, params }) {
  if (!projectId) throw new Error("projectId is required");
  if (!type) throw new Error("type is required");

  const db = getDatabase();
  const id = randomUUID();
  const requestedAt = new Date().toISOString();
  const paramsJson = JSON.stringify(params ?? {});

  db.prepare(`
    INSERT INTO external_actions (id, projectId, type, params, status, requestedAt)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(id, projectId, type, paramsJson, requestedAt);

  console.log(
    `[external-actions] requested id=${id} project=${projectId} type=${type}`,
  );

  return {
    id,
    projectId,
    type,
    params: params ?? {},
    status: "pending",
    requestedAt,
    confirmedAt: null,
    executedAt: null,
    completedAt: null,
    result: null,
    error: null,
  };
}

/**
 * Confirm a pending action — transitions status to 'confirmed'.
 * @param {{ projectId: string, actionId: string }} opts
 * @returns {object} The updated action
 */
export function confirmAction({ projectId, actionId }) {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM external_actions WHERE id = ?").get(actionId);
  if (!row) throw new Error(`Action not found: ${actionId}`);
  if (row.projectId !== projectId) {
    throw new Error(`Action ${actionId} does not belong to project ${projectId}`);
  }
  if (row.status !== "pending") {
    throw new Error(
      `Cannot confirm action in status '${row.status}' — must be 'pending'`,
    );
  }

  const confirmedAt = new Date().toISOString();
  db.prepare("UPDATE external_actions SET status = 'confirmed', confirmedAt = ? WHERE id = ?")
    .run(confirmedAt, actionId);

  console.log(
    `[external-actions] confirmed id=${actionId} project=${projectId}`,
  );

  return rowToRecord({ ...row, status: "confirmed", confirmedAt });
}

/**
 * Cancel a pending or confirmed action — transitions status to 'cancelled'.
 * @param {{ projectId: string, actionId: string }} opts
 * @returns {object} The updated action
 */
export function cancelAction({ projectId, actionId }) {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM external_actions WHERE id = ?").get(actionId);
  if (!row) throw new Error(`Action not found: ${actionId}`);
  if (row.projectId !== projectId) {
    throw new Error(`Action ${actionId} does not belong to project ${projectId}`);
  }
  if (row.status !== "pending" && row.status !== "confirmed") {
    throw new Error(
      `Cannot cancel action in status '${row.status}' — must be 'pending' or 'confirmed'`,
    );
  }

  db.prepare("UPDATE external_actions SET status = 'cancelled' WHERE id = ?")
    .run(actionId);

  console.log(
    `[external-actions] cancelled id=${actionId} project=${projectId}`,
  );

  return rowToRecord({ ...row, status: "cancelled" });
}

/**
 * Execute a confirmed action via the supplied provider callback.
 *
 * **THE GATE (D051 / R018 / R029):**
 * Rejects with a structured error when action status is not 'confirmed'.
 *
 * @param {{ projectId: string, actionId: string, provider: (params: object) => Promise<object> }} opts
 * @returns {Promise<object>} The updated action with result or error
 */
export async function executeAction({ projectId, actionId, provider }) {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM external_actions WHERE id = ?").get(actionId);
  if (!row) throw new Error(`Action not found: ${actionId}`);
  if (row.projectId !== projectId) {
    throw new Error(`Action ${actionId} does not belong to project ${projectId}`);
  }

  // ── THE CONFIRMATION GATE ──────────────────────────────────────────────
  if (row.status !== "confirmed") {
    const err = new Error(
      `Execution rejected: action ${actionId} has status '${row.status}' — must be 'confirmed'`,
    );
    err.code = "CONFIRMATION_REQUIRED";
    console.log(
      `[external-actions] gate-rejected id=${actionId} status=${row.status}`,
    );
    throw err;
  }

  const executedAt = new Date().toISOString();
  db.prepare("UPDATE external_actions SET status = 'executing', executedAt = ? WHERE id = ?")
    .run(executedAt, actionId);

  console.log(
    `[external-actions] executing id=${actionId} project=${projectId}`,
  );

  try {
    const result = await provider(row.params ? JSON.parse(row.params) : {});
    const completedAt = new Date().toISOString();
    db.prepare("UPDATE external_actions SET status = 'completed', completedAt = ?, result = ? WHERE id = ?")
      .run(completedAt, JSON.stringify(result), actionId);

    console.log(
      `[external-actions] completed id=${actionId} project=${projectId}`,
    );

    // Re-read to return consistent state
    const updated = db.prepare("SELECT * FROM external_actions WHERE id = ?").get(actionId);
    return rowToRecord(updated);
  } catch (providerErr) {
    const completedAt = new Date().toISOString();
    const errorMsg = providerErr.message || "Provider execution failed";
    db.prepare("UPDATE external_actions SET status = 'failed', completedAt = ?, error = ? WHERE id = ?")
      .run(completedAt, errorMsg, actionId);

    console.log(
      `[external-actions] failed id=${actionId} project=${projectId} error=${errorMsg}`,
    );

    // Re-read to return consistent state
    const updated = db.prepare("SELECT * FROM external_actions WHERE id = ?").get(actionId);
    return rowToRecord(updated);
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get all actions for a project.
 * @param {string} projectId
 * @returns {object[]}
 */
export function getActions(projectId) {
  const db = getDatabase();
  const rows = db.prepare("SELECT * FROM external_actions WHERE projectId = ?").all(projectId);
  return rows.map(rowToRecord);
}

/**
 * Get a single action by ID.
 * @param {string} actionId
 * @returns {object|null}
 */
export function getAction(actionId) {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM external_actions WHERE id = ?").get(actionId);
  return row ? rowToRecord(row) : null;
}

// ---------------------------------------------------------------------------
// Test cleanup
// ---------------------------------------------------------------------------

/**
 * Clear all external-action state. Used by tests.
 */
export function clear() {
  const db = getDatabase();
  db.prepare("DELETE FROM external_actions").run();
}
