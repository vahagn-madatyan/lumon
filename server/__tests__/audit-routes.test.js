import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import app from "../index.js";
import * as audit from "../audit.js";
import { sseClients, emitSSE } from "../routes/pipeline.js";

beforeEach(() => {
  audit.clear();
});

afterEach(() => {
  // Clean up any SSE clients registered during tests
  sseClients.clear();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/audit/events/:projectId
// ---------------------------------------------------------------------------
describe("GET /api/audit/events/:projectId", () => {
  it("returns 200 with empty array when no events exist", async () => {
    const res = await request(app).get("/api/audit/events/proj-1");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns logged events after logEvent()", async () => {
    audit.logEvent("proj-1", "stage-update", { stageKey: "research" });
    audit.logEvent("proj-1", "pipeline-status", { status: "triggered" });

    const res = await request(app).get("/api/audit/events/proj-1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].projectId).toBe("proj-1");
    expect(res.body[0].eventType).toBeDefined();
  });

  it("supports ?eventType filter", async () => {
    audit.logEvent("proj-1", "stage-update", { a: 1 });
    audit.logEvent("proj-1", "pipeline-status", { b: 2 });

    const res = await request(app).get(
      "/api/audit/events/proj-1?eventType=stage-update",
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].eventType).toBe("stage-update");
  });

  it("supports ?limit filter", async () => {
    audit.logEvent("proj-1", "a", {});
    audit.logEvent("proj-1", "b", {});
    audit.logEvent("proj-1", "c", {});

    const res = await request(app).get("/api/audit/events/proj-1?limit=2");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("supports ?since and ?until filters", async () => {
    // Insert events with known timestamps by calling logEvent directly
    audit.logEvent("proj-1", "early", { t: 1 });

    // Query with a since bound that should include everything
    const res = await request(app).get(
      "/api/audit/events/proj-1?since=2000-01-01T00:00:00Z&until=2099-12-31T23:59:59Z",
    );
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    // Query with a future since bound that should exclude everything
    const res2 = await request(app).get(
      "/api/audit/events/proj-1?since=2099-01-01T00:00:00Z",
    );
    expect(res2.status).toBe(200);
    expect(res2.body).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/audit/events — cross-project
// ---------------------------------------------------------------------------
describe("GET /api/audit/events", () => {
  it("returns events across all projects", async () => {
    audit.logEvent("proj-a", "stage-update", {});
    audit.logEvent("proj-b", "pipeline-status", {});

    const res = await request(app).get("/api/audit/events");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    const projectIds = res.body.map((e) => e.projectId);
    expect(projectIds).toContain("proj-a");
    expect(projectIds).toContain("proj-b");
  });
});

// ---------------------------------------------------------------------------
// GET /api/audit/cost/:projectId
// ---------------------------------------------------------------------------
describe("GET /api/audit/cost/:projectId", () => {
  it("returns 200 with cost data (empty array when no build_agents rows)", async () => {
    const res = await request(app).get("/api/audit/cost/proj-1");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/audit/cost — fleet-wide
// ---------------------------------------------------------------------------
describe("GET /api/audit/cost", () => {
  it("returns 200 with fleet-wide cost data", async () => {
    const res = await request(app).get("/api/audit/cost");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// emitSSE integration — verifies audit persistence from within emitSSE
// ---------------------------------------------------------------------------
describe("emitSSE audit integration", () => {
  it("persists events emitted via emitSSE to the audit log", () => {
    // Set up a mock SSE client so emitSSE doesn't bail early
    const mockRes = {
      write: vi.fn(),
    };
    sseClients.set("proj-sse", new Set([mockRes]));

    emitSSE("proj-sse", "stage-update", {
      stageKey: "research",
      data: { status: "awaiting_approval" },
    });

    // Verify SSE was sent
    expect(mockRes.write).toHaveBeenCalled();

    // Verify event was persisted to audit log
    const events = audit.getEvents({ projectId: "proj-sse" });
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("stage-update");
    expect(events[0].data).toMatchObject({ stageKey: "research" });
  });

  it("does NOT persist build-agent-output events", () => {
    const mockRes = {
      write: vi.fn(),
    };
    sseClients.set("proj-sse2", new Set([mockRes]));

    emitSSE("proj-sse2", "build-agent-output", { line: "compiling..." });

    // SSE should still be sent
    expect(mockRes.write).toHaveBeenCalled();

    // But audit log should be empty
    const events = audit.getEvents({ projectId: "proj-sse2" });
    expect(events).toHaveLength(0);
  });

  it("does not block SSE delivery when audit write fails", () => {
    const mockRes = {
      write: vi.fn(),
    };
    sseClients.set("proj-sse3", new Set([mockRes]));

    // Spy on logEvent to throw
    vi.spyOn(audit, "logEvent").mockImplementation(() => {
      throw new Error("DB write failed");
    });

    // Spy on console.error to verify the error is logged
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // emitSSE should not throw — SSE delivery continues
    expect(() => {
      emitSSE("proj-sse3", "pipeline-status", { status: "triggered" });
    }).not.toThrow();

    // SSE was still sent
    expect(mockRes.write).toHaveBeenCalled();

    // Error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[audit] failed to log event:",
      "DB write failed",
    );
  });
});
