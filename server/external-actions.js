import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// In-memory external-action state
// ---------------------------------------------------------------------------

/** @type {Map<string, object[]>} projectId → ExternalAction[] */
const actionsByProject = new Map();

/** @type {Map<string, object>} actionId → ExternalAction (index for direct lookup) */
const actionsById = new Map();

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

  const action = {
    id: randomUUID(),
    projectId,
    type,
    params: params ?? {},
    status: "pending",
    requestedAt: new Date().toISOString(),
    confirmedAt: null,
    executedAt: null,
    completedAt: null,
    result: null,
    error: null,
  };

  if (!actionsByProject.has(projectId)) {
    actionsByProject.set(projectId, []);
  }
  actionsByProject.get(projectId).push(action);
  actionsById.set(action.id, action);

  console.log(
    `[external-actions] requested id=${action.id} project=${projectId} type=${type}`,
  );
  return action;
}

/**
 * Confirm a pending action — transitions status to 'confirmed'.
 * @param {{ projectId: string, actionId: string }} opts
 * @returns {object} The updated action
 */
export function confirmAction({ projectId, actionId }) {
  const action = actionsById.get(actionId);
  if (!action) throw new Error(`Action not found: ${actionId}`);
  if (action.projectId !== projectId) {
    throw new Error(`Action ${actionId} does not belong to project ${projectId}`);
  }
  if (action.status !== "pending") {
    throw new Error(
      `Cannot confirm action in status '${action.status}' — must be 'pending'`,
    );
  }

  action.status = "confirmed";
  action.confirmedAt = new Date().toISOString();

  console.log(
    `[external-actions] confirmed id=${actionId} project=${projectId}`,
  );
  return action;
}

/**
 * Cancel a pending or confirmed action — transitions status to 'cancelled'.
 * @param {{ projectId: string, actionId: string }} opts
 * @returns {object} The updated action
 */
export function cancelAction({ projectId, actionId }) {
  const action = actionsById.get(actionId);
  if (!action) throw new Error(`Action not found: ${actionId}`);
  if (action.projectId !== projectId) {
    throw new Error(`Action ${actionId} does not belong to project ${projectId}`);
  }
  if (action.status !== "pending" && action.status !== "confirmed") {
    throw new Error(
      `Cannot cancel action in status '${action.status}' — must be 'pending' or 'confirmed'`,
    );
  }

  action.status = "cancelled";

  console.log(
    `[external-actions] cancelled id=${actionId} project=${projectId}`,
  );
  return action;
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
  const action = actionsById.get(actionId);
  if (!action) throw new Error(`Action not found: ${actionId}`);
  if (action.projectId !== projectId) {
    throw new Error(`Action ${actionId} does not belong to project ${projectId}`);
  }

  // ── THE CONFIRMATION GATE ──────────────────────────────────────────────
  if (action.status !== "confirmed") {
    const err = new Error(
      `Execution rejected: action ${actionId} has status '${action.status}' — must be 'confirmed'`,
    );
    err.code = "CONFIRMATION_REQUIRED";
    console.log(
      `[external-actions] gate-rejected id=${actionId} status=${action.status}`,
    );
    throw err;
  }

  action.status = "executing";
  action.executedAt = new Date().toISOString();

  console.log(
    `[external-actions] executing id=${actionId} project=${projectId}`,
  );

  try {
    const result = await provider(action.params);
    action.status = "completed";
    action.completedAt = new Date().toISOString();
    action.result = result;

    console.log(
      `[external-actions] completed id=${actionId} project=${projectId}`,
    );
    return action;
  } catch (providerErr) {
    action.status = "failed";
    action.completedAt = new Date().toISOString();
    action.error = providerErr.message || "Provider execution failed";

    console.log(
      `[external-actions] failed id=${actionId} project=${projectId} error=${action.error}`,
    );
    return action;
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
  return actionsByProject.get(projectId) ?? [];
}

/**
 * Get a single action by ID.
 * @param {string} actionId
 * @returns {object|null}
 */
export function getAction(actionId) {
  return actionsById.get(actionId) ?? null;
}

// ---------------------------------------------------------------------------
// Test cleanup
// ---------------------------------------------------------------------------

/**
 * Clear all in-memory state. Used by tests.
 */
export function clear() {
  actionsByProject.clear();
  actionsById.clear();
}
