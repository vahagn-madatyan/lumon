import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";

import {
  startBuild,
  getStatus,
  getAgentOutput,
  checkAgentAvailability,
  createRingBuffer,
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
  // Ensure .on("data") works even after .on("close") — node streams support this
  proc.stdout.on("error", () => {});
  proc.stderr.on("error", () => {});
  return proc;
}

/**
 * Install a mock spawn that returns the given fake process(es).
 * Also installs a version-check process that succeeds by default.
 * @param {object|Function} procOrFactory — a fake process, or (cmd, args) => fakeProcess
 */
function installMockSpawn(procOrFactory) {
  const factory =
    typeof procOrFactory === "function"
      ? procOrFactory
      : () => procOrFactory;

  _setSpawn((cmd, args, opts) => {
    // Version checks get an auto-success process
    if (args.includes("--version")) {
      const versionProc = createFakeProcess(9999);
      process.nextTick(() => {
        versionProc.stdout.push(`${cmd} version 1.0.0\n`);
        versionProc.stdout.push(null);
        // Delay close so data events process first
        setTimeout(() => versionProc.emit("close", 0, null), 5);
      });
      return versionProc;
    }
    return factory(cmd, args, opts);
  });
}

/**
 * Install a mock spawn where the version check fails.
 */
function installMockSpawnUnavailable() {
  _setSpawn((cmd, args) => {
    const proc = createFakeProcess(0);
    process.nextTick(() => {
      proc.emit("error", new Error("ENOENT: command not found"));
    });
    return proc;
  });
}

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
// Ring Buffer
// ===================================================================

describe("createRingBuffer", () => {
  it("stores lines up to capacity", () => {
    const buf = createRingBuffer(3);
    buf.push("a");
    buf.push("b");
    buf.push("c");
    expect(buf.getAll()).toEqual(["a", "b", "c"]);
    expect(buf.length).toBe(3);
  });

  it("drops oldest lines when over capacity", () => {
    const buf = createRingBuffer(3);
    buf.push("a");
    buf.push("b");
    buf.push("c");
    buf.push("d");
    expect(buf.getAll()).toEqual(["b", "c", "d"]);
    expect(buf.length).toBe(3);
  });

  it("wraps around correctly with many pushes", () => {
    const buf = createRingBuffer(3);
    for (let i = 0; i < 10; i++) {
      buf.push(`line-${i}`);
    }
    expect(buf.getAll()).toEqual(["line-7", "line-8", "line-9"]);
  });

  it("returns empty array when nothing pushed", () => {
    const buf = createRingBuffer(5);
    expect(buf.getAll()).toEqual([]);
    expect(buf.length).toBe(0);
  });

  it("handles capacity of 1", () => {
    const buf = createRingBuffer(1);
    buf.push("first");
    buf.push("second");
    expect(buf.getAll()).toEqual(["second"]);
  });
});

// ===================================================================
// checkAgentAvailability
// ===================================================================

describe("checkAgentAvailability", () => {
  it("returns available=true with version on success", async () => {
    _setSpawn((cmd, args) => {
      const proc = createFakeProcess(100);
      process.nextTick(() => {
        proc.stdout.push("claude version 1.2.3\n");
        proc.stdout.push(null);
        setTimeout(() => proc.emit("close", 0, null), 5);
      });
      return proc;
    });

    const result = await checkAgentAvailability("claude");
    expect(result.available).toBe(true);
    expect(result.version).toBe("1.2.3");
  });

  it("returns available=false on non-zero exit", async () => {
    _setSpawn((cmd, args) => {
      const proc = createFakeProcess(100);
      process.nextTick(() => {
        proc.stderr.push("not found\n");
        proc.stderr.push(null);
        // Let data events process before emitting close
        setTimeout(() => proc.emit("close", 1, null), 5);
      });
      return proc;
    });

    const result = await checkAgentAvailability("claude");
    expect(result.available).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("returns available=false on spawn error (ENOENT)", async () => {
    _setSpawn(() => {
      const proc = createFakeProcess(0);
      process.nextTick(() => {
        proc.emit("error", new Error("spawn ENOENT"));
      });
      return proc;
    });

    const result = await checkAgentAvailability("codex");
    expect(result.available).toBe(false);
    expect(result.error).toContain("ENOENT");
  });

  it("returns error for unknown agent type", async () => {
    const result = await checkAgentAvailability("unknown-agent");
    expect(result.available).toBe(false);
    expect(result.error).toContain("Unknown agent type");
  });
});

// ===================================================================
// startBuild — successful lifecycle
// ===================================================================

describe("startBuild — successful lifecycle", () => {
  it("spawns agent, captures stdout, transitions to completed on exit 0", async () => {
    const events = [];
    const fakeProc = createFakeProcess(5678);

    installMockSpawn(fakeProc);

    const record = await startBuild(
      "proj-1",
      { workspacePath: "/tmp/test-workspace", agentType: "claude" },
      { onAgentEvent: (ev) => events.push(ev) },
    );

    expect(record.status).toBe("running");
    expect(record.agents).toHaveLength(1);
    expect(record.agents[0].pid).toBe(5678);
    expect(record.agents[0].status).toBe("running");

    // Verify spawned event
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("build-agent-spawned");
    expect(events[0].pid).toBe(5678);

    const agentId = record.agents[0].agentId;

    // Simulate stdout
    fakeProc.stdout.push("Building project...\n");
    fakeProc.stdout.push("Step 1 complete\nStep 2 complete\n");

    // Wait for data events to process
    await new Promise((r) => setTimeout(r, 10));

    // Verify output captured
    const output = getAgentOutput(agentId);
    expect(output).toContain("Building project...");
    expect(output).toContain("Step 1 complete");
    expect(output).toContain("Step 2 complete");

    // Simulate exit
    fakeProc.stdout.push(null);
    fakeProc.stderr.push(null);
    fakeProc.emit("close", 0, null);
    await new Promise((r) => setTimeout(r, 10));

    // Verify completed
    const status = getStatus("proj-1");
    expect(status.status).toBe("completed");
    expect(status.agents[0].status).toBe("completed");
    expect(status.agents[0].exitCode).toBe(0);
    expect(status.completedAt).toBeTruthy();

    // Verify events include completed
    const completedEvent = events.find((e) => e.type === "build-agent-completed");
    expect(completedEvent).toBeTruthy();
    expect(completedEvent.exitCode).toBe(0);
    expect(completedEvent.elapsed).toBeGreaterThanOrEqual(0);
  });

  it("tracks PID in agent record", async () => {
    const fakeProc = createFakeProcess(9876);
    installMockSpawn(fakeProc);

    const record = await startBuild("proj-pid", {
      workspacePath: "/tmp/test",
      agentType: "claude",
    });

    expect(record.agents[0].pid).toBe(9876);

    const status = getStatus("proj-pid");
    expect(status.agents[0].pid).toBe(9876);
  });
});

// ===================================================================
// startBuild — failed lifecycle
// ===================================================================

describe("startBuild — failed lifecycle", () => {
  it("transitions to failed on non-zero exit code", async () => {
    const events = [];
    const fakeProc = createFakeProcess(1111);
    installMockSpawn(fakeProc);

    const record = await startBuild(
      "proj-fail",
      { workspacePath: "/tmp/fail-workspace", agentType: "claude" },
      { onAgentEvent: (ev) => events.push(ev) },
    );

    const agentId = record.agents[0].agentId;

    // Simulate some output then failure
    fakeProc.stdout.push("Starting...\n");
    fakeProc.stderr.push("Error: something went wrong\n");
    fakeProc.stdout.push(null);
    fakeProc.stderr.push(null);
    fakeProc.emit("close", 1, null);
    await new Promise((r) => setTimeout(r, 10));

    const status = getStatus("proj-fail");
    expect(status.status).toBe("failed");
    expect(status.error).toContain("Exit code 1");
    expect(status.agents[0].status).toBe("failed");
    expect(status.agents[0].exitCode).toBe(1);

    // stderr captured in output buffer
    const output = getAgentOutput(agentId);
    expect(output.some((line) => line.includes("[stderr]"))).toBe(true);
    expect(output.some((line) => line.includes("something went wrong"))).toBe(true);

    // Failed event emitted
    const failEvent = events.find((e) => e.type === "build-agent-failed");
    expect(failEvent).toBeTruthy();
    expect(failEvent.exitCode).toBe(1);
  });

  it("handles signal-killed processes", async () => {
    const fakeProc = createFakeProcess(2222);
    installMockSpawn(fakeProc);

    await startBuild("proj-signal", {
      workspacePath: "/tmp/signal-workspace",
      agentType: "claude",
    });

    fakeProc.stdout.push(null);
    fakeProc.stderr.push(null);
    fakeProc.emit("close", null, "SIGTERM");
    await new Promise((r) => setTimeout(r, 10));

    const status = getStatus("proj-signal");
    expect(status.status).toBe("failed");
    expect(status.error).toContain("SIGTERM");
  });

  it("handles process error event (ENOENT after spawn)", async () => {
    const fakeProc = createFakeProcess(3333);
    installMockSpawn(fakeProc);

    await startBuild("proj-err", {
      workspacePath: "/tmp/err-workspace",
      agentType: "claude",
    });

    fakeProc.emit("error", new Error("spawn EACCES"));
    await new Promise((r) => setTimeout(r, 10));

    const status = getStatus("proj-err");
    expect(status.status).toBe("failed");
    expect(status.error).toContain("EACCES");
  });
});

// ===================================================================
// stderr capture
// ===================================================================

describe("stderr capture", () => {
  it("prefixes stderr lines with [stderr] in output buffer", async () => {
    const fakeProc = createFakeProcess(4444);
    installMockSpawn(fakeProc);

    const record = await startBuild("proj-stderr", {
      workspacePath: "/tmp/stderr-test",
      agentType: "claude",
    });

    const agentId = record.agents[0].agentId;

    fakeProc.stdout.push("normal output\n");
    fakeProc.stderr.push("warning: something\n");
    fakeProc.stderr.push("error: fatal\n");
    await new Promise((r) => setTimeout(r, 10));

    const output = getAgentOutput(agentId);
    expect(output).toContain("normal output");
    expect(output).toContain("[stderr] warning: something");
    expect(output).toContain("[stderr] error: fatal");
  });
});

// ===================================================================
// Ring buffer limits in real usage
// ===================================================================

describe("ring buffer limits with agent output", () => {
  it("retains only the last N lines when output exceeds capacity", async () => {
    // Use a small ring buffer — override the config temporarily
    const fakeProc = createFakeProcess(5555);
    installMockSpawn(fakeProc);

    const record = await startBuild("proj-ring", {
      workspacePath: "/tmp/ring-test",
      agentType: "claude",
    });

    const agentId = record.agents[0].agentId;

    // Push more lines than the default ring buffer (1000)
    // We'll push 1005 lines to verify overflow
    const lines = [];
    for (let i = 0; i < 1005; i++) {
      lines.push(`line-${i}`);
    }
    fakeProc.stdout.push(lines.join("\n") + "\n");
    await new Promise((r) => setTimeout(r, 20));

    const output = getAgentOutput(agentId);
    expect(output.length).toBe(1000);
    // Oldest 5 lines should be dropped
    expect(output[0]).toBe("line-5");
    expect(output[output.length - 1]).toBe("line-1004");
  });
});

// ===================================================================
// Concurrency guard
// ===================================================================

describe("concurrency guard", () => {
  it("rejects startBuild if a build is already running for the same project", async () => {
    const fakeProc = createFakeProcess(6666);
    installMockSpawn(fakeProc);

    await startBuild("proj-concurrent", {
      workspacePath: "/tmp/concurrent-test",
      agentType: "claude",
    });

    await expect(
      startBuild("proj-concurrent", {
        workspacePath: "/tmp/concurrent-test",
        agentType: "claude",
      }),
    ).rejects.toThrow("Build already running");
  });

  it("allows a new build after the previous one completes", async () => {
    const fakeProc1 = createFakeProcess(7001);
    installMockSpawn(fakeProc1);

    await startBuild("proj-rerun", {
      workspacePath: "/tmp/rerun-test",
      agentType: "claude",
    });

    // Complete the first build
    fakeProc1.stdout.push(null);
    fakeProc1.stderr.push(null);
    fakeProc1.emit("close", 0, null);
    await new Promise((r) => setTimeout(r, 10));

    // Now start another
    const fakeProc2 = createFakeProcess(7002);
    installMockSpawn(fakeProc2);

    const record = await startBuild("proj-rerun", {
      workspacePath: "/tmp/rerun-test",
      agentType: "claude",
    });

    expect(record.status).toBe("running");
    expect(record.agents[0].pid).toBe(7002);
  });

  it("allows builds on different projects simultaneously", async () => {
    const fakeProc1 = createFakeProcess(8001);
    const fakeProc2 = createFakeProcess(8002);
    let callCount = 0;

    installMockSpawn(() => {
      callCount++;
      return callCount === 1 ? fakeProc1 : fakeProc2;
    });

    await startBuild("proj-a", {
      workspacePath: "/tmp/proj-a",
      agentType: "claude",
    });
    await startBuild("proj-b", {
      workspacePath: "/tmp/proj-b",
      agentType: "claude",
    });

    const statusA = getStatus("proj-a");
    const statusB = getStatus("proj-b");
    expect(statusA.status).toBe("running");
    expect(statusB.status).toBe("running");
  });
});

// ===================================================================
// Validation
// ===================================================================

describe("startBuild validation", () => {
  it("throws when workspacePath is missing", async () => {
    await expect(
      startBuild("proj-no-path", {}),
    ).rejects.toThrow("workspacePath is required");
  });

  it("throws for unknown agent type", async () => {
    await expect(
      startBuild("proj-bad-agent", {
        workspacePath: "/tmp/test",
        agentType: "nonexistent",
      }),
    ).rejects.toThrow("Unknown agent type");
  });

  it("throws when agent CLI is not available", async () => {
    installMockSpawnUnavailable();

    await expect(
      startBuild("proj-no-cli", {
        workspacePath: "/tmp/test",
        agentType: "claude",
      }),
    ).rejects.toThrow("not available");
  });
});

// ===================================================================
// getStatus / getAgentOutput
// ===================================================================

describe("getStatus", () => {
  it("returns null for unknown projectId", () => {
    expect(getStatus("nonexistent")).toBeNull();
  });

  it("returns serializable status without ring buffer reference", async () => {
    const fakeProc = createFakeProcess(9001);
    installMockSpawn(fakeProc);

    await startBuild("proj-status", {
      workspacePath: "/tmp/status-test",
      agentType: "claude",
    });

    const status = getStatus("proj-status");
    expect(status.projectId).toBe("proj-status");
    expect(status.status).toBe("running");
    expect(status.agents[0].agentId).toBeTruthy();
    expect(status.agents[0].outputLines).toBe(0);
    // Should NOT expose the full outputBuffer object
    expect(status.agents[0].outputBuffer).toBeUndefined();
  });
});

describe("getAgentOutput", () => {
  it("returns null for unknown agentId", () => {
    expect(getAgentOutput("nonexistent-agent")).toBeNull();
  });

  it("returns output array for a known agent", async () => {
    const fakeProc = createFakeProcess(9002);
    installMockSpawn(fakeProc);

    const record = await startBuild("proj-output", {
      workspacePath: "/tmp/output-test",
      agentType: "claude",
    });

    const agentId = record.agents[0].agentId;
    fakeProc.stdout.push("hello world\n");
    await new Promise((r) => setTimeout(r, 10));

    const output = getAgentOutput(agentId);
    expect(Array.isArray(output)).toBe(true);
    expect(output).toContain("hello world");
  });
});

// ===================================================================
// onAgentEvent callback
// ===================================================================

describe("onAgentEvent callback", () => {
  it("emits spawned, output, and completed events in order", async () => {
    const events = [];
    const fakeProc = createFakeProcess(9500);
    installMockSpawn(fakeProc);

    await startBuild(
      "proj-events",
      { workspacePath: "/tmp/events-test", agentType: "claude" },
      { onAgentEvent: (ev) => events.push(ev) },
    );

    // spawned event
    expect(events[0].type).toBe("build-agent-spawned");

    // stdout
    fakeProc.stdout.push("output line\n");
    await new Promise((r) => setTimeout(r, 10));
    const outputEvents = events.filter((e) => e.type === "build-agent-output");
    expect(outputEvents.length).toBeGreaterThan(0);
    expect(outputEvents[0].stream).toBe("stdout");

    // completion
    fakeProc.stdout.push(null);
    fakeProc.stderr.push(null);
    fakeProc.emit("close", 0, null);
    await new Promise((r) => setTimeout(r, 10));
    const completedEvents = events.filter((e) => e.type === "build-agent-completed");
    expect(completedEvents).toHaveLength(1);
  });

  it("works without onAgentEvent callback (no throw)", async () => {
    const fakeProc = createFakeProcess(9600);
    installMockSpawn(fakeProc);

    const record = await startBuild("proj-no-cb", {
      workspacePath: "/tmp/no-cb-test",
      agentType: "claude",
    });

    fakeProc.stdout.push("output\n");
    fakeProc.stdout.push(null);
    fakeProc.stderr.push(null);
    fakeProc.emit("close", 0, null);
    await new Promise((r) => setTimeout(r, 10));

    const status = getStatus("proj-no-cb");
    expect(status.status).toBe("completed");
  });
});

// ===================================================================
// Partial line handling
// ===================================================================

describe("partial line handling", () => {
  it("buffers incomplete lines until newline arrives", async () => {
    const fakeProc = createFakeProcess(9700);
    installMockSpawn(fakeProc);

    const record = await startBuild("proj-partial", {
      workspacePath: "/tmp/partial-test",
      agentType: "claude",
    });

    const agentId = record.agents[0].agentId;

    // Push partial line
    fakeProc.stdout.push("partial");
    await new Promise((r) => setTimeout(r, 10));
    expect(getAgentOutput(agentId)).toEqual([]); // not yet complete

    // Complete the line
    fakeProc.stdout.push(" line\n");
    await new Promise((r) => setTimeout(r, 10));
    expect(getAgentOutput(agentId)).toEqual(["partial line"]);
  });

  it("flushes remainder on process close", async () => {
    const fakeProc = createFakeProcess(9800);
    installMockSpawn(fakeProc);

    const record = await startBuild("proj-flush", {
      workspacePath: "/tmp/flush-test",
      agentType: "claude",
    });

    const agentId = record.agents[0].agentId;

    fakeProc.stdout.push("no newline at end");
    // Let the data event process before closing
    await new Promise((r) => setTimeout(r, 10));
    fakeProc.stdout.push(null);
    fakeProc.stderr.push(null);
    fakeProc.emit("close", 0, null);
    await new Promise((r) => setTimeout(r, 10));

    expect(getAgentOutput(agentId)).toContain("no newline at end");
  });
});
