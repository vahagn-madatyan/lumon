import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useServerSync } from "../sync";

// ---------------------------------------------------------------------------
// Mock EventSource
// ---------------------------------------------------------------------------

class MockEventSource {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this._listeners = {};
    this.onerror = null;
    MockEventSource.instances.push(this);
  }

  addEventListener(type, handler) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(handler);
  }

  removeEventListener(type, handler) {
    if (!this._listeners[type]) return;
    this._listeners[type] = this._listeners[type].filter((h) => h !== handler);
  }

  close() {
    this.readyState = 2; // CLOSED
  }

  // Test helpers
  _emit(type, data) {
    const event = { data: typeof data === "string" ? data : JSON.stringify(data) };
    (this._listeners[type] || []).forEach((h) => h(event));
  }

  _triggerError() {
    this.readyState = 0;
    if (this.onerror) this.onerror(new Event("error"));
  }

  static reset() {
    MockEventSource.instances = [];
  }

  static latest() {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let originalEventSource;

beforeEach(() => {
  MockEventSource.reset();
  originalEventSource = globalThis.EventSource;
  globalThis.EventSource = MockEventSource;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  globalThis.EventSource = originalEventSource;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useServerSync", () => {
  it("dispatches updateStage when receiving a stage-update event", async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useServerSync({ projectId: "proj-1", dispatch }),
    );

    const es = MockEventSource.latest();

    // Simulate connected event
    act(() => {
      es._emit("connected", { projectId: "proj-1" });
    });

    expect(result.current.connected).toBe(true);

    // Simulate stage-update event
    act(() => {
      es._emit("stage-update", {
        projectId: "proj-1",
        stageKey: "intake",
        data: { status: "awaiting_approval" },
      });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "lumon/update-stage",
      payload: {
        stageId: "proj-1:intake",
        changes: { status: "awaiting_approval" },
      },
    });

    expect(result.current.lastEvent).toMatchObject({
      type: "stage-update",
      projectId: "proj-1",
      stageKey: "intake",
    });
  });

  it("dispatches updateStage with artifact reference on artifact-ready event", () => {
    const dispatch = vi.fn();
    renderHook(() => useServerSync({ projectId: "proj-1", dispatch }));

    const es = MockEventSource.latest();

    act(() => {
      es._emit("artifact-ready", {
        projectId: "proj-1",
        stageKey: "intake",
        data: {
          artifactId: "art-001",
          summary: "Viability report ready",
          type: "viability-report",
        },
      });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "lumon/update-stage",
      payload: {
        stageId: "proj-1:intake",
        changes: {
          output: {
            artifactId: "art-001",
            summary: "Viability report ready",
            type: "viability-report",
          },
        },
      },
    });
  });

  it("triggerPipeline calls the correct API endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ executionId: "exec-1", status: "triggered" }),
    });
    globalThis.fetch = mockFetch;

    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useServerSync({ projectId: "proj-1", dispatch }),
    );

    let response;
    await act(async () => {
      response = await result.current.triggerPipeline("proj-1", "intake");
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/pipeline/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: "proj-1", stageKey: "intake" }),
    });
    expect(response).toEqual({ executionId: "exec-1", status: "triggered" });
  });

  it("approvePipeline calls the correct API endpoint with the decision", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, decision: "approved" }),
    });
    globalThis.fetch = mockFetch;

    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useServerSync({ projectId: "proj-1", dispatch }),
    );

    let response;
    await act(async () => {
      response = await result.current.approvePipeline("proj-1", "intake", "approved");
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/pipeline/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: "proj-1", stageKey: "intake", decision: "approved" }),
    });
    expect(response).toEqual({ ok: true, decision: "approved" });
  });

  it("tracks connection status transitions (connected → error → reconnected)", () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useServerSync({ projectId: "proj-1", dispatch }),
    );

    const es = MockEventSource.latest();

    // Initially not connected
    expect(result.current.connected).toBe(false);

    // Simulate connected
    act(() => {
      es._emit("connected", { projectId: "proj-1" });
    });
    expect(result.current.connected).toBe(true);
    expect(result.current.error).toBe(null);

    // Simulate error
    act(() => {
      es._triggerError();
    });
    expect(result.current.connected).toBe(false);
    expect(result.current.error).toBe("SSE connection lost — reconnecting");

    // Simulate reconnected
    act(() => {
      es._emit("connected", { projectId: "proj-1" });
    });
    expect(result.current.connected).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it("closes old EventSource and opens new one when projectId changes", () => {
    const dispatch = vi.fn();
    const { rerender } = renderHook(
      ({ projectId }) => useServerSync({ projectId, dispatch }),
      { initialProps: { projectId: "proj-1" } },
    );

    const firstEs = MockEventSource.latest();
    expect(firstEs.url).toBe("/api/pipeline/events/proj-1");
    expect(firstEs.readyState).not.toBe(2); // not closed

    // Change projectId
    rerender({ projectId: "proj-2" });

    // Old EventSource should be closed
    expect(firstEs.readyState).toBe(2);

    // New EventSource should be created
    const secondEs = MockEventSource.latest();
    expect(secondEs).not.toBe(firstEs);
    expect(secondEs.url).toBe("/api/pipeline/events/proj-2");
    expect(secondEs.readyState).not.toBe(2);
  });

  it("does not open EventSource when projectId is null", () => {
    const dispatch = vi.fn();
    renderHook(() => useServerSync({ projectId: null, dispatch }));

    // No EventSource should have been created
    expect(MockEventSource.instances.length).toBe(0);
  });

  it("dispatches updateProject on pipeline-status event", () => {
    const dispatch = vi.fn();
    renderHook(() => useServerSync({ projectId: "proj-1", dispatch }));

    const es = MockEventSource.latest();

    act(() => {
      es._emit("pipeline-status", {
        projectId: "proj-1",
        stageKey: "intake",
        data: { status: "triggered", executionId: "exec-1" },
      });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "lumon/update-project",
      payload: {
        projectId: "proj-1",
        changes: {
          meta: { lastPipelineStatus: "triggered" },
        },
      },
    });
  });
});
