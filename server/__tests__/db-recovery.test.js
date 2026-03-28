import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { initialize, close, _setDbPath, getDb } from "../db.js";
import * as pipeline from "../pipeline.js";
import * as execution from "../execution.js";
import * as externalActions from "../external-actions.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "lumon-recovery-"));
}

/**
 * Simulate a server restart: close the DB connection, then re-initialize
 * with the same file path. This proves data survives on disk.
 */
function simulateRestart(dbPath) {
  close();
  _setDbPath(dbPath);
  initialize();
}

// ---------------------------------------------------------------------------
// Recovery integration tests
// ---------------------------------------------------------------------------

describe("restart recovery (file-backed SQLite)", () => {
  let tempDir;
  let dbPath;

  beforeEach(() => {
    tempDir = makeTempDir();
    dbPath = join(tempDir, "recovery-test.db");
    _setDbPath(dbPath);
    initialize();
  });

  afterEach(() => {
    // Clean up module state so tests don't leak
    try { pipeline.clear(); } catch { /* ignore */ }
    try { execution.clear(); } catch { /* ignore */ }
    try { externalActions.clear(); } catch { /* ignore */ }
    close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // (a) Pipeline recovery
  // -------------------------------------------------------------------------

  it("recovers pipeline execution state after restart", () => {
    // Trigger a pipeline execution
    const result = pipeline.trigger({
      projectId: "proj-recovery-1",
      stageKey: "research",
      context: { source: "recovery-test" },
    });

    expect(result.status).toBe("triggered");
    expect(result.executionId).toBeTruthy();

    // Verify it's visible before restart
    const beforeRestart = pipeline.getStatus("proj-recovery-1");
    expect(beforeRestart).not.toBeNull();
    expect(beforeRestart.research).toBeDefined();
    expect(beforeRestart.research.status).toBe("triggered");

    // Simulate restart
    simulateRestart(dbPath);

    // After restart, pipeline data should be intact
    const afterRestart = pipeline.getStatus("proj-recovery-1");
    expect(afterRestart).not.toBeNull();
    expect(afterRestart.research).toBeDefined();
    expect(afterRestart.research.executionId).toBe(result.executionId);
    expect(afterRestart.research.status).toBe("triggered");
    expect(afterRestart.research.stageKey).toBe("research");
    expect(afterRestart.research.context).toEqual({ source: "recovery-test" });
  });

  // -------------------------------------------------------------------------
  // (b) Build execution recovery
  // -------------------------------------------------------------------------

  it("marks running builds as interrupted after restart via recoverBuilds()", () => {
    const db = getDb();

    // Insert a build record directly into SQLite simulating a build that was
    // running when the server crashed (bypasses in-memory state)
    db.prepare(`
      INSERT INTO build_executions (projectId, status, startedAt)
      VALUES (?, 'running', ?)
    `).run("proj-build-1", new Date().toISOString());

    db.prepare(`
      INSERT INTO build_agents (agentId, projectId, agentType, pid, status, startedAt, retryCount)
      VALUES (?, ?, 'claude', 12345, 'running', ?, 0)
    `).run("agent-001", "proj-build-1", new Date().toISOString());

    // Simulate restart
    simulateRestart(dbPath);

    // Run recovery — should mark running builds as interrupted
    const recoveryResult = execution.recoverBuilds();
    expect(recoveryResult.recovered).toBe(1);
    expect(recoveryResult.interrupted).toContain("proj-build-1");

    // getStatus should return the interrupted build from SQLite
    const status = execution.getStatus("proj-build-1");
    expect(status).not.toBeNull();
    expect(status.status).toBe("interrupted");
    expect(status.completedAt).toBeTruthy();
    expect(status.agents).toHaveLength(1);
    expect(status.agents[0].status).toBe("interrupted");
    expect(status.agents[0].agentId).toBe("agent-001");
  });

  // -------------------------------------------------------------------------
  // (c) External action recovery
  // -------------------------------------------------------------------------

  it("recovers confirmed external actions after restart", () => {
    // Request and confirm an action
    const action = externalActions.requestAction({
      projectId: "proj-action-1",
      type: "create_github_repo",
      params: { repoName: "my-repo" },
    });
    expect(action.status).toBe("pending");

    const confirmed = externalActions.confirmAction({
      projectId: "proj-action-1",
      actionId: action.id,
    });
    expect(confirmed.status).toBe("confirmed");

    // Simulate restart
    simulateRestart(dbPath);

    // After restart, the confirmed action should be visible
    const actions = externalActions.getActions("proj-action-1");
    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe(action.id);
    expect(actions[0].status).toBe("confirmed");
    expect(actions[0].type).toBe("create_github_repo");
    expect(actions[0].params).toEqual({ repoName: "my-repo" });
  });

  // -------------------------------------------------------------------------
  // (d) Multiple projects survive restart
  // -------------------------------------------------------------------------

  it("recovers state across multiple projects after restart", () => {
    const db = getDb();

    // Project A: pipeline execution
    const pipeResult = pipeline.trigger({
      projectId: "proj-multi-A",
      stageKey: "naming",
      context: { batch: true },
    });

    // Project B: build execution (raw SQL to simulate pre-crash state)
    db.prepare(`
      INSERT INTO build_executions (projectId, status, startedAt)
      VALUES (?, 'running', ?)
    `).run("proj-multi-B", new Date().toISOString());

    db.prepare(`
      INSERT INTO build_agents (agentId, projectId, agentType, pid, status, startedAt, retryCount)
      VALUES (?, ?, 'codex', 99999, 'running', ?, 0)
    `).run("agent-multi-B", "proj-multi-B", new Date().toISOString());

    // Project C: external action
    const actionResult = externalActions.requestAction({
      projectId: "proj-multi-C",
      type: "deploy_preview",
      params: { env: "staging" },
    });

    // Simulate restart
    simulateRestart(dbPath);

    // Recover builds
    const recovery = execution.recoverBuilds();
    expect(recovery.recovered).toBe(1);
    expect(recovery.interrupted).toContain("proj-multi-B");

    // Verify all three projects' data survived
    // Project A: pipeline
    const pipeStatus = pipeline.getStatus("proj-multi-A");
    expect(pipeStatus).not.toBeNull();
    expect(pipeStatus.naming).toBeDefined();
    expect(pipeStatus.naming.executionId).toBe(pipeResult.executionId);
    expect(pipeStatus.naming.stageKey).toBe("naming");

    // Project B: build (now interrupted)
    const buildStatus = execution.getStatus("proj-multi-B");
    expect(buildStatus).not.toBeNull();
    expect(buildStatus.status).toBe("interrupted");
    expect(buildStatus.agents).toHaveLength(1);
    expect(buildStatus.agents[0].agentType).toBe("codex");

    // Project C: external action
    const actions = externalActions.getActions("proj-multi-C");
    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe(actionResult.id);
    expect(actions[0].type).toBe("deploy_preview");
    expect(actions[0].params).toEqual({ env: "staging" });
  });

  // -------------------------------------------------------------------------
  // recoverBuilds is idempotent
  // -------------------------------------------------------------------------

  it("recoverBuilds is idempotent — second call finds nothing to recover", () => {
    const db = getDb();

    db.prepare(`
      INSERT INTO build_executions (projectId, status, startedAt)
      VALUES (?, 'running', ?)
    `).run("proj-idem", new Date().toISOString());

    simulateRestart(dbPath);

    const first = execution.recoverBuilds();
    expect(first.recovered).toBe(1);

    const second = execution.recoverBuilds();
    expect(second.recovered).toBe(0);
    expect(second.interrupted).toHaveLength(0);
  });
});
