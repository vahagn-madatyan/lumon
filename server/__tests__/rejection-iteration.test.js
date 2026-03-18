import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "../index.js";
import * as pipeline from "../pipeline.js";
import * as artifacts from "../artifacts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DATA_DIR = path.join(__dirname, ".tmp-data-rejection-iteration");

beforeAll(() => {
  artifacts.setDataDir(TEST_DATA_DIR);
});

beforeEach(() => {
  pipeline.clear();
  artifacts.clear();
  // Clear all webhook env vars so triggers record intent without firing fetch
  delete process.env.N8N_WEBHOOK_URL;
  delete process.env.N8N_WEBHOOK_URL_INTAKE;
  delete process.env.N8N_WEBHOOK_URL_RESEARCH;
  delete process.env.N8N_WEBHOOK_URL_PLAN;
  delete process.env.N8N_WEBHOOK_URL_VERIFICATION;
});

afterEach(() => {
  delete process.env.N8N_WEBHOOK_URL;
  delete process.env.N8N_WEBHOOK_URL_INTAKE;
  delete process.env.N8N_WEBHOOK_URL_RESEARCH;
  delete process.env.N8N_WEBHOOK_URL_PLAN;
  delete process.env.N8N_WEBHOOK_URL_VERIFICATION;
});

afterAll(() => {
  artifacts.clear();
  try { fs.rmSync(TEST_DATA_DIR, { recursive: true }); } catch {}
});

// ---------------------------------------------------------------------------
// Reject → re-trigger → approve lifecycle (single stage)
// ---------------------------------------------------------------------------
describe("reject → re-trigger → approve lifecycle", () => {
  it("completes cleanly for a single stage", async () => {
    const PROJECT = "rej-lifecycle";

    // 1. Trigger intake
    const triggerRes1 = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: PROJECT, stageKey: "intake" });
    expect(triggerRes1.status).toBe(201);
    const execId1 = triggerRes1.body.executionId;

    // 2. Callback with result
    const callbackRes1 = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: execId1,
        projectId: PROJECT,
        stageKey: "intake",
        result: { type: "viability_analysis", content: { score: 55, verdict: "marginal" } },
        resumeUrl: "http://n8n:5678/resume/r1",
      });
    expect(callbackRes1.status).toBe(200);
    expect(callbackRes1.body.ok).toBe(true);

    // 3. Reject
    const rejectRes = await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: PROJECT, stageKey: "intake", decision: "rejected" });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.decision).toBe("rejected");

    // Verify the execution is now rejected
    const rejectedExec = pipeline.getStageExecution(PROJECT, "intake");
    expect(rejectedExec.status).toBe("rejected");

    // 4. Re-trigger same stage — should get NEW executionId
    const triggerRes2 = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: PROJECT, stageKey: "intake" });
    expect(triggerRes2.status).toBe(201);
    const execId2 = triggerRes2.body.executionId;
    expect(execId2).not.toBe(execId1);

    // 5. New callback with improved result
    const callbackRes2 = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: execId2,
        projectId: PROJECT,
        stageKey: "intake",
        result: { type: "viability_analysis", content: { score: 88, verdict: "strong" } },
        resumeUrl: "http://n8n:5678/resume/r2",
      });
    expect(callbackRes2.status).toBe(200);

    // 6. Verify 2 artifacts accumulated (one from each callback)
    const intakeArtifacts = artifacts.getByProjectAndStage(PROJECT, "intake");
    expect(intakeArtifacts).toHaveLength(2);

    // 7. Approve
    const approveRes = await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: PROJECT, stageKey: "intake", decision: "approved" });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.decision).toBe("approved");

    // 8. Verify final state is approved
    const statusRes = await request(app).get(`/api/pipeline/status/${PROJECT}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.stages.intake.status).toBe("approved");
  });
});

// ---------------------------------------------------------------------------
// Rejection doesn't affect other stages
// ---------------------------------------------------------------------------
describe("rejection doesn't affect other stages", () => {
  it("rejecting research leaves intake approved and its artifacts intact", async () => {
    const PROJECT = "rej-cross-stage";

    // Complete intake: trigger → callback → approve
    const intakeTrigger = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: PROJECT, stageKey: "intake" });
    const intakeExecId = intakeTrigger.body.executionId;

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: intakeExecId,
        projectId: PROJECT,
        stageKey: "intake",
        result: { type: "viability_analysis", content: { score: 92 } },
        resumeUrl: "http://n8n:5678/resume/intake",
      });

    await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: PROJECT, stageKey: "intake", decision: "approved" });

    // Verify intake is approved
    expect(pipeline.getStageExecution(PROJECT, "intake").status).toBe("approved");

    // Trigger research manually (no webhook configured, so no auto-trigger)
    const researchTrigger = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: PROJECT, stageKey: "research" });
    const researchExecId = researchTrigger.body.executionId;

    // Research callback
    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: researchExecId,
        projectId: PROJECT,
        stageKey: "research",
        subStage: "business_plan",
        result: { type: "business_plan", content: { plan: "v1" } },
      });

    // REJECT research
    await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: PROJECT, stageKey: "research", decision: "rejected" });

    // Verify research is rejected
    expect(pipeline.getStageExecution(PROJECT, "research").status).toBe("rejected");

    // Verify intake is STILL approved (not corrupted)
    expect(pipeline.getStageExecution(PROJECT, "intake").status).toBe("approved");

    // Verify intake artifacts still exist
    const intakeArtifacts = artifacts.getByProjectAndStage(PROJECT, "intake");
    expect(intakeArtifacts).toHaveLength(1);
    expect(intakeArtifacts[0].type).toBe("viability_analysis");

    // Re-trigger research → callback → approve → verify clean
    const researchRetrigger = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: PROJECT, stageKey: "research" });
    const researchExecId2 = researchRetrigger.body.executionId;
    expect(researchExecId2).not.toBe(researchExecId);

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: researchExecId2,
        projectId: PROJECT,
        stageKey: "research",
        subStage: "business_plan",
        result: { type: "business_plan", content: { plan: "v2-improved" } },
      });

    await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: PROJECT, stageKey: "research", decision: "approved" });

    // Verify research is now approved
    expect(pipeline.getStageExecution(PROJECT, "research").status).toBe("approved");

    // Verify intake is STILL approved
    expect(pipeline.getStageExecution(PROJECT, "intake").status).toBe("approved");
  });
});

// ---------------------------------------------------------------------------
// Multiple rejections accumulate artifacts correctly
// ---------------------------------------------------------------------------
describe("multiple rejections accumulate artifacts", () => {
  it("three iterations produce 3 artifacts, final state is approved", async () => {
    const PROJECT = "rej-multi";

    // Iteration 1: trigger → callback → reject
    const t1 = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: PROJECT, stageKey: "intake" });
    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: t1.body.executionId,
        projectId: PROJECT,
        stageKey: "intake",
        result: { type: "viability_analysis", content: { score: 40, iteration: 1 } },
      });
    await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: PROJECT, stageKey: "intake", decision: "rejected" });

    // Iteration 2: re-trigger → callback → reject
    const t2 = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: PROJECT, stageKey: "intake" });
    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: t2.body.executionId,
        projectId: PROJECT,
        stageKey: "intake",
        result: { type: "viability_analysis", content: { score: 60, iteration: 2 } },
      });
    await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: PROJECT, stageKey: "intake", decision: "rejected" });

    // Iteration 3: re-trigger → callback → approve
    const t3 = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: PROJECT, stageKey: "intake" });
    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: t3.body.executionId,
        projectId: PROJECT,
        stageKey: "intake",
        result: { type: "viability_analysis", content: { score: 90, iteration: 3 } },
      });
    await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: PROJECT, stageKey: "intake", decision: "approved" });

    // Verify 3 artifacts total (one per callback, all accumulated)
    const intakeArtifacts = artifacts.getByProjectAndStage(PROJECT, "intake");
    expect(intakeArtifacts).toHaveLength(3);

    // Verify final execution state is approved
    expect(pipeline.getStageExecution(PROJECT, "intake").status).toBe("approved");

    // Verify status endpoint reflects approved state
    const statusRes = await request(app).get(`/api/pipeline/status/${PROJECT}`);
    expect(statusRes.body.stages.intake.status).toBe("approved");
  });
});

// ---------------------------------------------------------------------------
// Re-trigger after rejection creates new execution record
// ---------------------------------------------------------------------------
describe("re-trigger after rejection creates new execution", () => {
  it("returns different executionId and getStageExecution points to latest", async () => {
    const PROJECT = "rej-new-exec";

    // Trigger → callback → reject
    const t1 = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: PROJECT, stageKey: "intake" });
    const execId1 = t1.body.executionId;

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: execId1,
        projectId: PROJECT,
        stageKey: "intake",
        result: { type: "viability_analysis", content: { score: 30 } },
      });
    await request(app)
      .post("/api/pipeline/approve")
      .send({ projectId: PROJECT, stageKey: "intake", decision: "rejected" });

    // Re-trigger
    const t2 = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: PROJECT, stageKey: "intake" });
    const execId2 = t2.body.executionId;

    // Verify different executionId
    expect(execId2).not.toBe(execId1);

    // Verify getStageExecution returns the LATEST execution (the re-triggered one)
    const latestExec = pipeline.getStageExecution(PROJECT, "intake");
    expect(latestExec.executionId).toBe(execId2);
    expect(latestExec.status).toBe("triggered");

    // The old rejected execution still exists by ID but is no longer the "current" one
    const oldExec = pipeline.getExecution(execId1);
    expect(oldExec.status).toBe("rejected");
  });
});
