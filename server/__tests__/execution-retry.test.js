import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";

import {
  startBuild,
  getStatus,
  getAgentOutput,
  retryAgent,
  acknowledgeEscalation,
  getActiveEscalations,
  clear,
  _setSpawn,
  _resetSpawn,
} from "../execution.js";

// ---------------------------------------------------------------------------
// Helpers — fake child process via EventEmitter + readable streams
// ---------------------------------------------------------------------------

function createFakeProcess(pid = 1234) {
  const proc = new EventEmitter();
  proc.pid = pid;
  proc.stdout = new Readable({ read() {} });
  proc.stderr = new Readable({ read() {} });
  proc.stdout.on("error", () => {});
  proc.stderr.on("error", () => {});
  proc.kill = vi.fn(); // stub kill for timeout tests
  return proc;
}

/**
 * Install a mock spawn that routes version checks to auto-success
 * and exec calls to the supplied factory.
 */
function installMockSpawn(procOrFactory) {
  const factory =
    typeof procOrFactory === "function" ? procOrFactory : () => procOrFactory;

  _setSpawn((cmd, args, opts) => {
    if (args.includes("--version")) {
      const versionProc = createFakeProcess(9999);
      process.nextTick(() => {
        versionProc.stdout.push(`${cmd} version 1.0.0\n`);
        versionProc.stdout.push(null);
        setTimeout(() => versionProc.emit("close", 0, null), 5);
      });
      return versionProc;
    }
    return factory(cmd, args, opts);
  });
}

/** Small delay helper */
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  clear();
});

afterEach(() => {
  _resetSpawn();
  clear();
});

// ===================================================================
// Auto-retry on first failure
// ===================================================================

describe("auto-retry on first failure", () => {
  it("retries exactly once on non-zero exit code", async () => {
    const events = [];
    const proc1 = createFakeProcess(1001);
    const proc2 = createFakeProcess(1002);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? proc1 : proc2;
    });

    await startBuild(
      "proj-retry",
      { workspacePath: "/tmp/retry", agentType: "claude", timeoutMs: 0 },
      { onAgentEvent: (ev) => events.push(ev) },
    );

    // First failure
    proc1.stdout.push(null);
    proc1.stderr.push("Error: first failure\n");
    proc1.stderr.push(null);
    proc1.emit("close", 1, null);
    await tick();

    const status = getStatus("proj-retry");
    expect(status.status).toBe("running");
    expect(status.agents[0].retryCount).toBe(1);

    const retryEvent = events.find((e) => e.type === "retry-started");
    expect(retryEvent).toBeTruthy();
    expect(retryEvent.retryCount).toBe(1);
    expect(retryEvent.previousError).toContain("Exit code 1");
  });

  it("emits retry-started event with correct fields", async () => {
    const events = [];
    const proc1 = createFakeProcess(2001);
    const proc2 = createFakeProcess(2002);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? proc1 : proc2;
    });

    await startBuild(
      "proj-retry-event",
      { workspacePath: "/tmp/retry-event", agentType: "claude", timeoutMs: 0 },
      { onAgentEvent: (ev) => events.push(ev) },
    );

    proc1.stdout.push(null);
    proc1.stderr.push(null);
    proc1.emit("close", 1, null);
    await tick();

    const retryEvent = events.find((e) => e.type === "retry-started");
    expect(retryEvent.projectId).toBe("proj-retry-event");
    expect(retryEvent.retryCount).toBe(1);
    expect(retryEvent.agentId).toBeTruthy();
  });

  it("re-spawns the agent with the same config on retry", async () => {
    const proc1 = createFakeProcess(3001);
    const proc2 = createFakeProcess(3002);
    let spawnCalls = [];

    installMockSpawn((cmd, args, opts) => {
      spawnCalls.push({ cmd, args, opts });
      return spawnCalls.length === 1 ? proc1 : proc2;
    });

    await startBuild("proj-respawn", {
      workspacePath: "/tmp/respawn",
      agentType: "claude",
      prompt: "build the thing",
      timeoutMs: 0,
    });

    proc1.stdout.push(null);
    proc1.stderr.push(null);
    proc1.emit("close", 1, null);
    await tick();

    // Two exec spawns should have happened (not counting version checks)
    expect(spawnCalls.length).toBe(2);
    expect(spawnCalls[0].opts.cwd).toBe("/tmp/respawn");
    expect(spawnCalls[1].opts.cwd).toBe("/tmp/respawn");
  });

  it("succeeds on retry if second attempt exits 0", async () => {
    const events = [];
    const proc1 = createFakeProcess(4001);
    const proc2 = createFakeProcess(4002);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? proc1 : proc2;
    });

    await startBuild(
      "proj-retry-ok",
      { workspacePath: "/tmp/retry-ok", agentType: "claude", timeoutMs: 0 },
      { onAgentEvent: (ev) => events.push(ev) },
    );

    // First failure
    proc1.stdout.push(null);
    proc1.stderr.push(null);
    proc1.emit("close", 1, null);
    await tick();

    expect(getStatus("proj-retry-ok").status).toBe("running");

    // Second attempt succeeds
    proc2.stdout.push("done!\n");
    proc2.stdout.push(null);
    proc2.stderr.push(null);
    proc2.emit("close", 0, null);
    await tick();

    const status = getStatus("proj-retry-ok");
    expect(status.status).toBe("completed");
    expect(status.agents[0].retryCount).toBe(1);
    expect(status.agents[0].exitCode).toBe(0);
  });
});

// ===================================================================
// Escalation on second failure
// ===================================================================

describe("escalation on second failure", () => {
  it("escalates with reason after second failure", async () => {
    const events = [];
    const proc1 = createFakeProcess(5001);
    const proc2 = createFakeProcess(5002);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? proc1 : proc2;
    });

    await startBuild(
      "proj-esc",
      { workspacePath: "/tmp/esc", agentType: "claude", timeoutMs: 0 },
      { onAgentEvent: (ev) => events.push(ev) },
    );

    // First failure → retry
    proc1.stdout.push(null);
    proc1.stderr.push("first error\n");
    proc1.stderr.push(null);
    proc1.emit("close", 1, null);
    await tick();

    // Second failure → escalation
    proc2.stdout.push(null);
    proc2.stderr.push("second error\n");
    proc2.stderr.push(null);
    proc2.emit("close", 1, null);
    await tick();

    const status = getStatus("proj-esc");
    expect(status.status).toBe("escalated");
    expect(status.escalation).toBeTruthy();
    expect(status.escalation.status).toBe("raised");
    expect(status.escalation.reason).toContain("failed after retry");
    expect(status.escalation.exitCode).toBe(1);
    expect(status.escalation.raisedAt).toBeTruthy();
    expect(status.escalation.acknowledgedAt).toBeNull();
    expect(status.escalation.decision).toBeNull();
  });

  it("includes stderr tail in escalation", async () => {
    const proc1 = createFakeProcess(5101);
    const proc2 = createFakeProcess(5102);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? proc1 : proc2;
    });

    await startBuild("proj-esc-stderr", {
      workspacePath: "/tmp/esc-stderr",
      agentType: "claude",
      timeoutMs: 0,
    });

    proc1.stdout.push(null);
    proc1.stderr.push(null);
    proc1.emit("close", 1, null);
    await tick();

    proc2.stdout.push(null);
    proc2.stderr.push("fatal: something broke\n");
    proc2.stderr.push(null);
    proc2.emit("close", 1, null);
    await tick();

    const status = getStatus("proj-esc-stderr");
    expect(status.escalation.stderrTail).toBeInstanceOf(Array);
  });

  it("emits escalation-raised event", async () => {
    const events = [];
    const proc1 = createFakeProcess(5201);
    const proc2 = createFakeProcess(5202);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? proc1 : proc2;
    });

    await startBuild(
      "proj-esc-event",
      { workspacePath: "/tmp/esc-event", agentType: "claude", timeoutMs: 0 },
      { onAgentEvent: (ev) => events.push(ev) },
    );

    proc1.stdout.push(null);
    proc1.stderr.push(null);
    proc1.emit("close", 1, null);
    await tick();

    proc2.stdout.push(null);
    proc2.stderr.push(null);
    proc2.emit("close", 1, null);
    await tick();

    const escEvent = events.find((e) => e.type === "escalation-raised");
    expect(escEvent).toBeTruthy();
    expect(escEvent.projectId).toBe("proj-esc-event");
    expect(escEvent.escalation.status).toBe("raised");
  });

  it("getActiveEscalations returns raised escalations", async () => {
    const proc1 = createFakeProcess(5301);
    const proc2 = createFakeProcess(5302);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? proc1 : proc2;
    });

    await startBuild("proj-active-esc", {
      workspacePath: "/tmp/active-esc",
      agentType: "claude",
      timeoutMs: 0,
    });

    proc1.stdout.push(null);
    proc1.stderr.push(null);
    proc1.emit("close", 1, null);
    await tick();
    proc2.stdout.push(null);
    proc2.stderr.push(null);
    proc2.emit("close", 1, null);
    await tick();

    const escalations = getActiveEscalations();
    expect(escalations).toHaveLength(1);
    expect(escalations[0].projectId).toBe("proj-active-esc");
    expect(escalations[0].escalation.status).toBe("raised");
  });
});

// ===================================================================
// acknowledgeEscalation — retry decision
// ===================================================================

describe("acknowledgeEscalation — retry", () => {
  async function setupEscalatedProject(projectId) {
    const events = [];
    const proc1 = createFakeProcess(6001);
    const proc2 = createFakeProcess(6002);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      if (callCount === 1) return proc1;
      if (callCount === 2) return proc2;
      // Manual retry gets a new process
      return createFakeProcess(6003);
    });

    await startBuild(
      projectId,
      { workspacePath: "/tmp/ack", agentType: "claude", timeoutMs: 0 },
      { onAgentEvent: (ev) => events.push(ev) },
    );

    // First fail → retry
    proc1.stdout.push(null);
    proc1.stderr.push(null);
    proc1.emit("close", 1, null);
    await tick();

    // Second fail → escalation
    proc2.stdout.push(null);
    proc2.stderr.push(null);
    proc2.emit("close", 1, null);
    await tick();

    return { events };
  }

  it("acknowledging with retry resets escalation and respawns", async () => {
    const { events } = await setupEscalatedProject("proj-ack-retry");

    const status1 = getStatus("proj-ack-retry");
    expect(status1.status).toBe("escalated");

    const result = acknowledgeEscalation("proj-ack-retry", "retry");
    expect(result.status).toBe("running");

    const ackEvent = events.find((e) => e.type === "escalation-acknowledged");
    expect(ackEvent).toBeTruthy();
    expect(ackEvent.decision).toBe("retry");
    expect(ackEvent.escalation.acknowledgedAt).toBeTruthy();
  });

  it("manual retry increments retryCount", async () => {
    await setupEscalatedProject("proj-ack-count");

    acknowledgeEscalation("proj-ack-count", "retry");

    const status = getStatus("proj-ack-count");
    // retryCount: 1 (auto) + 1 (manual) = 2
    expect(status.agents[0].retryCount).toBeGreaterThanOrEqual(2);
  });
});

// ===================================================================
// acknowledgeEscalation — abort decision
// ===================================================================

describe("acknowledgeEscalation — abort", () => {
  async function setupEscalatedProject(projectId) {
    const events = [];
    const proc1 = createFakeProcess(7001);
    const proc2 = createFakeProcess(7002);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? proc1 : proc2;
    });

    await startBuild(
      projectId,
      { workspacePath: "/tmp/abort", agentType: "claude", timeoutMs: 0 },
      { onAgentEvent: (ev) => events.push(ev) },
    );

    proc1.stdout.push(null);
    proc1.stderr.push(null);
    proc1.emit("close", 1, null);
    await tick();
    proc2.stdout.push(null);
    proc2.stderr.push(null);
    proc2.emit("close", 1, null);
    await tick();

    return { events };
  }

  it("acknowledging with abort sets status to aborted", async () => {
    const { events } = await setupEscalatedProject("proj-abort");

    const result = acknowledgeEscalation("proj-abort", "abort");
    expect(result.status).toBe("aborted");
    expect(result.completedAt).toBeTruthy();

    const ackEvent = events.find((e) => e.type === "escalation-acknowledged");
    expect(ackEvent).toBeTruthy();
    expect(ackEvent.decision).toBe("abort");
  });

  it("getActiveEscalations excludes acknowledged escalations", async () => {
    await setupEscalatedProject("proj-abort-list");
    expect(getActiveEscalations()).toHaveLength(1);

    acknowledgeEscalation("proj-abort-list", "abort");
    expect(getActiveEscalations()).toHaveLength(0);
  });
});

// ===================================================================
// acknowledgeEscalation — validation
// ===================================================================

describe("acknowledgeEscalation — validation", () => {
  it("throws for unknown project", () => {
    expect(() => acknowledgeEscalation("nonexistent", "retry")).toThrow(
      "No build found",
    );
  });

  it("throws when no escalation is active", async () => {
    const proc = createFakeProcess(7501);
    installMockSpawn(proc);

    await startBuild("proj-no-esc", {
      workspacePath: "/tmp/no-esc",
      agentType: "claude",
      timeoutMs: 0,
    });

    expect(() => acknowledgeEscalation("proj-no-esc", "retry")).toThrow(
      "No active escalation",
    );
  });

  it("throws for invalid decision value", async () => {
    const proc1 = createFakeProcess(7601);
    const proc2 = createFakeProcess(7602);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? proc1 : proc2;
    });

    await startBuild("proj-bad-decision", {
      workspacePath: "/tmp/bad-decision",
      agentType: "claude",
      timeoutMs: 0,
    });

    proc1.stdout.push(null);
    proc1.stderr.push(null);
    proc1.emit("close", 1, null);
    await tick();
    proc2.stdout.push(null);
    proc2.stderr.push(null);
    proc2.emit("close", 1, null);
    await tick();

    expect(() => acknowledgeEscalation("proj-bad-decision", "maybe")).toThrow(
      "Invalid decision",
    );
  });
});

// ===================================================================
// Timeout triggers retry
// ===================================================================

describe("timeout triggers retry", () => {
  it("marks agent as timed-out and retries", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const events = [];
    const proc1 = createFakeProcess(8001);
    const proc2 = createFakeProcess(8002);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? proc1 : proc2;
    });

    await startBuild(
      "proj-timeout",
      { workspacePath: "/tmp/timeout", agentType: "claude", timeoutMs: 5000 },
      { onAgentEvent: (ev) => events.push(ev) },
    );

    // Advance past timeout
    vi.advanceTimersByTime(5100);
    // Timeout fires SIGTERM → proc.on("close") fires after kill
    proc1.stdout.push(null);
    proc1.stderr.push(null);
    proc1.emit("close", null, "SIGTERM");
    await tick(30);

    const timeoutEvent = events.find((e) => e.type === "timeout");
    expect(timeoutEvent).toBeTruthy();
    expect(timeoutEvent.timeoutMs).toBe(5000);

    // Should have retried
    const retryEvent = events.find((e) => e.type === "retry-started");
    expect(retryEvent).toBeTruthy();

    const status = getStatus("proj-timeout");
    expect(status.status).toBe("running");
    expect(status.agents[0].retryCount).toBe(1);

    vi.useRealTimers();
  });

  it("timeout after retry triggers escalation", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const events = [];
    const proc1 = createFakeProcess(8101);
    const proc2 = createFakeProcess(8102);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? proc1 : proc2;
    });

    await startBuild(
      "proj-timeout-esc",
      { workspacePath: "/tmp/timeout-esc", agentType: "claude", timeoutMs: 5000 },
      { onAgentEvent: (ev) => events.push(ev) },
    );

    // First timeout → retry
    vi.advanceTimersByTime(5100);
    proc1.stdout.push(null);
    proc1.stderr.push(null);
    proc1.emit("close", null, "SIGTERM");
    await tick(30);

    expect(getStatus("proj-timeout-esc").status).toBe("running");

    // Second timeout → escalation
    vi.advanceTimersByTime(5100);
    proc2.stdout.push(null);
    proc2.stderr.push(null);
    proc2.emit("close", null, "SIGTERM");
    await tick(30);

    const status = getStatus("proj-timeout-esc");
    expect(status.status).toBe("escalated");
    expect(status.escalation.reason).toContain("failed after retry");

    vi.useRealTimers();
  });

  it("timeout with custom threshold from config", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const proc1 = createFakeProcess(8201);
    const proc2 = createFakeProcess(8202);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? proc1 : proc2;
    });

    // Use a very short custom timeout
    await startBuild("proj-custom-timeout", {
      workspacePath: "/tmp/custom-timeout",
      agentType: "claude",
      timeoutMs: 1000,
    });

    // Should not have timed out yet at 500ms
    vi.advanceTimersByTime(500);
    expect(getStatus("proj-custom-timeout").agents[0].status).toBe("running");

    // Should time out at 1100ms
    vi.advanceTimersByTime(600);
    proc1.stdout.push(null);
    proc1.stderr.push(null);
    proc1.emit("close", null, "SIGTERM");
    await tick(30);

    expect(getStatus("proj-custom-timeout").agents[0].retryCount).toBe(1);

    vi.useRealTimers();
  });

  it("timed-out is a distinct status from generic failure", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const events = [];
    const proc1 = createFakeProcess(8301);
    const proc2 = createFakeProcess(8302);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? proc1 : proc2;
    });

    await startBuild(
      "proj-timeout-distinct",
      { workspacePath: "/tmp/timeout-distinct", agentType: "claude", timeoutMs: 2000 },
      { onAgentEvent: (ev) => events.push(ev) },
    );

    vi.advanceTimersByTime(2100);

    // The timeout event fires before close
    const timeoutEvent = events.find((e) => e.type === "timeout");
    expect(timeoutEvent).toBeTruthy();
    expect(timeoutEvent.timeoutMs).toBe(2000);

    // Confirm kill was called on the process
    expect(proc1.kill).toHaveBeenCalledWith("SIGTERM");

    vi.useRealTimers();
  });
});

// ===================================================================
// retryCount tracking
// ===================================================================

describe("retryCount tracking", () => {
  it("starts at 0 for new agents", async () => {
    const proc = createFakeProcess(9001);
    installMockSpawn(proc);

    await startBuild("proj-count-0", {
      workspacePath: "/tmp/count-0",
      agentType: "claude",
      timeoutMs: 0,
    });

    const status = getStatus("proj-count-0");
    expect(status.agents[0].retryCount).toBe(0);
  });

  it("increments to 1 after auto-retry", async () => {
    const proc1 = createFakeProcess(9101);
    const proc2 = createFakeProcess(9102);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? proc1 : proc2;
    });

    await startBuild("proj-count-1", {
      workspacePath: "/tmp/count-1",
      agentType: "claude",
      timeoutMs: 0,
    });

    proc1.stdout.push(null);
    proc1.stderr.push(null);
    proc1.emit("close", 1, null);
    await tick();

    expect(getStatus("proj-count-1").agents[0].retryCount).toBe(1);
  });

  it("is exposed in getStatus response", async () => {
    const proc = createFakeProcess(9201);
    installMockSpawn(proc);

    await startBuild("proj-count-visible", {
      workspacePath: "/tmp/count-visible",
      agentType: "claude",
      timeoutMs: 0,
    });

    const status = getStatus("proj-count-visible");
    expect(status.agents[0]).toHaveProperty("retryCount");
    expect(typeof status.agents[0].retryCount).toBe("number");
  });
});

// ===================================================================
// Escalation state shape
// ===================================================================

describe("escalation state shape", () => {
  async function getEscalatedStatus(projectId) {
    const proc1 = createFakeProcess(9301);
    const proc2 = createFakeProcess(9302);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? proc1 : proc2;
    });

    await startBuild(projectId, {
      workspacePath: "/tmp/esc-shape",
      agentType: "claude",
      timeoutMs: 0,
    });

    proc1.stdout.push(null);
    proc1.stderr.push("err1\n");
    proc1.stderr.push(null);
    proc1.emit("close", 1, null);
    await tick();
    proc2.stdout.push(null);
    proc2.stderr.push("err2\n");
    proc2.stderr.push(null);
    proc2.emit("close", 1, null);
    await tick();

    return getStatus(projectId);
  }

  it("has expected escalation fields", async () => {
    const status = await getEscalatedStatus("proj-esc-shape");
    const esc = status.escalation;

    expect(esc).toHaveProperty("status", "raised");
    expect(esc).toHaveProperty("reason");
    expect(typeof esc.reason).toBe("string");
    expect(esc).toHaveProperty("exitCode");
    expect(esc).toHaveProperty("stderrTail");
    expect(Array.isArray(esc.stderrTail)).toBe(true);
    expect(esc).toHaveProperty("raisedAt");
    expect(esc).toHaveProperty("acknowledgedAt", null);
    expect(esc).toHaveProperty("decision", null);
  });

  it("escalation is null when no escalation exists", async () => {
    const proc = createFakeProcess(9401);
    installMockSpawn(proc);

    await startBuild("proj-no-esc-shape", {
      workspacePath: "/tmp/no-esc-shape",
      agentType: "claude",
      timeoutMs: 0,
    });

    const status = getStatus("proj-no-esc-shape");
    expect(status.escalation).toBeNull();
  });
});

// ===================================================================
// All events emitted through onAgentEvent
// ===================================================================

describe("event lifecycle completeness", () => {
  it("emits all lifecycle events: spawned, retry-started, escalation-raised, build-agent-failed", async () => {
    const events = [];
    const proc1 = createFakeProcess(9501);
    const proc2 = createFakeProcess(9502);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? proc1 : proc2;
    });

    await startBuild(
      "proj-all-events",
      { workspacePath: "/tmp/all-events", agentType: "claude", timeoutMs: 0 },
      { onAgentEvent: (ev) => events.push(ev) },
    );

    // First failure (retry)
    proc1.stdout.push(null);
    proc1.stderr.push(null);
    proc1.emit("close", 1, null);
    await tick();

    // Second failure (escalation)
    proc2.stdout.push(null);
    proc2.stderr.push(null);
    proc2.emit("close", 1, null);
    await tick();

    const eventTypes = events.map((e) => e.type);
    // Initial spawn
    expect(eventTypes).toContain("build-agent-spawned");
    // Auto retry
    expect(eventTypes).toContain("retry-started");
    // Re-spawn after retry
    expect(eventTypes.filter((t) => t === "build-agent-spawned").length).toBe(2);
    // Escalation
    expect(eventTypes).toContain("escalation-raised");
    // Failed
    expect(eventTypes).toContain("build-agent-failed");
  });

  it("emits escalation-acknowledged on acknowledge", async () => {
    const events = [];
    const proc1 = createFakeProcess(9601);
    const proc2 = createFakeProcess(9602);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      if (callCount <= 2) return callCount === 1 ? proc1 : proc2;
      return createFakeProcess(9603);
    });

    await startBuild(
      "proj-ack-event",
      { workspacePath: "/tmp/ack-event", agentType: "claude", timeoutMs: 0 },
      { onAgentEvent: (ev) => events.push(ev) },
    );

    proc1.stdout.push(null);
    proc1.stderr.push(null);
    proc1.emit("close", 1, null);
    await tick();
    proc2.stdout.push(null);
    proc2.stderr.push(null);
    proc2.emit("close", 1, null);
    await tick();

    acknowledgeEscalation("proj-ack-event", "abort");

    const ackEvent = events.find((e) => e.type === "escalation-acknowledged");
    expect(ackEvent).toBeTruthy();
    expect(ackEvent.decision).toBe("abort");
    expect(ackEvent.escalation.acknowledgedAt).toBeTruthy();
  });
});
