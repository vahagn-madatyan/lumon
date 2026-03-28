/**
 * Live integration test for execution service against real processes.
 *
 * Guarded by LIVE_INTEGRATION env var — skipped in normal test runs.
 *
 * Echo-based test: proves full lifecycle with real process I/O (no agent CLI required).
 * Agent CLI test: proves real agent CLI integration (requires claude or codex in PATH).
 *
 * Follows the M003 pattern from provisioning-live.test.js.
 */

import { describe, it, expect, afterAll, afterEach } from "vitest";
import { spawn as nodeSpawn } from "node:child_process";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

import {
  startBuild,
  getStatus,
  getAgentOutput,
  checkAgentAvailability,
  clear,
  _setSpawn,
  _resetSpawn,
} from "../execution.js";

// ---------------------------------------------------------------------------
// Tracked PIDs for afterAll cleanup
// ---------------------------------------------------------------------------

const trackedPids = new Set();

// ---------------------------------------------------------------------------
// Helper — poll until build exits "running" state
// ---------------------------------------------------------------------------

function waitForCompletion(projectId, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const status = getStatus(projectId);
      if (!status || status.status !== "running") {
        clearInterval(interval);
        resolve(status);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(
          new Error(
            `Timed out waiting for ${projectId} to leave running state after ${timeoutMs}ms`,
          ),
        );
      }
    }, 100);
  });
}

// ---------------------------------------------------------------------------
// Guard: skip entire suite unless LIVE_INTEGRATION is set
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.LIVE_INTEGRATION)(
  "execution — live integration",
  () => {
    // Temp workspace for real agent test (created on demand, cleaned up in afterAll)
    let agentTestWorkspace = null;

    // ----------------------------------------------------------------
    // Teardown
    // ----------------------------------------------------------------

    afterEach(() => {
      _resetSpawn();
      clear();
    });

    afterAll(() => {
      // 1. Kill orphaned agent processes
      let killed = 0;
      for (const pid of trackedPids) {
        try {
          process.kill(pid, 0); // probe — throws if already dead
          process.kill(pid, "SIGTERM");
          killed++;
          console.log(`[live-test] killed orphaned process PID ${pid}`);
        } catch {
          // Already exited — expected
        }
      }
      if (killed > 0) {
        console.log(
          `[live-test] cleanup: killed ${killed} orphaned process(es)`,
        );
      } else {
        console.log("[live-test] cleanup: no orphaned processes");
      }
      trackedPids.clear();

      // 2. Remove temp workspace if we created one
      if (agentTestWorkspace && !process.env.LIVE_TEST_WORKSPACE) {
        try {
          fs.rmSync(agentTestWorkspace, { recursive: true, force: true });
          console.log(
            `[live-test] removed temp workspace: ${agentTestWorkspace}`,
          );
        } catch (err) {
          console.error(
            `[live-test] cleanup: failed to remove workspace: ${err.message}`,
          );
        }
      }

      // 3. Reset execution state
      _resetSpawn();
      clear();
    });

    // ----------------------------------------------------------------
    // Test 1: Echo-based lifecycle — always runs under LIVE_INTEGRATION
    // ----------------------------------------------------------------

    it(
      "echo-based: spawns real process, captures output, completes with exit 0",
      async () => {
        // Redirect agent CLI commands to real echo/bash processes.
        // Uses real child_process.spawn underneath — only the binary is swapped.
        _setSpawn((cmd, args, opts) => {
          if (args.includes("--version")) {
            // Pre-flight version check → echo a fake version string
            const proc = nodeSpawn(
              "echo",
              ["claude version 1.0.0-live-test"],
              { ...opts, stdio: ["ignore", "pipe", "pipe"] },
            );
            if (proc.pid) trackedPids.add(proc.pid);
            return proc;
          }
          // Exec call → bash script with multi-line output + exit 0
          const proc = nodeSpawn(
            "bash",
            [
              "-c",
              'echo "hello world" && echo "build step 1" && echo "build step 2" && echo "done"',
            ],
            { ...opts, stdio: ["ignore", "pipe", "pipe"] },
          );
          if (proc.pid) trackedPids.add(proc.pid);
          return proc;
        });

        const events = [];
        const record = await startBuild(
          "live-echo",
          { workspacePath: "/tmp", agentType: "claude" },
          { onAgentEvent: (ev) => events.push(ev) },
        );

        // — Agent spawned with a real PID
        expect(record.status).toBe("running");
        expect(record.agents).toHaveLength(1);

        const agent = record.agents[0];
        expect(agent.pid).toBeGreaterThan(0);
        trackedPids.add(agent.pid);
        console.log(`[live-test] echo process spawned, PID ${agent.pid}`);

        // — Wait for completion
        const finalStatus = await waitForCompletion("live-echo", 15_000);

        // — Status transitions to completed with exit code 0
        expect(finalStatus).not.toBeNull();
        expect(finalStatus.status).toBe("completed");
        expect(finalStatus.agents[0].exitCode).toBe(0);
        expect(finalStatus.agents[0].status).toBe("completed");
        expect(finalStatus.completedAt).toBeTruthy();
        expect(finalStatus.startedAt).toBeTruthy();

        // — stdout captured in ring buffer
        const output = getAgentOutput(agent.agentId);
        expect(output).toContain("hello world");
        expect(output.length).toBeGreaterThanOrEqual(4); // 4 echo lines
        console.log(
          `[live-test] captured ${output.length} output line(s): ${output.slice(0, 2).join(", ")}…`,
        );

        // — Spawned event emitted with real PID
        const spawnedEvent = events.find(
          (e) => e.type === "build-agent-spawned",
        );
        expect(spawnedEvent).toBeTruthy();
        expect(spawnedEvent.pid).toBeGreaterThan(0);
        expect(spawnedEvent.agentType).toBe("claude");

        // — Completed event with elapsed time
        const completedEvent = events.find(
          (e) => e.type === "build-agent-completed",
        );
        expect(completedEvent).toBeTruthy();
        expect(completedEvent.exitCode).toBe(0);
        expect(completedEvent.elapsed).toBeGreaterThanOrEqual(0);

        // — Output events fired
        const outputEvents = events.filter(
          (e) => e.type === "build-agent-output",
        );
        expect(outputEvents.length).toBeGreaterThan(0);

        // — getStatus returns consistent, serializable state
        expect(finalStatus.projectId).toBe("live-echo");
        expect(finalStatus.agents).toHaveLength(1);
        expect(typeof finalStatus.startedAt).toBe("string");
        expect(typeof finalStatus.completedAt).toBe("string");
        expect(finalStatus.agents[0].outputBuffer).toBeUndefined(); // not leaked

        console.log("[live-test] echo lifecycle test passed ✓");
      },
      60_000,
    );

    // ----------------------------------------------------------------
    // Test 2: Real agent CLI — skips gracefully if no CLI in PATH
    // ----------------------------------------------------------------

    it(
      "real agent CLI: spawns agent, captures output, reaches terminal status",
      async () => {
        // Use real spawn — no injection
        _resetSpawn();

        // Check which agent CLI is available
        const claudeCheck = await checkAgentAvailability("claude");
        const codexCheck = await checkAgentAvailability("codex");

        if (!claudeCheck.available && !codexCheck.available) {
          console.log(
            "[live-test] no agent CLI (claude or codex) in PATH — skipping real agent test",
          );
          return; // graceful skip
        }

        const agentType = claudeCheck.available ? "claude" : "codex";
        const agentVersion = claudeCheck.available
          ? claudeCheck.version
          : codexCheck.version;
        console.log(
          `[live-test] using agent CLI: ${agentType} (version: ${agentVersion})`,
        );

        // Set up workspace — prefer env var, fall back to temp dir
        agentTestWorkspace =
          process.env.LIVE_TEST_WORKSPACE ||
          fs.mkdtempSync(path.join(os.tmpdir(), "lumon-exec-live-"));
        console.log(`[live-test] workspace: ${agentTestWorkspace}`);

        const events = [];
        const record = await startBuild(
          "live-agent",
          {
            workspacePath: agentTestWorkspace,
            agentType,
            prompt:
              'Respond with just the word "hello" and nothing else. Do not create, edit, or delete any files.',
          },
          { onAgentEvent: (ev) => events.push(ev) },
        );

        // — Agent spawned with real PID
        expect(record.status).toBe("running");
        expect(record.agents).toHaveLength(1);

        const agent = record.agents[0];
        expect(agent.pid).toBeGreaterThan(0);
        trackedPids.add(agent.pid);
        console.log(`[live-test] real agent spawned, PID ${agent.pid}`);

        // — Wait for terminal state (agent CLIs may take time)
        const finalStatus = await waitForCompletion("live-agent", 110_000);

        // — Terminal status: completed or failed, both prove the lifecycle
        expect(finalStatus).not.toBeNull();
        expect(["completed", "failed"]).toContain(finalStatus.status);
        console.log(
          `[live-test] agent finished with status: ${finalStatus.status}`,
        );

        // — Output captured in ring buffer
        const output = getAgentOutput(agent.agentId);
        expect(output).not.toBeNull();
        expect(output.length).toBeGreaterThan(0);
        console.log(`[live-test] captured ${output.length} output line(s)`);

        // — Elapsed time is non-zero
        const agentStatus = finalStatus.agents[0];
        expect(agentStatus.startedAt).toBeTruthy();
        expect(agentStatus.completedAt).toBeTruthy();
        const elapsed =
          new Date(agentStatus.completedAt) - new Date(agentStatus.startedAt);
        expect(elapsed).toBeGreaterThan(0);
        console.log(`[live-test] agent elapsed: ${elapsed}ms`);

        // — PID was tracked correctly
        expect(agentStatus.pid).toBeGreaterThan(0);

        // — Spawned event emitted with correct agent type
        const spawnedEvent = events.find(
          (e) => e.type === "build-agent-spawned",
        );
        expect(spawnedEvent).toBeTruthy();
        expect(spawnedEvent.agentType).toBe(agentType);
        expect(spawnedEvent.pid).toBeGreaterThan(0);

        // — Terminal event emitted (completed or failed)
        const terminalEvent = events.find(
          (e) =>
            e.type === "build-agent-completed" ||
            e.type === "build-agent-failed",
        );
        expect(terminalEvent).toBeTruthy();
        expect(terminalEvent.elapsed).toBeGreaterThan(0);

        console.log("[live-test] real agent CLI test passed ✓");
      },
      120_000,
    );
  },
);
