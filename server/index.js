import express from "express";
import cors from "cors";
import pipelineRouter from "./routes/pipeline.js";
import provisioningRouter from "./routes/provisioning.js";
import * as artifacts from "./artifacts.js";
import { checkGhAvailability } from "./provisioning.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Pipeline endpoints: /api/pipeline/*
app.use("/api/pipeline", pipelineRouter);

// Provisioning endpoints: /api/provisioning/*
app.use("/api/provisioning", provisioningRouter);

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
});

export default app;
