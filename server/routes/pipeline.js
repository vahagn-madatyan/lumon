import { Router } from "express";
import * as artifacts from "../artifacts.js";
import * as pipeline from "../pipeline.js";

const router = Router();

// ---------------------------------------------------------------------------
// SSE connection registry — per projectId
// ---------------------------------------------------------------------------
/** @type {Map<string, Set<import("express").Response>>} */
const sseClients = new Map();

/**
 * Send a typed SSE event to all connected clients for a given projectId.
 * @param {string} projectId
 * @param {string} eventType — e.g. "stage-update", "artifact-ready", "pipeline-status"
 * @param {object} data
 */
function emitSSE(projectId, eventType, data) {
  const clients = sseClients.get(projectId);
  if (!clients || clients.size === 0) return;

  const payload = JSON.stringify({ projectId, ...data });
  for (const res of clients) {
    res.write(`event: ${eventType}\ndata: ${payload}\n\n`);
  }

  console.log(`[bridge] SSE emit event=${eventType} projectId=${projectId} clients=${clients.size}`);
}

/** Expose for tests. */
export { sseClients, emitSSE };

// ---------------------------------------------------------------------------
// SSE endpoint
// ---------------------------------------------------------------------------

/**
 * GET /api/pipeline/events/:projectId
 * Opens an SSE stream. Sends keepalive pings every 15 s.
 * Typed events: stage-update, artifact-ready, pipeline-status
 */
router.get("/events/:projectId", (req, res) => {
  const { projectId } = req.params;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send an initial connected event so the client knows the stream is live
  res.write(`event: connected\ndata: ${JSON.stringify({ projectId })}\n\n`);

  // Register this connection
  if (!sseClients.has(projectId)) {
    sseClients.set(projectId, new Set());
  }
  sseClients.get(projectId).add(res);

  console.log(`[bridge] SSE connect projectId=${projectId} clients=${sseClients.get(projectId).size}`);

  // Keepalive ping every 15 s
  const keepalive = setInterval(() => {
    res.write(`:ping\n\n`);
  }, 15_000);

  // Clean up on client disconnect
  req.on("close", () => {
    clearInterval(keepalive);
    const clients = sseClients.get(projectId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) sseClients.delete(projectId);
    }
    console.log(`[bridge] SSE disconnect projectId=${projectId} remaining=${sseClients.get(projectId)?.size ?? 0}`);
  });
});

// ---------------------------------------------------------------------------
// REST endpoints (trigger, callback, approve, status)
// ---------------------------------------------------------------------------

/**
 * POST /api/pipeline/trigger
 * Trigger a pipeline execution for a project + stage.
 * Body: { projectId, stageKey }
 */
router.post("/trigger", async (req, res) => {
  const { projectId, stageKey } = req.body;

  if (!projectId || !stageKey) {
    return res.status(400).json({ error: "Missing required fields", reason: "projectId and stageKey are required" });
  }

  // Create execution first so we can pass executionId to n8n
  const execution = pipeline.trigger({ projectId, stageKey });

  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, stageKey, executionId: execution.executionId }),
      });

      if (!response.ok) {
        console.log(`[bridge] POST /api/pipeline/trigger projectId=${projectId} n8n returned ${response.status}`);
        // Mark execution as failed since n8n rejected it
        pipeline.recordFailure({ executionId: execution.executionId, reason: `n8n returned HTTP ${response.status}` });
        return res.status(502).json({
          error: "n8n webhook failed",
          reason: `n8n returned HTTP ${response.status}`,
        });
      }

      const data = await response.json();
      if (data.executionId) {
        execution.n8nExecutionId = data.executionId;
      }
    } catch (err) {
      console.log(`[bridge] POST /api/pipeline/trigger projectId=${projectId} n8n unreachable: ${err.message}`);
      pipeline.recordFailure({ executionId: execution.executionId, reason: err.message });
      return res.status(502).json({
        error: "n8n unreachable",
        reason: err.message,
      });
    }
  } else {
    console.log(`[bridge] POST /api/pipeline/trigger projectId=${projectId} N8N_WEBHOOK_URL not configured, recording intent`);
  }

  console.log(`[bridge] POST /api/pipeline/trigger projectId=${projectId} stageKey=${stageKey} executionId=${execution.executionId}`);

  // Emit SSE: pipeline status changed to "triggered"
  emitSSE(projectId, "pipeline-status", {
    stageKey,
    data: { status: execution.status, executionId: execution.executionId },
  });

  res.status(201).json({ executionId: execution.executionId, status: execution.status });
});

/**
 * POST /api/pipeline/callback
 * Receive callback from n8n with stage result.
 * Body: { executionId, projectId, stageKey, result, resumeUrl }
 */
router.post("/callback", (req, res) => {
  const { executionId, projectId, stageKey, result, resumeUrl } = req.body;

  if (!executionId || !projectId || !stageKey) {
    return res.status(400).json({ error: "Missing required fields", reason: "executionId, projectId, and stageKey are required" });
  }

  const execution = pipeline.getExecution(executionId);
  if (!execution) {
    console.log(`[bridge] POST /api/pipeline/callback executionId=${executionId} not found`);
    return res.status(404).json({ error: "Execution not found", reason: `No execution with id ${executionId}` });
  }

  // Store the result as an artifact
  const artifact = artifacts.create({
    projectId,
    stageKey,
    type: result?.type || "stage-result",
    content: result?.content || result,
    metadata: { executionId, ...(result?.metadata || {}) },
  });

  // Update pipeline state
  pipeline.recordCallback({ executionId, projectId, stageKey, resumeUrl });

  console.log(`[bridge] POST /api/pipeline/callback projectId=${projectId} stageKey=${stageKey} artifactId=${artifact.id}`);

  // Emit SSE: stage update (result received, status changed to awaiting_approval)
  emitSSE(projectId, "stage-update", {
    stageKey,
    data: { status: "awaiting_approval", resumeUrl: !!resumeUrl },
  });

  // Emit SSE: artifact ready
  emitSSE(projectId, "artifact-ready", {
    stageKey,
    data: {
      artifactId: artifact.id,
      type: artifact.type,
      summary: typeof result?.content === "string" ? result.content.slice(0, 200) : "Artifact stored",
    },
  });

  res.json({ ok: true, artifactId: artifact.id });
});

/**
 * POST /api/pipeline/approve
 * Approve or reject a pipeline stage.
 * Body: { projectId, stageKey, decision }
 */
router.post("/approve", async (req, res) => {
  const { projectId, stageKey, decision } = req.body;

  if (!projectId || !stageKey || !decision) {
    return res.status(400).json({ error: "Missing required fields", reason: "projectId, stageKey, and decision are required" });
  }

  const execution = pipeline.getStatus(projectId);
  if (!execution) {
    console.log(`[bridge] POST /api/pipeline/approve projectId=${projectId} no execution found`);
    return res.status(404).json({ error: "No execution found", reason: `No active execution for project ${projectId}` });
  }

  // If approved and resumeUrl exists, call n8n to resume the workflow
  if (decision === "approved" && execution.resumeUrl) {
    try {
      const response = await fetch(execution.resumeUrl, {
        method: "GET",
      });
      if (!response.ok) {
        console.log(`[bridge] POST /api/pipeline/approve projectId=${projectId} n8n resume failed: ${response.status}`);
      }
    } catch (err) {
      console.log(`[bridge] POST /api/pipeline/approve projectId=${projectId} n8n resume unreachable: ${err.message}`);
    }
  }

  pipeline.recordApproval({ projectId, stageKey, decision });
  console.log(`[bridge] POST /api/pipeline/approve projectId=${projectId} stageKey=${stageKey} decision=${decision}`);

  // Emit SSE: pipeline status changed after approval/rejection
  const updatedExecution = pipeline.getStatus(projectId);
  emitSSE(projectId, "pipeline-status", {
    stageKey,
    data: { status: updatedExecution?.status ?? decision, decision },
  });

  res.json({ ok: true, decision });
});

/**
 * GET /api/pipeline/status/:projectId
 * Get current pipeline execution state for a project.
 */
router.get("/status/:projectId", (req, res) => {
  const status = pipeline.getStatus(req.params.projectId);

  console.log(`[bridge] GET /api/pipeline/status/${req.params.projectId} found=${!!status}`);
  res.json(status || { projectId: req.params.projectId, status: "idle", message: "No active execution" });
});

export default router;
