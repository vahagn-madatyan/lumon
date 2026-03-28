import { describe, expect, it } from "vitest";
import {
  createProject,
  createLumonState,
  normalizeBuildExecutionState,
  VALID_BUILD_EXECUTION_STATUSES,
} from "../model";
import { lumonActions, lumonActionTypes, lumonReducer } from "../reducer";
import {
  selectDashboardProjects,
  selectSelectedProjectDetail,
  selectFloorAgents,
} from "../selectors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = "2026-03-21T12:00:00.000Z";

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

const makeProvisionedProject = (buildExecutionOverrides) =>
  makeState({
    provisioning: {
      status: "complete",
      repoUrl: "https://github.com/test/repo",
      workspacePath: "/tmp/test-workspace",
    },
    buildExecution: buildExecutionOverrides,
  });

// ---------------------------------------------------------------------------
// normalizeBuildExecutionState
// ---------------------------------------------------------------------------

describe("normalizeBuildExecutionState", () => {
  it("returns default shape for null input", () => {
    expect(normalizeBuildExecutionState(null)).toEqual({
      status: "idle",
      agents: [],
      startedAt: null,
      completedAt: null,
      error: null,
      retryCount: 0,
      escalation: { status: "none", reason: null, acknowledgedAt: null, decision: null },
    });
  });

  it("returns default shape for undefined input", () => {
    expect(normalizeBuildExecutionState(undefined)).toEqual({
      status: "idle",
      agents: [],
      startedAt: null,
      completedAt: null,
      error: null,
      retryCount: 0,
      escalation: { status: "none", reason: null, acknowledgedAt: null, decision: null },
    });
  });

  it("returns default shape for non-object input", () => {
    expect(normalizeBuildExecutionState("invalid")).toEqual({
      status: "idle",
      agents: [],
      startedAt: null,
      completedAt: null,
      error: null,
      retryCount: 0,
      escalation: { status: "none", reason: null, acknowledgedAt: null, decision: null },
    });
  });

  it("normalizes valid input", () => {
    const input = {
      status: "running",
      agents: [{ agentId: "a1", status: "running" }],
      startedAt: "2026-03-21T12:00:00.000Z",
      completedAt: null,
      error: null,
    };
    const result = normalizeBuildExecutionState(input);
    expect(result.status).toBe("running");
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].agentId).toBe("a1");
    expect(result.startedAt).toBe("2026-03-21T12:00:00.000Z");
  });

  it("coerces invalid status to idle", () => {
    expect(normalizeBuildExecutionState({ status: "bogus" }).status).toBe("idle");
    expect(normalizeBuildExecutionState({ status: 42 }).status).toBe("idle");
  });

  it("coerces non-array agents to empty array", () => {
    expect(normalizeBuildExecutionState({ agents: "not-array" }).agents).toEqual([]);
    expect(normalizeBuildExecutionState({ agents: null }).agents).toEqual([]);
  });

  it("coerces non-string timestamps to null", () => {
    expect(normalizeBuildExecutionState({ startedAt: 42 }).startedAt).toBeNull();
    expect(normalizeBuildExecutionState({ completedAt: true }).completedAt).toBeNull();
  });

  it("coerces non-string error to null", () => {
    expect(normalizeBuildExecutionState({ error: 42 }).error).toBeNull();
  });

  it("preserves all four valid statuses", () => {
    for (const status of ["idle", "running", "completed", "failed"]) {
      expect(normalizeBuildExecutionState({ status }).status).toBe(status);
    }
  });

  it("copies agents shallowly — mutation-safe", () => {
    const original = { agentId: "a1", status: "running" };
    const result = normalizeBuildExecutionState({ agents: [original] });
    expect(result.agents[0]).not.toBe(original);
    expect(result.agents[0].agentId).toBe(original.agentId);
    expect(result.agents[0].status).toBe(original.status);
    // agents now include telemetry defaults
    expect(result.agents[0].telemetry).toBeDefined();
  });
});

describe("VALID_BUILD_EXECUTION_STATUSES", () => {
  it("contains exactly the expected statuses", () => {
    expect(VALID_BUILD_EXECUTION_STATUSES).toEqual(
      new Set(["idle", "running", "completed", "failed", "escalated"]),
    );
  });
});

// ---------------------------------------------------------------------------
// createProject with buildExecution
// ---------------------------------------------------------------------------

describe("createProject — buildExecution field", () => {
  it("initializes buildExecution to idle defaults when not provided", () => {
    const project = createProject({ id: "p1" }, { now: NOW });
    expect(project.buildExecution).toEqual({
      status: "idle",
      agents: [],
      startedAt: null,
      completedAt: null,
      error: null,
      retryCount: 0,
      escalation: { status: "none", reason: null, acknowledgedAt: null, decision: null },
    });
  });

  it("normalizes buildExecution from input", () => {
    const project = createProject(
      {
        id: "p1",
        buildExecution: {
          status: "running",
          agents: [{ agentId: "a1", status: "running" }],
          startedAt: "2026-03-21T12:00:00.000Z",
        },
      },
      { now: NOW },
    );
    expect(project.buildExecution.status).toBe("running");
    expect(project.buildExecution.agents).toHaveLength(1);
  });

  it("coerces invalid buildExecution to idle defaults", () => {
    const project = createProject(
      { id: "p1", buildExecution: "garbage" },
      { now: NOW },
    );
    expect(project.buildExecution.status).toBe("idle");
    expect(project.buildExecution.agents).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Reducer — build execution action types
// ---------------------------------------------------------------------------

describe("lumonReducer — build execution actions", () => {
  describe("lumon/start-build", () => {
    it("sets buildExecution to running with startedAt", () => {
      const state = makeProvisionedProject();
      const next = lumonReducer(state, lumonActions.startBuild("test-project"));
      const project = next.projects[0];
      expect(project.buildExecution.status).toBe("running");
      expect(project.buildExecution.startedAt).toBeTruthy();
      expect(project.buildExecution.agents).toEqual([]);
      expect(project.buildExecution.error).toBeNull();
    });

    it("clears previous error and completedAt", () => {
      const state = makeProvisionedProject({
        status: "failed",
        error: "previous failure",
        completedAt: "2026-03-20T00:00:00.000Z",
      });
      const next = lumonReducer(state, lumonActions.startBuild("test-project"));
      expect(next.projects[0].buildExecution.error).toBeNull();
      expect(next.projects[0].buildExecution.completedAt).toBeNull();
    });

    it("ignores unknown projectId", () => {
      const state = makeProvisionedProject();
      const next = lumonReducer(state, lumonActions.startBuild("nonexistent"));
      expect(next).toBe(state);
    });

    it("ignores missing projectId", () => {
      const state = makeProvisionedProject();
      const next = lumonReducer(state, { type: lumonActionTypes.startBuild, payload: {} });
      expect(next).toBe(state);
    });
  });

  describe("lumon/update-build-agent", () => {
    it("adds a new agent when not found", () => {
      const state = makeProvisionedProject({ status: "running" });
      const startedState = lumonReducer(state, lumonActions.startBuild("test-project"));
      const next = lumonReducer(
        startedState,
        lumonActions.updateBuildAgent("test-project", "agent-123", {
          agentType: "claude",
          status: "running",
          pid: 12345,
        }),
      );
      const agents = next.projects[0].buildExecution.agents;
      expect(agents).toHaveLength(1);
      expect(agents[0].agentId).toBe("agent-123");
      expect(agents[0].agentType).toBe("claude");
      expect(agents[0].pid).toBe(12345);
    });

    it("updates an existing agent", () => {
      const state = makeProvisionedProject({
        status: "running",
        agents: [{ agentId: "agent-123", status: "running", agentType: "claude" }],
        startedAt: NOW,
      });
      const next = lumonReducer(
        state,
        lumonActions.updateBuildAgent("test-project", "agent-123", {
          lastOutput: "Building component...",
          elapsed: 5000,
        }),
      );
      const agent = next.projects[0].buildExecution.agents[0];
      expect(agent.lastOutput).toBe("Building component...");
      expect(agent.elapsed).toBe(5000);
      expect(agent.agentId).toBe("agent-123");
    });

    it("ignores unknown projectId", () => {
      const state = makeProvisionedProject({ status: "running", startedAt: NOW });
      const next = lumonReducer(
        state,
        lumonActions.updateBuildAgent("nonexistent", "agent-123", { status: "running" }),
      );
      expect(next).toBe(state);
    });
  });

  describe("lumon/complete-build", () => {
    it("sets status to completed with completedAt", () => {
      const state = makeProvisionedProject({
        status: "running",
        agents: [{ agentId: "agent-123", status: "completed" }],
        startedAt: NOW,
      });
      const next = lumonReducer(state, lumonActions.completeBuild("test-project"));
      expect(next.projects[0].buildExecution.status).toBe("completed");
      expect(next.projects[0].buildExecution.completedAt).toBeTruthy();
      expect(next.projects[0].buildExecution.error).toBeNull();
    });

    it("ignores unknown projectId", () => {
      const state = makeProvisionedProject({ status: "running", startedAt: NOW });
      const next = lumonReducer(state, lumonActions.completeBuild("nonexistent"));
      expect(next).toBe(state);
    });
  });

  describe("lumon/fail-build", () => {
    it("sets status to failed with error", () => {
      const state = makeProvisionedProject({
        status: "running",
        agents: [{ agentId: "agent-123", status: "failed" }],
        startedAt: NOW,
      });
      const next = lumonReducer(state, lumonActions.failBuild("test-project", "Exit code 1"));
      expect(next.projects[0].buildExecution.status).toBe("failed");
      expect(next.projects[0].buildExecution.error).toBe("Exit code 1");
      expect(next.projects[0].buildExecution.completedAt).toBeTruthy();
    });

    it("uses default error message when none provided", () => {
      const state = makeProvisionedProject({ status: "running", startedAt: NOW });
      const next = lumonReducer(state, lumonActions.failBuild("test-project"));
      expect(next.projects[0].buildExecution.error).toBe("Unknown build error");
    });
  });

  describe("full lifecycle: start → update-agent → complete", () => {
    it("walks through the happy path", () => {
      const initial = makeProvisionedProject();

      // Start
      const s1 = lumonReducer(initial, lumonActions.startBuild("test-project"));
      expect(s1.projects[0].buildExecution.status).toBe("running");

      // Agent spawned
      const s2 = lumonReducer(
        s1,
        lumonActions.updateBuildAgent("test-project", "agent-abc", {
          agentType: "claude",
          status: "running",
          pid: 100,
        }),
      );
      expect(s2.projects[0].buildExecution.agents).toHaveLength(1);

      // Agent output
      const s3 = lumonReducer(
        s2,
        lumonActions.updateBuildAgent("test-project", "agent-abc", {
          lastOutput: "All tests pass",
          elapsed: 30000,
        }),
      );
      expect(s3.projects[0].buildExecution.agents[0].lastOutput).toBe("All tests pass");

      // Complete
      const s4 = lumonReducer(s3, lumonActions.completeBuild("test-project"));
      expect(s4.projects[0].buildExecution.status).toBe("completed");
      expect(s4.projects[0].buildExecution.completedAt).toBeTruthy();
    });
  });

  describe("full lifecycle: start → update-agent → fail", () => {
    it("walks through the failure path", () => {
      const initial = makeProvisionedProject();

      // Start
      const s1 = lumonReducer(initial, lumonActions.startBuild("test-project"));

      // Agent spawned
      const s2 = lumonReducer(
        s1,
        lumonActions.updateBuildAgent("test-project", "agent-xyz", {
          agentType: "codex",
          status: "running",
          pid: 200,
        }),
      );

      // Agent output
      const s3 = lumonReducer(
        s2,
        lumonActions.updateBuildAgent("test-project", "agent-xyz", {
          lastOutput: "Error: compilation failed",
          status: "failed",
          error: "Exit code 1",
        }),
      );
      expect(s3.projects[0].buildExecution.agents[0].status).toBe("failed");

      // Build fails
      const s4 = lumonReducer(s3, lumonActions.failBuild("test-project", "Exit code 1"));
      expect(s4.projects[0].buildExecution.status).toBe("failed");
      expect(s4.projects[0].buildExecution.error).toBe("Exit code 1");
    });
  });
});

// ---------------------------------------------------------------------------
// Selectors — build execution view model
// ---------------------------------------------------------------------------

describe("selectors — buildExecution view model", () => {
  describe("canStartBuild", () => {
    it("returns true when provisioning complete and buildExecution idle", () => {
      const state = makeProvisionedProject();
      const projects = selectDashboardProjects(state);
      expect(projects[0].buildExecution.canStartBuild).toBe(true);
    });

    it("returns true when provisioning complete and buildExecution completed", () => {
      const state = makeProvisionedProject({
        status: "completed",
        completedAt: NOW,
      });
      const projects = selectDashboardProjects(state);
      expect(projects[0].buildExecution.canStartBuild).toBe(true);
    });

    it("returns true when provisioning complete and buildExecution failed", () => {
      const state = makeProvisionedProject({
        status: "failed",
        error: "previous failure",
      });
      const projects = selectDashboardProjects(state);
      expect(projects[0].buildExecution.canStartBuild).toBe(true);
    });

    it("returns false when provisioning not complete", () => {
      const state = makeState({
        provisioning: { status: "idle" },
      });
      const projects = selectDashboardProjects(state);
      expect(projects[0].buildExecution.canStartBuild).toBe(false);
    });

    it("returns false when buildExecution is running", () => {
      const state = makeProvisionedProject({
        status: "running",
        startedAt: NOW,
      });
      const projects = selectDashboardProjects(state);
      expect(projects[0].buildExecution.canStartBuild).toBe(false);
    });
  });

  describe("status view model fields", () => {
    it("shows idle status with correct labels", () => {
      const state = makeProvisionedProject();
      const projects = selectDashboardProjects(state);
      const be = projects[0].buildExecution;
      expect(be.status).toBe("idle");
      expect(be.statusLabel).toBe("Idle");
      expect(be.statusTone).toBe("queued");
    });

    it("shows running status with correct labels", () => {
      const state = makeProvisionedProject({
        status: "running",
        startedAt: NOW,
      });
      const projects = selectDashboardProjects(state);
      const be = projects[0].buildExecution;
      expect(be.status).toBe("running");
      expect(be.statusLabel).toBe("Running");
      expect(be.statusTone).toBe("running");
    });

    it("shows completed status with correct labels", () => {
      const state = makeProvisionedProject({
        status: "completed",
        startedAt: NOW,
        completedAt: NOW,
      });
      const projects = selectDashboardProjects(state);
      const be = projects[0].buildExecution;
      expect(be.status).toBe("completed");
      expect(be.statusLabel).toBe("Completed");
      expect(be.statusTone).toBe("complete");
    });

    it("shows failed status with error", () => {
      const state = makeProvisionedProject({
        status: "failed",
        error: "Exit code 1",
      });
      const projects = selectDashboardProjects(state);
      const be = projects[0].buildExecution;
      expect(be.status).toBe("failed");
      expect(be.statusLabel).toBe("Failed");
      expect(be.error).toBe("Exit code 1");
    });
  });

  describe("agent activity summaries", () => {
    it("includes agent details in view model", () => {
      const state = makeProvisionedProject({
        status: "running",
        startedAt: NOW,
        agents: [
          {
            agentId: "agent-abc",
            agentType: "claude",
            status: "running",
            lastOutput: "Building component...",
            elapsed: 45000,
            tokens: 5000,
            costUsd: 0.15,
            pid: 12345,
          },
        ],
      });
      const projects = selectDashboardProjects(state);
      const agents = projects[0].buildExecution.agents;
      expect(agents).toHaveLength(1);
      expect(agents[0].agentId).toBe("agent-abc");
      expect(agents[0].agentType).toBe("claude");
      expect(agents[0].status).toBe("running");
      expect(agents[0].lastOutput).toBe("Building component...");
      expect(agents[0].elapsed).toBe(45000);
      expect(agents[0].elapsedLabel).toBe("45s");
      expect(agents[0].tokensLabel).toBe("5.0k");
      expect(agents[0].costLabel).toBe("$0.15");
      expect(agents[0].pid).toBe(12345);
    });

    it("handles empty agents array", () => {
      const state = makeProvisionedProject({
        status: "running",
        startedAt: NOW,
        agents: [],
      });
      const projects = selectDashboardProjects(state);
      expect(projects[0].buildExecution.agents).toEqual([]);
      expect(projects[0].buildExecution.agentCount).toBe(0);
    });
  });

  describe("elapsed time", () => {
    it("computes elapsed from startedAt when running", () => {
      const state = makeProvisionedProject({
        status: "running",
        startedAt: NOW,
      });
      const projects = selectDashboardProjects(state);
      // Elapsed should be > 0 since startedAt is in the past
      expect(projects[0].buildExecution.elapsed).toBeGreaterThanOrEqual(0);
    });

    it("computes elapsed from startedAt to completedAt when completed", () => {
      const startTime = "2026-03-21T12:00:00.000Z";
      const endTime = "2026-03-21T12:05:00.000Z";
      const state = makeProvisionedProject({
        status: "completed",
        startedAt: startTime,
        completedAt: endTime,
      });
      const projects = selectDashboardProjects(state);
      expect(projects[0].buildExecution.elapsed).toBe(300000); // 5 minutes
      expect(projects[0].buildExecution.elapsedLabel).toBe("5m");
    });

    it("returns null elapsed when no startedAt", () => {
      const state = makeProvisionedProject();
      const projects = selectDashboardProjects(state);
      expect(projects[0].buildExecution.elapsed).toBeNull();
      expect(projects[0].buildExecution.elapsedLabel).toBe("—");
    });
  });

  describe("provisioningComplete flag", () => {
    it("is true when provisioning status is complete", () => {
      const state = makeProvisionedProject();
      const projects = selectDashboardProjects(state);
      expect(projects[0].buildExecution.provisioningComplete).toBe(true);
    });

    it("is false when provisioning status is not complete", () => {
      const state = makeState({ provisioning: { status: "provisioning" } });
      const projects = selectDashboardProjects(state);
      expect(projects[0].buildExecution.provisioningComplete).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Selectors — floor agent location from build execution state
// ---------------------------------------------------------------------------

describe("selectors — floor agent location from build execution", () => {
  it("maps agents to department when build has running agents", () => {
    const state = makeState({
      agents: [
        { id: "test-project:agent-01", name: "Agent 01", wave: 1, status: "queued" },
      ],
      buildExecution: {
        status: "running",
        agents: [{ agentId: "build-agent-1", status: "running" }],
        startedAt: NOW,
      },
    });
    const floorAgents = selectFloorAgents(state);
    expect(floorAgents[0].location).toBe("department");
  });

  it("maps agents to break-room when build has failed agents", () => {
    const state = makeState({
      agents: [
        { id: "test-project:agent-01", name: "Agent 01", wave: 1, status: "queued" },
      ],
      buildExecution: {
        status: "failed",
        agents: [{ agentId: "build-agent-1", status: "failed" }],
        startedAt: NOW,
        error: "Exit code 1",
      },
    });
    const floorAgents = selectFloorAgents(state);
    expect(floorAgents[0].location).toBe("break-room");
  });

  it("maps agents to amenity when no build is active (default)", () => {
    const state = makeState({
      agents: [
        { id: "test-project:agent-01", name: "Agent 01", wave: 1, status: "queued" },
      ],
    });
    const floorAgents = selectFloorAgents(state);
    expect(floorAgents[0].location).toBe("amenity");
  });

  it("uses seeded agent status when no build execution agents exist", () => {
    const state = makeState({
      agents: [
        { id: "test-project:agent-01", name: "Agent 01", wave: 1, status: "running" },
      ],
    });
    const floorAgents = selectFloorAgents(state);
    expect(floorAgents[0].location).toBe("department");
  });

  it("uses seeded agent status for failed agents without build execution", () => {
    const state = makeState({
      agents: [
        { id: "test-project:agent-01", name: "Agent 01", wave: 1, status: "failed" },
      ],
    });
    const floorAgents = selectFloorAgents(state);
    expect(floorAgents[0].location).toBe("break-room");
  });

  it("includes projectBuildExecutionStatus on floor agents", () => {
    const state = makeProvisionedProject({
      status: "running",
      startedAt: NOW,
      agents: [{ agentId: "build-agent-1", status: "running" }],
    });
    const floorAgents = selectFloorAgents(state);
    expect(floorAgents[0].projectBuildExecutionStatus).toBe("running");
  });
});

// ---------------------------------------------------------------------------
// Action types and creators
// ---------------------------------------------------------------------------

describe("lumonActionTypes — build execution", () => {
  it("defines all four build execution action types", () => {
    expect(lumonActionTypes.startBuild).toBe("lumon/start-build");
    expect(lumonActionTypes.updateBuildAgent).toBe("lumon/update-build-agent");
    expect(lumonActionTypes.completeBuild).toBe("lumon/complete-build");
    expect(lumonActionTypes.failBuild).toBe("lumon/fail-build");
  });
});

describe("lumonActions — build execution creators", () => {
  it("creates startBuild action", () => {
    const action = lumonActions.startBuild("proj-1");
    expect(action.type).toBe("lumon/start-build");
    expect(action.payload.projectId).toBe("proj-1");
  });

  it("creates updateBuildAgent action", () => {
    const action = lumonActions.updateBuildAgent("proj-1", "agent-1", { status: "running" });
    expect(action.type).toBe("lumon/update-build-agent");
    expect(action.payload.projectId).toBe("proj-1");
    expect(action.payload.agentId).toBe("agent-1");
    expect(action.payload.changes.status).toBe("running");
  });

  it("creates completeBuild action", () => {
    const action = lumonActions.completeBuild("proj-1");
    expect(action.type).toBe("lumon/complete-build");
    expect(action.payload.projectId).toBe("proj-1");
  });

  it("creates failBuild action", () => {
    const action = lumonActions.failBuild("proj-1", "timeout");
    expect(action.type).toBe("lumon/fail-build");
    expect(action.payload.projectId).toBe("proj-1");
    expect(action.payload.error).toBe("timeout");
  });
});
