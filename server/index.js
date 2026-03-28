import express from "express";
import cors from "cors";
import pipelineRouter from "./routes/pipeline.js";
import provisioningRouter from "./routes/provisioning.js";
import executionRouter from "./routes/execution.js";
import externalActionsRouter from "./routes/external-actions.js";
import auditRouter from "./routes/audit.js";
import * as artifacts from "./artifacts.js";
import { checkGhAvailability } from "./provisioning.js";
import { checkAgentAvailability, cleanupAllBuilds, recoverBuilds } from "./execution.js";
import { initialize as initializeDb, close as closeDb } from "./db.js";
import { authMiddleware, authRouter, createRateLimiter } from "./middleware/auth.js";
import { AUTH_CONFIG } from "./config.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Auth middleware — gates all requests behind Tailscale identity (with test/dev bypasses)
app.use(authMiddleware);

// Auth identity endpoint: GET /api/auth/identity
app.use("/api/auth", authRouter);

// Rate limiters for sensitive POST endpoints
const pipelineTriggerLimiter = createRateLimiter(
  AUTH_CONFIG.rateLimits.pipelineTrigger.maxRequests,
  AUTH_CONFIG.rateLimits.pipelineTrigger.windowMs,
);
const executionStartLimiter = createRateLimiter(
  AUTH_CONFIG.rateLimits.executionStart.maxRequests,
  AUTH_CONFIG.rateLimits.executionStart.windowMs,
);
const externalActionsExecuteLimiter = createRateLimiter(
  AUTH_CONFIG.rateLimits.externalActionsExecute.maxRequests,
  AUTH_CONFIG.rateLimits.externalActionsExecute.windowMs,
);
const provisioningExecuteLimiter = createRateLimiter(
  AUTH_CONFIG.rateLimits.provisioningExecute.maxRequests,
  AUTH_CONFIG.rateLimits.provisioningExecute.windowMs,
);

// Apply rate limiters to specific sensitive POST paths
app.post("/api/pipeline/trigger", pipelineTriggerLimiter);
app.post("/api/execution/start", executionStartLimiter);
app.post("/api/external-actions/execute/:actionId", externalActionsExecuteLimiter);
app.post("/api/provisioning/execute", provisioningExecuteLimiter);

// Pipeline endpoints: /api/pipeline/*
app.use("/api/pipeline", pipelineRouter);

// Provisioning endpoints: /api/provisioning/*
app.use("/api/provisioning", provisioningRouter);

// Build execution endpoints: /api/execution/*
app.use("/api/execution", executionRouter);

// External actions endpoints: /api/external-actions/*
app.use("/api/external-actions", externalActionsRouter);

// Audit endpoints: /api/audit/*
app.use("/api/audit", auditRouter);

// Artifact retrieval at top-level /api/artifacts/:id
// Artifacts filtered by project + stage (must be before /:id to avoid matching "project" as an id)
app.get("/api/artifacts/project/:projectId/stage/:stageKey", (req, res) => {
  const { projectId, stageKey } = req.params;
  const stageArtifacts = artifacts.getByProjectAndStage(projectId, stageKey);

  console.log(`[bridge] GET /api/artifacts/project/${projectId}/stage/${stageKey} count=${stageArtifacts.length}`);
  res.json(stageArtifacts);
});

// Single artifact by ID
app.get("/api/artifacts/:id", (req, res) => {
  const artifact = artifacts.get(req.params.id);

  if (!artifact) {
    return res.status(404).json({ error: "Artifact not found", reason: `No artifact with id ${req.params.id}` });
  }

  console.log(`[bridge] GET /api/artifacts/${req.params.id} projectId=${artifact.projectId}`);
  res.json(artifact);
});

app.listen(PORT, async () => {
  // Initialize SQLite before accepting requests (skip in test — modules use in-memory fallback)
  if (!process.env.VITEST) {
    initializeDb();

    // Recover builds that were running when the server last shut down
    const recoveryResult = recoverBuilds();
    if (recoveryResult.recovered > 0) {
      console.log(`[bridge] recovered ${recoveryResult.recovered} interrupted build(s): ${recoveryResult.interrupted.join(", ")}`);
    }
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  console.log(`[bridge] Express server listening on port ${PORT}`);
  if (webhookUrl) {
    console.log(`[bridge] n8n webhook URL configured`);
  } else {
    console.log(`[bridge] N8N_WEBHOOK_URL not set — trigger will record intent only`);
  }

  // Check gh CLI availability at startup
  const ghResult = await checkGhAvailability();
  if (ghResult.available) {
    console.log(`[bridge] gh CLI: available (version ${ghResult.version})`);
  } else {
    console.log(`[bridge] gh CLI: NOT AVAILABLE — provisioning will fail. Install: https://cli.github.com`);
  }

  // Check agent CLI availability at startup
  for (const agentType of ["claude", "codex"]) {
    const agentResult = await checkAgentAvailability(agentType);
    if (agentResult.available) {
      console.log(`[bridge] ${agentType} CLI: available (version ${agentResult.version})`);
    } else {
      console.log(`[bridge] ${agentType} CLI: not available — builds with this agent will return 503`);
    }
  }
});

// ---------------------------------------------------------------------------
// Graceful shutdown — kill active agent processes before exit
// ---------------------------------------------------------------------------

function handleShutdown(signal) {
  console.log(`[bridge] received ${signal} — cleaning up active builds…`);
  const result = cleanupAllBuilds();
  console.log(
    `[bridge] cleanup complete: ${result.killed} killed, ${result.alreadyDead} already dead, ${result.errors.length} errors`,
  );
  closeDb();
  process.exit(0);
}

process.once("SIGTERM", () => handleShutdown("SIGTERM"));
process.once("SIGINT", () => handleShutdown("SIGINT"));

export default app;
