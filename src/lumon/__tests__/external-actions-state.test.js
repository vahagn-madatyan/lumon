import { describe, it, expect } from "vitest";
import {
  normalizeExternalActionsState,
  createProject,
  createLumonState,
} from "../model";
import { lumonReducer, lumonActions } from "../reducer";
import {
  selectSelectedProjectDetail,
} from "../selectors";

// ---------------------------------------------------------------------------
// normalizeExternalActionsState
// ---------------------------------------------------------------------------

describe("normalizeExternalActionsState", () => {
  it("returns default empty state for undefined", () => {
    const result = normalizeExternalActionsState(undefined);
    expect(result).toEqual({ actions: [] });
  });

  it("returns default empty state for null", () => {
    const result = normalizeExternalActionsState(null);
    expect(result).toEqual({ actions: [] });
  });

  it("returns default empty state for non-object", () => {
    const result = normalizeExternalActionsState("garbage");
    expect(result).toEqual({ actions: [] });
  });

  it("preserves valid actions array", () => {
    const action = { id: "a1", type: "domain-purchase", status: "pending" };
    const result = normalizeExternalActionsState({ actions: [action] });
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toEqual(action);
  });

  it("normalizes invalid actions field to empty array", () => {
    const result = normalizeExternalActionsState({ actions: "not-array" });
    expect(result).toEqual({ actions: [] });
  });
});

// ---------------------------------------------------------------------------
// createProject — externalActions on project shape
// ---------------------------------------------------------------------------

describe("createProject externalActions", () => {
  it("includes default empty external actions when input omits them", () => {
    const project = createProject({ id: "p1" });
    expect(project.externalActions).toEqual({ actions: [] });
  });

  it("includes normalized external actions when provided", () => {
    const action = { id: "a1", type: "domain-purchase", status: "pending" };
    const project = createProject({ id: "p1", externalActions: { actions: [action] } });
    expect(project.externalActions.actions).toHaveLength(1);
    expect(project.externalActions.actions[0].id).toBe("a1");
  });
});

// ---------------------------------------------------------------------------
// Reducer action types
// ---------------------------------------------------------------------------

const buildTestState = (projectOverrides = {}) =>
  createLumonState({
    projects: [
      {
        id: "proj-1",
        name: "Test Project",
        ...projectOverrides,
      },
    ],
    selection: { projectId: "proj-1" },
  });

describe("reducer — external action lifecycle", () => {
  it("lumon/request-external-action adds action to project", () => {
    const state = buildTestState();
    const action = lumonActions.requestExternalAction("proj-1", {
      id: "ea-1",
      type: "domain-purchase",
      params: { domain: "example.com" },
      status: "pending",
      requestedAt: "2026-01-01T00:00:00.000Z",
    });
    const next = lumonReducer(state, action);
    const project = next.projects.find((p) => p.id === "proj-1");
    expect(project.externalActions.actions).toHaveLength(1);
    expect(project.externalActions.actions[0].id).toBe("ea-1");
    expect(project.externalActions.actions[0].status).toBe("pending");
  });

  it("lumon/confirm-external-action updates status and sets confirmedAt", () => {
    const state = buildTestState({
      externalActions: {
        actions: [{ id: "ea-1", type: "domain-purchase", status: "pending" }],
      },
    });
    const action = lumonActions.confirmExternalAction("proj-1", "ea-1", "2026-01-02T00:00:00.000Z");
    const next = lumonReducer(state, action);
    const ea = next.projects[0].externalActions.actions[0];
    expect(ea.status).toBe("confirmed");
    expect(ea.confirmedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("lumon/complete-external-action updates status, result, and completedAt", () => {
    const state = buildTestState({
      externalActions: {
        actions: [{ id: "ea-1", type: "domain-purchase", status: "confirmed" }],
      },
    });
    const result = { domain: "example.com", orderId: "ORD-123" };
    const action = lumonActions.completeExternalAction("proj-1", "ea-1", result, "2026-01-03T00:00:00.000Z");
    const next = lumonReducer(state, action);
    const ea = next.projects[0].externalActions.actions[0];
    expect(ea.status).toBe("completed");
    expect(ea.result).toEqual(result);
    expect(ea.completedAt).toBe("2026-01-03T00:00:00.000Z");
  });

  it("lumon/fail-external-action updates status and sets error", () => {
    const state = buildTestState({
      externalActions: {
        actions: [{ id: "ea-1", type: "domain-purchase", status: "confirmed" }],
      },
    });
    const action = lumonActions.failExternalAction("proj-1", "ea-1", "Domain taken");
    const next = lumonReducer(state, action);
    const ea = next.projects[0].externalActions.actions[0];
    expect(ea.status).toBe("failed");
    expect(ea.error).toBe("Domain taken");
  });

  it("lumon/cancel-external-action updates status to cancelled", () => {
    const state = buildTestState({
      externalActions: {
        actions: [{ id: "ea-1", type: "domain-purchase", status: "pending" }],
      },
    });
    const action = lumonActions.cancelExternalAction("proj-1", "ea-1");
    const next = lumonReducer(state, action);
    const ea = next.projects[0].externalActions.actions[0];
    expect(ea.status).toBe("cancelled");
  });

  it("action for nonexistent projectId returns unchanged state", () => {
    const state = buildTestState();
    const action = lumonActions.requestExternalAction("nonexistent-project", {
      id: "ea-1",
      type: "domain-purchase",
      status: "pending",
    });
    const next = lumonReducer(state, action);
    expect(next).toBe(state);
  });

  it("confirm for nonexistent actionId returns unchanged state", () => {
    const state = buildTestState({
      externalActions: {
        actions: [{ id: "ea-1", type: "domain-purchase", status: "pending" }],
      },
    });
    const action = lumonActions.confirmExternalAction("proj-1", "no-such-action", "2026-01-02T00:00:00.000Z");
    const next = lumonReducer(state, action);
    // Project was found but action wasn't — no change
    expect(next.projects[0].externalActions.actions[0].status).toBe("pending");
  });
});

// ---------------------------------------------------------------------------
// Selector — view model
// ---------------------------------------------------------------------------

describe("selector — external actions view model", () => {
  it("includes correct status labels and tones", () => {
    const state = buildTestState({
      externalActions: {
        actions: [
          { id: "ea-1", type: "domain-purchase", params: { domain: "a.com" }, status: "pending" },
          { id: "ea-2", type: "domain-purchase", params: { domain: "b.com" }, status: "confirmed" },
          { id: "ea-3", type: "domain-purchase", params: { domain: "c.com" }, status: "completed" },
          { id: "ea-4", type: "domain-purchase", params: { domain: "d.com" }, status: "failed", error: "oops" },
          { id: "ea-5", type: "domain-purchase", params: { domain: "e.com" }, status: "cancelled" },
          { id: "ea-6", type: "domain-purchase", params: { domain: "f.com" }, status: "executing" },
        ],
      },
    });
    const vm = selectSelectedProjectDetail(state);
    const ea = vm.externalActions;

    expect(ea.actions[0].statusLabel).toBe("Pending confirmation");
    expect(ea.actions[0].statusTone).toBe("waiting");

    expect(ea.actions[1].statusLabel).toBe("Confirmed");
    expect(ea.actions[1].statusTone).toBe("running");

    expect(ea.actions[2].statusLabel).toBe("Completed");
    expect(ea.actions[2].statusTone).toBe("complete");

    expect(ea.actions[3].statusLabel).toBe("Failed");
    expect(ea.actions[3].statusTone).toBe("failed");

    expect(ea.actions[4].statusLabel).toBe("Cancelled");
    expect(ea.actions[4].statusTone).toBe("idle");

    expect(ea.actions[5].statusLabel).toBe("Executing…");
    expect(ea.actions[5].statusTone).toBe("running");
  });

  it("boolean helpers correct per status", () => {
    const state = buildTestState({
      externalActions: {
        actions: [
          { id: "ea-1", type: "domain-purchase", status: "pending" },
          { id: "ea-2", type: "domain-purchase", status: "confirmed" },
          { id: "ea-3", type: "domain-purchase", status: "completed" },
          { id: "ea-4", type: "domain-purchase", status: "failed" },
          { id: "ea-5", type: "domain-purchase", status: "cancelled" },
        ],
      },
    });
    const vm = selectSelectedProjectDetail(state);
    const ea = vm.externalActions;

    // pending: canConfirm=true, canCancel=true, canExecute=false
    expect(ea.actions[0].canConfirm).toBe(true);
    expect(ea.actions[0].canCancel).toBe(true);
    expect(ea.actions[0].canExecute).toBe(false);

    // confirmed: canConfirm=false, canCancel=true, canExecute=true
    expect(ea.actions[1].canConfirm).toBe(false);
    expect(ea.actions[1].canCancel).toBe(true);
    expect(ea.actions[1].canExecute).toBe(true);

    // completed: all false
    expect(ea.actions[2].canConfirm).toBe(false);
    expect(ea.actions[2].canCancel).toBe(false);
    expect(ea.actions[2].canExecute).toBe(false);

    // failed: all false
    expect(ea.actions[3].canConfirm).toBe(false);
    expect(ea.actions[3].canCancel).toBe(false);
    expect(ea.actions[3].canExecute).toBe(false);

    // cancelled: all false
    expect(ea.actions[4].canConfirm).toBe(false);
    expect(ea.actions[4].canCancel).toBe(false);
    expect(ea.actions[4].canExecute).toBe(false);
  });

  it("aggregate counts correct", () => {
    const state = buildTestState({
      externalActions: {
        actions: [
          { id: "ea-1", type: "domain-purchase", status: "pending" },
          { id: "ea-2", type: "domain-purchase", status: "pending" },
          { id: "ea-3", type: "domain-purchase", status: "confirmed" },
          { id: "ea-4", type: "domain-purchase", status: "completed" },
          { id: "ea-5", type: "domain-purchase", status: "failed" },
        ],
      },
    });
    const vm = selectSelectedProjectDetail(state);
    const ea = vm.externalActions;

    expect(ea.pendingCount).toBe(2);
    expect(ea.confirmedCount).toBe(1);
    expect(ea.completedCount).toBe(1);
    expect(ea.failedCount).toBe(1);
    expect(ea.hasPending).toBe(true);
    expect(ea.hasConfirmed).toBe(true);
    expect(ea.hasActions).toBe(true);
  });

  it("empty external actions produce zero counts", () => {
    const state = buildTestState();
    const vm = selectSelectedProjectDetail(state);
    const ea = vm.externalActions;

    expect(ea.actions).toHaveLength(0);
    expect(ea.pendingCount).toBe(0);
    expect(ea.confirmedCount).toBe(0);
    expect(ea.completedCount).toBe(0);
    expect(ea.failedCount).toBe(0);
    expect(ea.hasPending).toBe(false);
    expect(ea.hasConfirmed).toBe(false);
    expect(ea.hasActions).toBe(false);
  });

  it("domainLabel derives from params.domain when present", () => {
    const state = buildTestState({
      externalActions: {
        actions: [
          { id: "ea-1", type: "domain-purchase", params: { domain: "example.com" }, status: "pending" },
        ],
      },
    });
    const vm = selectSelectedProjectDetail(state);
    expect(vm.externalActions.actions[0].domainLabel).toBe("example.com");
  });
});
