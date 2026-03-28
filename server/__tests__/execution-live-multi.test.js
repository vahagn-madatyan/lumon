/**
 * Live multi-project integration test for execution service.
 *
 * Guarded by LIVE_INTEGRATION env var — skipped in normal test runs.
 *
 * Proves:
 *   1. Two concurrent builds run with isolated state
 *   2. Failure on one project triggers auto-retry
 *   3. Second failure triggers escalation while other project is unaffected
 *   4. cleanupAllBuilds kills remaining processes
 *
 * Uses real child_process.spawn with bash scripts (no agent CLI required).
 */

import { describe, it, expect, afterAll, afterEach, beforeAll } from "vitest";
import { spawn as nodeSpawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  startBuild,
  getStatus,
  getAgentOutput,
  getActiveBuilds,
  getActiveEscalations,
  cleanupAllBuilds,
  clear,
  _setSpawn,
  _resetSpawn,
} from "../execution.js";

// ---------------------------------------------------------------------------
// Tracked PIDs for afterAll safety cleanup
// ---------------------------------------------------------------------------

const trackedPids = new Set();

// ---------------------------------------------------------------------------
// Helper — poll until a project exits "running" state
// ---------------------------------------------------------------------------

function waitForStatus(projectId, predicate, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const status = getStatus(projectId);
      if (status && predicate(status)) {
        clearInterval(interval);
        resolve(status);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(
          new Error(
            `Timed out waiting for ${projectId} status predicate after ${timeoutMs}ms`,
          ),
        );
      }
    }, 50);
  });
}

// ---------------------------------------------------------------------------
// Guard: skip entire suite unless LIVE_INTEGRATION is set
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.LIVE_INTEGRATION)(
  "execution — live multi-project integration",
  () => {
    // Temp directories for workspace paths
    let tmpDirA = null;
    let tmpDirB = null;

    // ----------------------------------------------------------------
    // Setup / Teardown
    // ----------------------------------------------------------------

    beforeAll(() => {
      tmpDirA = fs.mkdtempSync(path.join(os.tmpdir(), "lumon-live-a-"));
      tmpDirB = fs.mkdtempSync(path.join(os.tmpdir(), "lumon-live-b-"));
      console.log(`[live-multi] workspaces: ${tmpDirA}, ${tmpDirB}`);
    });

    afterEach(() => {
      _resetSpawn();
      clear();
    });

    afterAll(() => {
      // Kill any orphaned processes
      let killed = 0;
      for (const pid of trackedPids) {
        try {
          process.kill(pid, 0); // probe
          process.kill(pid, "SIGTERM");
          killed++;
          console.log(`[live-multi] killed orphaned PID ${pid}`);
        } catch {
          // Already dead — expected
        }
      }
      if (killed > 0) {
        console.log(`[live-multi] cleanup: killed ${killed} orphaned process(es)`);
      }
      trackedPids.clear();
      _resetSpawn();
      clear();

      // Remove temp workspaces
      for (const dir of [tmpDirA, tmpDirB]) {
        if (dir) {
          try {
            fs.rmSync(dir, { recursive: true, force: true });
          } catch {
            // best effort
          }
        }
      }
    });

    // ----------------------------------------------------------------
    // Test 1: Two concurrent builds with isolated state — one fails
    // through retry→escalation, the other completes successfully
    // ----------------------------------------------------------------

    it(
      "concurrent builds: isolated state, retry, escalation, and cleanup",
      async () => {
        // Track how many times each "project" has been spawned to control
        // which invocations succeed vs. fail.
        const spawnCounts = { "proj-a": 0, "proj-b": 0 };

        // Custom spawn that:
        //   - For version checks: returns a fake version string
        //   - proj-a: always succeeds (echo + exit 0)
        //   - proj-b: first two exec calls fail (exit 1), to trigger
        //     auto-retry then escalation
        _setSpawn((cmd, args, opts) => {
          if (args.includes("--version")) {
            const proc = nodeSpawn(
              "echo",
              ["claude version 1.0.0-live-multi"],
              { stdio: ["ignore", "pipe", "pipe"] },
            );
            if (proc.pid) trackedPids.add(proc.pid);
            return proc;
          }

          // Determine which project based on cwd
          const cwd = opts?.cwd || "";
          const project = cwd.includes("lumon-live-a") ? "proj-a" : "proj-b";
          spawnCounts[project] = (spawnCounts[project] || 0) + 1;
          const attempt = spawnCounts[project];

          let script;
          if (project === "proj-a") {
            // proj-a: always succeeds, with a small delay to stay "running"
            // while proj-b exercises retry/escalation
            script =
              'echo "proj-a: step 1" && sleep 0.5 && echo "proj-a: step 2" && echo "proj-a: done"';
          } else {
            // proj-b: first two attempts fail, third would succeed (but
            // escalation happens after the second failure)
            if (attempt <= 2) {
              script =
                `echo "proj-b attempt ${attempt}: starting" >&1 && echo "proj-b: error detail" >&2 && exit 1`;
            } else {
              script = 'echo "proj-b attempt 3: recovered" && echo "done"';
            }
          }

          const proc = nodeSpawn("bash", ["-c", script], {
            cwd: cwd, // use the actual temp workspace cwd
            stdio: ["ignore", "pipe", "pipe"],
          });
          if (proc.pid) trackedPids.add(proc.pid);
          return proc;
        });

        // --- Start both builds concurrently ---
        const eventsA = [];
        const eventsB = [];

        const [recordA, recordB] = await Promise.all([
          startBuild(
            "proj-a",
            { workspacePath: tmpDirA, agentType: "claude" },
            { onAgentEvent: (ev) => eventsA.push(ev) },
          ),
          startBuild(
            "proj-b",
            { workspacePath: tmpDirB, agentType: "claude" },
            { onAgentEvent: (ev) => eventsB.push(ev) },
          ),
        ]);

        // Both should be running with valid PIDs
        expect(recordA.status).toBe("running");
        expect(recordB.status).toBe("running");
        expect(recordA.agents[0].pid).toBeGreaterThan(0);
        expect(recordB.agents[0].pid).toBeGreaterThan(0);

        trackedPids.add(recordA.agents[0].pid);
        trackedPids.add(recordB.agents[0].pid);

        console.log(
          `[live-multi] both builds started — proj-a PID ${recordA.agents[0].pid}, proj-b PID ${recordB.agents[0].pid}`,
        );

        // --- Verify both appear as active ---
        const active = getActiveBuilds();
        expect(active).toContain("proj-a");
        expect(active).toContain("proj-b");

        // --- Wait for proj-a to complete successfully ---
        const statusA = await waitForStatus(
          "proj-a",
          (s) => s.status !== "running",
          15_000,
        );
        expect(statusA.status).toBe("completed");
        expect(statusA.agents[0].exitCode).toBe(0);
        console.log("[live-multi] proj-a completed successfully ✓");

        // --- Wait for proj-b to reach escalated state ---
        // (first failure → auto-retry → second failure → escalation)
        const statusB = await waitForStatus(
          "proj-b",
          (s) => s.status === "escalated",
          15_000,
        );
        expect(statusB.status).toBe("escalated");
        expect(statusB.escalation).toBeTruthy();
        expect(statusB.escalation.status).toBe("raised");
        expect(statusB.agents[0].retryCount).toBe(1);
        console.log("[live-multi] proj-b escalated after retry ✓");

        // --- Verify isolation: proj-a is unaffected ---
        const finalA = getStatus("proj-a");
        expect(finalA.status).toBe("completed");
        expect(finalA.escalation).toBeNull();
        expect(finalA.agents[0].retryCount).toBe(0);
        console.log("[live-multi] proj-a state is clean / uncontaminated ✓");

        // --- Verify escalation query ---
        const escalations = getActiveEscalations();
        expect(escalations).toHaveLength(1);
        expect(escalations[0].projectId).toBe("proj-b");

        // --- Verify event isolation ---
        const retryEvents = eventsB.filter((e) => e.type === "retry-started");
        expect(retryEvents.length).toBeGreaterThanOrEqual(1);
        expect(retryEvents[0].projectId).toBe("proj-b");

        const escalationEvents = eventsB.filter(
          (e) => e.type === "escalation-raised",
        );
        expect(escalationEvents).toHaveLength(1);
        expect(escalationEvents[0].projectId).toBe("proj-b");

        // proj-a should have NO retry or escalation events
        const aRetryEvents = eventsA.filter(
          (e) => e.type === "retry-started" || e.type === "escalation-raised",
        );
        expect(aRetryEvents).toHaveLength(0);
        console.log("[live-multi] event isolation verified ✓");

        // --- Verify output isolation ---
        const outputA = getAgentOutput(recordA.agents[0].agentId);
        expect(outputA).toBeTruthy();
        expect(outputA.some((l) => l.includes("proj-a"))).toBe(true);
        expect(outputA.some((l) => l.includes("proj-b"))).toBe(false);

        const outputB = getAgentOutput(recordB.agents[0].agentId);
        expect(outputB).toBeTruthy();
        expect(outputB.some((l) => l.includes("proj-b"))).toBe(true);
        expect(outputB.some((l) => l.includes("proj-a"))).toBe(false);
        console.log("[live-multi] output isolation verified ✓");

        // --- Test cleanupAllBuilds ---
        const cleanupResult = cleanupAllBuilds();
        // proj-a completed, proj-b escalated — PIDs should be dead already
        expect(cleanupResult).toHaveProperty("killed");
        expect(cleanupResult).toHaveProperty("alreadyDead");
        expect(cleanupResult).toHaveProperty("errors");
        expect(cleanupResult.errors).toHaveLength(0);
        console.log(
          `[live-multi] cleanupAllBuilds: killed=${cleanupResult.killed}, alreadyDead=${cleanupResult.alreadyDead} ✓`,
        );

        // State should be cleared after cleanup
        expect(getStatus("proj-a")).toBeNull();
        expect(getStatus("proj-b")).toBeNull();

        console.log("[live-multi] concurrent lifecycle test passed ✓");
      },
      60_000,
    );

    // ----------------------------------------------------------------
    // Test 2: cleanupAllBuilds kills actively running processes
    // ----------------------------------------------------------------

    it(
      "cleanupAllBuilds: kills running agent processes by PID",
      async () => {
        // Spawn a long-running process that we can kill
        _setSpawn((cmd, args, opts) => {
          if (args.includes("--version")) {
            const proc = nodeSpawn(
              "echo",
              ["claude version 1.0.0-live-multi"],
              { stdio: ["ignore", "pipe", "pipe"] },
            );
            if (proc.pid) trackedPids.add(proc.pid);
            return proc;
          }
          // Long sleep — will be killed by cleanup
          const proc = nodeSpawn("sleep", ["60"], {
            cwd: opts?.cwd || "/tmp",
            stdio: ["ignore", "pipe", "pipe"],
          });
          if (proc.pid) trackedPids.add(proc.pid);
          return proc;
        });

        const record = await startBuild("cleanup-test", {
          workspacePath: "/tmp",
          agentType: "claude",
          timeoutMs: 0, // disable timeout — we'll kill it manually
        });

        const pid = record.agents[0].pid;
        expect(pid).toBeGreaterThan(0);
        trackedPids.add(pid);

        // Verify process is alive
        expect(() => process.kill(pid, 0)).not.toThrow();
        console.log(`[live-multi] process PID ${pid} is alive`);

        // Cleanup should kill it
        const result = cleanupAllBuilds();
        expect(result.killed).toBe(1);
        expect(result.errors).toHaveLength(0);

        // Give the OS a moment to reap
        await new Promise((r) => setTimeout(r, 200));

        // Process should be dead now
        let alive = true;
        try {
          process.kill(pid, 0);
        } catch {
          alive = false;
        }
        expect(alive).toBe(false);
        console.log(`[live-multi] PID ${pid} confirmed dead after cleanup ✓`);
      },
      30_000,
    );

    // ----------------------------------------------------------------
    // Test 3: cleanupAllBuilds handles ESRCH gracefully
    // ----------------------------------------------------------------

    it(
      "cleanupAllBuilds: handles already-dead processes (ESRCH) gracefully",
      async () => {
        _setSpawn((cmd, args, opts) => {
          if (args.includes("--version")) {
            const proc = nodeSpawn(
              "echo",
              ["claude version 1.0.0-live-multi"],
              { stdio: ["ignore", "pipe", "pipe"] },
            );
            if (proc.pid) trackedPids.add(proc.pid);
            return proc;
          }
          // Very short-lived — exits immediately
          const proc = nodeSpawn("bash", ["-c", "echo done && exit 0"], {
            cwd: opts?.cwd || "/tmp",
            stdio: ["ignore", "pipe", "pipe"],
          });
          if (proc.pid) trackedPids.add(proc.pid);
          return proc;
        });

        const record = await startBuild("esrch-test", {
          workspacePath: "/tmp",
          agentType: "claude",
          timeoutMs: 0,
        });

        // Wait for process to complete naturally
        await waitForStatus(
          "esrch-test",
          (s) => s.status !== "running",
          10_000,
        );

        // Now cleanup — process is already dead
        const result = cleanupAllBuilds();
        expect(result.errors).toHaveLength(0);
        // Should report as alreadyDead, not as an error
        console.log(
          `[live-multi] ESRCH handled: killed=${result.killed}, alreadyDead=${result.alreadyDead} ✓`,
        );
      },
      30_000,
    );
  },
);
