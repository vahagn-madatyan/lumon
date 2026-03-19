import { Router } from "express";
import * as artifacts from "../artifacts.js";
import * as provisioning from "../provisioning.js";
import { emitSSE } from "./pipeline.js";

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/provisioning/preview
// Build a provisioning plan without side effects.
// Body: { projectId }
// ---------------------------------------------------------------------------

router.post("/preview", (req, res) => {
  const { projectId } = req.body;

  if (!projectId) {
    return res.status(400).json({
      error: "Missing required field",
      reason: "projectId is required",
    });
  }

  const projectArtifacts = artifacts.getByProject(projectId);
  const plan = provisioning.preview(projectId, { artifacts: projectArtifacts });

  console.log(`[provisioning] POST /api/provisioning/preview projectId=${projectId} files=${plan.files.length}`);
  res.json(plan);
});

// ---------------------------------------------------------------------------
// POST /api/provisioning/execute
// Start provisioning. Returns 201 immediately; emits SSE events for progress.
// Body: { projectId, repoName?, isPrivate?, workspacePath?, engineChoice? }
// ---------------------------------------------------------------------------

router.post("/execute", async (req, res) => {
  const { projectId, repoName, isPrivate, workspacePath, engineChoice } = req.body;

  if (!projectId) {
    return res.status(400).json({
      error: "Missing required field",
      reason: "projectId is required",
    });
  }

  // Check if provisioning is already in progress for this project
  const existing = provisioning.getStatus(projectId);
  if (existing && existing.status === "running") {
    return res.status(409).json({
      error: "Provisioning already in progress",
      reason: `Project ${projectId} is already being provisioned`,
    });
  }

  const projectArtifacts = artifacts.getByProject(projectId);

  // Respond immediately — provisioning runs async
  console.log(`[provisioning] POST /api/provisioning/execute projectId=${projectId} engineChoice=${engineChoice || "claude"}`);
  res.status(201).json({ projectId, status: "running" });

  // Run provisioning with SSE step updates
  try {
    await provisioning.provision(projectId, {
      name: repoName || projectId,
      isPrivate: isPrivate !== false,
      workspacePath,
      engineChoice: engineChoice || "claude",
      artifacts: projectArtifacts,
      onStepUpdate: (stepName, status, error) => {
        emitSSE(projectId, "provisioning-progress", {
          step: stepName,
          status,
          ...(error ? { error } : {}),
        });
      },
    });

    emitSSE(projectId, "provisioning-complete", {
      status: "complete",
    });
    console.log(`[provisioning] provisioning-complete projectId=${projectId}`);
  } catch (err) {
    const record = provisioning.getStatus(projectId);
    const failedStep = record?.steps?.find((s) => s.status === "failed");
    emitSSE(projectId, "provisioning-error", {
      step: failedStep?.name || "unknown",
      error: err.message,
    });
    console.error(`[provisioning] provisioning-error projectId=${projectId}: ${err.message}`);
  }
});

// ---------------------------------------------------------------------------
// GET /api/provisioning/status/:projectId
// Returns current provisioning state, or { status: 'idle' } if none exists.
// ---------------------------------------------------------------------------

router.get("/status/:projectId", (req, res) => {
  const { projectId } = req.params;
  const status = provisioning.getStatus(projectId);

  console.log(`[provisioning] GET /api/provisioning/status/${projectId} status=${status?.status ?? "idle"}`);

  if (!status) {
    return res.json({ projectId, status: "idle" });
  }

  res.json(status);
});

export default router;
