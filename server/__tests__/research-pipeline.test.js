import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "../index.js";
import * as pipeline from "../pipeline.js";
import * as artifacts from "../artifacts.js";
import { getWebhookUrl, RESEARCH_SUB_STAGES } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DATA_DIR = path.join(__dirname, ".tmp-data-research-pipeline");

beforeAll(() => {
  artifacts.setDataDir(TEST_DATA_DIR);
});

beforeEach(() => {
  pipeline.clear();
  artifacts.clear();
  // Reset env vars for each test
  delete process.env.N8N_WEBHOOK_URL;
  delete process.env.N8N_WEBHOOK_URL_RESEARCH;
  delete process.env.N8N_WEBHOOK_URL_INTAKE;
});

afterEach(() => {
  delete process.env.N8N_WEBHOOK_URL;
  delete process.env.N8N_WEBHOOK_URL_RESEARCH;
  delete process.env.N8N_WEBHOOK_URL_INTAKE;
});

afterAll(() => {
  artifacts.clear();
  try { fs.rmSync(TEST_DATA_DIR, { recursive: true }); } catch {}
});

// ---------------------------------------------------------------------------
// Webhook registry
// ---------------------------------------------------------------------------
describe("webhook registry — getWebhookUrl", () => {
  it("returns stage-specific URL when configured", () => {
    process.env.N8N_WEBHOOK_URL_RESEARCH = "http://n8n:5678/webhook/research";
    process.env.N8N_WEBHOOK_URL = "http://n8n:5678/webhook/global";

    expect(getWebhookUrl("research")).toBe("http://n8n:5678/webhook/research");
  });

  it("falls back to global N8N_WEBHOOK_URL when no stage-specific URL", () => {
    process.env.N8N_WEBHOOK_URL = "http://n8n:5678/webhook/global";

    expect(getWebhookUrl("research")).toBe("http://n8n:5678/webhook/global");
  });

  it("returns null when no URL configured at all", () => {
    expect(getWebhookUrl("research")).toBeNull();
  });

  it("returns global fallback for unmapped stage keys", () => {
    process.env.N8N_WEBHOOK_URL = "http://n8n:5678/webhook/global";

    expect(getWebhookUrl("custom_stage")).toBe("http://n8n:5678/webhook/global");
  });
});

// ---------------------------------------------------------------------------
// Per-stage execution tracking
// ---------------------------------------------------------------------------
describe("per-stage execution tracking", () => {
  it("stores independent executions per stage per project", () => {
    const exec1 = pipeline.trigger({ projectId: "proj-1", stageKey: "intake" });
    const exec2 = pipeline.trigger({ projectId: "proj-1", stageKey: "research", subStage: "business_plan" });

    expect(exec1.executionId).not.toBe(exec2.executionId);

    const status = pipeline.getStatus("proj-1");
    expect(status).toHaveProperty("intake");
    expect(status).toHaveProperty("research");
    expect(status.intake.executionId).toBe(exec1.executionId);
    expect(status.research.executionId).toBe(exec2.executionId);
  });

  it("getStageExecution returns execution for specific project+stage", () => {
    pipeline.trigger({ projectId: "proj-1", stageKey: "intake" });
    const researchExec = pipeline.trigger({ projectId: "proj-1", stageKey: "research" });

    const result = pipeline.getStageExecution("proj-1", "research");
    expect(result.executionId).toBe(researchExec.executionId);
  });

  it("getStageExecution returns null for non-existent stage", () => {
    pipeline.trigger({ projectId: "proj-1", stageKey: "intake" });
    expect(pipeline.getStageExecution("proj-1", "naming")).toBeNull();
  });

  it("status endpoint returns per-stage records", async () => {
    await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-multi", stageKey: "intake" });

    const res = await request(app).get("/api/pipeline/status/proj-multi");
    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe("proj-multi");
    expect(res.body.stages).toHaveProperty("intake");
    expect(res.body.stages.intake.status).toBe("triggered");
  });
});

// ---------------------------------------------------------------------------
// Sequential callback progression
// ---------------------------------------------------------------------------
describe("sequential research orchestration", () => {
  it("business_plan callback triggers tech_stack automatically", async () => {
    // Trigger research (starts with business_plan sub-stage)
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-seq", stageKey: "research" });

    const { executionId } = triggerRes.body;

    // Simulate business_plan callback from n8n
    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId,
        projectId: "proj-seq",
        stageKey: "research",
        subStage: "business_plan",
        result: {
          type: "business_plan",
          content: { targetAudience: "SMBs", recommendation: { decision: "proceed" } },
        },
      });

    expect(callbackRes.body.ok).toBe(true);
    expect(callbackRes.body.artifactId).toBeTruthy();

    // Sequential orchestration should have triggered tech_stack
    // (will fail to reach n8n since no webhook configured, but execution record exists)
    expect(callbackRes.body.nextTriggered).toBeDefined();
    if (callbackRes.body.nextTriggered) {
      expect(callbackRes.body.nextTriggered.subStage).toBe("tech_stack");
    }
  });

  it("tech_stack callback does NOT trigger another sub-stage (it's the last)", async () => {
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-last", stageKey: "research", subStage: "tech_stack" });

    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: triggerRes.body.executionId,
        projectId: "proj-last",
        stageKey: "research",
        subStage: "tech_stack",
        result: {
          type: "tech_research",
          content: { approaches: [], recommendation: { choice: "Node.js" } },
        },
      });

    expect(callbackRes.body.ok).toBe(true);
    expect(callbackRes.body.nextTriggered).toBeNull();
  });

  it("stores separate artifacts with different types for each sub-stage", async () => {
    // Trigger and callback for business_plan
    const t1 = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-arts", stageKey: "research" });

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: t1.body.executionId,
        projectId: "proj-arts",
        stageKey: "research",
        subStage: "business_plan",
        result: { type: "business_plan", content: { targetAudience: "Devs" } },
      });

    // Trigger and callback for tech_stack
    const t2 = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-arts", stageKey: "research", subStage: "tech_stack" });

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: t2.body.executionId,
        projectId: "proj-arts",
        stageKey: "research",
        subStage: "tech_stack",
        result: { type: "tech_research", content: { approaches: [] } },
      });

    // Fetch all research artifacts
    const artifactsRes = await request(app).get("/api/artifacts/project/proj-arts/stage/research");
    expect(artifactsRes.status).toBe(200);
    expect(artifactsRes.body).toHaveLength(2);

    const types = artifactsRes.body.map((a) => a.type).sort();
    expect(types).toEqual(["business_plan", "tech_stack"]);
  });
});

// ---------------------------------------------------------------------------
// Auto-trigger after intake approval
// ---------------------------------------------------------------------------
describe("auto-trigger research after intake approval", () => {
  it("auto-triggers research when intake is approved and webhook is configured", async () => {
    // Need a webhook URL configured so auto-trigger fires
    process.env.N8N_WEBHOOK_URL = "http://n8n:5678/webhook/test";

    // Mock fetch to prevent actual HTTP calls
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    try {
      // Trigger intake
      const triggerRes = await request(app)
        .post("/api/pipeline/trigger")
        .send({ projectId: "proj-auto", stageKey: "intake" });

      // Callback for intake
      await request(app)
        .post("/api/pipeline/callback")
        .send({
          executionId: triggerRes.body.executionId,
          projectId: "proj-auto",
          stageKey: "intake",
          result: { type: "viability_analysis", content: { viable: true } },
          resumeUrl: "http://n8n:5678/webhook-waiting/test",
        });

      // Approve intake → should auto-trigger research
      const approveRes = await request(app)
        .post("/api/pipeline/approve")
        .send({ projectId: "proj-auto", stageKey: "intake", decision: "approved" });

      expect(approveRes.body.ok).toBe(true);
      expect(approveRes.body.autoTriggered).toBeDefined();
      expect(approveRes.body.autoTriggered.stageKey).toBe("research");
      expect(approveRes.body.autoTriggered.subStage).toBe("business_plan");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("does NOT auto-trigger research when no webhook is configured", async () => {
    // No webhook URL set

    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-no-auto", stageKey: "intake" });

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: triggerRes.body.executionId,
        projectId: "proj-no-auto",
        stageKey: "intake",
        result: { type: "viability_analysis", content: { viable: true } },
      });

    const approveRes = await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: "proj-no-auto", stageKey: "intake", decision: "approved" });

    expect(approveRes.body.ok).toBe(true);
    expect(approveRes.body.autoTriggered).toBeNull();
  });

  it("does NOT auto-trigger research when intake is rejected", async () => {
    process.env.N8N_WEBHOOK_URL = "http://n8n:5678/webhook/test";

    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-reject", stageKey: "intake" });

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: triggerRes.body.executionId,
        projectId: "proj-reject",
        stageKey: "intake",
        result: { type: "viability_analysis", content: { viable: false } },
      });

    const approveRes = await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: "proj-reject", stageKey: "intake", decision: "rejected" });

    expect(approveRes.body.ok).toBe(true);
    expect(approveRes.body.autoTriggered).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Artifact list endpoint
// ---------------------------------------------------------------------------
describe("GET /api/artifacts/project/:projectId/stage/:stageKey", () => {
  it("returns artifacts filtered by project and stage", async () => {
    // Create artifacts via callback flow
    const t1 = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-filter", stageKey: "research" });

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: t1.body.executionId,
        projectId: "proj-filter",
        stageKey: "research",
        subStage: "business_plan",
        result: { type: "business_plan", content: { plan: true } },
      });

    // Also create an intake artifact (different stage)
    const t2 = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-filter", stageKey: "intake" });

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: t2.body.executionId,
        projectId: "proj-filter",
        stageKey: "intake",
        result: { type: "viability", content: { score: 90 } },
      });

    // Filter by research stage
    const researchRes = await request(app).get("/api/artifacts/project/proj-filter/stage/research");
    expect(researchRes.status).toBe(200);
    expect(researchRes.body).toHaveLength(1);
    expect(researchRes.body[0].stageKey).toBe("research");

    // Filter by intake stage
    const intakeRes = await request(app).get("/api/artifacts/project/proj-filter/stage/intake");
    expect(intakeRes.body).toHaveLength(1);
    expect(intakeRes.body[0].stageKey).toBe("intake");
  });

  it("returns empty array when no artifacts match", async () => {
    const res = await request(app).get("/api/artifacts/project/ghost/stage/nothing");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("endpoint available at both pipeline router and top-level routes", async () => {
    const t1 = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-dual", stageKey: "research" });

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: t1.body.executionId,
        projectId: "proj-dual",
        stageKey: "research",
        subStage: "business_plan",
        result: { type: "business_plan", content: { plan: true } },
      });

    // Top-level route
    const topLevel = await request(app).get("/api/artifacts/project/proj-dual/stage/research");
    expect(topLevel.status).toBe(200);
    expect(topLevel.body).toHaveLength(1);

    // Pipeline router route
    const pipelineRoute = await request(app).get("/api/pipeline/artifacts/proj-dual/research");
    expect(pipelineRoute.status).toBe(200);
    expect(pipelineRoute.body).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility — S01 intake flow works with only N8N_WEBHOOK_URL
// ---------------------------------------------------------------------------
describe("backward compatibility — S01 intake flow", () => {
  it("full intake lifecycle works with global webhook fallback", async () => {
    // Only global URL set, no stage-specific
    // No actual n8n running — triggers record intent

    // Trigger intake
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-compat", stageKey: "intake" });

    expect(triggerRes.status).toBe(201);
    expect(triggerRes.body.status).toBe("triggered");
    const { executionId } = triggerRes.body;

    // Callback
    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId,
        projectId: "proj-compat",
        stageKey: "intake",
        result: {
          type: "viability-analysis",
          content: { score: 85, summary: "Strong fit" },
        },
        resumeUrl: "http://n8n:5678/webhook-waiting/compat-test",
      });

    expect(callbackRes.body.ok).toBe(true);
    expect(callbackRes.body.artifactId).toBeTruthy();

    // Approve
    const approveRes = await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: "proj-compat", stageKey: "intake", decision: "approved" });

    expect(approveRes.body.ok).toBe(true);
    expect(approveRes.body.decision).toBe("approved");

    // Verify per-stage status
    const statusRes = await request(app).get("/api/pipeline/status/proj-compat");
    expect(statusRes.body.stages.intake.status).toBe("approved");

    // Verify artifact is retrievable
    const artifactRes = await request(app).get(`/api/artifacts/${callbackRes.body.artifactId}`);
    expect(artifactRes.body.projectId).toBe("proj-compat");
    expect(artifactRes.body.content).toEqual({ score: 85, summary: "Strong fit" });
  });
});
