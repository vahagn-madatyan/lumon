import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";

import {
  startBuild,
  getStatus,
  getAgentOutput,
  getActiveBuilds,
  getActiveEscalations,
  acknowledgeEscalation,
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
  proc.kill = vi.fn();
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
// Concurrent builds for different projects
// ===================================================================

describe("concurrent builds for different projects", () => {
  it("starts two builds simultaneously with different projectIds", async () => {
    const procA = createFakeProcess(100);
    const procB = createFakeProcess(200);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? procA : procB;
    });

    const recordA = await startBuild("project-alpha", {
      workspacePath: "/tmp/alpha",
      agentType: "claude",
      timeoutMs: 0,
    });
    const recordB = await startBuild("project-beta", {
      workspacePath: "/tmp/beta",
      agentType: "claude",
      timeoutMs: 0,
    });

    expect(recordA.status).toBe("running");
    expect(recordB.status).toBe("running");
    expect(recordA.agents[0].pid).toBe(100);
    expect(recordB.agents[0].pid).toBe(200);

    const statusA = getStatus("project-alpha");
    const statusB = getStatus("project-beta");
    expect(statusA.status).toBe("running");
    expect(statusB.status).toBe("running");
    expect(statusA.projectId).toBe("project-alpha");
    expect(statusB.projectId).toBe("project-beta");
  });

  it("rejects duplicate build for same projectId while another is running", async () => {
    const proc = createFakeProcess(300);
    installMockSpawn(proc);

    await startBuild("project-dup", {
      workspacePath: "/tmp/dup",
      agentType: "claude",
      timeoutMs: 0,
    });

    await expect(
      startBuild("project-dup", {
        workspacePath: "/tmp/dup",
        agentType: "claude",
        timeoutMs: 0,
      }),
    ).rejects.toThrow("Build already running");
  });

  it("allows three or more concurrent projects", async () => {
    let callCount = 0;
    installMockSpawn(() => {
      callCount++;
      return createFakeProcess(400 + callCount);
    });

    await startBuild("proj-1", { workspacePath: "/tmp/1", agentType: "claude", timeoutMs: 0 });
    await startBuild("proj-2", { workspacePath: "/tmp/2", agentType: "claude", timeoutMs: 0 });
    await startBuild("proj-3", { workspacePath: "/tmp/3", agentType: "claude", timeoutMs: 0 });

    expect(getStatus("proj-1").status).toBe("running");
    expect(getStatus("proj-2").status).toBe("running");
    expect(getStatus("proj-3").status).toBe("running");
    expect(getActiveBuilds()).toHaveLength(3);
  });
});

// ===================================================================
// State map isolation per projectId
// ===================================================================

describe("state map isolation per projectId", () => {
  it("each project has independent agents, status, and retry counts", async () => {
    const procA1 = createFakeProcess(500);
    const procA2 = createFakeProcess(501);
    const procB = createFakeProcess(600);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      if (callCount === 1) return procA1;
      if (callCount === 2) return procB;
      return procA2; // retry spawn for project-alpha
    });

    await startBuild("project-alpha", {
      workspacePath: "/tmp/alpha",
      agentType: "claude",
      timeoutMs: 0,
    });
    await startBuild("project-beta", {
      workspacePath: "/tmp/beta",
      agentType: "claude",
      timeoutMs: 0,
    });

    // Fail project-alpha (triggers auto-retry)
    procA1.stdout.push(null);
    procA1.stderr.push("alpha error\n");
    procA1.stderr.push(null);
    procA1.emit("close", 1, null);
    await tick();

    // project-alpha should be retrying; project-beta should be unaffected
    const statusA = getStatus("project-alpha");
    const statusB = getStatus("project-beta");

    expect(statusA.status).toBe("running"); // retrying
    expect(statusA.agents[0].retryCount).toBe(1);
    expect(statusB.status).toBe("running");
    expect(statusB.agents[0].retryCount).toBe(0);
  });

  it("output buffers are project-isolated", async () => {
    const procA = createFakeProcess(700);
    const procB = createFakeProcess(800);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? procA : procB;
    });

    const recA = await startBuild("proj-out-a", {
      workspacePath: "/tmp/out-a",
      agentType: "claude",
      timeoutMs: 0,
    });
    const recB = await startBuild("proj-out-b", {
      workspacePath: "/tmp/out-b",
      agentType: "claude",
      timeoutMs: 0,
    });

    const agentIdA = recA.agents[0].agentId;
    const agentIdB = recB.agents[0].agentId;

    procA.stdout.push("alpha output line 1\nalpha output line 2\n");
    procB.stdout.push("beta output line 1\n");
    await tick();

    const outputA = getAgentOutput(agentIdA);
    const outputB = getAgentOutput(agentIdB);

    expect(outputA).toContain("alpha output line 1");
    expect(outputA).toContain("alpha output line 2");
    expect(outputA).not.toContain("beta output line 1");

    expect(outputB).toContain("beta output line 1");
    expect(outputB).not.toContain("alpha output line 1");
  });

  it("escalation state is project-scoped", async () => {
    // project-alpha will escalate; project-beta stays running
    const procA1 = createFakeProcess(900);
    const procA2 = createFakeProcess(901);
    const procB = createFakeProcess(1000);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      if (callCount === 1) return procA1;
      if (callCount === 2) return procB;
      return procA2; // retry spawn for project-alpha
    });

    await startBuild("proj-esc-a", {
      workspacePath: "/tmp/esc-a",
      agentType: "claude",
      timeoutMs: 0,
    });
    await startBuild("proj-esc-b", {
      workspacePath: "/tmp/esc-b",
      agentType: "claude",
      timeoutMs: 0,
    });

    // First failure on project-alpha → auto-retry
    procA1.stdout.push(null);
    procA1.stderr.push(null);
    procA1.emit("close", 1, null);
    await tick();

    // Second failure on project-alpha → escalation
    procA2.stdout.push(null);
    procA2.stderr.push("final error\n");
    procA2.stderr.push(null);
    procA2.emit("close", 1, null);
    await tick();

    const statusA = getStatus("proj-esc-a");
    const statusB = getStatus("proj-esc-b");

    expect(statusA.status).toBe("escalated");
    expect(statusA.escalation).toBeTruthy();
    expect(statusA.escalation.status).toBe("raised");

    expect(statusB.status).toBe("running");
    expect(statusB.escalation).toBeNull();
  });
});

// ===================================================================
// SSE event isolation per projectId
// ===================================================================

describe("SSE event isolation per projectId", () => {
  it("onAgentEvent callbacks are project-scoped", async () => {
    const eventsA = [];
    const eventsB = [];
    const procA = createFakeProcess(1100);
    const procB = createFakeProcess(1200);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? procA : procB;
    });

    await startBuild(
      "proj-ev-a",
      { workspacePath: "/tmp/ev-a", agentType: "claude", timeoutMs: 0 },
      { onAgentEvent: (ev) => eventsA.push(ev) },
    );
    await startBuild(
      "proj-ev-b",
      { workspacePath: "/tmp/ev-b", agentType: "claude", timeoutMs: 0 },
      { onAgentEvent: (ev) => eventsB.push(ev) },
    );

    // Output on project-alpha only
    procA.stdout.push("alpha data\n");
    await tick();

    // Output on project-beta only
    procB.stdout.push("beta data\n");
    await tick();

    // project-alpha callback only sees alpha events
    const alphaOutputEvents = eventsA.filter((e) => e.type === "build-agent-output");
    expect(alphaOutputEvents.length).toBeGreaterThan(0);
    expect(alphaOutputEvents.every((e) => e.projectId === "proj-ev-a")).toBe(true);

    // project-beta callback only sees beta events
    const betaOutputEvents = eventsB.filter((e) => e.type === "build-agent-output");
    expect(betaOutputEvents.length).toBeGreaterThan(0);
    expect(betaOutputEvents.every((e) => e.projectId === "proj-ev-b")).toBe(true);
  });

  it("retry events route to the correct project's callback", async () => {
    const eventsA = [];
    const eventsB = [];
    const procA1 = createFakeProcess(1300);
    const procA2 = createFakeProcess(1301);
    const procB = createFakeProcess(1400);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      if (callCount === 1) return procA1;
      if (callCount === 2) return procB;
      return procA2; // retry for proj-ev-retry-a
    });

    await startBuild(
      "proj-ev-retry-a",
      { workspacePath: "/tmp/ev-retry-a", agentType: "claude", timeoutMs: 0 },
      { onAgentEvent: (ev) => eventsA.push(ev) },
    );
    await startBuild(
      "proj-ev-retry-b",
      { workspacePath: "/tmp/ev-retry-b", agentType: "claude", timeoutMs: 0 },
      { onAgentEvent: (ev) => eventsB.push(ev) },
    );

    // Fail project-alpha to trigger retry
    procA1.stdout.push(null);
    procA1.stderr.push(null);
    procA1.emit("close", 1, null);
    await tick();

    // project-alpha should have retry events
    expect(eventsA.some((e) => e.type === "retry-started")).toBe(true);
    // project-beta should NOT have retry events
    expect(eventsB.some((e) => e.type === "retry-started")).toBe(false);
  });

  it("escalation events route to the correct project's callback", async () => {
    const eventsA = [];
    const eventsB = [];
    const procA1 = createFakeProcess(1500);
    const procA2 = createFakeProcess(1501);
    const procB = createFakeProcess(1600);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      if (callCount === 1) return procA1;
      if (callCount === 2) return procB;
      return procA2;
    });

    await startBuild(
      "proj-ev-esc-a",
      { workspacePath: "/tmp/ev-esc-a", agentType: "claude", timeoutMs: 0 },
      { onAgentEvent: (ev) => eventsA.push(ev) },
    );
    await startBuild(
      "proj-ev-esc-b",
      { workspacePath: "/tmp/ev-esc-b", agentType: "claude", timeoutMs: 0 },
      { onAgentEvent: (ev) => eventsB.push(ev) },
    );

    // Drive project-alpha to escalation (two failures)
    procA1.stdout.push(null);
    procA1.stderr.push(null);
    procA1.emit("close", 1, null);
    await tick();

    procA2.stdout.push(null);
    procA2.stderr.push(null);
    procA2.emit("close", 1, null);
    await tick();

    expect(eventsA.some((e) => e.type === "escalation-raised")).toBe(true);
    expect(eventsB.some((e) => e.type === "escalation-raised")).toBe(false);
  });
});

// ===================================================================
// One project's failure doesn't affect another
// ===================================================================

describe("failure isolation between projects", () => {
  it("one project failing and retrying does not change the other's status", async () => {
    const procA1 = createFakeProcess(1700);
    const procA2 = createFakeProcess(1701);
    const procB = createFakeProcess(1800);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      if (callCount === 1) return procA1;
      if (callCount === 2) return procB;
      return procA2;
    });

    await startBuild("proj-fail-a", {
      workspacePath: "/tmp/fail-a",
      agentType: "claude",
      timeoutMs: 0,
    });
    await startBuild("proj-fail-b", {
      workspacePath: "/tmp/fail-b",
      agentType: "claude",
      timeoutMs: 0,
    });

    // Fail project-alpha
    procA1.stdout.push(null);
    procA1.stderr.push("alpha broke\n");
    procA1.stderr.push(null);
    procA1.emit("close", 1, null);
    await tick();

    // project-beta is completely unaffected
    const statusB = getStatus("proj-fail-b");
    expect(statusB.status).toBe("running");
    expect(statusB.agents[0].retryCount).toBe(0);
    expect(statusB.agents[0].status).toBe("running");
    expect(statusB.agents[0].error).toBeNull();
  });

  it("one project escalating while another completes successfully", async () => {
    const procA1 = createFakeProcess(1900);
    const procA2 = createFakeProcess(1901);
    const procB = createFakeProcess(2000);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      if (callCount === 1) return procA1;
      if (callCount === 2) return procB;
      return procA2;
    });

    await startBuild("proj-iso-a", {
      workspacePath: "/tmp/iso-a",
      agentType: "claude",
      timeoutMs: 0,
    });
    await startBuild("proj-iso-b", {
      workspacePath: "/tmp/iso-b",
      agentType: "claude",
      timeoutMs: 0,
    });

    // project-alpha: first failure → retry
    procA1.stdout.push(null);
    procA1.stderr.push(null);
    procA1.emit("close", 1, null);
    await tick();

    // project-beta: successful completion
    procB.stdout.push("done!\n");
    procB.stdout.push(null);
    procB.stderr.push(null);
    procB.emit("close", 0, null);
    await tick();

    expect(getStatus("proj-iso-b").status).toBe("completed");
    expect(getStatus("proj-iso-a").status).toBe("running"); // retrying

    // project-alpha: second failure → escalation
    procA2.stdout.push(null);
    procA2.stderr.push(null);
    procA2.emit("close", 1, null);
    await tick();

    expect(getStatus("proj-iso-a").status).toBe("escalated");
    expect(getStatus("proj-iso-b").status).toBe("completed"); // still completed
  });

  it("acknowledging one project's escalation does not affect another", async () => {
    // Escalate both projects
    const procA1 = createFakeProcess(2100);
    const procA2 = createFakeProcess(2101);
    const procB1 = createFakeProcess(2200);
    const procB2 = createFakeProcess(2201);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      if (callCount === 1) return procA1;
      if (callCount === 2) return procB1;
      if (callCount === 3) return procA2;
      return procB2;
    });

    await startBuild("proj-ack-a", {
      workspacePath: "/tmp/ack-a",
      agentType: "claude",
      timeoutMs: 0,
    });
    await startBuild("proj-ack-b", {
      workspacePath: "/tmp/ack-b",
      agentType: "claude",
      timeoutMs: 0,
    });

    // Drive both to escalation
    procA1.stdout.push(null);
    procA1.stderr.push(null);
    procA1.emit("close", 1, null);
    await tick();
    procA2.stdout.push(null);
    procA2.stderr.push(null);
    procA2.emit("close", 1, null);
    await tick();

    procB1.stdout.push(null);
    procB1.stderr.push(null);
    procB1.emit("close", 1, null);
    await tick();
    procB2.stdout.push(null);
    procB2.stderr.push(null);
    procB2.emit("close", 1, null);
    await tick();

    expect(getStatus("proj-ack-a").status).toBe("escalated");
    expect(getStatus("proj-ack-b").status).toBe("escalated");
    expect(getActiveEscalations()).toHaveLength(2);

    // Abort project-alpha — project-beta should remain escalated
    acknowledgeEscalation("proj-ack-a", "abort");

    expect(getStatus("proj-ack-a").status).toBe("aborted");
    expect(getStatus("proj-ack-b").status).toBe("escalated");
    expect(getActiveEscalations()).toHaveLength(1);
    expect(getActiveEscalations()[0].projectId).toBe("proj-ack-b");
  });
});

// ===================================================================
// getActiveBuilds
// ===================================================================

describe("getActiveBuilds", () => {
  it("returns empty array when no builds exist", () => {
    expect(getActiveBuilds()).toEqual([]);
  });

  it("returns projectIds for running builds", async () => {
    let callCount = 0;
    installMockSpawn(() => {
      callCount++;
      return createFakeProcess(2300 + callCount);
    });

    await startBuild("proj-active-1", {
      workspacePath: "/tmp/active-1",
      agentType: "claude",
      timeoutMs: 0,
    });
    await startBuild("proj-active-2", {
      workspacePath: "/tmp/active-2",
      agentType: "claude",
      timeoutMs: 0,
    });

    const active = getActiveBuilds();
    expect(active).toHaveLength(2);
    expect(active).toContain("proj-active-1");
    expect(active).toContain("proj-active-2");
  });

  it("includes escalated builds in active list", async () => {
    const proc1 = createFakeProcess(2400);
    const proc2 = createFakeProcess(2401);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? proc1 : proc2;
    });

    await startBuild("proj-esc-active", {
      workspacePath: "/tmp/esc-active",
      agentType: "claude",
      timeoutMs: 0,
    });

    // Drive to escalation
    proc1.stdout.push(null);
    proc1.stderr.push(null);
    proc1.emit("close", 1, null);
    await tick();
    proc2.stdout.push(null);
    proc2.stderr.push(null);
    proc2.emit("close", 1, null);
    await tick();

    expect(getStatus("proj-esc-active").status).toBe("escalated");
    expect(getActiveBuilds()).toContain("proj-esc-active");
  });

  it("excludes completed builds from active list", async () => {
    const proc = createFakeProcess(2500);
    installMockSpawn(proc);

    await startBuild("proj-done", {
      workspacePath: "/tmp/done",
      agentType: "claude",
      timeoutMs: 0,
    });

    proc.stdout.push(null);
    proc.stderr.push(null);
    proc.emit("close", 0, null);
    await tick();

    expect(getStatus("proj-done").status).toBe("completed");
    expect(getActiveBuilds()).not.toContain("proj-done");
  });

  it("excludes aborted builds from active list", async () => {
    const proc1 = createFakeProcess(2600);
    const proc2 = createFakeProcess(2601);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? proc1 : proc2;
    });

    await startBuild("proj-aborted", {
      workspacePath: "/tmp/aborted",
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

    acknowledgeEscalation("proj-aborted", "abort");

    expect(getStatus("proj-aborted").status).toBe("aborted");
    expect(getActiveBuilds()).not.toContain("proj-aborted");
  });

  it("returns mix of running and escalated projects", async () => {
    const procRunning = createFakeProcess(2700);
    const procEsc1 = createFakeProcess(2800);
    const procEsc2 = createFakeProcess(2801);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      if (callCount === 1) return procRunning;
      if (callCount === 2) return procEsc1;
      return procEsc2;
    });

    await startBuild("proj-mix-running", {
      workspacePath: "/tmp/mix-running",
      agentType: "claude",
      timeoutMs: 0,
    });
    await startBuild("proj-mix-escalated", {
      workspacePath: "/tmp/mix-escalated",
      agentType: "claude",
      timeoutMs: 0,
    });

    // Drive proj-mix-escalated to escalation
    procEsc1.stdout.push(null);
    procEsc1.stderr.push(null);
    procEsc1.emit("close", 1, null);
    await tick();
    procEsc2.stdout.push(null);
    procEsc2.stderr.push(null);
    procEsc2.emit("close", 1, null);
    await tick();

    const active = getActiveBuilds();
    expect(active).toHaveLength(2);
    expect(active).toContain("proj-mix-running");
    expect(active).toContain("proj-mix-escalated");
  });
});

// ===================================================================
// getStatus returns correct state per project
// ===================================================================

describe("getStatus correctness per project", () => {
  it("returns independent status for each project", async () => {
    const procA = createFakeProcess(2900);
    const procB = createFakeProcess(3000);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? procA : procB;
    });

    await startBuild("proj-status-a", {
      workspacePath: "/tmp/status-a",
      agentType: "claude",
      timeoutMs: 0,
    });
    await startBuild("proj-status-b", {
      workspacePath: "/tmp/status-b",
      agentType: "claude",
      timeoutMs: 0,
    });

    // Complete project-alpha
    procA.stdout.push("alpha done\n");
    procA.stdout.push(null);
    procA.stderr.push(null);
    procA.emit("close", 0, null);
    await tick();

    const statusA = getStatus("proj-status-a");
    const statusB = getStatus("proj-status-b");

    expect(statusA.status).toBe("completed");
    expect(statusA.agents[0].exitCode).toBe(0);
    expect(statusA.completedAt).toBeTruthy();

    expect(statusB.status).toBe("running");
    expect(statusB.agents[0].exitCode).toBeNull();
    expect(statusB.completedAt).toBeNull();
  });

  it("returns null for unknown projectId", () => {
    expect(getStatus("nonexistent-project")).toBeNull();
  });
});

// ===================================================================
// Edge cases
// ===================================================================

describe("multi-project edge cases", () => {
  it("a project can start a new build after its previous build completed", async () => {
    const proc1 = createFakeProcess(3100);
    const proc2 = createFakeProcess(3200);
    const proc3 = createFakeProcess(3300);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      if (callCount === 1) return proc1;
      if (callCount === 2) return proc2;
      return proc3;
    });

    // Start and complete project-alpha
    await startBuild("proj-reuse", {
      workspacePath: "/tmp/reuse",
      agentType: "claude",
      timeoutMs: 0,
    });
    proc1.stdout.push(null);
    proc1.stderr.push(null);
    proc1.emit("close", 0, null);
    await tick();

    // Start project-beta concurrently
    await startBuild("proj-other", {
      workspacePath: "/tmp/other",
      agentType: "claude",
      timeoutMs: 0,
    });

    // Start a new build on project-alpha (should succeed — previous completed)
    const record = await startBuild("proj-reuse", {
      workspacePath: "/tmp/reuse",
      agentType: "claude",
      timeoutMs: 0,
    });

    expect(record.status).toBe("running");
    expect(getActiveBuilds()).toContain("proj-reuse");
    expect(getActiveBuilds()).toContain("proj-other");
  });

  it("clear() removes all projects' state", async () => {
    let callCount = 0;
    installMockSpawn(() => {
      callCount++;
      return createFakeProcess(3400 + callCount);
    });

    await startBuild("proj-clear-a", {
      workspacePath: "/tmp/clear-a",
      agentType: "claude",
      timeoutMs: 0,
    });
    await startBuild("proj-clear-b", {
      workspacePath: "/tmp/clear-b",
      agentType: "claude",
      timeoutMs: 0,
    });

    expect(getActiveBuilds()).toHaveLength(2);

    clear();

    expect(getActiveBuilds()).toEqual([]);
    expect(getStatus("proj-clear-a")).toBeNull();
    expect(getStatus("proj-clear-b")).toBeNull();
  });
});
