import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "../index.js";
import * as pipeline from "../pipeline.js";
import * as artifacts from "../artifacts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DATA_DIR = path.join(__dirname, ".tmp-data-pipeline-api");

// Track the server instance to close after tests
let server;

beforeAll(() => {
  artifacts.setDataDir(TEST_DATA_DIR);
});

beforeEach(() => {
  pipeline.clear();
  artifacts.clear();
});

afterEach(() => {
  if (server) {
    server.close();
    server = null;
  }
});

afterAll(() => {
  artifacts.clear();
  try { fs.rmSync(TEST_DATA_DIR, { recursive: true }); } catch {}
});

describe("POST /api/pipeline/trigger", () => {
  it("creates an execution and returns executionId + status", async () => {
    const res = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-1", stageKey: "discovery" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("executionId");
    expect(res.body.status).toBe("triggered");
  });

  it("returns 400 when projectId is missing", async () => {
    const res = await request(app)
      .post("/api/pipeline/trigger")
      .send({ stageKey: "discovery" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Missing required fields");
  });

  it("returns 400 when stageKey is missing", async () => {
    const res = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Missing required fields");
  });
});

describe("POST /api/pipeline/callback", () => {
  it("stores artifact and updates execution to awaiting_approval", async () => {
    // First trigger an execution
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-1", stageKey: "discovery" });

    const { executionId } = triggerRes.body;

    const res = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId,
        projectId: "proj-1",
        stageKey: "discovery",
        result: {
          type: "viability-analysis",
          content: { score: 85, summary: "Strong market fit" },
          metadata: { model: "gpt-4" },
        },
        resumeUrl: "http://n8n:5678/webhook-waiting/abc-123",
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body).toHaveProperty("artifactId");

    // Verify artifact was persisted
    const artifactRes = await request(app).get(`/api/artifacts/${res.body.artifactId}`);
    expect(artifactRes.status).toBe(200);
    expect(artifactRes.body.projectId).toBe("proj-1");
    expect(artifactRes.body.stageKey).toBe("discovery");
    expect(artifactRes.body.content).toEqual({ score: 85, summary: "Strong market fit" });

    // Verify execution state updated (status endpoint returns per-stage records)
    const statusRes = await request(app).get("/api/pipeline/status/proj-1");
    expect(statusRes.body.stages.discovery.status).toBe("awaiting_approval");
    expect(statusRes.body.stages.discovery.resumeUrl).toBe("http://n8n:5678/webhook-waiting/abc-123");
  });

  it("returns 404 for callback with unknown executionId", async () => {
    const res = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: "nonexistent-id",
        projectId: "proj-1",
        stageKey: "discovery",
        result: { content: "test" },
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Execution not found");
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/pipeline/callback")
      .send({ result: { content: "test" } });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Missing required fields");
  });
});

describe("POST /api/pipeline/approve", () => {
  it("approves a stage and updates execution status", async () => {
    // Set up: trigger → callback → approve
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-2", stageKey: "discovery" });

    const { executionId } = triggerRes.body;

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId,
        projectId: "proj-2",
        stageKey: "discovery",
        result: { content: "analysis result" },
      });

    const res = await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: "proj-2", stageKey: "discovery", decision: "approved" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.decision).toBe("approved");

    // Verify execution state (per-stage)
    const statusRes = await request(app).get("/api/pipeline/status/proj-2");
    expect(statusRes.body.stages.discovery.status).toBe("approved");
    expect(statusRes.body.stages.discovery.completedAt).toBeTruthy();
  });

  it("rejects a stage and updates execution status", async () => {
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-3", stageKey: "discovery" });

    const { executionId } = triggerRes.body;

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId,
        projectId: "proj-3",
        stageKey: "discovery",
        result: { content: "poor fit" },
      });

    const res = await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: "proj-3", stageKey: "discovery", decision: "rejected" });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe("rejected");

    const statusRes = await request(app).get("/api/pipeline/status/proj-3");
    expect(statusRes.body.stages.discovery.status).toBe("rejected");
  });

  it("returns 404 for approve with non-existent project", async () => {
    const res = await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: "ghost-project", stageKey: "discovery", decision: "approved" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("No execution found");
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: "proj-1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Missing required fields");
  });
});

describe("GET /api/artifacts/:id", () => {
  it("returns a stored artifact by ID", async () => {
    // Create artifact via callback flow
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-4", stageKey: "research" });

    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: triggerRes.body.executionId,
        projectId: "proj-4",
        stageKey: "research",
        result: {
          type: "market-research",
          content: { competitors: ["A", "B", "C"] },
        },
      });

    const res = await request(app).get(`/api/artifacts/${callbackRes.body.artifactId}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(callbackRes.body.artifactId);
    expect(res.body.projectId).toBe("proj-4");
    expect(res.body.type).toBe("market-research");
    expect(res.body.content).toEqual({ competitors: ["A", "B", "C"] });
    expect(res.body).toHaveProperty("createdAt");
  });

  it("returns 404 for non-existent artifact", async () => {
    const res = await request(app).get("/api/artifacts/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Artifact not found");
  });
});

describe("GET /api/pipeline/status/:projectId", () => {
  it("returns current execution state for a project", async () => {
    await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-5", stageKey: "naming" });

    const res = await request(app).get("/api/pipeline/status/proj-5");

    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe("proj-5");
    expect(res.body.stages.naming.status).toBe("triggered");
    expect(res.body.stages.naming.stageKey).toBe("naming");
    expect(res.body.stages.naming).toHaveProperty("executionId");
    expect(res.body.stages.naming).toHaveProperty("triggeredAt");
  });

  it("returns idle status for project with no executions", async () => {
    const res = await request(app).get("/api/pipeline/status/unknown-project");

    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe("unknown-project");
    expect(res.body.status).toBe("idle");
  });
});

describe("full lifecycle: trigger → callback → approve", () => {
  it("tracks the complete pipeline execution lifecycle", async () => {
    // 1. Trigger
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-lifecycle", stageKey: "discovery" });

    expect(triggerRes.body.status).toBe("triggered");
    const { executionId } = triggerRes.body;

    // 2. Callback with result
    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId,
        projectId: "proj-lifecycle",
        stageKey: "discovery",
        result: {
          type: "viability",
          content: { viable: true, confidence: 0.92 },
        },
        resumeUrl: "http://n8n:5678/webhook-waiting/lifecycle-test",
      });

    expect(callbackRes.body.ok).toBe(true);

    // Verify awaiting approval (per-stage)
    let status = await request(app).get("/api/pipeline/status/proj-lifecycle");
    expect(status.body.stages.discovery.status).toBe("awaiting_approval");

    // 3. Approve
    const approveRes = await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: "proj-lifecycle", stageKey: "discovery", decision: "approved" });

    expect(approveRes.body.decision).toBe("approved");

    // Verify final state (per-stage)
    status = await request(app).get("/api/pipeline/status/proj-lifecycle");
    expect(status.body.stages.discovery.status).toBe("approved");
    expect(status.body.stages.discovery.completedAt).toBeTruthy();

    // Verify artifact is retrievable
    const artifactRes = await request(app).get(`/api/artifacts/${callbackRes.body.artifactId}`);
    expect(artifactRes.body.content).toEqual({ viable: true, confidence: 0.92 });
  });
});
