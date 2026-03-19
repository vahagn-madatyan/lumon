import { describe, expect, it } from "vitest";
import {
  createProject,
  createLumonState,
  normalizeProvisioningState,
} from "../model";
import { lumonActions, lumonActionTypes, lumonReducer } from "../reducer";
import {
  selectDashboardProjects,
  selectSelectedProjectDetail,
} from "../selectors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = "2026-03-18T12:00:00.000Z";

const makeMinimalProject = (overrides = {}) => ({
  id: "test-project",
  name: "Test Project",
  agents: [{ id: "test-project:agent-01", name: "Agent 01", wave: 1, status: "queued" }],
  ...overrides,
});

const makeState = (projectOverrides = {}, options = {}) =>
  createLumonState(
    {
      projects: [makeMinimalProject(projectOverrides)],
      selection: { projectId: "test-project" },
    },
    { now: NOW, ...options },
  );

const makeHandoffReadyProject = (provisioningOverrides) => {
  // Create a project with all stages complete + handoff pending = handoff_ready
  const stageOverrides = {
    intake: { status: "complete", approval: { state: "approved" } },
    research: { status: "complete" },
    plan: { status: "complete", approval: { state: "approved" } },
    verification: { status: "complete", approval: { state: "approved" } },
    handoff: { status: "queued", approval: { state: "pending" } },
  };
  return makeState({
    execution: {
      stages: [
        { stageKey: "intake", ...stageOverrides.intake },
        { stageKey: "research", ...stageOverrides.research },
        { stageKey: "plan", ...stageOverrides.plan },
        { stageKey: "wave-1", status: "complete" },
        { stageKey: "verification", ...stageOverrides.verification },
        { stageKey: "handoff", ...stageOverrides.handoff },
      ],
    },
    provisioning: provisioningOverrides,
  });
};

// ---------------------------------------------------------------------------
// normalizeProvisioningState
// ---------------------------------------------------------------------------

describe("normalizeProvisioningState", () => {
  it("returns default shape for null/undefined input", () => {
    expect(normalizeProvisioningState(null)).toEqual({
      status: "idle",
      repoUrl: null,
      workspacePath: null,
      error: null,
      steps: [],
      previewPlan: null,
    });
    expect(normalizeProvisioningState(undefined)).toEqual({
      status: "idle",
      repoUrl: null,
      workspacePath: null,
      error: null,
      steps: [],
      previewPlan: null,
    });
  });

  it("returns default shape for non-object input", () => {
    expect(normalizeProvisioningState("invalid")).toEqual({
      status: "idle",
      repoUrl: null,
      workspacePath: null,
      error: null,
      steps: [],
      previewPlan: null,
    });
    expect(normalizeProvisioningState(42)).toEqual({
      status: "idle",
      repoUrl: null,
      workspacePath: null,
      error: null,
      steps: [],
      previewPlan: null,
    });
  });

  it("coerces invalid status to idle", () => {
    const result = normalizeProvisioningState({ status: "bogus" });
    expect(result.status).toBe("idle");
  });

  it("preserves valid status values", () => {
    for (const status of ["idle", "previewing", "confirming", "provisioning", "complete", "failed"]) {
      expect(normalizeProvisioningState({ status }).status).toBe(status);
    }
  });

  it("preserves string fields, coerces non-strings to null", () => {
    const result = normalizeProvisioningState({
      repoUrl: "https://github.com/test/repo",
      workspacePath: "/tmp/test",
      error: 123, // not a string
    });
    expect(result.repoUrl).toBe("https://github.com/test/repo");
    expect(result.workspacePath).toBe("/tmp/test");
    expect(result.error).toBeNull();
  });

  it("copies steps array, defaults to empty array", () => {
    const steps = [{ name: "repo-create", status: "complete" }];
    expect(normalizeProvisioningState({ steps }).steps).toEqual(steps);
    expect(normalizeProvisioningState({ steps }).steps).not.toBe(steps); // defensive copy
    expect(normalizeProvisioningState({}).steps).toEqual([]);
  });

  it("copies previewPlan object, defaults to null", () => {
    const plan = { repoName: "test-repo", files: ["a.md"] };
    const result = normalizeProvisioningState({ previewPlan: plan });
    expect(result.previewPlan).toEqual(plan);
    expect(result.previewPlan).not.toBe(plan); // defensive copy
    expect(normalizeProvisioningState({}).previewPlan).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createProject — provisioning initialization
// ---------------------------------------------------------------------------

describe("createProject provisioning", () => {
  it("initializes provisioning with default idle state when omitted", () => {
    const project = createProject(makeMinimalProject(), { now: NOW });
    expect(project.provisioning).toEqual({
      status: "idle",
      repoUrl: null,
      workspacePath: null,
      error: null,
      steps: [],
      previewPlan: null,
    });
  });

  it("preserves explicit provisioning input through createProject", () => {
    const provisioning = {
      status: "complete",
      repoUrl: "https://github.com/test/repo",
      workspacePath: "/home/user/projects/test",
      error: null,
      steps: [{ name: "repo-create", status: "complete" }],
      previewPlan: { repoName: "test-repo" },
    };

    const project = createProject(makeMinimalProject({ provisioning }), { now: NOW });
    expect(project.provisioning.status).toBe("complete");
    expect(project.provisioning.repoUrl).toBe("https://github.com/test/repo");
    expect(project.provisioning.workspacePath).toBe("/home/user/projects/test");
    expect(project.provisioning.steps).toEqual([{ name: "repo-create", status: "complete" }]);
    expect(project.provisioning.previewPlan).toEqual({ repoName: "test-repo" });
  });

  it("normalizes invalid provisioning input", () => {
    const project = createProject(
      makeMinimalProject({ provisioning: { status: "bogus", repoUrl: 42 } }),
      { now: NOW },
    );
    expect(project.provisioning.status).toBe("idle");
    expect(project.provisioning.repoUrl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Reducer — lumon/update-provisioning
// ---------------------------------------------------------------------------

describe("lumonReducer update-provisioning", () => {
  it("has the correct action type string", () => {
    expect(lumonActionTypes.updateProvisioning).toBe("lumon/update-provisioning");
  });

  it("merges provisioning changes on the correct project", () => {
    const state = makeState();
    expect(state.projects[0].provisioning.status).toBe("idle");

    const action = lumonActions.updateProvisioning("test-project", {
      status: "previewing",
    });
    const next = lumonReducer(state, action);

    expect(next.projects[0].provisioning.status).toBe("previewing");
    // Other fields preserved
    expect(next.projects[0].provisioning.repoUrl).toBeNull();
    expect(next.projects[0].provisioning.error).toBeNull();
  });

  it("merges multiple fields at once", () => {
    const state = makeState();
    const action = lumonActions.updateProvisioning("test-project", {
      status: "complete",
      repoUrl: "https://github.com/test/repo",
      workspacePath: "/tmp/test",
    });
    const next = lumonReducer(state, action);

    expect(next.projects[0].provisioning.status).toBe("complete");
    expect(next.projects[0].provisioning.repoUrl).toBe("https://github.com/test/repo");
    expect(next.projects[0].provisioning.workspacePath).toBe("/tmp/test");
  });

  it("is a no-op for unknown projectId", () => {
    const state = makeState();
    const action = lumonActions.updateProvisioning("unknown-project", {
      status: "provisioning",
    });
    const next = lumonReducer(state, action);

    expect(next).toBe(state);
  });

  it("is a no-op when changes is missing", () => {
    const state = makeState();
    const action = { type: lumonActionTypes.updateProvisioning, payload: { projectId: "test-project" } };
    const next = lumonReducer(state, action);

    expect(next).toBe(state);
  });

  it("touches updatedAt when provisioning changes", () => {
    const state = makeState();
    const originalUpdatedAt = state.projects[0].updatedAt;

    const action = {
      type: lumonActionTypes.updateProvisioning,
      payload: {
        projectId: "test-project",
        changes: { status: "provisioning" },
        now: "2026-03-19T00:00:00.000Z",
      },
    };
    const next = lumonReducer(state, action);

    expect(next.projects[0].updatedAt).not.toBe(originalUpdatedAt);
  });

  it("preserves provisioning fields not in changes", () => {
    // Start with some provisioning state already set
    const state = makeState({
      provisioning: {
        status: "confirming",
        previewPlan: { repoName: "my-repo" },
      },
    });

    const action = lumonActions.updateProvisioning("test-project", {
      status: "provisioning",
    });
    const next = lumonReducer(state, action);

    expect(next.projects[0].provisioning.status).toBe("provisioning");
    // previewPlan should survive the merge through touchProject → createProject
    expect(next.projects[0].provisioning.previewPlan).toEqual({ repoName: "my-repo" });
  });
});

// ---------------------------------------------------------------------------
// Selectors — provisioning in view models
// ---------------------------------------------------------------------------

describe("selectors provisioning", () => {
  it("buildProjectViewModel includes provisioning state", () => {
    const state = makeState({
      provisioning: { status: "complete", repoUrl: "https://github.com/test/repo" },
    });

    const projects = selectDashboardProjects(state);
    expect(projects[0].provisioning).toBeDefined();
    expect(projects[0].provisioning.status).toBe("complete");
    expect(projects[0].provisioning.repoUrl).toBe("https://github.com/test/repo");
  });

  it("buildHandoffPacket includes provisioning with provisioningReady", () => {
    // handoff_ready + idle provisioning → provisioningReady = true
    const state = makeHandoffReadyProject();
    const detail = selectSelectedProjectDetail(state);

    expect(detail.handoffPacket).toBeDefined();
    expect(detail.handoffPacket.provisioning).toBeDefined();
    expect(detail.handoffPacket.provisioning.provisioningReady).toBe(true);
    expect(detail.handoffPacket.provisioning.status).toBe("idle");
  });

  it("provisioningReady is false when provisioning is not idle", () => {
    const state = makeHandoffReadyProject({ status: "provisioning" });
    const detail = selectSelectedProjectDetail(state);

    expect(detail.handoffPacket.provisioning.provisioningReady).toBe(false);
  });

  it("provisioningReady is false when pipeline is not handoff_ready", () => {
    // Pipeline at intake (not handoff_ready) but provisioning idle
    const state = makeState();
    const detail = selectSelectedProjectDetail(state);

    expect(detail.handoffPacket.provisioning.provisioningReady).toBe(false);
  });

  it("provisioning error surfaces in handoff packet", () => {
    const state = makeHandoffReadyProject({
      status: "failed",
      error: "GitHub API rate limited",
    });
    const detail = selectSelectedProjectDetail(state);

    expect(detail.handoffPacket.provisioning.status).toBe("failed");
    expect(detail.handoffPacket.provisioning.error).toBe("GitHub API rate limited");
    expect(detail.handoffPacket.provisioning.provisioningReady).toBe(false);
  });

  it("provisioning repoUrl and workspacePath surface in handoff packet", () => {
    const state = makeHandoffReadyProject({
      status: "complete",
      repoUrl: "https://github.com/org/repo",
      workspacePath: "/home/user/projects/repo",
    });
    const detail = selectSelectedProjectDetail(state);

    expect(detail.handoffPacket.provisioning.repoUrl).toBe("https://github.com/org/repo");
    expect(detail.handoffPacket.provisioning.workspacePath).toBe("/home/user/projects/repo");
  });
});

// ---------------------------------------------------------------------------
// Persistence — provisioning round-trips through createLumonState
// ---------------------------------------------------------------------------

describe("provisioning persistence", () => {
  it("provisioning state survives full createLumonState round-trip", () => {
    const provisioning = {
      status: "complete",
      repoUrl: "https://github.com/test/repo",
      workspacePath: "/home/user/test",
      error: null,
      steps: [{ name: "repo-create", status: "complete" }],
      previewPlan: { repoName: "test-repo" },
    };

    // Simulate: state → serialize → deserialize → createLumonState
    const original = makeState({ provisioning });
    const serialized = JSON.parse(JSON.stringify(original));
    const restored = createLumonState(serialized, { now: NOW });

    expect(restored.projects[0].provisioning.status).toBe("complete");
    expect(restored.projects[0].provisioning.repoUrl).toBe("https://github.com/test/repo");
    expect(restored.projects[0].provisioning.workspacePath).toBe("/home/user/test");
    expect(restored.projects[0].provisioning.steps).toEqual([
      { name: "repo-create", status: "complete" },
    ]);
    expect(restored.projects[0].provisioning.previewPlan).toEqual({ repoName: "test-repo" });
  });

  it("provisioning defaults survive round-trip when originally omitted", () => {
    const original = makeState();
    const serialized = JSON.parse(JSON.stringify(original));
    const restored = createLumonState(serialized, { now: NOW });

    expect(restored.projects[0].provisioning).toEqual({
      status: "idle",
      repoUrl: null,
      workspacePath: null,
      error: null,
      steps: [],
      previewPlan: null,
    });
  });
});

// ---------------------------------------------------------------------------
// SSE dispatch simulation through reducer
// ---------------------------------------------------------------------------

describe("SSE dispatches via reducer", () => {
  it("provisioning-progress pattern: sets status to provisioning with steps", () => {
    const state = makeState();
    const steps = [
      { name: "repo-create", status: "complete" },
      { name: "clone", status: "running" },
    ];

    const next = lumonReducer(state, {
      type: "lumon/update-provisioning",
      payload: {
        projectId: "test-project",
        changes: { status: "provisioning", steps },
      },
    });

    expect(next.projects[0].provisioning.status).toBe("provisioning");
    expect(next.projects[0].provisioning.steps).toEqual(steps);
  });

  it("provisioning-complete pattern: sets complete with repoUrl and workspacePath", () => {
    const state = makeState({ provisioning: { status: "provisioning" } });

    const next = lumonReducer(state, {
      type: "lumon/update-provisioning",
      payload: {
        projectId: "test-project",
        changes: {
          status: "complete",
          repoUrl: "https://github.com/org/my-repo",
          workspacePath: "/home/user/my-repo",
          error: null,
        },
      },
    });

    expect(next.projects[0].provisioning.status).toBe("complete");
    expect(next.projects[0].provisioning.repoUrl).toBe("https://github.com/org/my-repo");
    expect(next.projects[0].provisioning.workspacePath).toBe("/home/user/my-repo");
    expect(next.projects[0].provisioning.error).toBeNull();
  });

  it("provisioning-error pattern: sets failed with error message", () => {
    const state = makeState({ provisioning: { status: "provisioning" } });

    const next = lumonReducer(state, {
      type: "lumon/update-provisioning",
      payload: {
        projectId: "test-project",
        changes: {
          status: "failed",
          error: "Step 'clone' failed: git clone returned non-zero",
        },
      },
    });

    expect(next.projects[0].provisioning.status).toBe("failed");
    expect(next.projects[0].provisioning.error).toBe(
      "Step 'clone' failed: git clone returned non-zero",
    );
  });
});
