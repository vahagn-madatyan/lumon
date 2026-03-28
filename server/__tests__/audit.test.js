import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  logEvent,
  getEvents,
  getCostSummary,
  clear,
} from "../audit.js";
import { getTestDb } from "../db.js";

// ---------------------------------------------------------------------------
// Helpers — seed build_agents telemetry rows for getCostSummary tests
// ---------------------------------------------------------------------------

/**
 * Return the in-memory database used by the audit module (lazy fallback).
 * Since no initialize() is called, getDatabase() in audit.js falls back to
 * its own :memory: DB. We use getTestDb() here to get a handle for seeding
 * build_agents data — but the audit module's fallback is a different instance.
 *
 * To work around this, we call logEvent once first (to force the fallback DB
 * to initialise), then use the same audit module functions.
 *
 * For getCostSummary tests we need to insert into build_agents, so we'll
 * access the database through a small bootstrap trick: import and call
 * getEvents to trigger the lazy init, then reach into the module's DB via
 * the same SQLite in-memory instance.
 */

// The audit module uses its own in-memory fallback. We can't directly access
// it, so we'll test getCostSummary by using a fresh :memory: DB and
// monkey-patching the module to use it. A simpler approach: since the audit
// module falls back to getTestDb(":memory:") on first call, and Node caches
// modules, the same DB instance is reused across the whole test file. We just
// need to seed build_agents through the same instance.
//
// We'll achieve this by importing the module dynamically to get a handle on
// its internal DB. But the cleaner approach used in the codebase is to just
// let the module create its fallback and then write through SQL via the
// module's own methods — but for build_agents we need raw SQL.
//
// Solution: We'll create the DB ourselves, and mock getDb to return it.

import { vi } from "vitest";
import * as dbModule from "../db.js";

let testDb;

beforeEach(async () => {
  // Create a fresh in-memory DB for each test
  testDb = getTestDb(":memory:");

  // Mock getDb to return our testDb so the audit module uses it
  vi.spyOn(dbModule, "getDb").mockReturnValue(testDb);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (testDb) {
    testDb.close();
    testDb = null;
  }
});

// ---------------------------------------------------------------------------
// logEvent
// ---------------------------------------------------------------------------

describe("logEvent", () => {
  it("writes a row to audit_events with correct fields", () => {
    const result = logEvent("proj-1", "pipeline.triggered", { stage: "build" });

    expect(result.id).toBeTypeOf("number");
    expect(result.projectId).toBe("proj-1");
    expect(result.eventType).toBe("pipeline.triggered");
    expect(result.data).toEqual({ stage: "build" });
    expect(result.timestamp).toBeTruthy();
    expect(result.actor).toBeNull();
  });

  it("stores data as JSON string in the database", () => {
    logEvent("proj-1", "build.completed", { duration: 42 });

    const raw = testDb
      .prepare("SELECT data FROM audit_events WHERE projectId = ?")
      .get("proj-1");
    expect(raw.data).toBe('{"duration":42}');
  });

  it("stores actor when provided", () => {
    const result = logEvent("proj-1", "action.confirmed", { id: "a1" }, "operator");

    expect(result.actor).toBe("operator");
  });

  it("stores null data when data is null", () => {
    const result = logEvent("proj-1", "stage.approved", null);
    expect(result.data).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getEvents
// ---------------------------------------------------------------------------

describe("getEvents", () => {
  beforeEach(() => {
    // Seed events with explicit timestamps for ordering tests
    testDb
      .prepare(
        "INSERT INTO audit_events (projectId, eventType, data, timestamp, actor) VALUES (?, ?, ?, ?, ?)",
      )
      .run("proj-a", "build.started", '{"n":1}', "2025-01-01T10:00:00", null);
    testDb
      .prepare(
        "INSERT INTO audit_events (projectId, eventType, data, timestamp, actor) VALUES (?, ?, ?, ?, ?)",
      )
      .run("proj-a", "build.completed", '{"n":2}', "2025-01-01T11:00:00", "ci");
    testDb
      .prepare(
        "INSERT INTO audit_events (projectId, eventType, data, timestamp, actor) VALUES (?, ?, ?, ?, ?)",
      )
      .run("proj-b", "pipeline.triggered", '{"n":3}', "2025-01-01T12:00:00", null);
  });

  it("returns events in reverse chronological order", () => {
    const events = getEvents();
    expect(events).toHaveLength(3);
    expect(events[0].eventType).toBe("pipeline.triggered");
    expect(events[1].eventType).toBe("build.completed");
    expect(events[2].eventType).toBe("build.started");
  });

  it("filters by projectId", () => {
    const events = getEvents({ projectId: "proj-a" });
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.projectId === "proj-a")).toBe(true);
  });

  it("filters by eventType", () => {
    const events = getEvents({ eventType: "build.completed" });
    expect(events).toHaveLength(1);
    expect(events[0].actor).toBe("ci");
  });

  it("filters by time range (since/until)", () => {
    const events = getEvents({
      since: "2025-01-01T10:30:00",
      until: "2025-01-01T11:30:00",
    });
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("build.completed");
  });

  it("respects limit parameter", () => {
    const events = getEvents({ limit: 1 });
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("pipeline.triggered"); // most recent
  });

  it("returns empty array for unknown project", () => {
    const events = getEvents({ projectId: "nonexistent" });
    expect(events).toEqual([]);
  });

  it("limit=0 returns no events", () => {
    const events = getEvents({ limit: 0 });
    expect(events).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getCostSummary
// ---------------------------------------------------------------------------

describe("getCostSummary", () => {
  /** Seed a build_executions parent row so FK constraints pass. */
  function seedProject(id) {
    testDb
      .prepare(
        "INSERT OR IGNORE INTO build_executions (projectId, status) VALUES (?, 'idle')",
      )
      .run(id);
  }

  it("returns per-project aggregation from build_agents telemetry", () => {
    seedProject("proj-a");
    seedProject("proj-b");

    // Seed build_agents with telemetry
    testDb
      .prepare(
        "INSERT INTO build_agents (agentId, projectId, agentType, status, telemetry) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        "agent-1",
        "proj-a",
        "claude-code",
        "completed",
        JSON.stringify({ tokens: { input: 1000, output: 500 }, costUsd: 0.05 }),
      );
    testDb
      .prepare(
        "INSERT INTO build_agents (agentId, projectId, agentType, status, telemetry) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        "agent-2",
        "proj-a",
        "codex",
        "completed",
        JSON.stringify({ tokens: { input: 2000, output: 1000 }, costUsd: 0.10 }),
      );
    testDb
      .prepare(
        "INSERT INTO build_agents (agentId, projectId, agentType, status, telemetry) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        "agent-3",
        "proj-b",
        "claude-code",
        "completed",
        JSON.stringify({ tokens: { input: 500, output: 200 }, costUsd: 0.02 }),
      );

    const summary = getCostSummary();
    expect(summary).toHaveLength(2);

    const projA = summary.find((s) => s.projectId === "proj-a");
    expect(projA.totalCostUsd).toBeCloseTo(0.15);
    expect(projA.tokensInput).toBe(3000);
    expect(projA.tokensOutput).toBe(1500);
    expect(projA.invocations).toBe(2);

    const projB = summary.find((s) => s.projectId === "proj-b");
    expect(projB.totalCostUsd).toBeCloseTo(0.02);
    expect(projB.tokensInput).toBe(500);
    expect(projB.tokensOutput).toBe(200);
    expect(projB.invocations).toBe(1);
  });

  it("filters to single project when projectId provided", () => {
    seedProject("proj-a");
    seedProject("proj-b");

    testDb
      .prepare(
        "INSERT INTO build_agents (agentId, projectId, agentType, status, telemetry) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        "agent-1",
        "proj-a",
        "claude-code",
        "completed",
        JSON.stringify({ tokens: { input: 1000, output: 500 }, costUsd: 0.05 }),
      );
    testDb
      .prepare(
        "INSERT INTO build_agents (agentId, projectId, agentType, status, telemetry) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        "agent-2",
        "proj-b",
        "claude-code",
        "completed",
        JSON.stringify({ tokens: { input: 500, output: 200 }, costUsd: 0.02 }),
      );

    const summary = getCostSummary("proj-a");
    expect(summary).toHaveLength(1);
    expect(summary[0].projectId).toBe("proj-a");
    expect(summary[0].totalCostUsd).toBeCloseTo(0.05);
  });

  it("returns empty array when no telemetry exists", () => {
    const summary = getCostSummary();
    expect(summary).toEqual([]);
  });

  it("handles build_agents rows where telemetry is null", () => {
    seedProject("proj-a");

    testDb
      .prepare(
        "INSERT INTO build_agents (agentId, projectId, agentType, status, telemetry) VALUES (?, ?, ?, ?, ?)",
      )
      .run("agent-1", "proj-a", "claude-code", "running", null);

    // Row with null telemetry should be excluded (WHERE telemetry IS NOT NULL)
    const summary = getCostSummary();
    expect(summary).toEqual([]);
  });

  it("handles build_agents with mix of null and valid telemetry", () => {
    seedProject("proj-a");

    testDb
      .prepare(
        "INSERT INTO build_agents (agentId, projectId, agentType, status, telemetry) VALUES (?, ?, ?, ?, ?)",
      )
      .run("agent-1", "proj-a", "claude-code", "running", null);
    testDb
      .prepare(
        "INSERT INTO build_agents (agentId, projectId, agentType, status, telemetry) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        "agent-2",
        "proj-a",
        "codex",
        "completed",
        JSON.stringify({ tokens: { input: 100, output: 50 }, costUsd: 0.01 }),
      );

    const summary = getCostSummary("proj-a");
    expect(summary).toHaveLength(1);
    expect(summary[0].invocations).toBe(1); // only the non-null row
    expect(summary[0].tokensInput).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// clear
// ---------------------------------------------------------------------------

describe("clear", () => {
  it("removes all audit events", () => {
    logEvent("proj-1", "test.event", { x: 1 });
    logEvent("proj-2", "test.event", { x: 2 });

    expect(getEvents()).toHaveLength(2);

    clear();

    expect(getEvents()).toEqual([]);
  });
});
