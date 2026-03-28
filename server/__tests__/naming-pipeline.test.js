import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "../index.js";
import * as pipeline from "../pipeline.js";
import * as artifacts from "../artifacts.js";
import { getWebhookUrl, PLAN_SUB_STAGES, RESEARCH_SUB_STAGES } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DATA_DIR = path.join(__dirname, ".tmp-data-naming-pipeline");

beforeAll(() => {
  artifacts.setDataDir(TEST_DATA_DIR);
});

beforeEach(() => {
  pipeline.clear();
  artifacts.clear();
  delete process.env.N8N_WEBHOOK_URL;
  delete process.env.N8N_WEBHOOK_URL_PLAN;
  delete process.env.N8N_WEBHOOK_URL_PLAN_NAMING;
  delete process.env.N8N_WEBHOOK_URL_PLAN_DOMAIN;
  delete process.env.N8N_WEBHOOK_URL_PLAN_TRADEMARK;
  delete process.env.N8N_WEBHOOK_URL_RESEARCH;
  delete process.env.N8N_WEBHOOK_URL_INTAKE;
});

afterEach(() => {
  delete process.env.N8N_WEBHOOK_URL;
  delete process.env.N8N_WEBHOOK_URL_PLAN;
  delete process.env.N8N_WEBHOOK_URL_PLAN_NAMING;
  delete process.env.N8N_WEBHOOK_URL_PLAN_DOMAIN;
  delete process.env.N8N_WEBHOOK_URL_PLAN_TRADEMARK;
  delete process.env.N8N_WEBHOOK_URL_RESEARCH;
  delete process.env.N8N_WEBHOOK_URL_INTAKE;
});

afterAll(() => {
  artifacts.clear();
  try { fs.rmSync(TEST_DATA_DIR, { recursive: true }); } catch {}
});

// ---------------------------------------------------------------------------
// PLAN_SUB_STAGES export
// ---------------------------------------------------------------------------
describe("PLAN_SUB_STAGES config", () => {
  it("exports the correct sub-stage ordering", () => {
    expect(PLAN_SUB_STAGES).toEqual(["naming_candidates", "domain_signals", "trademark_signals"]);
  });

  it("has exactly 3 sub-stages", () => {
    expect(PLAN_SUB_STAGES).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Compound webhook registry
// ---------------------------------------------------------------------------
describe("compound webhook registry — getWebhookUrl with subStage", () => {
  it("returns compound URL when plan_naming env is set", () => {
    process.env.N8N_WEBHOOK_URL_PLAN_NAMING = "http://n8n:5678/webhook/plan-naming";
    process.env.N8N_WEBHOOK_URL_PLAN = "http://n8n:5678/webhook/plan";
    process.env.N8N_WEBHOOK_URL = "http://n8n:5678/webhook/global";

    expect(getWebhookUrl("plan", "naming_candidates")).toBe("http://n8n:5678/webhook/plan-naming");
  });

  it("falls back to stage-level when no compound key env is set", () => {
    process.env.N8N_WEBHOOK_URL_PLAN = "http://n8n:5678/webhook/plan";
    process.env.N8N_WEBHOOK_URL = "http://n8n:5678/webhook/global";

    expect(getWebhookUrl("plan", "naming_candidates")).toBe("http://n8n:5678/webhook/plan");
  });

  it("falls back to global when neither compound nor stage-level is set", () => {
    process.env.N8N_WEBHOOK_URL = "http://n8n:5678/webhook/global";

    expect(getWebhookUrl("plan", "naming_candidates")).toBe("http://n8n:5678/webhook/global");
  });

  it("returns null when nothing is configured", () => {
    expect(getWebhookUrl("plan", "naming_candidates")).toBeNull();
  });

  it("resolves plan_domain compound key", () => {
    process.env.N8N_WEBHOOK_URL_PLAN_DOMAIN = "http://n8n:5678/webhook/plan-domain";
    expect(getWebhookUrl("plan", "domain_signals")).toBe("http://n8n:5678/webhook/plan-domain");
  });

  it("resolves plan_trademark compound key", () => {
    process.env.N8N_WEBHOOK_URL_PLAN_TRADEMARK = "http://n8n:5678/webhook/plan-trademark";
    expect(getWebhookUrl("plan", "trademark_signals")).toBe("http://n8n:5678/webhook/plan-trademark");
  });

  it("backward compatible — getWebhookUrl without subStage still works", () => {
    process.env.N8N_WEBHOOK_URL_RESEARCH = "http://n8n:5678/webhook/research";
    expect(getWebhookUrl("research")).toBe("http://n8n:5678/webhook/research");
  });
});

// ---------------------------------------------------------------------------
// Plan trigger defaults
// ---------------------------------------------------------------------------
describe("plan trigger defaults to naming_candidates", () => {
  it("defaults plan stage to naming_candidates when no subStage provided", async () => {
    const res = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-plan-default", stageKey: "plan" });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("triggered");

    // Verify execution record has subStage = naming_candidates
    const exec = pipeline.getExecution(res.body.executionId);
    expect(exec.subStage).toBe("naming_candidates");
  });

  it("preserves explicit subStage when provided", async () => {
    const res = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-plan-explicit", stageKey: "plan", subStage: "domain_signals" });

    expect(res.status).toBe(201);
    const exec = pipeline.getExecution(res.body.executionId);
    expect(exec.subStage).toBe("domain_signals");
  });

  it("still defaults research to business_plan (regression)", async () => {
    const res = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-research-default", stageKey: "research" });

    expect(res.status).toBe(201);
    const exec = pipeline.getExecution(res.body.executionId);
    expect(exec.subStage).toBe("business_plan");
  });
});

// ---------------------------------------------------------------------------
// Context storage in execution record
// ---------------------------------------------------------------------------
describe("context field in execution record", () => {
  it("stores context when provided in trigger", async () => {
    const ctx = { selectedName: "Nexus" };
    const res = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-ctx", stageKey: "plan", context: ctx });

    expect(res.status).toBe(201);
    const exec = pipeline.getExecution(res.body.executionId);
    expect(exec.context).toEqual({ selectedName: "Nexus" });
  });

  it("stores null context when not provided", async () => {
    const res = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-no-ctx", stageKey: "plan" });

    expect(res.status).toBe(201);
    const exec = pipeline.getExecution(res.body.executionId);
    expect(exec.context).toBeNull();
  });

  it("pipeline.trigger() directly stores context", () => {
    const exec = pipeline.trigger({
      projectId: "proj-direct",
      stageKey: "plan",
      subStage: "naming_candidates",
      context: { selectedName: "Apex" },
    });
    expect(exec.context).toEqual({ selectedName: "Apex" });
  });
});

// ---------------------------------------------------------------------------
// Sequential plan orchestration
// ---------------------------------------------------------------------------
describe("sequential plan orchestration", () => {
  it("naming_candidates callback triggers domain_signals automatically", async () => {
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-plan-seq", stageKey: "plan" });

    const { executionId } = triggerRes.body;

    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId,
        projectId: "proj-plan-seq",
        stageKey: "plan",
        subStage: "naming_candidates",
        result: {
          type: "naming_candidates",
          content: { candidates: [{ name: "Nexus", score: 92 }] },
        },
      });

    expect(callbackRes.body.ok).toBe(true);
    expect(callbackRes.body.artifactId).toBeTruthy();
    expect(callbackRes.body.nextTriggered).toBeDefined();
    expect(callbackRes.body.nextTriggered.subStage).toBe("domain_signals");
  });

  it("domain_signals callback triggers trademark_signals automatically", async () => {
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-plan-seq2", stageKey: "plan", subStage: "domain_signals" });

    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: triggerRes.body.executionId,
        projectId: "proj-plan-seq2",
        stageKey: "plan",
        subStage: "domain_signals",
        result: {
          type: "domain_signals",
          content: { domains: [{ tld: ".com", available: true }] },
        },
      });

    expect(callbackRes.body.ok).toBe(true);
    expect(callbackRes.body.nextTriggered).toBeDefined();
    expect(callbackRes.body.nextTriggered.subStage).toBe("trademark_signals");
  });

  it("trademark_signals callback does NOT trigger another sub-stage (last in chain)", async () => {
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-plan-last", stageKey: "plan", subStage: "trademark_signals" });

    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: triggerRes.body.executionId,
        projectId: "proj-plan-last",
        stageKey: "plan",
        subStage: "trademark_signals",
        result: {
          type: "trademark_signals",
          content: { results: [{ status: "no conflict", class: 9 }] },
        },
      });

    expect(callbackRes.body.ok).toBe(true);
    expect(callbackRes.body.nextTriggered).toBeNull();
  });

  it("stores separate artifacts for each plan sub-stage", async () => {
    // naming_candidates
    const t1 = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-plan-arts", stageKey: "plan" });

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: t1.body.executionId,
        projectId: "proj-plan-arts",
        stageKey: "plan",
        subStage: "naming_candidates",
        result: { type: "naming_candidates", content: { candidates: [] } },
      });

    // domain_signals
    const t2 = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-plan-arts", stageKey: "plan", subStage: "domain_signals" });

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: t2.body.executionId,
        projectId: "proj-plan-arts",
        stageKey: "plan",
        subStage: "domain_signals",
        result: { type: "domain_signals", content: { domains: [] } },
      });

    // trademark_signals
    const t3 = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-plan-arts", stageKey: "plan", subStage: "trademark_signals" });

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: t3.body.executionId,
        projectId: "proj-plan-arts",
        stageKey: "plan",
        subStage: "trademark_signals",
        result: { type: "trademark_signals", content: { results: [] } },
      });

    const artifactsRes = await request(app).get("/api/artifacts/project/proj-plan-arts/stage/plan");
    expect(artifactsRes.status).toBe(200);
    expect(artifactsRes.body).toHaveLength(3);

    const types = artifactsRes.body.map((a) => a.type).sort();
    expect(types).toEqual(["domain_signals", "naming_candidates", "trademark_signals"]);
  });
});

// ---------------------------------------------------------------------------
// Context forwarding through sequential chain
// ---------------------------------------------------------------------------
describe("context forwarding through plan sub-stage chain", () => {
  it("context from trigger propagates to auto-fired next sub-stage", async () => {
    const ctx = { selectedName: "Nexus" };

    // Trigger naming_candidates with context
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-ctx-fwd", stageKey: "plan", context: ctx });

    const { executionId } = triggerRes.body;

    // Verify context stored on first execution
    const firstExec = pipeline.getExecution(executionId);
    expect(firstExec.context).toEqual({ selectedName: "Nexus" });

    // Callback triggers domain_signals
    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId,
        projectId: "proj-ctx-fwd",
        stageKey: "plan",
        subStage: "naming_candidates",
        result: { type: "naming_candidates", content: { candidates: [{ name: "Nexus" }] } },
      });

    expect(callbackRes.body.nextTriggered).toBeDefined();
    const nextExecId = callbackRes.body.nextTriggered.executionId;

    // Verify context forwarded to auto-fired domain_signals execution
    const nextExec = pipeline.getExecution(nextExecId);
    expect(nextExec.context).toEqual({ selectedName: "Nexus" });
    expect(nextExec.subStage).toBe("domain_signals");
  });

  it("null context does not break sequential orchestration", async () => {
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-ctx-null", stageKey: "plan" });

    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: triggerRes.body.executionId,
        projectId: "proj-ctx-null",
        stageKey: "plan",
        subStage: "naming_candidates",
        result: { type: "naming_candidates", content: { candidates: [] } },
      });

    expect(callbackRes.body.nextTriggered).toBeDefined();
    const nextExec = pipeline.getExecution(callbackRes.body.nextTriggered.executionId);
    expect(nextExec.context).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Context in webhook payload (mock fetch)
// ---------------------------------------------------------------------------
describe("context in webhook POST body", () => {
  it("includes context in webhook POST body when truthy", async () => {
    process.env.N8N_WEBHOOK_URL = "http://n8n:5678/webhook/test";

    const originalFetch = global.fetch;
    const fetchCalls = [];
    global.fetch = vi.fn().mockImplementation(async (url, opts) => {
      fetchCalls.push({ url, body: JSON.parse(opts.body) });
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      await request(app)
        .post("/api/pipeline/trigger")
        .send({
          projectId: "proj-ctx-webhook",
          stageKey: "plan",
          context: { selectedName: "Apex" },
        });

      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0].body.context).toEqual({ selectedName: "Apex" });
      expect(fetchCalls[0].body.stageKey).toBe("plan");
      expect(fetchCalls[0].body.subStage).toBe("naming_candidates");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("omits context from webhook POST body when not provided", async () => {
    process.env.N8N_WEBHOOK_URL = "http://n8n:5678/webhook/test";

    const originalFetch = global.fetch;
    const fetchCalls = [];
    global.fetch = vi.fn().mockImplementation(async (url, opts) => {
      fetchCalls.push({ url, body: JSON.parse(opts.body) });
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      await request(app)
        .post("/api/pipeline/trigger")
        .send({ projectId: "proj-no-ctx-webhook", stageKey: "plan" });

      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0].body).not.toHaveProperty("context");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("context forwarded in auto-fire webhook call", async () => {
    process.env.N8N_WEBHOOK_URL = "http://n8n:5678/webhook/test";

    const originalFetch = global.fetch;
    const fetchCalls = [];
    global.fetch = vi.fn().mockImplementation(async (url, opts) => {
      fetchCalls.push({ url, body: JSON.parse(opts.body) });
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      // Trigger with context
      const triggerRes = await request(app)
        .post("/api/pipeline/trigger")
        .send({
          projectId: "proj-ctx-autofire",
          stageKey: "plan",
          context: { selectedName: "Nova" },
        });

      // fetchCalls[0] = initial trigger webhook
      expect(fetchCalls).toHaveLength(1);

      // Callback → auto-fires domain_signals
      await request(app)
        .post("/api/pipeline/callback")
        .send({
          executionId: triggerRes.body.executionId,
          projectId: "proj-ctx-autofire",
          stageKey: "plan",
          subStage: "naming_candidates",
          result: { type: "naming_candidates", content: { candidates: [] } },
        });

      // fetchCalls[1] = auto-fired domain_signals webhook
      expect(fetchCalls).toHaveLength(2);
      expect(fetchCalls[1].body.subStage).toBe("domain_signals");
      // Credential injection (D032) adds porkbunApiKey/porkbunApiSecret for domain_signals
      expect(fetchCalls[1].body.context).toEqual({
        selectedName: "Nova",
        porkbunApiKey: null,
        porkbunApiSecret: null,
      });
    } finally {
      global.fetch = originalFetch;
    }
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility
// ---------------------------------------------------------------------------
describe("backward compatibility", () => {
  it("research orchestration still works after plan additions", async () => {
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

  it("intake lifecycle unchanged", async () => {
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-compat-intake", stageKey: "intake" });

    expect(triggerRes.status).toBe(201);
    const { executionId } = triggerRes.body;

    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId,
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

  it("non-plan/non-research stages ignore context", async () => {
    const res = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-compat-ctx", stageKey: "intake", context: { foo: "bar" } });

    expect(res.status).toBe(201);
    const exec = pipeline.getExecution(res.body.executionId);
    expect(exec.context).toEqual({ foo: "bar" });
    // context stored but doesn't affect orchestration for non-plan stages
    expect(exec.subStage).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Compound webhook routing via trigger endpoint
// ---------------------------------------------------------------------------
describe("compound webhook routing through trigger", () => {
  it("uses compound webhook URL for plan sub-stages", async () => {
    process.env.N8N_WEBHOOK_URL_PLAN_NAMING = "http://n8n:5678/webhook/plan-naming";

    const originalFetch = global.fetch;
    const fetchCalls = [];
    global.fetch = vi.fn().mockImplementation(async (url, opts) => {
      fetchCalls.push({ url });
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      await request(app)
        .post("/api/pipeline/trigger")
        .send({ projectId: "proj-compound", stageKey: "plan" });

      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0].url).toBe("http://n8n:5678/webhook/plan-naming");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
