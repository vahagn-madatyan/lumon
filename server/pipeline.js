import { randomUUID } from "node:crypto";

/**
 * In-memory pipeline execution state tracker.
 * Tracks per-project pipeline runs through the trigger→callback→approve lifecycle.
 *
 * Storage: Map<executionId, ExecutionRecord>
 * Index:   Map<projectId, executionId> (latest execution per project)
 */

/** @type {Map<string, object>} */
const executions = new Map();

/** @type {Map<string, string>} projectId → latest executionId */
const projectIndex = new Map();

/**
 * Create a new pipeline execution for a project + stage.
 * @param {{ projectId: string, stageKey: string }} params
 * @returns {object} The execution record
 */
export function trigger({ projectId, stageKey }) {
  const executionId = randomUUID();
  const record = {
    projectId,
    executionId,
    status: "triggered",
    stageKey,
    n8nExecutionId: null,
    resumeUrl: null,
    triggeredAt: new Date().toISOString(),
    completedAt: null,
  };

  executions.set(executionId, record);
  projectIndex.set(projectId, executionId);

  return record;
}

/**
 * Record a callback from n8n with stage result and resumeUrl.
 * @param {{ executionId: string, projectId: string, stageKey: string, resumeUrl?: string }} params
 * @returns {object|null} Updated record, or null if execution not found
 */
export function recordCallback({ executionId, projectId, stageKey, resumeUrl = null }) {
  const record = executions.get(executionId);
  if (!record) return null;

  record.status = "awaiting_approval";
  record.resumeUrl = resumeUrl;

  return record;
}

/**
 * Record an approval or rejection decision.
 * @param {{ projectId: string, stageKey: string, decision: string }} params
 * @returns {object|null} Updated record, or null if no execution found for project
 */
export function recordApproval({ projectId, stageKey, decision }) {
  const executionId = projectIndex.get(projectId);
  if (!executionId) return null;

  const record = executions.get(executionId);
  if (!record) return null;

  record.status = decision === "approved" ? "approved" : "rejected";
  record.completedAt = new Date().toISOString();

  return record;
}

/**
 * Get the current pipeline execution state for a project.
 * @param {string} projectId
 * @returns {object|null}
 */
export function getStatus(projectId) {
  const executionId = projectIndex.get(projectId);
  if (!executionId) return null;
  return executions.get(executionId) || null;
}

/**
 * Get an execution by its ID.
 * @param {string} executionId
 * @returns {object|null}
 */
export function getExecution(executionId) {
  return executions.get(executionId) || null;
}

/**
 * Record a failure for an execution (e.g. n8n unreachable after trigger).
 * @param {{ executionId: string, reason: string }} params
 * @returns {object|null} Updated record, or null if execution not found
 */
export function recordFailure({ executionId, reason }) {
  const record = executions.get(executionId);
  if (!record) return null;

  record.status = "failed";
  record.failureReason = reason;
  record.completedAt = new Date().toISOString();

  return record;
}

/**
 * Clear all state. Used for test cleanup.
 */
export function clear() {
  executions.clear();
  projectIndex.clear();
}
