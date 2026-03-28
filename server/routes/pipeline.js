import { Router } from "express";
import * as artifacts from "../artifacts.js";
import * as pipeline from "../pipeline.js";
import { getWebhookUrl, getPorkbunCredentials, RESEARCH_SUB_STAGES, PLAN_SUB_STAGES, VERIFICATION_SUB_STAGES } from "../config.js";
import { logEvent } from "../audit.js";

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
function emitSSE(projectId, eventType, data, actor = null) {
  const clients = sseClients.get(projectId);
  if (!clients || clients.size === 0) return;

  const payload = JSON.stringify({ projectId, ...data });
  for (const res of clients) {
    res.write(`event: ${eventType}\ndata: ${payload}\n\n`);
  }

  console.log(`[bridge] SSE emit event=${eventType} projectId=${projectId} clients=${clients.size}`);

  // Persist audit event for state-transition events; skip noisy build output
  if (eventType !== 'build-agent-output') {
    try {
      logEvent(projectId, eventType, data, actor);
    } catch (err) {
      console.error('[audit] failed to log event:', err.message);
    }
  }
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
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fire an n8n webhook for a given stage. Creates a pipeline execution record,
 * POSTs to the webhook, and handles failures.
 * @param {{ projectId: string, stageKey: string, subStage?: string, context?: object }} params
 * @returns {Promise<{ execution: object, error?: string }>}
 */
async function fireWebhook({ projectId, stageKey, subStage = null, context = null }) {
  const execution = pipeline.trigger({ projectId, stageKey, subStage, context });
  const webhookUrl = getWebhookUrl(stageKey, subStage);

  if (!webhookUrl) {
    console.log(`[bridge] fireWebhook projectId=${projectId} stageKey=${stageKey} no webhook configured, recording intent`);
    return { execution };
  }

  try {
    const body = {
      projectId,
      stageKey,
      subStage: subStage || undefined,
      executionId: execution.executionId,
    };
    if (context) body.context = context;

    // Inject Porkbun credentials for domain_signals sub-stage only (D032)
    if (stageKey === "plan" && subStage === "domain_signals") {
      const creds = getPorkbunCredentials();
      if (!body.context) body.context = {};
      body.context.porkbunApiKey = creds.apiKey;
      body.context.porkbunApiSecret = creds.apiSecret;
      const credStatus = creds.apiKey && creds.apiSecret ? "injected" : "missing";
      console.log(`[bridge] fireWebhook projectId=${projectId} stageKey=${stageKey} subStage=${subStage} credentials=${credStatus}`);
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.log(`[bridge] fireWebhook projectId=${projectId} stageKey=${stageKey} n8n returned ${response.status}`);
      pipeline.recordFailure({ executionId: execution.executionId, reason: `n8n returned HTTP ${response.status}` });
      return { execution, error: `n8n returned HTTP ${response.status}` };
    }

    const data = await response.json();
    if (data.executionId) {
      execution.n8nExecutionId = data.executionId;
    }
  } catch (err) {
    console.log(`[bridge] fireWebhook projectId=${projectId} stageKey=${stageKey} n8n unreachable: ${err.message}`);
    pipeline.recordFailure({ executionId: execution.executionId, reason: err.message });
    return { execution, error: err.message };
  }

  return { execution };
}

// ---------------------------------------------------------------------------
// REST endpoints (trigger, callback, approve, status, artifacts)
// ---------------------------------------------------------------------------

/**
 * POST /api/pipeline/trigger
 * Trigger a pipeline execution for a project + stage.
 * Body: { projectId, stageKey, subStage? }
 */
router.post("/trigger", async (req, res) => {
  const { projectId, stageKey, subStage, context } = req.body;

  if (!projectId || !stageKey) {
    return res.status(400).json({ error: "Missing required fields", reason: "projectId and stageKey are required" });
  }

  // For research/plan stages without explicit subStage, start sequential orchestration with first sub-stage
  let effectiveSubStage = subStage;
  if (stageKey === "research" && !subStage) {
    effectiveSubStage = RESEARCH_SUB_STAGES[0];
  } else if (stageKey === "plan" && !subStage) {
    effectiveSubStage = PLAN_SUB_STAGES[0];
  } else if (stageKey === "verification" && !subStage) {
    effectiveSubStage = VERIFICATION_SUB_STAGES[0];
  }

  const { execution, error } = await fireWebhook({
    projectId,
    stageKey,
    subStage: effectiveSubStage || null,
    context: context || null,
  });

  if (error) {
    return res.status(502).json({ error: "n8n webhook failed", reason: error });
  }

  console.log(`[bridge] POST /api/pipeline/trigger projectId=${projectId} stageKey=${stageKey} executionId=${execution.executionId}`);

  // Emit SSE: pipeline status changed to "triggered"
  const actor = req.lumonUser?.login ?? null;
  emitSSE(projectId, "pipeline-status", {
    stageKey,
    data: { status: execution.status, executionId: execution.executionId, subStage: effectiveSubStage },
  }, actor);

  res.status(201).json({ executionId: execution.executionId, status: execution.status });
});

/**
 * POST /api/pipeline/callback
 * Receive callback from n8n with stage result.
 * Body: { executionId, projectId, stageKey, result, resumeUrl, subStage? }
 */
router.post("/callback", async (req, res) => {
  const { executionId, projectId, stageKey, result, resumeUrl, subStage } = req.body;

  if (!executionId || !projectId || !stageKey) {
    return res.status(400).json({ error: "Missing required fields", reason: "executionId, projectId, and stageKey are required" });
  }

  const execution = pipeline.getExecution(executionId);
  if (!execution) {
    console.log(`[bridge] POST /api/pipeline/callback executionId=${executionId} not found`);
    return res.status(404).json({ error: "Execution not found", reason: `No execution with id ${executionId}` });
  }

  // Store the result as an artifact — use subStage as type if provided
  const artifactType = subStage || result?.type || "stage-result";
  const artifact = artifacts.create({
    projectId,
    stageKey,
    type: artifactType,
    content: result?.content || result,
    metadata: { executionId, subStage: subStage || null, ...(result?.metadata || {}) },
  });

  // Update pipeline state
  pipeline.recordCallback({ executionId, projectId, stageKey, resumeUrl, subStage });

  console.log(`[bridge] POST /api/pipeline/callback projectId=${projectId} stageKey=${stageKey} subStage=${subStage || "none"} artifactId=${artifact.id}`);

  const actor = req.lumonUser?.login ?? null;

  // Emit SSE: stage update
  emitSSE(projectId, "stage-update", {
    stageKey,
    data: { status: "awaiting_approval", resumeUrl: !!resumeUrl, subStage: subStage || null },
  }, actor);

  // Emit SSE: artifact ready
  emitSSE(projectId, "artifact-ready", {
    stageKey,
    data: {
      artifactId: artifact.id,
      type: artifact.type,
      subStage: subStage || null,
      summary: typeof result?.content === "string" ? result.content.slice(0, 200) : "Artifact stored",
    },
  }, actor);

  // Sequential orchestration: if this is a research sub-stage, check for next
  let nextTriggered = null;
  if (stageKey === "research" && subStage) {
    const currentIndex = RESEARCH_SUB_STAGES.indexOf(subStage);
    const nextSubStage = currentIndex >= 0 && currentIndex < RESEARCH_SUB_STAGES.length - 1
      ? RESEARCH_SUB_STAGES[currentIndex + 1]
      : null;

    if (nextSubStage) {
      console.log(`[bridge] sequential-next subStage=${nextSubStage} after=${subStage}`);
      const { execution: nextExec, error: nextError } = await fireWebhook({
        projectId,
        stageKey: "research",
        subStage: nextSubStage,
      });

      if (nextError) {
        console.log(`[bridge] sequential-next subStage=${nextSubStage} failed: ${nextError}`);
      } else {
        nextTriggered = { executionId: nextExec.executionId, subStage: nextSubStage };
      }
    }
  }

  // Sequential orchestration: if this is a plan sub-stage, check for next and forward context
  if (stageKey === "plan" && subStage) {
    const currentIndex = PLAN_SUB_STAGES.indexOf(subStage);
    const nextSubStage = currentIndex >= 0 && currentIndex < PLAN_SUB_STAGES.length - 1
      ? PLAN_SUB_STAGES[currentIndex + 1]
      : null;

    if (nextSubStage) {
      // Read context from the current execution and forward it to the next sub-stage
      const currentContext = execution.context || null;
      console.log(`[bridge] sequential-next subStage=${nextSubStage} after=${subStage}`);
      const { execution: nextExec, error: nextError } = await fireWebhook({
        projectId,
        stageKey: "plan",
        subStage: nextSubStage,
        context: currentContext,
      });

      if (nextError) {
        console.log(`[bridge] sequential-next subStage=${nextSubStage} failed: ${nextError}`);
      } else {
        nextTriggered = { executionId: nextExec.executionId, subStage: nextSubStage };
      }
    }
  }

  // Sequential orchestration: if this is a verification sub-stage, check for next and forward context
  if (stageKey === "verification" && subStage) {
    const currentIndex = VERIFICATION_SUB_STAGES.indexOf(subStage);
    const nextSubStage = currentIndex >= 0 && currentIndex < VERIFICATION_SUB_STAGES.length - 1
      ? VERIFICATION_SUB_STAGES[currentIndex + 1]
      : null;

    if (nextSubStage) {
      // Read context from the current execution and forward it to the next sub-stage
      const currentContext = execution.context || null;
      console.log(`[bridge] sequential-next subStage=${nextSubStage} after=${subStage}`);
      const { execution: nextExec, error: nextError } = await fireWebhook({
        projectId,
        stageKey: "verification",
        subStage: nextSubStage,
        context: currentContext,
      });

      if (nextError) {
        console.log(`[bridge] sequential-next subStage=${nextSubStage} failed: ${nextError}`);
      } else {
        nextTriggered = { executionId: nextExec.executionId, subStage: nextSubStage };
      }
    }
  }

  res.json({ ok: true, artifactId: artifact.id, nextTriggered });
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

  // Look up execution for this project+stage
  const execution = pipeline.getStageExecution(projectId, stageKey);
  if (!execution) {
    console.log(`[bridge] POST /api/pipeline/approve projectId=${projectId} stageKey=${stageKey} no execution found`);
    return res.status(404).json({ error: "No execution found", reason: `No active execution for project ${projectId} stage ${stageKey}` });
  }

  // If approved and resumeUrl exists, call n8n to resume the workflow
  if (decision === "approved" && execution.resumeUrl) {
    try {
      const response = await fetch(execution.resumeUrl, { method: "GET" });
      if (!response.ok) {
        console.log(`[bridge] POST /api/pipeline/approve projectId=${projectId} n8n resume failed: ${response.status}`);
      }
    } catch (err) {
      console.log(`[bridge] POST /api/pipeline/approve projectId=${projectId} n8n resume unreachable: ${err.message}`);
    }
  }

  pipeline.recordApproval({ projectId, stageKey, decision });
  console.log(`[bridge] POST /api/pipeline/approve projectId=${projectId} stageKey=${stageKey} decision=${decision}`);

  const actor = req.lumonUser?.login ?? null;

  // Emit SSE: pipeline status changed after approval/rejection
  const stageExec = pipeline.getStageExecution(projectId, stageKey);
  emitSSE(projectId, "pipeline-status", {
    stageKey,
    data: { status: stageExec?.status ?? decision, decision },
  }, actor);

  // Auto-trigger research after intake approval
  let autoTriggered = null;
  if (decision === "approved" && stageKey === "intake") {
    const researchWebhookUrl = getWebhookUrl("research");
    if (researchWebhookUrl) {
      console.log(`[bridge] auto-trigger research after intake approval projectId=${projectId}`);
      const { execution: researchExec, error: researchError } = await fireWebhook({
        projectId,
        stageKey: "research",
        subStage: RESEARCH_SUB_STAGES[0],
      });

      if (researchError) {
        console.log(`[bridge] auto-trigger research failed: ${researchError}`);
      } else {
        autoTriggered = { stageKey: "research", executionId: researchExec.executionId, subStage: RESEARCH_SUB_STAGES[0] };

        emitSSE(projectId, "pipeline-status", {
          stageKey: "research",
          data: { status: "triggered", executionId: researchExec.executionId, subStage: RESEARCH_SUB_STAGES[0] },
        }, actor);
      }
    } else {
      console.log(`[bridge] auto-trigger research skipped — no webhook configured projectId=${projectId}`);
    }
  }

  // Auto-trigger verification after plan approval
  if (decision === "approved" && stageKey === "plan") {
    const verificationWebhookUrl = getWebhookUrl("verification");
    if (verificationWebhookUrl) {
      console.log(`[bridge] auto-trigger verification after plan approval projectId=${projectId}`);
      const { execution: verificationExec, error: verificationError } = await fireWebhook({
        projectId,
        stageKey: "verification",
        subStage: VERIFICATION_SUB_STAGES[0],
      });

      if (verificationError) {
        console.log(`[bridge] auto-trigger verification failed: ${verificationError}`);
      } else {
        autoTriggered = { stageKey: "verification", executionId: verificationExec.executionId, subStage: VERIFICATION_SUB_STAGES[0] };

        emitSSE(projectId, "pipeline-status", {
          stageKey: "verification",
          data: { status: "triggered", executionId: verificationExec.executionId, subStage: VERIFICATION_SUB_STAGES[0] },
        }, actor);
      }
    } else {
      console.log(`[bridge] auto-trigger verification skipped — no webhook configured projectId=${projectId}`);
    }
  }

  res.json({ ok: true, decision, autoTriggered });
});

/**
 * GET /api/pipeline/status/:projectId
 * Get current pipeline execution state for a project — returns per-stage records.
 */
router.get("/status/:projectId", (req, res) => {
  const status = pipeline.getStatus(req.params.projectId);

  console.log(`[bridge] GET /api/pipeline/status/${req.params.projectId} found=${!!status}`);

  if (!status) {
    return res.json({ projectId: req.params.projectId, status: "idle", message: "No active execution" });
  }

  res.json({ projectId: req.params.projectId, stages: status });
});

/**
 * GET /api/pipeline/artifacts/:projectId/:stageKey
 * Get all artifacts for a project + stage combination (pipeline-scoped route).
 */
router.get("/artifacts/:projectId/:stageKey", (req, res) => {
  const { projectId, stageKey } = req.params;
  const stageArtifacts = artifacts.getByProjectAndStage(projectId, stageKey);

  console.log(`[bridge] GET /api/pipeline/artifacts/${projectId}/${stageKey} count=${stageArtifacts.length}`);
  res.json(stageArtifacts);
});

export default router;
