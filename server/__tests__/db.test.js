import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  initialize,
  getDb,
  close,
  getTestDb,
  _setDbPath,
} from "../db.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "lumon-db-test-"));
}

// ---------------------------------------------------------------------------
// Schema creation & WAL mode
// ---------------------------------------------------------------------------

describe("db module", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("initializes the database and creates all tables", () => {
    const dbPath = join(tempDir, "test.db");
    _setDbPath(dbPath);
    initialize();

    const db = getDb();
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all()
      .map((r) => r.name);

    expect(tables).toContain("pipeline_executions");
    expect(tables).toContain("build_executions");
    expect(tables).toContain("build_agents");
    expect(tables).toContain("external_actions");
  });

  it("enables WAL journal mode", () => {
    const dbPath = join(tempDir, "wal-test.db");
    _setDbPath(dbPath);
    initialize();

    const db = getDb();
    const mode = db.pragma("journal_mode", { simple: true });
    expect(mode).toBe("wal");
  });

  it("is idempotent — calling initialize() twice does not error", () => {
    const dbPath = join(tempDir, "idem.db");
    _setDbPath(dbPath);
    initialize();
    expect(() => initialize()).not.toThrow();
  });

  it("throws if getDb() is called before initialize()", () => {
    // close() was already called in afterEach of the previous test,
    // but let's be explicit
    close();
    expect(() => getDb()).toThrow("Database not initialized");
  });

  it("close() is safe to call multiple times", () => {
    const dbPath = join(tempDir, "close-test.db");
    _setDbPath(dbPath);
    initialize();
    close();
    expect(() => close()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

describe("db indexes", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = makeTempDir();
    _setDbPath(join(tempDir, "idx.db"));
    initialize();
  });

  afterEach(() => {
    close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates the compound index on pipeline_executions(projectId, stageKey)", () => {
    const db = getDb();
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='pipeline_executions'",
      )
      .all()
      .map((r) => r.name);

    expect(indexes).toContain("idx_pipeline_project_stage");
  });

  it("creates the index on build_agents(projectId)", () => {
    const db = getDb();
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='build_agents'",
      )
      .all()
      .map((r) => r.name);

    expect(indexes).toContain("idx_build_agents_project");
  });

  it("creates the index on external_actions(projectId)", () => {
    const db = getDb();
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='external_actions'",
      )
      .all()
      .map((r) => r.name);

    expect(indexes).toContain("idx_external_actions_project");
  });
});

// ---------------------------------------------------------------------------
// CRUD: pipeline_executions
// ---------------------------------------------------------------------------

describe("pipeline_executions CRUD", () => {
  let db;

  beforeEach(() => {
    db = getTestDb(); // :memory:
  });

  afterEach(() => {
    db.close();
  });

  it("inserts and reads a pipeline execution", () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO pipeline_executions
         (executionId, projectId, stageKey, subStage, status, context, n8nExecutionId, resumeUrl, triggeredAt, completedAt, failureReason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("exec-1", "proj-a", "research", null, "triggered", JSON.stringify({ foo: 1 }), null, null, now, null, null);

    const row = db
      .prepare("SELECT * FROM pipeline_executions WHERE executionId = ?")
      .get("exec-1");

    expect(row.executionId).toBe("exec-1");
    expect(row.projectId).toBe("proj-a");
    expect(row.stageKey).toBe("research");
    expect(row.status).toBe("triggered");
    expect(JSON.parse(row.context)).toEqual({ foo: 1 });
    expect(row.triggeredAt).toBe(now);
    expect(row.completedAt).toBeNull();
  });

  it("updates status and completedAt", () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO pipeline_executions
         (executionId, projectId, stageKey, status, triggeredAt)
       VALUES (?, ?, ?, ?, ?)`,
    ).run("exec-2", "proj-b", "naming", "triggered", now);

    const later = new Date().toISOString();
    db.prepare(
      "UPDATE pipeline_executions SET status = ?, completedAt = ? WHERE executionId = ?",
    ).run("approved", later, "exec-2");

    const row = db
      .prepare("SELECT * FROM pipeline_executions WHERE executionId = ?")
      .get("exec-2");

    expect(row.status).toBe("approved");
    expect(row.completedAt).toBe(later);
  });

  it("deletes all rows", () => {
    db.prepare(
      "INSERT INTO pipeline_executions (executionId, projectId, stageKey, status, triggeredAt) VALUES (?, ?, ?, ?, ?)",
    ).run("exec-3", "proj-c", "s1", "triggered", new Date().toISOString());

    db.prepare("DELETE FROM pipeline_executions").run();

    const count = db
      .prepare("SELECT COUNT(*) as cnt FROM pipeline_executions")
      .get().cnt;
    expect(count).toBe(0);
  });

  it("enforces executionId primary key uniqueness", () => {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO pipeline_executions (executionId, projectId, stageKey, status, triggeredAt) VALUES (?, ?, ?, ?, ?)",
    ).run("dup-1", "proj-d", "s1", "triggered", now);

    expect(() =>
      db
        .prepare(
          "INSERT INTO pipeline_executions (executionId, projectId, stageKey, status, triggeredAt) VALUES (?, ?, ?, ?, ?)",
        )
        .run("dup-1", "proj-e", "s2", "triggered", now),
    ).toThrow();
  });

  it("uses the compound index for projectId+stageKey lookups", () => {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO pipeline_executions (executionId, projectId, stageKey, status, triggeredAt) VALUES (?, ?, ?, ?, ?)",
    ).run("e1", "proj-f", "research", "triggered", now);
    db.prepare(
      "INSERT INTO pipeline_executions (executionId, projectId, stageKey, status, triggeredAt) VALUES (?, ?, ?, ?, ?)",
    ).run("e2", "proj-f", "naming", "triggered", now);

    const plan = db
      .prepare(
        "EXPLAIN QUERY PLAN SELECT * FROM pipeline_executions WHERE projectId = ? AND stageKey = ? ORDER BY triggeredAt DESC LIMIT 1",
      )
      .all("proj-f", "research");

    // The query planner should mention our index
    const planText = plan.map((r) => r.detail).join(" ");
    expect(planText).toMatch(/idx_pipeline_project_stage/);
  });
});

// ---------------------------------------------------------------------------
// CRUD: build_executions
// ---------------------------------------------------------------------------

describe("build_executions CRUD", () => {
  let db;

  beforeEach(() => {
    db = getTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it("inserts and reads a build execution", () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO build_executions (projectId, status, startedAt, completedAt, error, escalation, configJson)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("proj-1", "running", now, null, null, null, JSON.stringify({ workspacePath: "/tmp/w" }));

    const row = db
      .prepare("SELECT * FROM build_executions WHERE projectId = ?")
      .get("proj-1");

    expect(row.projectId).toBe("proj-1");
    expect(row.status).toBe("running");
    expect(row.startedAt).toBe(now);
    expect(JSON.parse(row.configJson)).toEqual({ workspacePath: "/tmp/w" });
  });

  it("updates status on completion", () => {
    db.prepare(
      "INSERT INTO build_executions (projectId, status, startedAt) VALUES (?, ?, ?)",
    ).run("proj-2", "running", new Date().toISOString());

    const completedAt = new Date().toISOString();
    db.prepare(
      "UPDATE build_executions SET status = ?, completedAt = ? WHERE projectId = ?",
    ).run("completed", completedAt, "proj-2");

    const row = db
      .prepare("SELECT * FROM build_executions WHERE projectId = ?")
      .get("proj-2");
    expect(row.status).toBe("completed");
    expect(row.completedAt).toBe(completedAt);
  });

  it("stores escalation as JSON", () => {
    const esc = { status: "raised", reason: "timeout", raisedAt: new Date().toISOString() };
    db.prepare(
      "INSERT INTO build_executions (projectId, status, startedAt, escalation) VALUES (?, ?, ?, ?)",
    ).run("proj-3", "escalated", new Date().toISOString(), JSON.stringify(esc));

    const row = db
      .prepare("SELECT * FROM build_executions WHERE projectId = ?")
      .get("proj-3");
    expect(JSON.parse(row.escalation)).toEqual(esc);
  });
});

// ---------------------------------------------------------------------------
// CRUD: build_agents
// ---------------------------------------------------------------------------

describe("build_agents CRUD", () => {
  let db;

  beforeEach(() => {
    db = getTestDb();
    // Insert a parent build_execution so FK is satisfied
    db.prepare(
      "INSERT INTO build_executions (projectId, status) VALUES (?, ?)",
    ).run("proj-x", "running");
  });

  afterEach(() => {
    db.close();
  });

  it("inserts and reads a build agent", () => {
    const now = new Date().toISOString();
    const telemetry = { tokens: { input: 100, output: 50 }, costUsd: 0.01, raw: false };

    db.prepare(
      `INSERT INTO build_agents
         (agentId, projectId, agentType, pid, status, startedAt, completedAt, exitCode, error, lastOutputLine, retryCount, telemetry)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("agent-1", "proj-x", "claude", 12345, "running", now, null, null, null, "line 1", 0, JSON.stringify(telemetry));

    const row = db
      .prepare("SELECT * FROM build_agents WHERE agentId = ?")
      .get("agent-1");

    expect(row.agentId).toBe("agent-1");
    expect(row.projectId).toBe("proj-x");
    expect(row.agentType).toBe("claude");
    expect(row.pid).toBe(12345);
    expect(row.status).toBe("running");
    expect(row.retryCount).toBe(0);
    expect(JSON.parse(row.telemetry)).toEqual(telemetry);
  });

  it("updates agent status and exitCode on completion", () => {
    db.prepare(
      "INSERT INTO build_agents (agentId, projectId, agentType, pid, status, startedAt, retryCount) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("agent-2", "proj-x", "codex", 9999, "running", new Date().toISOString(), 0);

    const completedAt = new Date().toISOString();
    db.prepare(
      "UPDATE build_agents SET status = ?, exitCode = ?, completedAt = ? WHERE agentId = ?",
    ).run("completed", 0, completedAt, "agent-2");

    const row = db
      .prepare("SELECT * FROM build_agents WHERE agentId = ?")
      .get("agent-2");
    expect(row.status).toBe("completed");
    expect(row.exitCode).toBe(0);
  });

  it("queries agents by projectId", () => {
    db.prepare(
      "INSERT INTO build_agents (agentId, projectId, agentType, status, retryCount) VALUES (?, ?, ?, ?, ?)",
    ).run("a1", "proj-x", "claude", "completed", 0);
    db.prepare(
      "INSERT INTO build_agents (agentId, projectId, agentType, status, retryCount) VALUES (?, ?, ?, ?, ?)",
    ).run("a2", "proj-x", "codex", "running", 1);

    const agents = db
      .prepare("SELECT * FROM build_agents WHERE projectId = ?")
      .all("proj-x");
    expect(agents).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// CRUD: external_actions
// ---------------------------------------------------------------------------

describe("external_actions CRUD", () => {
  let db;

  beforeEach(() => {
    db = getTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it("inserts and reads an external action", () => {
    const now = new Date().toISOString();
    const params = { domain: "example.com" };

    db.prepare(
      `INSERT INTO external_actions
         (id, projectId, type, params, status, requestedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("act-1", "proj-1", "dns-provision", JSON.stringify(params), "pending", now);

    const row = db
      .prepare("SELECT * FROM external_actions WHERE id = ?")
      .get("act-1");

    expect(row.id).toBe("act-1");
    expect(row.projectId).toBe("proj-1");
    expect(row.type).toBe("dns-provision");
    expect(JSON.parse(row.params)).toEqual(params);
    expect(row.status).toBe("pending");
  });

  it("updates through the action lifecycle", () => {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO external_actions (id, projectId, type, params, status, requestedAt) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("act-2", "proj-2", "deploy", "{}", "pending", now);

    // confirm
    db.prepare(
      "UPDATE external_actions SET status = ?, confirmedAt = ? WHERE id = ?",
    ).run("confirmed", new Date().toISOString(), "act-2");

    // execute
    db.prepare(
      "UPDATE external_actions SET status = ?, executedAt = ? WHERE id = ?",
    ).run("executing", new Date().toISOString(), "act-2");

    // complete
    const result = { success: true };
    db.prepare(
      "UPDATE external_actions SET status = ?, completedAt = ?, result = ? WHERE id = ?",
    ).run("completed", new Date().toISOString(), JSON.stringify(result), "act-2");

    const row = db
      .prepare("SELECT * FROM external_actions WHERE id = ?")
      .get("act-2");

    expect(row.status).toBe("completed");
    expect(JSON.parse(row.result)).toEqual({ success: true });
  });

  it("queries actions by projectId", () => {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO external_actions (id, projectId, type, params, status, requestedAt) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("a1", "proj-q", "dns", "{}", "pending", now);
    db.prepare(
      "INSERT INTO external_actions (id, projectId, type, params, status, requestedAt) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("a2", "proj-q", "deploy", "{}", "confirmed", now);
    db.prepare(
      "INSERT INTO external_actions (id, projectId, type, params, status, requestedAt) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("a3", "proj-other", "dns", "{}", "pending", now);

    const actions = db
      .prepare("SELECT * FROM external_actions WHERE projectId = ?")
      .all("proj-q");
    expect(actions).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// getTestDb isolation
// ---------------------------------------------------------------------------

describe("getTestDb isolation", () => {
  it("returns independent database instances", () => {
    const db1 = getTestDb();
    const db2 = getTestDb();

    db1.prepare(
      "INSERT INTO pipeline_executions (executionId, projectId, stageKey, status, triggeredAt) VALUES (?, ?, ?, ?, ?)",
    ).run("iso-1", "proj-1", "s1", "triggered", new Date().toISOString());

    const row = db2
      .prepare("SELECT * FROM pipeline_executions WHERE executionId = ?")
      .get("iso-1");

    // db2 should NOT see db1's data because they're separate :memory: databases
    expect(row).toBeUndefined();

    db1.close();
    db2.close();
  });

  it("file-backed test DB persists data across close/reopen", () => {
    const tempDir = makeTempDir();
    const dbPath = join(tempDir, "persist.db");

    const db1 = getTestDb(dbPath);
    db1.prepare(
      "INSERT INTO pipeline_executions (executionId, projectId, stageKey, status, triggeredAt) VALUES (?, ?, ?, ?, ?)",
    ).run("persist-1", "proj-p", "s1", "triggered", new Date().toISOString());
    db1.close();

    const db2 = getTestDb(dbPath);
    const row = db2
      .prepare("SELECT * FROM pipeline_executions WHERE executionId = ?")
      .get("persist-1");

    expect(row).toBeDefined();
    expect(row.executionId).toBe("persist-1");

    db2.close();
    rmSync(tempDir, { recursive: true, force: true });
  });
});
