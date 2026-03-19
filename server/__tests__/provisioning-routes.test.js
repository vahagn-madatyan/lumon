import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import app from "../index.js";
import * as provisioning from "../provisioning.js";
import * as artifacts from "../artifacts.js";

beforeEach(() => {
  provisioning.clear();
  artifacts.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/provisioning/preview", () => {
  it("returns a provisioning plan for a valid projectId", async () => {
    // Seed an artifact so preview has something to include
    artifacts.create({
      projectId: "proj-prev",
      stageKey: "research",
      type: "viability_analysis",
      content: { marketAssessment: "Good" },
    });

    const res = await request(app)
      .post("/api/provisioning/preview")
      .send({ projectId: "proj-prev" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("repoName");
    expect(res.body).toHaveProperty("workspacePath");
    expect(res.body).toHaveProperty("engineChoice");
    expect(res.body).toHaveProperty("files");
    expect(res.body).toHaveProperty("steps");
    expect(Array.isArray(res.body.files)).toBe(true);
    expect(Array.isArray(res.body.steps)).toBe(true);
    // Should have artifact file + GSD bootstrap files
    expect(res.body.files.length).toBeGreaterThanOrEqual(6);
  });

  it("returns a plan with no artifacts when project has none", async () => {
    const res = await request(app)
      .post("/api/provisioning/preview")
      .send({ projectId: "proj-empty" });

    expect(res.status).toBe(200);
    expect(res.body.repoName).toBe("proj-empty");
    // Should still have GSD bootstrap files
    expect(res.body.files.length).toBe(5);
  });

  it("returns 400 when projectId is missing", async () => {
    const res = await request(app)
      .post("/api/provisioning/preview")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Missing required field");
    expect(res.body.reason).toContain("projectId");
  });
});

describe("POST /api/provisioning/execute", () => {
  it("starts provisioning and returns 201 with running status", async () => {
    // Mock provision to resolve immediately
    const provisionSpy = vi.spyOn(provisioning, "provision").mockResolvedValue({
      projectId: "proj-exec",
      status: "complete",
      steps: [],
    });

    const res = await request(app)
      .post("/api/provisioning/execute")
      .send({ projectId: "proj-exec", engineChoice: "claude" });

    expect(res.status).toBe(201);
    expect(res.body.projectId).toBe("proj-exec");
    expect(res.body.status).toBe("running");

    // Wait a tick for the async provision call to be invoked
    await vi.waitFor(() => {
      expect(provisionSpy).toHaveBeenCalledOnce();
    });

    // Verify the provision was called with correct params
    const callArgs = provisionSpy.mock.calls[0];
    expect(callArgs[0]).toBe("proj-exec");
    expect(callArgs[1]).toHaveProperty("engineChoice", "claude");
    expect(callArgs[1]).toHaveProperty("onStepUpdate");
    expect(typeof callArgs[1].onStepUpdate).toBe("function");
  });

  it("returns 400 when projectId is missing", async () => {
    const res = await request(app)
      .post("/api/provisioning/execute")
      .send({ engineChoice: "claude" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Missing required field");
    expect(res.body.reason).toContain("projectId");
  });

  it("returns 409 when provisioning is already running", async () => {
    // Seed a "running" provisioning state by calling provision with a mock that never resolves
    vi.spyOn(provisioning, "provision").mockReturnValue(new Promise(() => {}));

    // Start first provisioning
    await request(app)
      .post("/api/provisioning/execute")
      .send({ projectId: "proj-conflict" });

    // getStatus won't return "running" because mock doesn't actually set state.
    // We need to set state manually.
    // Instead, use the real getStatus — the mock provision doesn't create state.
    // We'll mock getStatus instead for this specific test.
    vi.spyOn(provisioning, "getStatus").mockReturnValue({
      projectId: "proj-conflict",
      status: "running",
      steps: [],
    });

    const res = await request(app)
      .post("/api/provisioning/execute")
      .send({ projectId: "proj-conflict" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Provisioning already in progress");
  });

  it("passes repoName and engineChoice through to provision()", async () => {
    const provisionSpy = vi.spyOn(provisioning, "provision").mockResolvedValue({
      projectId: "proj-opts",
      status: "complete",
      steps: [],
    });

    await request(app)
      .post("/api/provisioning/execute")
      .send({
        projectId: "proj-opts",
        repoName: "my-custom-repo",
        engineChoice: "codex",
      });

    await vi.waitFor(() => {
      expect(provisionSpy).toHaveBeenCalledOnce();
    });

    const opts = provisionSpy.mock.calls[0][1];
    expect(opts.name).toBe("my-custom-repo");
    expect(opts.engineChoice).toBe("codex");
  });

  it("calls onStepUpdate for each provisioning step", async () => {
    vi.spyOn(provisioning, "provision").mockImplementation(async (_id, opts) => {
      // Simulate step updates
      if (opts.onStepUpdate) {
        opts.onStepUpdate("repo-create", "running");
        opts.onStepUpdate("repo-create", "complete");
        opts.onStepUpdate("clone", "running");
        opts.onStepUpdate("clone", "complete");
      }
      return { projectId: _id, status: "complete", steps: [] };
    });

    // Spy on emitSSE to verify events
    const pipelineModule = await import("../routes/pipeline.js");
    const emitSpy = vi.spyOn(pipelineModule, "emitSSE").mockImplementation(() => {});

    await request(app)
      .post("/api/provisioning/execute")
      .send({ projectId: "proj-steps" });

    // Wait for async provisioning to complete
    await vi.waitFor(() => {
      // 4 progress events + 1 complete event = 5 total
      expect(emitSpy).toHaveBeenCalledTimes(5);
    });

    // Verify progress events
    expect(emitSpy).toHaveBeenCalledWith("proj-steps", "provisioning-progress", {
      step: "repo-create",
      status: "running",
    });
    expect(emitSpy).toHaveBeenCalledWith("proj-steps", "provisioning-progress", {
      step: "clone",
      status: "complete",
    });

    // Verify completion event
    expect(emitSpy).toHaveBeenCalledWith("proj-steps", "provisioning-complete", {
      status: "complete",
    });
  });

  it("emits provisioning-error on failure", async () => {
    vi.spyOn(provisioning, "provision").mockRejectedValue(new Error("gh auth failed"));
    vi.spyOn(provisioning, "getStatus")
      .mockReturnValueOnce(null)  // First call in the 409 check
      .mockReturnValue({
        projectId: "proj-fail",
        status: "failed",
        steps: [{ name: "repo-create", status: "failed", error: "gh auth failed" }],
      });

    const pipelineModule = await import("../routes/pipeline.js");
    const emitSpy = vi.spyOn(pipelineModule, "emitSSE").mockImplementation(() => {});

    await request(app)
      .post("/api/provisioning/execute")
      .send({ projectId: "proj-fail" });

    await vi.waitFor(() => {
      expect(emitSpy).toHaveBeenCalledWith("proj-fail", "provisioning-error", {
        step: "repo-create",
        error: "gh auth failed",
      });
    });
  });
});

describe("GET /api/provisioning/status/:projectId", () => {
  it("returns current provisioning state", async () => {
    // Manually set provisioning state via the service
    vi.spyOn(provisioning, "getStatus").mockReturnValue({
      projectId: "proj-status",
      status: "complete",
      startedAt: "2026-03-18T00:00:00.000Z",
      completedAt: "2026-03-18T00:01:00.000Z",
      error: null,
      steps: [
        { name: "repo-create", status: "complete" },
        { name: "clone", status: "complete" },
      ],
    });

    const res = await request(app).get("/api/provisioning/status/proj-status");

    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe("proj-status");
    expect(res.body.status).toBe("complete");
    expect(res.body.steps).toHaveLength(2);
    expect(res.body.steps[0].name).toBe("repo-create");
  });

  it("returns idle status when no provisioning exists", async () => {
    const res = await request(app).get("/api/provisioning/status/proj-none");

    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe("proj-none");
    expect(res.body.status).toBe("idle");
  });

  it("returns failed state with error details", async () => {
    vi.spyOn(provisioning, "getStatus").mockReturnValue({
      projectId: "proj-err",
      status: "failed",
      error: "Step 'clone' failed: repo not found",
      steps: [
        { name: "repo-create", status: "complete" },
        { name: "clone", status: "failed", error: "repo not found" },
        { name: "artifact-write", status: "pending" },
      ],
    });

    const res = await request(app).get("/api/provisioning/status/proj-err");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("failed");
    expect(res.body.error).toContain("clone");
    expect(res.body.steps[1].status).toBe("failed");
    expect(res.body.steps[2].status).toBe("pending");
  });
});
