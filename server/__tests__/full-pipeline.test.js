import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "../index.js";
import * as pipeline from "../pipeline.js";
import * as artifacts from "../artifacts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DATA_DIR = path.join(__dirname, ".tmp-data-full-pipeline");

let originalFetch;
let fetchCalls;

beforeAll(() => {
  artifacts.setDataDir(TEST_DATA_DIR);
});

beforeEach(() => {
  pipeline.clear();
  artifacts.clear();
  fetchCalls = [];

  // Configure a global webhook so all auto-triggers fire
  process.env.N8N_WEBHOOK_URL = "http://n8n:5678/webhook/global";

  // Mock fetch to capture all webhook calls and return success
  originalFetch = global.fetch;
  global.fetch = vi.fn().mockImplementation(async (url, opts) => {
    fetchCalls.push({ url, body: opts?.body ? JSON.parse(opts.body) : null });
    return { ok: true, json: async () => ({ ok: true }) };
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.N8N_WEBHOOK_URL;
});

afterAll(() => {
  artifacts.clear();
  try { fs.rmSync(TEST_DATA_DIR, { recursive: true }); } catch {}
});

// ---------------------------------------------------------------------------
// Full pipeline: intake → research → plan → verification
// ---------------------------------------------------------------------------
describe("full pipeline integration", () => {
  it("drives all 4 stages to approved with 9 total artifacts", async () => {
    const PROJECT = "full-pipeline-e2e";

    // -----------------------------------------------------------------------
    // INTAKE: trigger → callback → approve → auto-trigger research
    // -----------------------------------------------------------------------
    const intakeTrigger = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: PROJECT, stageKey: "intake" });
    expect(intakeTrigger.status).toBe(201);
    const intakeExecId = intakeTrigger.body.executionId;

    // Intake callback with viability_analysis artifact
    const intakeCallback = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: intakeExecId,
        projectId: PROJECT,
        stageKey: "intake",
        result: {
          type: "viability_analysis",
          content: {
            score: 92,
            market: "SaaS productivity tools",
            verdict: "strong opportunity",
          },
        },
        resumeUrl: "http://n8n:5678/resume/intake",
      });
    expect(intakeCallback.body.ok).toBe(true);

    // Approve intake → should auto-trigger research (webhook is configured)
    fetchCalls = []; // Reset to isolate auto-trigger calls
    const intakeApprove = await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: PROJECT, stageKey: "intake", decision: "approved" });
    expect(intakeApprove.body.ok).toBe(true);
    expect(intakeApprove.body.decision).toBe("approved");
    expect(intakeApprove.body.autoTriggered).not.toBeNull();
    expect(intakeApprove.body.autoTriggered.stageKey).toBe("research");

    const researchExecId1 = intakeApprove.body.autoTriggered.executionId;

    // Verify fetch was called for auto-trigger (research webhook + resume URL)
    const autoTriggerCalls = fetchCalls.filter((c) => c.body?.stageKey === "research");
    expect(autoTriggerCalls.length).toBeGreaterThanOrEqual(1);

    // -----------------------------------------------------------------------
    // RESEARCH: business_plan callback → auto-trigger tech_stack → callback → approve
    // -----------------------------------------------------------------------

    // business_plan callback → should auto-trigger tech_stack
    fetchCalls = [];
    const researchCb1 = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: researchExecId1,
        projectId: PROJECT,
        stageKey: "research",
        subStage: "business_plan",
        result: {
          type: "business_plan",
          content: {
            revenue_model: "subscription",
            tam: "$2.4B",
            competitors: ["Notion", "Linear"],
          },
        },
      });
    expect(researchCb1.body.ok).toBe(true);
    expect(researchCb1.body.nextTriggered).toBeDefined();
    expect(researchCb1.body.nextTriggered.subStage).toBe("tech_stack");

    const techStackExecId = researchCb1.body.nextTriggered.executionId;

    // tech_stack callback (last research sub-stage — no next)
    const researchCb2 = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: techStackExecId,
        projectId: PROJECT,
        stageKey: "research",
        subStage: "tech_stack",
        result: {
          type: "tech_stack",
          content: {
            frontend: "React + Vite",
            backend: "Node.js + Express",
            database: "PostgreSQL",
          },
        },
      });
    expect(researchCb2.body.ok).toBe(true);
    expect(researchCb2.body.nextTriggered).toBeNull();

    // Approve research
    const researchApprove = await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: PROJECT, stageKey: "research", decision: "approved" });
    expect(researchApprove.body.ok).toBe(true);

    // -----------------------------------------------------------------------
    // PLAN: trigger → naming_candidates → domain_signals → trademark_signals → approve → auto-trigger verification
    // -----------------------------------------------------------------------

    // Manually trigger plan (research→plan auto-trigger is not implemented)
    const planTrigger = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: PROJECT, stageKey: "plan" });
    expect(planTrigger.status).toBe(201);
    const planExecId1 = planTrigger.body.executionId;

    // Verify plan defaults to naming_candidates
    const planExec = pipeline.getExecution(planExecId1);
    expect(planExec.subStage).toBe("naming_candidates");

    // naming_candidates callback → auto-trigger domain_signals
    fetchCalls = [];
    const planCb1 = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: planExecId1,
        projectId: PROJECT,
        stageKey: "plan",
        subStage: "naming_candidates",
        result: {
          type: "naming_candidates",
          content: {
            candidates: [
              { name: "Nexus", score: 95 },
              { name: "Apex", score: 88 },
              { name: "Vantage", score: 82 },
            ],
          },
        },
      });
    expect(planCb1.body.ok).toBe(true);
    expect(planCb1.body.nextTriggered).toBeDefined();
    expect(planCb1.body.nextTriggered.subStage).toBe("domain_signals");

    const domainExecId = planCb1.body.nextTriggered.executionId;

    // domain_signals callback → auto-trigger trademark_signals
    const planCb2 = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: domainExecId,
        projectId: PROJECT,
        stageKey: "plan",
        subStage: "domain_signals",
        result: {
          type: "domain_signals",
          content: {
            domains: [
              { name: "nexus.io", available: false },
              { name: "getnexus.com", available: true },
            ],
          },
        },
      });
    expect(planCb2.body.ok).toBe(true);
    expect(planCb2.body.nextTriggered).toBeDefined();
    expect(planCb2.body.nextTriggered.subStage).toBe("trademark_signals");

    const trademarkExecId = planCb2.body.nextTriggered.executionId;

    // trademark_signals callback (last plan sub-stage — no next)
    const planCb3 = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: trademarkExecId,
        projectId: PROJECT,
        stageKey: "plan",
        subStage: "trademark_signals",
        result: {
          type: "trademark_signals",
          content: {
            results: [
              { name: "Nexus", status: "conflict in class 9", risk: "high" },
              { name: "Apex", status: "no conflict", risk: "low" },
            ],
          },
        },
      });
    expect(planCb3.body.ok).toBe(true);
    expect(planCb3.body.nextTriggered).toBeNull();

    // Approve plan → should auto-trigger verification
    fetchCalls = [];
    const planApprove = await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: PROJECT, stageKey: "plan", decision: "approved" });
    expect(planApprove.body.ok).toBe(true);
    expect(planApprove.body.autoTriggered).not.toBeNull();
    expect(planApprove.body.autoTriggered.stageKey).toBe("verification");

    const verificationExecId1 = planApprove.body.autoTriggered.executionId;

    // Verify auto-trigger webhook fired for verification
    const verificationTriggerCalls = fetchCalls.filter((c) => c.body?.stageKey === "verification");
    expect(verificationTriggerCalls.length).toBeGreaterThanOrEqual(1);

    // -----------------------------------------------------------------------
    // VERIFICATION: architecture_outline → specification → prototype_scaffold → approve
    // -----------------------------------------------------------------------

    // architecture_outline callback → auto-trigger specification
    fetchCalls = [];
    const verifCb1 = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: verificationExecId1,
        projectId: PROJECT,
        stageKey: "verification",
        subStage: "architecture_outline",
        result: {
          type: "architecture_outline",
          content: {
            layers: ["presentation", "business", "data"],
            patterns: ["repository", "service", "controller"],
            components: [
              { name: "API Gateway", type: "server" },
              { name: "Auth Service", type: "service" },
            ],
          },
        },
      });
    expect(verifCb1.body.ok).toBe(true);
    expect(verifCb1.body.nextTriggered).toBeDefined();
    expect(verifCb1.body.nextTriggered.subStage).toBe("specification");

    const specExecId = verifCb1.body.nextTriggered.executionId;

    // specification callback → auto-trigger prototype_scaffold
    const verifCb2 = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: specExecId,
        projectId: PROJECT,
        stageKey: "verification",
        subStage: "specification",
        result: {
          type: "specification",
          content: {
            endpoints: [
              { path: "/api/users", method: "GET", description: "List users" },
              { path: "/api/projects", method: "POST", description: "Create project" },
            ],
            dataModels: [
              { name: "User", fields: ["id", "email", "name"] },
              { name: "Project", fields: ["id", "name", "status"] },
            ],
          },
        },
      });
    expect(verifCb2.body.ok).toBe(true);
    expect(verifCb2.body.nextTriggered).toBeDefined();
    expect(verifCb2.body.nextTriggered.subStage).toBe("prototype_scaffold");

    const protoExecId = verifCb2.body.nextTriggered.executionId;

    // prototype_scaffold callback (last verification sub-stage — no next)
    const verifCb3 = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: protoExecId,
        projectId: PROJECT,
        stageKey: "verification",
        subStage: "prototype_scaffold",
        result: {
          type: "prototype_scaffold",
          content: {
            structure: {
              "src/index.ts": "entry point",
              "src/routes/api.ts": "API routes",
              "src/models/user.ts": "User model",
            },
            commands: {
              install: "npm install",
              dev: "npm run dev",
              build: "npm run build",
            },
          },
        },
      });
    expect(verifCb3.body.ok).toBe(true);
    expect(verifCb3.body.nextTriggered).toBeNull();

    // Approve verification
    const verifApprove = await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: PROJECT, stageKey: "verification", decision: "approved" });
    expect(verifApprove.body.ok).toBe(true);

    // -----------------------------------------------------------------------
    // FINAL STATE CHECKS
    // -----------------------------------------------------------------------

    // 1. Status endpoint returns all 4 stages
    const statusRes = await request(app).get(`/api/pipeline/status/${PROJECT}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.stages).toBeDefined();

    const stages = statusRes.body.stages;
    expect(stages.intake).toBeDefined();
    expect(stages.research).toBeDefined();
    expect(stages.plan).toBeDefined();
    expect(stages.verification).toBeDefined();

    // 2. All stages show approved status
    expect(stages.intake.status).toBe("approved");
    expect(stages.research.status).toBe("approved");
    expect(stages.plan.status).toBe("approved");
    expect(stages.verification.status).toBe("approved");

    // 3. Artifact counts per stage
    const intakeArtifacts = artifacts.getByProjectAndStage(PROJECT, "intake");
    expect(intakeArtifacts).toHaveLength(1);
    expect(intakeArtifacts[0].type).toBe("viability_analysis");

    const researchArtifacts = artifacts.getByProjectAndStage(PROJECT, "research");
    expect(researchArtifacts).toHaveLength(2);
    const researchTypes = researchArtifacts.map((a) => a.type).sort();
    expect(researchTypes).toEqual(["business_plan", "tech_stack"]);

    const planArtifacts = artifacts.getByProjectAndStage(PROJECT, "plan");
    expect(planArtifacts).toHaveLength(3);
    const planTypes = planArtifacts.map((a) => a.type).sort();
    expect(planTypes).toEqual(["domain_signals", "naming_candidates", "trademark_signals"]);

    const verificationArtifacts = artifacts.getByProjectAndStage(PROJECT, "verification");
    expect(verificationArtifacts).toHaveLength(3);
    const verifTypes = verificationArtifacts.map((a) => a.type).sort();
    expect(verifTypes).toEqual(["architecture_outline", "prototype_scaffold", "specification"]);

    // 4. Total artifacts across all stages = 9
    const allArtifacts = [
      ...intakeArtifacts,
      ...researchArtifacts,
      ...planArtifacts,
      ...verificationArtifacts,
    ];
    expect(allArtifacts).toHaveLength(9);

    // 5. Verify artifact content is realistic (not empty)
    expect(intakeArtifacts[0].content.score).toBe(92);
    expect(researchArtifacts.find((a) => a.type === "business_plan").content.revenue_model).toBe("subscription");
    expect(planArtifacts.find((a) => a.type === "naming_candidates").content.candidates).toHaveLength(3);
    expect(verificationArtifacts.find((a) => a.type === "architecture_outline").content.layers).toHaveLength(3);
  });

  it("auto-trigger chains are proven: intake→research and plan→verification", async () => {
    const PROJECT = "auto-trigger-proof";

    // Trigger intake
    const intakeTrigger = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: PROJECT, stageKey: "intake" });

    // Intake callback
    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: intakeTrigger.body.executionId,
        projectId: PROJECT,
        stageKey: "intake",
        result: { type: "viability_analysis", content: { score: 85 } },
        resumeUrl: "http://n8n:5678/resume/intake",
      });

    // Approve intake → verify auto-trigger research
    fetchCalls = [];
    const intakeApprove = await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: PROJECT, stageKey: "intake", decision: "approved" });

    expect(intakeApprove.body.autoTriggered).not.toBeNull();
    expect(intakeApprove.body.autoTriggered.stageKey).toBe("research");
    expect(intakeApprove.body.autoTriggered.subStage).toBe("business_plan");

    // Now test plan→verification auto-trigger
    // Set up plan stage (trigger, complete all sub-stages)
    const planTrigger = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: PROJECT, stageKey: "plan" });

    // Quick-complete all plan sub-stages
    const planExecId = planTrigger.body.executionId;
    const cb1 = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: planExecId,
        projectId: PROJECT,
        stageKey: "plan",
        subStage: "naming_candidates",
        result: { type: "naming_candidates", content: { candidates: [] } },
      });

    const cb2 = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: cb1.body.nextTriggered.executionId,
        projectId: PROJECT,
        stageKey: "plan",
        subStage: "domain_signals",
        result: { type: "domain_signals", content: { domains: [] } },
      });

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: cb2.body.nextTriggered.executionId,
        projectId: PROJECT,
        stageKey: "plan",
        subStage: "trademark_signals",
        result: { type: "trademark_signals", content: { results: [] } },
      });

    // Approve plan → verify auto-trigger verification
    fetchCalls = [];
    const planApprove = await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: PROJECT, stageKey: "plan", decision: "approved" });

    expect(planApprove.body.autoTriggered).not.toBeNull();
    expect(planApprove.body.autoTriggered.stageKey).toBe("verification");
    expect(planApprove.body.autoTriggered.subStage).toBe("architecture_outline");
  });

  it("sequential orchestration proven for all multi-sub-stage stages", { timeout: 15000 }, async () => {
    const PROJECT = "seq-orch-proof";

    // --- Research: business_plan → tech_stack ---
    const researchTrigger = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: PROJECT, stageKey: "research" });

    const researchCb1 = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: researchTrigger.body.executionId,
        projectId: PROJECT,
        stageKey: "research",
        subStage: "business_plan",
        result: { type: "business_plan", content: { plan: true } },
      });
    expect(researchCb1.body.nextTriggered.subStage).toBe("tech_stack");

    const researchCb2 = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: researchCb1.body.nextTriggered.executionId,
        projectId: PROJECT,
        stageKey: "research",
        subStage: "tech_stack",
        result: { type: "tech_stack", content: { stack: true } },
      });
    expect(researchCb2.body.nextTriggered).toBeNull();

    // --- Plan: naming_candidates → domain_signals → trademark_signals ---
    const planTrigger = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: PROJECT, stageKey: "plan" });

    const planCb1 = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: planTrigger.body.executionId,
        projectId: PROJECT,
        stageKey: "plan",
        subStage: "naming_candidates",
        result: { type: "naming_candidates", content: { candidates: [] } },
      });
    expect(planCb1.body.nextTriggered.subStage).toBe("domain_signals");

    const planCb2 = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: planCb1.body.nextTriggered.executionId,
        projectId: PROJECT,
        stageKey: "plan",
        subStage: "domain_signals",
        result: { type: "domain_signals", content: { domains: [] } },
      });
    expect(planCb2.body.nextTriggered.subStage).toBe("trademark_signals");

    const planCb3 = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: planCb2.body.nextTriggered.executionId,
        projectId: PROJECT,
        stageKey: "plan",
        subStage: "trademark_signals",
        result: { type: "trademark_signals", content: { results: [] } },
      });
    expect(planCb3.body.nextTriggered).toBeNull();

    // --- Verification: architecture_outline → specification → prototype_scaffold ---
    const verifTrigger = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: PROJECT, stageKey: "verification" });

    const verifCb1 = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: verifTrigger.body.executionId,
        projectId: PROJECT,
        stageKey: "verification",
        subStage: "architecture_outline",
        result: { type: "architecture_outline", content: { layers: [] } },
      });
    expect(verifCb1.body.nextTriggered.subStage).toBe("specification");

    const verifCb2 = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: verifCb1.body.nextTriggered.executionId,
        projectId: PROJECT,
        stageKey: "verification",
        subStage: "specification",
        result: { type: "specification", content: { endpoints: [] } },
      });
    expect(verifCb2.body.nextTriggered.subStage).toBe("prototype_scaffold");

    const verifCb3 = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: verifCb2.body.nextTriggered.executionId,
        projectId: PROJECT,
        stageKey: "verification",
        subStage: "prototype_scaffold",
        result: { type: "prototype_scaffold", content: { structure: {} } },
      });
    expect(verifCb3.body.nextTriggered).toBeNull();
  });
});
