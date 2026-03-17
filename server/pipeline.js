import { randomUUID } from "node:crypto";

/**
 * In-memory pipeline execution state tracker.
 * Tracks per-project, per-stage pipeline runs through the trigger→callback→approve lifecycle.
 *
 * Storage: Map<executionId, ExecutionRecord>
 * Index:   Map<projectId, Map<stageKey, executionId>> (latest execution per stage per project)
 */

/** @type {Map<string, object>} */
const executions = new Map();

/** @type {Map<string, Map<string, string>>} projectId → Map<stageKey, executionId> */
const projectIndex = new Map();

/**
 * Create a new pipeline execution for a project + stage.
 * @param {{ projectId: string, stageKey: string, subStage?: string, context?: object }} params
 * @returns {object} The execution record
 */
export function trigger({ projectId, stageKey, subStage = null, context = null }) {
  const executionId = randomUUID();
  const record = {
    projectId,
    executionId,
    status: "triggered",
    stageKey,
    subStage,
    context: context || null,
    n8nExecutionId: null,
    resumeUrl: null,
    triggeredAt: new Date().toISOString(),
    completedAt: null,
  };

  executions.set(executionId, record);

  // Two-level index: projectId → stageKey → executionId
  if (!projectIndex.has(projectId)) {
    projectIndex.set(projectId, new Map());
  }
  projectIndex.get(projectId).set(stageKey, executionId);

  return record;
}

/**
 * Record a callback from n8n with stage result and resumeUrl.
 * @param {{ executionId: string, projectId: string, stageKey: string, resumeUrl?: string, subStage?: string }} params
 * @returns {object|null} Updated record, or null if execution not found
 */
export function recordCallback({ executionId, projectId, stageKey, resumeUrl = null, subStage = null }) {
  const record = executions.get(executionId);
  if (!record) return null;

  record.status = "awaiting_approval";
  record.resumeUrl = resumeUrl;
  if (subStage) record.subStage = subStage;

  return record;
}

/**
 * Record an approval or rejection decision.
 * @param {{ projectId: string, stageKey: string, decision: string }} params
 * @returns {object|null} Updated record, or null if no execution found for project+stage
 */
export function recordApproval({ projectId, stageKey, decision }) {
  const stageMap = projectIndex.get(projectId);
  if (!stageMap) return null;

  const executionId = stageMap.get(stageKey);
  if (!executionId) return null;

  const record = executions.get(executionId);
  if (!record) return null;

  record.status = decision === "approved" ? "approved" : "rejected";
  record.completedAt = new Date().toISOString();

  return record;
}

/**
 * Get all pipeline execution states for a project (per-stage).
 * @param {string} projectId
 * @returns {object} Per-stage execution map, or idle status
 */
export function getStatus(projectId) {
  const stageMap = projectIndex.get(projectId);
  if (!stageMap || stageMap.size === 0) {
    return null;
  }

  const stages = {};
  for (const [stageKey, executionId] of stageMap) {
    const record = executions.get(executionId);
    if (record) stages[stageKey] = record;
  }

  return Object.keys(stages).length > 0 ? stages : null;
}

/**
 * Get the execution for a specific project + stage.
 * @param {string} projectId
 * @param {string} stageKey
 * @returns {object|null}
 */
export function getStageExecution(projectId, stageKey) {
  const stageMap = projectIndex.get(projectId);
  if (!stageMap) return null;

  const executionId = stageMap.get(stageKey);
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
