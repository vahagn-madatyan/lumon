import { Router } from "express";
import {
  startBuild,
  getStatus,
  getAgentOutput,
  checkAgentAvailability,
  retryAgent,
  acknowledgeEscalation,
  getActiveEscalations,
} from "../execution.js";
import { emitSSE } from "./pipeline.js";

const router = Router();

// ---------------------------------------------------------------------------
// Output throttle — limit build-agent-output SSE to 1 event/sec per project
// ---------------------------------------------------------------------------

/** @type {Map<string, number>} projectId → last output emit timestamp */
const outputThrottles = new Map();

/**
 * Returns true if an output SSE should be emitted for this project.
 * Enforces max 1 output event per second per project.
 */
function shouldEmitOutput(projectId) {
  const now = Date.now();
  const last = outputThrottles.get(projectId) || 0;
  if (now - last >= 1000) {
    outputThrottles.set(projectId, now);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// SSE bridge — maps execution service events to SSE event names
// ---------------------------------------------------------------------------

/**
 * Create an onAgentEvent callback that bridges execution events to SSE.
 * @param {string} projectId
 * @returns {(event: object) => void}
 */
function createSSEBridge(projectId) {
  return (event) => {
    const { type, ...data } = event;

    switch (type) {
      case "build-agent-spawned":
        emitSSE(projectId, "build-agent-spawned", data);
        // Also emit build-status for the running transition
        emitSSE(projectId, "build-status", {
          projectId,
          status: "running",
          agentId: data.agentId,
        });
        break;

      case "build-agent-output":
        if (shouldEmitOutput(projectId)) {
          emitSSE(projectId, "build-agent-output", data);
        }
        break;

      case "build-agent-completed":
        emitSSE(projectId, "build-agent-completed", data);
        emitSSE(projectId, "build-status", {
          projectId,
          status: "completed",
          agentId: data.agentId,
          exitCode: data.exitCode,
          elapsed: data.elapsed,
        });
        // Clean up throttle state
        outputThrottles.delete(projectId);
        break;

      case "build-agent-failed":
        emitSSE(projectId, "build-agent-failed", data);
        emitSSE(projectId, "build-status", {
          projectId,
          status: "failed",
          agentId: data.agentId,
          error: data.error,
          elapsed: data.elapsed,
        });
        // Clean up throttle state
        outputThrottles.delete(projectId);
        break;

      // ---------------------------------------------------------------
      // Retry / escalation lifecycle events (T04 — S02)
      // ---------------------------------------------------------------

      case "retry-started":
        emitSSE(projectId, "build-retry-started", data);
        emitSSE(projectId, "build-status", {
          projectId,
          status: "running",
          agentId: data.agentId,
          retryCount: data.retryCount,
        });
        break;

      case "escalation-raised":
        emitSSE(projectId, "build-escalation-raised", data);
        emitSSE(projectId, "build-status", {
          projectId,
          status: "escalated",
          reason: data.reason,
        });
        break;

      case "escalation-acknowledged":
        emitSSE(projectId, "build-escalation-acknowledged", data);
        emitSSE(projectId, "build-status", {
          projectId,
          status: data.decision === "abort" ? "aborted" : "running",
          decision: data.decision,
        });
        break;

      default:
        console.log(`[execution] unknown event type: ${type}`);
    }
  };
}

// ---------------------------------------------------------------------------
// POST /start — fire-and-forget build start, responds 201 immediately
// ---------------------------------------------------------------------------

router.post("/start", async (req, res) => {
  const { projectId, workspacePath, agentType, prompt } = req.body;

  if (!projectId) {
    return res.status(400).json({
      error: "Missing required field",
      reason: "projectId is required",
    });
  }

  if (!workspacePath) {
    return res.status(400).json({
      error: "Missing required field",
      reason: "workspacePath is required",
    });
  }

  // Pre-flight: check agent CLI availability
  const effectiveAgentType = agentType || "claude";
  const availability = await checkAgentAvailability(effectiveAgentType);
  if (!availability.available) {
    return res.status(503).json({
      error: "Agent CLI unavailable",
      reason: availability.error,
      agentType: effectiveAgentType,
      action: `Install the ${effectiveAgentType} CLI and ensure it is on PATH`,
    });
  }

  // Check for already-running build (concurrency guard surfaces as thrown error,
  // but we check proactively here for a clean 409)
  const existing = getStatus(projectId);
  if (existing?.status === "running") {
    return res.status(409).json({
      error: "Build already running",
      reason: `Project ${projectId} already has a running build`,
    });
  }

  // Respond 201 immediately — build runs async
  console.log(`[execution] POST /api/execution/start projectId=${projectId} agentType=${effectiveAgentType}`);
  res.status(201).json({ projectId, status: "started" });

  // Start the build asynchronously with SSE bridge
  try {
    await startBuild(
      projectId,
      { workspacePath, agentType: effectiveAgentType, prompt },
      { onAgentEvent: createSSEBridge(projectId) }
    );
  } catch (err) {
    // Build-level failures are surfaced through SSE events (build-agent-failed),
    // but log for server-side observability
    console.error(`[execution] build error projectId=${projectId}: ${err.message}`);
  }
});

// ---------------------------------------------------------------------------
// GET /status/:projectId — current build state
// ---------------------------------------------------------------------------

router.get("/status/:projectId", (req, res) => {
  const { projectId } = req.params;
  const status = getStatus(projectId);

  console.log(`[execution] GET /api/execution/status/${projectId} status=${status?.status ?? "none"}`);

  if (!status) {
    return res.status(404).json({
      error: "Build not found",
      reason: `No build record for project ${projectId}`,
    });
  }

  res.json(status);
});

// ---------------------------------------------------------------------------
// GET /agent/:agentId/output — ring buffer contents
// ---------------------------------------------------------------------------

router.get("/agent/:agentId/output", (req, res) => {
  const { agentId } = req.params;
  const output = getAgentOutput(agentId);

  console.log(`[execution] GET /api/execution/agent/${agentId}/output lines=${output?.length ?? "none"}`);

  if (output === null) {
    return res.status(404).json({
      error: "Agent not found",
      reason: `No agent record for ${agentId}`,
    });
  }

  res.json({ agentId, lines: output, count: output.length });
});

// ---------------------------------------------------------------------------
// POST /retry — manual agent retry after escalation acknowledgment
// ---------------------------------------------------------------------------

router.post("/retry", (req, res) => {
  const { projectId, agentId } = req.body;

  if (!projectId || !agentId) {
    return res.status(400).json({
      error: "Missing required field",
      reason: "projectId and agentId are required",
    });
  }

  console.log(`[execution] POST /api/execution/retry projectId=${projectId} agentId=${agentId}`);

  try {
    const result = retryAgent(projectId, agentId);
    res.status(201).json(result);
  } catch (err) {
    // Distinguish "not found" from "no escalation to retry" by message content
    if (err.message.includes("No build found") || err.message.includes("No agent found")) {
      return res.status(404).json({
        error: "Not found",
        reason: err.message,
      });
    }
    return res.status(400).json({
      error: "Retry failed",
      reason: err.message,
    });
  }
});

// ---------------------------------------------------------------------------
// POST /escalation/acknowledge — operator acknowledges an escalation
// ---------------------------------------------------------------------------

router.post("/escalation/acknowledge", (req, res) => {
  const { projectId, decision } = req.body;

  if (!projectId) {
    return res.status(400).json({
      error: "Missing required field",
      reason: "projectId is required",
    });
  }

  if (!decision || !["retry", "abort"].includes(decision)) {
    return res.status(400).json({
      error: "Invalid decision",
      reason: "decision must be 'retry' or 'abort'",
    });
  }

  console.log(`[execution] POST /api/execution/escalation/acknowledge projectId=${projectId} decision=${decision}`);

  try {
    const result = acknowledgeEscalation(projectId, decision);
    res.json(result);
  } catch (err) {
    if (err.message.includes("No build found")) {
      return res.status(404).json({
        error: "Not found",
        reason: err.message,
      });
    }
    if (err.message.includes("No active escalation") || err.message.includes("already acknowledged")) {
      return res.status(400).json({
        error: "No active escalation",
        reason: err.message,
      });
    }
    return res.status(400).json({
      error: "Acknowledge failed",
      reason: err.message,
    });
  }
});

// ---------------------------------------------------------------------------
// GET /escalations — all active escalations across projects
// ---------------------------------------------------------------------------

router.get("/escalations", (_req, res) => {
  console.log("[execution] GET /api/execution/escalations");

  const escalations = getActiveEscalations();
  const result = escalations.map(({ projectId, escalation }) => ({
    projectId,
    reason: escalation.reason,
    escalatedAt: escalation.raisedAt,
  }));

  res.json(result);
});

/** Expose throttle map for test cleanup. */
export { outputThrottles };

export default router;
