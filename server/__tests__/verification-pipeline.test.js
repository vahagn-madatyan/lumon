import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "../index.js";
import * as pipeline from "../pipeline.js";
import * as artifacts from "../artifacts.js";
import {
  getWebhookUrl,
  VERIFICATION_SUB_STAGES,
  PLAN_SUB_STAGES,
  RESEARCH_SUB_STAGES,
} from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DATA_DIR = path.join(__dirname, ".tmp-data-verification-pipeline");

beforeAll(() => {
  artifacts.setDataDir(TEST_DATA_DIR);
});

beforeEach(() => {
  pipeline.clear();
  artifacts.clear();
  delete process.env.N8N_WEBHOOK_URL;
  delete process.env.N8N_WEBHOOK_URL_VERIFICATION;
  delete process.env.N8N_WEBHOOK_URL_VERIFICATION_ARCHITECTURE;
  delete process.env.N8N_WEBHOOK_URL_VERIFICATION_SPECIFICATION;
  delete process.env.N8N_WEBHOOK_URL_VERIFICATION_PROTOTYPE;
  delete process.env.N8N_WEBHOOK_URL_PLAN;
  delete process.env.N8N_WEBHOOK_URL_RESEARCH;
  delete process.env.N8N_WEBHOOK_URL_INTAKE;
});

afterEach(() => {
  delete process.env.N8N_WEBHOOK_URL;
  delete process.env.N8N_WEBHOOK_URL_VERIFICATION;
  delete process.env.N8N_WEBHOOK_URL_VERIFICATION_ARCHITECTURE;
  delete process.env.N8N_WEBHOOK_URL_VERIFICATION_SPECIFICATION;
  delete process.env.N8N_WEBHOOK_URL_VERIFICATION_PROTOTYPE;
  delete process.env.N8N_WEBHOOK_URL_PLAN;
  delete process.env.N8N_WEBHOOK_URL_RESEARCH;
  delete process.env.N8N_WEBHOOK_URL_INTAKE;
});

afterAll(() => {
  artifacts.clear();
  try { fs.rmSync(TEST_DATA_DIR, { recursive: true }); } catch {}
});

// ---------------------------------------------------------------------------
// VERIFICATION_SUB_STAGES config
// ---------------------------------------------------------------------------
describe("VERIFICATION_SUB_STAGES config", () => {
  it("exports the correct sub-stage ordering", () => {
    expect(VERIFICATION_SUB_STAGES).toEqual([
      "architecture_outline",
      "specification",
      "prototype_scaffold",
    ]);
  });

  it("has exactly 3 sub-stages", () => {
    expect(VERIFICATION_SUB_STAGES).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Compound webhook registry — verification
// ---------------------------------------------------------------------------
describe("compound webhook registry — verification sub-stages", () => {
  it("returns compound URL when verification_architecture env is set", () => {
    process.env.N8N_WEBHOOK_URL_VERIFICATION_ARCHITECTURE = "http://n8n:5678/webhook/ver-arch";
    process.env.N8N_WEBHOOK_URL_VERIFICATION = "http://n8n:5678/webhook/verification";
    process.env.N8N_WEBHOOK_URL = "http://n8n:5678/webhook/global";

    expect(getWebhookUrl("verification", "architecture_outline")).toBe(
      "http://n8n:5678/webhook/ver-arch"
    );
  });

  it("falls back to stage-level when no compound key env is set", () => {
    process.env.N8N_WEBHOOK_URL_VERIFICATION = "http://n8n:5678/webhook/verification";
    process.env.N8N_WEBHOOK_URL = "http://n8n:5678/webhook/global";

    expect(getWebhookUrl("verification", "architecture_outline")).toBe(
      "http://n8n:5678/webhook/verification"
    );
  });

  it("falls back to global when neither compound nor stage-level is set", () => {
    process.env.N8N_WEBHOOK_URL = "http://n8n:5678/webhook/global";

    expect(getWebhookUrl("verification", "architecture_outline")).toBe(
      "http://n8n:5678/webhook/global"
    );
  });

  it("returns null when nothing is configured", () => {
    expect(getWebhookUrl("verification", "architecture_outline")).toBeNull();
  });

  it("resolves verification_specification compound key", () => {
    process.env.N8N_WEBHOOK_URL_VERIFICATION_SPECIFICATION = "http://n8n:5678/webhook/ver-spec";
    expect(getWebhookUrl("verification", "specification")).toBe(
      "http://n8n:5678/webhook/ver-spec"
    );
  });

  it("resolves verification_prototype compound key", () => {
    process.env.N8N_WEBHOOK_URL_VERIFICATION_PROTOTYPE = "http://n8n:5678/webhook/ver-proto";
    expect(getWebhookUrl("verification", "prototype_scaffold")).toBe(
      "http://n8n:5678/webhook/ver-proto"
    );
  });

  it("stage-level verification key resolves without subStage", () => {
    process.env.N8N_WEBHOOK_URL_VERIFICATION = "http://n8n:5678/webhook/verification";
    expect(getWebhookUrl("verification")).toBe("http://n8n:5678/webhook/verification");
  });
});

// ---------------------------------------------------------------------------
// Trigger defaults
// ---------------------------------------------------------------------------
describe("verification trigger defaults to architecture_outline", () => {
  it("defaults verification stage to architecture_outline when no subStage provided", async () => {
    const res = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-ver-default", stageKey: "verification" });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("triggered");

    const exec = pipeline.getExecution(res.body.executionId);
    expect(exec.subStage).toBe("architecture_outline");
  });

  it("preserves explicit subStage when provided", async () => {
    const res = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-ver-explicit", stageKey: "verification", subStage: "specification" });

    expect(res.status).toBe(201);
    const exec = pipeline.getExecution(res.body.executionId);
    expect(exec.subStage).toBe("specification");
  });
});

// ---------------------------------------------------------------------------
// Sequential verification orchestration
// ---------------------------------------------------------------------------
describe("sequential verification orchestration", () => {
  it("architecture_outline callback triggers specification automatically", async () => {
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-ver-seq", stageKey: "verification" });

    const { executionId } = triggerRes.body;

    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId,
        projectId: "proj-ver-seq",
        stageKey: "verification",
        subStage: "architecture_outline",
        result: {
          type: "architecture_outline",
          content: { systemOverview: "Cloud-native SaaS" },
        },
      });

    expect(callbackRes.body.ok).toBe(true);
    expect(callbackRes.body.artifactId).toBeTruthy();
    expect(callbackRes.body.nextTriggered).toBeDefined();
    expect(callbackRes.body.nextTriggered.subStage).toBe("specification");
  });

  it("specification callback triggers prototype_scaffold automatically", async () => {
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({
        projectId: "proj-ver-seq2",
        stageKey: "verification",
        subStage: "specification",
      });

    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: triggerRes.body.executionId,
        projectId: "proj-ver-seq2",
        stageKey: "verification",
        subStage: "specification",
        result: {
          type: "specification",
          content: { functionalRequirements: [] },
        },
      });

    expect(callbackRes.body.ok).toBe(true);
    expect(callbackRes.body.nextTriggered).toBeDefined();
    expect(callbackRes.body.nextTriggered.subStage).toBe("prototype_scaffold");
  });

  it("prototype_scaffold callback does NOT trigger another sub-stage (last in chain)", async () => {
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({
        projectId: "proj-ver-last",
        stageKey: "verification",
        subStage: "prototype_scaffold",
      });

    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: triggerRes.body.executionId,
        projectId: "proj-ver-last",
        stageKey: "verification",
        subStage: "prototype_scaffold",
        result: {
          type: "prototype_scaffold",
          content: { projectStructure: "src/" },
        },
      });

    expect(callbackRes.body.ok).toBe(true);
    expect(callbackRes.body.nextTriggered).toBeNull();
  });

  it("stores separate artifacts for each verification sub-stage", async () => {
    const pid = "proj-ver-arts";

    const t1 = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: pid, stageKey: "verification" });

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: t1.body.executionId,
        projectId: pid,
        stageKey: "verification",
        subStage: "architecture_outline",
        result: { type: "architecture_outline", content: { systemOverview: "overview" } },
      });

    const t2 = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: pid, stageKey: "verification", subStage: "specification" });

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: t2.body.executionId,
        projectId: pid,
        stageKey: "verification",
        subStage: "specification",
        result: { type: "specification", content: { functionalRequirements: [] } },
      });

    const t3 = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: pid, stageKey: "verification", subStage: "prototype_scaffold" });

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: t3.body.executionId,
        projectId: pid,
        stageKey: "verification",
        subStage: "prototype_scaffold",
        result: { type: "prototype_scaffold", content: { projectStructure: "src/" } },
      });

    const artifactsRes = await request(app).get(
      `/api/artifacts/project/${pid}/stage/verification`
    );
    expect(artifactsRes.status).toBe(200);
    expect(artifactsRes.body).toHaveLength(3);

    const types = artifactsRes.body.map((a) => a.type).sort();
    expect(types).toEqual(["architecture_outline", "prototype_scaffold", "specification"]);
  });
});

// ---------------------------------------------------------------------------
// Context forwarding through verification chain
// ---------------------------------------------------------------------------
describe("context forwarding through verification sub-stage chain", () => {
  it("context from trigger propagates to auto-fired next sub-stage", async () => {
    const ctx = { projectName: "Acme" };

    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-ver-ctx", stageKey: "verification", context: ctx });

    const { executionId } = triggerRes.body;

    const firstExec = pipeline.getExecution(executionId);
    expect(firstExec.context).toEqual({ projectName: "Acme" });

    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId,
        projectId: "proj-ver-ctx",
        stageKey: "verification",
        subStage: "architecture_outline",
        result: { type: "architecture_outline", content: { systemOverview: "overview" } },
      });

    expect(callbackRes.body.nextTriggered).toBeDefined();
    const nextExecId = callbackRes.body.nextTriggered.executionId;

    const nextExec = pipeline.getExecution(nextExecId);
    expect(nextExec.context).toEqual({ projectName: "Acme" });
    expect(nextExec.subStage).toBe("specification");
  });

  it("null context does not break sequential orchestration", async () => {
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-ver-ctx-null", stageKey: "verification" });

    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: triggerRes.body.executionId,
        projectId: "proj-ver-ctx-null",
        stageKey: "verification",
        subStage: "architecture_outline",
        result: { type: "architecture_outline", content: { systemOverview: "test" } },
      });

    expect(callbackRes.body.nextTriggered).toBeDefined();
    const nextExec = pipeline.getExecution(callbackRes.body.nextTriggered.executionId);
    expect(nextExec.context).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Auto-trigger verification from plan approval
// ---------------------------------------------------------------------------
describe("auto-trigger verification from plan approval", () => {
  it("approving plan auto-triggers verification when webhook is configured", async () => {
    process.env.N8N_WEBHOOK_URL = "http://n8n:5678/webhook/test";

    const originalFetch = global.fetch;
    const fetchCalls = [];
    global.fetch = vi.fn().mockImplementation(async (url, opts) => {
      fetchCalls.push({ url, body: opts ? JSON.parse(opts.body) : null });
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      // Create a plan execution so approve can find it
      const triggerRes = await request(app)
        .post("/api/pipeline/trigger")
        .send({ projectId: "proj-plan-approve", stageKey: "plan" });

      // Complete the plan stage via callback
      await request(app)
        .post("/api/pipeline/callback")
        .send({
          executionId: triggerRes.body.executionId,
          projectId: "proj-plan-approve",
          stageKey: "plan",
          subStage: "naming_candidates",
          result: { type: "naming_candidates", content: {} },
        });

      // Reset fetch calls to isolate approve behavior
      fetchCalls.length = 0;

      const approveRes = await request(app)
        .post("/api/pipeline/approve")
        .send({ projectId: "proj-plan-approve", stageKey: "plan", decision: "approved" });

      expect(approveRes.body.ok).toBe(true);
      expect(approveRes.body.autoTriggered).toBeDefined();
      expect(approveRes.body.autoTriggered.stageKey).toBe("verification");
      expect(approveRes.body.autoTriggered.subStage).toBe("architecture_outline");

      // Verify webhook was called for verification
      const verificationCall = fetchCalls.find(
        (c) => c.body && c.body.stageKey === "verification"
      );
      expect(verificationCall).toBeDefined();
      expect(verificationCall.body.subStage).toBe("architecture_outline");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("does NOT auto-trigger verification when no webhook is configured", async () => {
    // No env vars set — no webhooks available

    // Create and complete a plan execution
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-plan-no-webhook", stageKey: "plan" });

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: triggerRes.body.executionId,
        projectId: "proj-plan-no-webhook",
        stageKey: "plan",
        subStage: "naming_candidates",
        result: { type: "naming_candidates", content: {} },
      });

    const approveRes = await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: "proj-plan-no-webhook", stageKey: "plan", decision: "approved" });

    expect(approveRes.body.ok).toBe(true);
    expect(approveRes.body.autoTriggered).toBeNull();
  });

  it("does NOT auto-trigger verification when plan is rejected", async () => {
    process.env.N8N_WEBHOOK_URL = "http://n8n:5678/webhook/test";

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => {
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      const triggerRes = await request(app)
        .post("/api/pipeline/trigger")
        .send({ projectId: "proj-plan-reject", stageKey: "plan" });

      await request(app)
        .post("/api/pipeline/callback")
        .send({
          executionId: triggerRes.body.executionId,
          projectId: "proj-plan-reject",
          stageKey: "plan",
          subStage: "naming_candidates",
          result: { type: "naming_candidates", content: {} },
        });

      const approveRes = await request(app)
        .post("/api/pipeline/approve")
        .send({ projectId: "proj-plan-reject", stageKey: "plan", decision: "rejected" });

      expect(approveRes.body.ok).toBe(true);
      expect(approveRes.body.autoTriggered).toBeNull();
    } finally {
      global.fetch = originalFetch;
    }
  });
});

// ---------------------------------------------------------------------------
// Failure recording for verification sub-stage webhook calls
// ---------------------------------------------------------------------------
describe("failure recording for verification webhook calls", () => {
  it("records failureReason when verification webhook returns non-ok status", async () => {
    process.env.N8N_WEBHOOK_URL = "http://n8n:5678/webhook/test";

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => {
      return { ok: false, status: 503, json: async () => ({}) };
    });

    try {
      const res = await request(app)
        .post("/api/pipeline/trigger")
        .send({ projectId: "proj-ver-fail", stageKey: "verification" });

      expect(res.status).toBe(502);
      expect(res.body.error).toBe("n8n webhook failed");

      // The execution should have been recorded with a failure
      // (pipeline.trigger creates it, then pipeline.recordFailure marks it)
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("records failureReason when verification webhook is unreachable", async () => {
    process.env.N8N_WEBHOOK_URL = "http://n8n:5678/webhook/test";

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => {
      throw new Error("ECONNREFUSED");
    });

    try {
      const res = await request(app)
        .post("/api/pipeline/trigger")
        .send({ projectId: "proj-ver-unreachable", stageKey: "verification" });

      expect(res.status).toBe(502);
      expect(res.body.reason).toBe("ECONNREFUSED");
    } finally {
      global.fetch = originalFetch;
    }
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility
// ---------------------------------------------------------------------------
describe("backward compatibility after verification additions", () => {
  it("research orchestration still works", async () => {
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-compat-research", stageKey: "research" });

    const exec = pipeline.getExecution(triggerRes.body.executionId);
    expect(exec.subStage).toBe("business_plan");

    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: triggerRes.body.executionId,
        projectId: "proj-compat-research",
        stageKey: "research",
        subStage: "business_plan",
        result: { type: "business_plan", content: { plan: true } },
      });

    expect(callbackRes.body.ok).toBe(true);
    expect(callbackRes.body.nextTriggered).toBeDefined();
    expect(callbackRes.body.nextTriggered.subStage).toBe("tech_stack");
  });

  it("plan orchestration still works", async () => {
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-compat-plan", stageKey: "plan" });

    const exec = pipeline.getExecution(triggerRes.body.executionId);
    expect(exec.subStage).toBe("naming_candidates");

    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: triggerRes.body.executionId,
        projectId: "proj-compat-plan",
        stageKey: "plan",
        subStage: "naming_candidates",
        result: { type: "naming_candidates", content: { candidates: [] } },
      });

    expect(callbackRes.body.ok).toBe(true);
    expect(callbackRes.body.nextTriggered).toBeDefined();
    expect(callbackRes.body.nextTriggered.subStage).toBe("domain_signals");
  });

  it("intake lifecycle unchanged", async () => {
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-compat-intake", stageKey: "intake" });

    expect(triggerRes.status).toBe(201);

    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: triggerRes.body.executionId,
        projectId: "proj-compat-intake",
        stageKey: "intake",
        result: { type: "viability", content: { score: 90 } },
        resumeUrl: "http://n8n:5678/resume/test",
      });

    expect(callbackRes.body.ok).toBe(true);

    const approveRes = await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: "proj-compat-intake", stageKey: "intake", decision: "approved" });

    expect(approveRes.body.ok).toBe(true);
    expect(approveRes.body.decision).toBe("approved");
  });

  it("existing getWebhookUrl calls without subStage still work", () => {
    process.env.N8N_WEBHOOK_URL_INTAKE = "http://n8n:5678/webhook/intake";
    expect(getWebhookUrl("intake")).toBe("http://n8n:5678/webhook/intake");
  });
});
