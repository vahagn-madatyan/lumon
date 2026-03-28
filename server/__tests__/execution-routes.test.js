import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import app from "../index.js";
import * as execution from "../execution.js";
import { outputThrottles } from "../routes/execution.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock build record returned by startBuild */
function makeBuildRecord(projectId, overrides = {}) {
  return {
    projectId,
    status: "running",
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
    agents: [],
    ...overrides,
  };
}

/** Create a serializable status object returned by getStatus */
function makeStatusView(projectId, overrides = {}) {
  return {
    projectId,
    status: "running",
    startedAt: "2026-03-19T00:00:00.000Z",
    completedAt: null,
    error: null,
    escalation: null,
    agents: [
      {
        agentId: "agent-test-abc",
        agentType: "claude",
        pid: 9999,
        status: "running",
        startedAt: "2026-03-19T00:00:00.000Z",
        completedAt: null,
        exitCode: null,
        error: null,
        lastOutputLine: "Building...",
        outputLines: 5,
        retryCount: 0,
        telemetry: null,
      },
    ],
    ...overrides,
  };
}

/** Create an escalated status view */
function makeEscalatedView(projectId, overrides = {}) {
  return makeStatusView(projectId, {
    status: "escalated",
    escalation: {
      status: "raised",
      reason: "Agent failed after retry",
      exitCode: 1,
      stderrTail: "Error: build failed",
      raisedAt: "2026-03-19T00:02:00.000Z",
      acknowledgedAt: null,
      decision: null,
    },
    agents: [
      {
        agentId: "agent-esc-1",
        agentType: "claude",
        pid: 8888,
        status: "failed",
        startedAt: "2026-03-19T00:00:00.000Z",
        completedAt: "2026-03-19T00:01:30.000Z",
        exitCode: 1,
        error: "Exit code 1",
        lastOutputLine: "[stderr] Error: build failed",
        outputLines: 10,
        retryCount: 1,
        telemetry: null,
      },
    ],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  execution.clear();
  outputThrottles.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// POST /api/execution/start
// ---------------------------------------------------------------------------

describe("POST /api/execution/start", () => {
  beforeEach(() => {
    // Default: agent CLI is available
    vi.spyOn(execution, "checkAgentAvailability").mockResolvedValue({
      available: true,
      version: "1.0.0",
    });
  });

  it("returns 201 and triggers async build execution", async () => {
    const startSpy = vi.spyOn(execution, "startBuild").mockResolvedValue(
      makeBuildRecord("proj-start")
    );

    const res = await request(app)
      .post("/api/execution/start")
      .send({ projectId: "proj-start", workspacePath: "/tmp/proj-start" });

    expect(res.status).toBe(201);
    expect(res.body.projectId).toBe("proj-start");
    expect(res.body.status).toBe("started");

    // Wait for async startBuild to be called
    await vi.waitFor(() => {
      expect(startSpy).toHaveBeenCalledOnce();
    });

    // Verify correct args passed
    const [pid, config, callbacks] = startSpy.mock.calls[0];
    expect(pid).toBe("proj-start");
    expect(config.workspacePath).toBe("/tmp/proj-start");
    expect(config.agentType).toBe("claude");
    expect(typeof callbacks.onAgentEvent).toBe("function");
  });

  it("passes agentType and prompt through to startBuild", async () => {
    const startSpy = vi.spyOn(execution, "startBuild").mockResolvedValue(
      makeBuildRecord("proj-opts")
    );

    await request(app)
      .post("/api/execution/start")
      .send({
        projectId: "proj-opts",
        workspacePath: "/tmp/proj-opts",
        agentType: "codex",
        prompt: "Build the login page",
      });

    await vi.waitFor(() => {
      expect(startSpy).toHaveBeenCalledOnce();
    });

    const config = startSpy.mock.calls[0][1];
    expect(config.agentType).toBe("codex");
    expect(config.prompt).toBe("Build the login page");
  });

  it("returns 400 when projectId is missing", async () => {
    const res = await request(app)
      .post("/api/execution/start")
      .send({ workspacePath: "/tmp/nope" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Missing required field");
    expect(res.body.reason).toContain("projectId");
  });

  it("returns 400 when workspacePath is missing", async () => {
    const res = await request(app)
      .post("/api/execution/start")
      .send({ projectId: "proj-no-path" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Missing required field");
    expect(res.body.reason).toContain("workspacePath");
  });

  it("returns 503 when agent CLI is unavailable", async () => {
    vi.spyOn(execution, "checkAgentAvailability").mockResolvedValue({
      available: false,
      error: "command not found: claude",
    });

    const res = await request(app)
      .post("/api/execution/start")
      .send({ projectId: "proj-no-cli", workspacePath: "/tmp/proj-no-cli" });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe("Agent CLI unavailable");
    expect(res.body.reason).toContain("command not found");
    expect(res.body.agentType).toBe("claude");
    expect(res.body.action).toContain("Install");
  });

  it("returns 409 when build is already running", async () => {
    vi.spyOn(execution, "getStatus").mockReturnValue(
      makeStatusView("proj-dup", { status: "running" })
    );

    const res = await request(app)
      .post("/api/execution/start")
      .send({ projectId: "proj-dup", workspacePath: "/tmp/proj-dup" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Build already running");
    expect(res.body.reason).toContain("proj-dup");
  });

  it("bridges agent events to SSE via onAgentEvent callback", async () => {
    const capturedEvents = [];

    vi.spyOn(execution, "startBuild").mockImplementation(
      async (_pid, _config, { onAgentEvent }) => {
        // Simulate the agent event lifecycle
        if (onAgentEvent) {
          onAgentEvent({
            type: "build-agent-spawned",
            projectId: "proj-sse",
            agentId: "agent-sse-1",
            agentType: "claude",
            pid: 5555,
          });
          onAgentEvent({
            type: "build-agent-output",
            projectId: "proj-sse",
            agentId: "agent-sse-1",
            stream: "stdout",
            line: "Working on it...",
          });
          onAgentEvent({
            type: "build-agent-completed",
            projectId: "proj-sse",
            agentId: "agent-sse-1",
            exitCode: 0,
            elapsed: 5000,
          });
        }
        return makeBuildRecord("proj-sse", { status: "completed" });
      }
    );

    // Spy on emitSSE to capture events
    const pipelineModule = await import("../routes/pipeline.js");
    const emitSpy = vi.spyOn(pipelineModule, "emitSSE").mockImplementation(
      (_pid, eventType, data) => {
        capturedEvents.push({ eventType, data });
      }
    );

    await request(app)
      .post("/api/execution/start")
      .send({ projectId: "proj-sse", workspacePath: "/tmp/proj-sse" });

    await vi.waitFor(() => {
      // spawned (1) + build-status running (1) + output (1) + completed (1) + build-status completed (1) = 5
      expect(emitSpy.mock.calls.length).toBeGreaterThanOrEqual(5);
    });

    const eventTypes = emitSpy.mock.calls.map((c) => c[1]);
    expect(eventTypes).toContain("build-agent-spawned");
    expect(eventTypes).toContain("build-agent-output");
    expect(eventTypes).toContain("build-agent-completed");
    expect(eventTypes).toContain("build-status");
  });

  it("emits build-agent-failed and build-status on agent failure", async () => {
    vi.spyOn(execution, "startBuild").mockImplementation(
      async (_pid, _config, { onAgentEvent }) => {
        if (onAgentEvent) {
          onAgentEvent({
            type: "build-agent-spawned",
            projectId: "proj-fail",
            agentId: "agent-fail-1",
            agentType: "claude",
            pid: 6666,
          });
          onAgentEvent({
            type: "build-agent-failed",
            projectId: "proj-fail",
            agentId: "agent-fail-1",
            exitCode: 1,
            error: "Exit code 1",
            elapsed: 3000,
          });
        }
        return makeBuildRecord("proj-fail", { status: "failed" });
      }
    );

    const pipelineModule = await import("../routes/pipeline.js");
    const emitSpy = vi.spyOn(pipelineModule, "emitSSE").mockImplementation(() => {});

    await request(app)
      .post("/api/execution/start")
      .send({ projectId: "proj-fail", workspacePath: "/tmp/proj-fail" });

    await vi.waitFor(() => {
      const eventTypes = emitSpy.mock.calls.map((c) => c[1]);
      expect(eventTypes).toContain("build-agent-failed");
    });

    // Verify build-status with failed state was emitted
    const statusCalls = emitSpy.mock.calls.filter((c) => c[1] === "build-status");
    const failedStatus = statusCalls.find((c) => c[2].status === "failed");
    expect(failedStatus).toBeDefined();
    expect(failedStatus[2].error).toBe("Exit code 1");
  });
});

// ---------------------------------------------------------------------------
// GET /api/execution/status/:projectId
// ---------------------------------------------------------------------------

describe("GET /api/execution/status/:projectId", () => {
  it("returns current build state", async () => {
    vi.spyOn(execution, "getStatus").mockReturnValue(
      makeStatusView("proj-status", { status: "completed" })
    );

    const res = await request(app).get("/api/execution/status/proj-status");

    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe("proj-status");
    expect(res.body.status).toBe("completed");
    expect(res.body.agents).toHaveLength(1);
    expect(res.body.agents[0].agentId).toBe("agent-test-abc");
    expect(res.body.agents[0].pid).toBe(9999);
  });

  it("returns 404 when no build exists for project", async () => {
    const res = await request(app).get("/api/execution/status/proj-unknown");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Build not found");
    expect(res.body.reason).toContain("proj-unknown");
  });

  it("returns failed state with error details", async () => {
    vi.spyOn(execution, "getStatus").mockReturnValue(
      makeStatusView("proj-err", {
        status: "failed",
        error: "Exit code 1",
        agents: [
          {
            agentId: "agent-err-1",
            agentType: "claude",
            pid: 7777,
            status: "failed",
            startedAt: "2026-03-19T00:00:00.000Z",
            completedAt: "2026-03-19T00:01:00.000Z",
            exitCode: 1,
            error: "Exit code 1",
            lastOutputLine: "[stderr] fatal: out of memory",
            outputLines: 42,
          },
        ],
      })
    );

    const res = await request(app).get("/api/execution/status/proj-err");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("failed");
    expect(res.body.error).toBe("Exit code 1");
    expect(res.body.agents[0].exitCode).toBe(1);
    expect(res.body.agents[0].lastOutputLine).toContain("stderr");
  });
});

// ---------------------------------------------------------------------------
// GET /api/execution/agent/:agentId/output
// ---------------------------------------------------------------------------

describe("GET /api/execution/agent/:agentId/output", () => {
  it("returns ring buffer contents for known agent", async () => {
    vi.spyOn(execution, "getAgentOutput").mockReturnValue([
      "Line 1: Setting up...",
      "Line 2: Building components...",
      "Line 3: Tests passing...",
    ]);

    const res = await request(app).get("/api/execution/agent/agent-out-1/output");

    expect(res.status).toBe(200);
    expect(res.body.agentId).toBe("agent-out-1");
    expect(res.body.lines).toHaveLength(3);
    expect(res.body.count).toBe(3);
    expect(res.body.lines[0]).toBe("Line 1: Setting up...");
    expect(res.body.lines[2]).toBe("Line 3: Tests passing...");
  });

  it("returns empty array for agent with no output", async () => {
    vi.spyOn(execution, "getAgentOutput").mockReturnValue([]);

    const res = await request(app).get("/api/execution/agent/agent-empty/output");

    expect(res.status).toBe(200);
    expect(res.body.lines).toHaveLength(0);
    expect(res.body.count).toBe(0);
  });

  it("returns 404 for unknown agent", async () => {
    // getAgentOutput returns null for unknown agents (real behavior)
    const res = await request(app).get("/api/execution/agent/agent-ghost/output");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Agent not found");
    expect(res.body.reason).toContain("agent-ghost");
  });
});

// ---------------------------------------------------------------------------
// POST /api/execution/retry
// ---------------------------------------------------------------------------

describe("POST /api/execution/retry", () => {
  it("returns 201 with updated agent state on successful retry", async () => {
    vi.spyOn(execution, "retryAgent").mockReturnValue({
      agentId: "agent-retry-1",
      status: "retrying",
      retryCount: 2,
      pid: 12345,
    });

    const res = await request(app)
      .post("/api/execution/retry")
      .send({ projectId: "proj-retry", agentId: "agent-retry-1" });

    expect(res.status).toBe(201);
    expect(res.body.agentId).toBe("agent-retry-1");
    expect(res.body.status).toBe("retrying");
    expect(res.body.retryCount).toBe(2);
    expect(res.body.pid).toBe(12345);
  });

  it("returns 400 when projectId is missing", async () => {
    const res = await request(app)
      .post("/api/execution/retry")
      .send({ agentId: "agent-retry-1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Missing required field");
    expect(res.body.reason).toContain("projectId");
  });

  it("returns 400 when agentId is missing", async () => {
    const res = await request(app)
      .post("/api/execution/retry")
      .send({ projectId: "proj-retry" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Missing required field");
    expect(res.body.reason).toContain("agentId");
  });

  it("returns 404 when projectId is unknown", async () => {
    vi.spyOn(execution, "retryAgent").mockImplementation(() => {
      throw new Error("[execution] No build found for proj-ghost");
    });

    const res = await request(app)
      .post("/api/execution/retry")
      .send({ projectId: "proj-ghost", agentId: "agent-1" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Not found");
    expect(res.body.reason).toContain("No build found");
  });

  it("returns 404 when agentId is unknown", async () => {
    vi.spyOn(execution, "retryAgent").mockImplementation(() => {
      throw new Error("[execution] No agent found: agent-ghost");
    });

    const res = await request(app)
      .post("/api/execution/retry")
      .send({ projectId: "proj-retry", agentId: "agent-ghost" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Not found");
    expect(res.body.reason).toContain("No agent found");
  });

  it("returns 400 on generic retry failure", async () => {
    vi.spyOn(execution, "retryAgent").mockImplementation(() => {
      throw new Error("Agent is still running");
    });

    const res = await request(app)
      .post("/api/execution/retry")
      .send({ projectId: "proj-retry", agentId: "agent-1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Retry failed");
    expect(res.body.reason).toContain("still running");
  });
});

// ---------------------------------------------------------------------------
// POST /api/execution/escalation/acknowledge
// ---------------------------------------------------------------------------

describe("POST /api/execution/escalation/acknowledge", () => {
  it("returns 200 with updated state on retry decision", async () => {
    vi.spyOn(execution, "acknowledgeEscalation").mockReturnValue(
      makeStatusView("proj-ack", {
        status: "running",
        escalation: {
          status: "acknowledged",
          reason: "Agent failed after retry",
          raisedAt: "2026-03-19T00:02:00.000Z",
          acknowledgedAt: "2026-03-19T00:03:00.000Z",
          decision: "retry",
        },
      })
    );

    const res = await request(app)
      .post("/api/execution/escalation/acknowledge")
      .send({ projectId: "proj-ack", decision: "retry" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("running");
    expect(res.body.escalation.decision).toBe("retry");
  });

  it("returns 200 with aborted state on abort decision", async () => {
    vi.spyOn(execution, "acknowledgeEscalation").mockReturnValue(
      makeStatusView("proj-abort", {
        status: "aborted",
        completedAt: "2026-03-19T00:03:00.000Z",
        escalation: {
          status: "acknowledged",
          reason: "Agent failed after retry",
          raisedAt: "2026-03-19T00:02:00.000Z",
          acknowledgedAt: "2026-03-19T00:03:00.000Z",
          decision: "abort",
        },
      })
    );

    const res = await request(app)
      .post("/api/execution/escalation/acknowledge")
      .send({ projectId: "proj-abort", decision: "abort" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("aborted");
    expect(res.body.escalation.decision).toBe("abort");
  });

  it("returns 400 when projectId is missing", async () => {
    const res = await request(app)
      .post("/api/execution/escalation/acknowledge")
      .send({ decision: "retry" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Missing required field");
    expect(res.body.reason).toContain("projectId");
  });

  it("returns 400 when decision is missing", async () => {
    const res = await request(app)
      .post("/api/execution/escalation/acknowledge")
      .send({ projectId: "proj-ack" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid decision");
    expect(res.body.reason).toContain("'retry' or 'abort'");
  });

  it("returns 400 when decision is invalid", async () => {
    const res = await request(app)
      .post("/api/execution/escalation/acknowledge")
      .send({ projectId: "proj-ack", decision: "ignore" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid decision");
    expect(res.body.reason).toContain("'retry' or 'abort'");
  });

  it("returns 404 when projectId is unknown", async () => {
    vi.spyOn(execution, "acknowledgeEscalation").mockImplementation(() => {
      throw new Error("[execution] No build found for proj-ghost");
    });

    const res = await request(app)
      .post("/api/execution/escalation/acknowledge")
      .send({ projectId: "proj-ghost", decision: "retry" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Not found");
    expect(res.body.reason).toContain("No build found");
  });

  it("returns 400 when no active escalation exists", async () => {
    vi.spyOn(execution, "acknowledgeEscalation").mockImplementation(() => {
      throw new Error("[execution] No active escalation for proj-no-esc");
    });

    const res = await request(app)
      .post("/api/execution/escalation/acknowledge")
      .send({ projectId: "proj-no-esc", decision: "retry" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("No active escalation");
    expect(res.body.reason).toContain("No active escalation");
  });

  it("returns 400 when escalation is already acknowledged", async () => {
    vi.spyOn(execution, "acknowledgeEscalation").mockImplementation(() => {
      throw new Error("[execution] Escalation already acknowledged for proj-ack");
    });

    const res = await request(app)
      .post("/api/execution/escalation/acknowledge")
      .send({ projectId: "proj-ack", decision: "retry" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("No active escalation");
    expect(res.body.reason).toContain("already acknowledged");
  });
});

// ---------------------------------------------------------------------------
// GET /api/execution/escalations
// ---------------------------------------------------------------------------

describe("GET /api/execution/escalations", () => {
  it("returns all active escalations across projects", async () => {
    vi.spyOn(execution, "getActiveEscalations").mockReturnValue([
      {
        projectId: "proj-esc-1",
        escalation: {
          status: "raised",
          reason: "Agent failed after retry",
          exitCode: 1,
          stderrTail: "Error in proj-esc-1",
          raisedAt: "2026-03-19T00:02:00.000Z",
          acknowledgedAt: null,
          decision: null,
        },
      },
      {
        projectId: "proj-esc-2",
        escalation: {
          status: "raised",
          reason: "Timeout after retry",
          exitCode: null,
          stderrTail: "",
          raisedAt: "2026-03-19T00:05:00.000Z",
          acknowledgedAt: null,
          decision: null,
        },
      },
    ]);

    const res = await request(app).get("/api/execution/escalations");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toEqual({
      projectId: "proj-esc-1",
      reason: "Agent failed after retry",
      escalatedAt: "2026-03-19T00:02:00.000Z",
    });
    expect(res.body[1]).toEqual({
      projectId: "proj-esc-2",
      reason: "Timeout after retry",
      escalatedAt: "2026-03-19T00:05:00.000Z",
    });
  });

  it("returns empty array when no escalations exist", async () => {
    vi.spyOn(execution, "getActiveEscalations").mockReturnValue([]);

    const res = await request(app).get("/api/execution/escalations");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// SSE bridge — retry/escalation lifecycle events
// ---------------------------------------------------------------------------

describe("SSE bridge — retry/escalation events", () => {
  beforeEach(() => {
    vi.spyOn(execution, "checkAgentAvailability").mockResolvedValue({
      available: true,
      version: "1.0.0",
    });
  });

  it("emits build-retry-started and build-status on retry event", async () => {
    vi.spyOn(execution, "startBuild").mockImplementation(
      async (_pid, _config, { onAgentEvent }) => {
        if (onAgentEvent) {
          onAgentEvent({
            type: "retry-started",
            projectId: "proj-retry-sse",
            agentId: "agent-r-1",
            retryCount: 1,
            previousError: "Exit code 1",
          });
        }
        return makeBuildRecord("proj-retry-sse");
      }
    );

    const pipelineModule = await import("../routes/pipeline.js");
    const emitSpy = vi.spyOn(pipelineModule, "emitSSE").mockImplementation(() => {});

    await request(app)
      .post("/api/execution/start")
      .send({ projectId: "proj-retry-sse", workspacePath: "/tmp/proj-retry-sse" });

    await vi.waitFor(() => {
      const eventTypes = emitSpy.mock.calls.map((c) => c[1]);
      expect(eventTypes).toContain("build-retry-started");
    });

    // Verify retry-started event payload
    const retryCall = emitSpy.mock.calls.find((c) => c[1] === "build-retry-started");
    expect(retryCall[0]).toBe("proj-retry-sse");
    expect(retryCall[2].agentId).toBe("agent-r-1");
    expect(retryCall[2].retryCount).toBe(1);

    // Verify build-status with running state
    const statusCalls = emitSpy.mock.calls.filter((c) => c[1] === "build-status");
    const runningStatus = statusCalls.find(
      (c) => c[2].status === "running" && c[2].retryCount === 1
    );
    expect(runningStatus).toBeDefined();
  });

  it("emits build-escalation-raised and build-status on escalation event", async () => {
    vi.spyOn(execution, "startBuild").mockImplementation(
      async (_pid, _config, { onAgentEvent }) => {
        if (onAgentEvent) {
          onAgentEvent({
            type: "escalation-raised",
            projectId: "proj-esc-sse",
            reason: "Agent failed after retry",
            exitCode: 1,
            stderrTail: "Error: fatal",
          });
        }
        return makeBuildRecord("proj-esc-sse", { status: "escalated" });
      }
    );

    const pipelineModule = await import("../routes/pipeline.js");
    const emitSpy = vi.spyOn(pipelineModule, "emitSSE").mockImplementation(() => {});

    await request(app)
      .post("/api/execution/start")
      .send({ projectId: "proj-esc-sse", workspacePath: "/tmp/proj-esc-sse" });

    await vi.waitFor(() => {
      const eventTypes = emitSpy.mock.calls.map((c) => c[1]);
      expect(eventTypes).toContain("build-escalation-raised");
    });

    // Verify escalation-raised event payload
    const escCall = emitSpy.mock.calls.find((c) => c[1] === "build-escalation-raised");
    expect(escCall[0]).toBe("proj-esc-sse");
    expect(escCall[2].reason).toBe("Agent failed after retry");
    expect(escCall[2].exitCode).toBe(1);

    // Verify build-status with escalated state
    const statusCalls = emitSpy.mock.calls.filter((c) => c[1] === "build-status");
    const escalatedStatus = statusCalls.find((c) => c[2].status === "escalated");
    expect(escalatedStatus).toBeDefined();
    expect(escalatedStatus[2].reason).toBe("Agent failed after retry");
  });

  it("emits build-escalation-acknowledged on acknowledgment event", async () => {
    vi.spyOn(execution, "startBuild").mockImplementation(
      async (_pid, _config, { onAgentEvent }) => {
        if (onAgentEvent) {
          onAgentEvent({
            type: "escalation-acknowledged",
            projectId: "proj-ack-sse",
            decision: "abort",
            escalation: {
              status: "acknowledged",
              reason: "Agent failed",
              acknowledgedAt: "2026-03-19T00:03:00.000Z",
              decision: "abort",
            },
          });
        }
        return makeBuildRecord("proj-ack-sse", { status: "aborted" });
      }
    );

    const pipelineModule = await import("../routes/pipeline.js");
    const emitSpy = vi.spyOn(pipelineModule, "emitSSE").mockImplementation(() => {});

    await request(app)
      .post("/api/execution/start")
      .send({ projectId: "proj-ack-sse", workspacePath: "/tmp/proj-ack-sse" });

    await vi.waitFor(() => {
      const eventTypes = emitSpy.mock.calls.map((c) => c[1]);
      expect(eventTypes).toContain("build-escalation-acknowledged");
    });

    // Verify acknowledgment event payload
    const ackCall = emitSpy.mock.calls.find((c) => c[1] === "build-escalation-acknowledged");
    expect(ackCall[0]).toBe("proj-ack-sse");
    expect(ackCall[2].decision).toBe("abort");

    // Verify build-status with aborted state (abort decision)
    const statusCalls = emitSpy.mock.calls.filter((c) => c[1] === "build-status");
    const abortedStatus = statusCalls.find((c) => c[2].status === "aborted");
    expect(abortedStatus).toBeDefined();
    expect(abortedStatus[2].decision).toBe("abort");
  });

  it("emits build-status with running for retry acknowledgment decision", async () => {
    vi.spyOn(execution, "startBuild").mockImplementation(
      async (_pid, _config, { onAgentEvent }) => {
        if (onAgentEvent) {
          onAgentEvent({
            type: "escalation-acknowledged",
            projectId: "proj-ack-retry",
            decision: "retry",
            escalation: {
              status: "acknowledged",
              decision: "retry",
            },
          });
        }
        return makeBuildRecord("proj-ack-retry");
      }
    );

    const pipelineModule = await import("../routes/pipeline.js");
    const emitSpy = vi.spyOn(pipelineModule, "emitSSE").mockImplementation(() => {});

    await request(app)
      .post("/api/execution/start")
      .send({ projectId: "proj-ack-retry", workspacePath: "/tmp/proj-ack-retry" });

    await vi.waitFor(() => {
      const eventTypes = emitSpy.mock.calls.map((c) => c[1]);
      expect(eventTypes).toContain("build-escalation-acknowledged");
    });

    // Verify build-status with running state (retry decision)
    const statusCalls = emitSpy.mock.calls.filter((c) => c[1] === "build-status");
    const retryStatus = statusCalls.find(
      (c) => c[2].decision === "retry" && c[2].status === "running"
    );
    expect(retryStatus).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// SSE output throttle behavior
// ---------------------------------------------------------------------------

describe("SSE output throttle", () => {
  it("throttles build-agent-output to 1 per second per project", async () => {
    vi.spyOn(execution, "checkAgentAvailability").mockResolvedValue({
      available: true,
      version: "1.0.0",
    });

    vi.spyOn(execution, "startBuild").mockImplementation(
      async (_pid, _config, { onAgentEvent }) => {
        if (onAgentEvent) {
          // Emit many output events rapidly — only first should pass throttle
          for (let i = 0; i < 10; i++) {
            onAgentEvent({
              type: "build-agent-output",
              projectId: "proj-throttle",
              agentId: "agent-throttle-1",
              stream: "stdout",
              line: `Output line ${i}`,
            });
          }
        }
        return makeBuildRecord("proj-throttle");
      }
    );

    const pipelineModule = await import("../routes/pipeline.js");
    const emitSpy = vi.spyOn(pipelineModule, "emitSSE").mockImplementation(() => {});

    await request(app)
      .post("/api/execution/start")
      .send({ projectId: "proj-throttle", workspacePath: "/tmp/proj-throttle" });

    await vi.waitFor(() => {
      expect(emitSpy).toHaveBeenCalled();
    });

    // Count output events — should be exactly 1 (throttled to 1/sec)
    const outputCalls = emitSpy.mock.calls.filter((c) => c[1] === "build-agent-output");
    expect(outputCalls.length).toBe(1);
  });
});
