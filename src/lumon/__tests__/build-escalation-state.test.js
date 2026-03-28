import { describe, expect, it } from "vitest";
import {
  createProject,
  createLumonState,
  normalizeBuildExecutionState,
  normalizeEscalationState,
  normalizeAgentTelemetry,
  VALID_BUILD_EXECUTION_STATUSES,
} from "../model";
import { lumonActions, lumonActionTypes, lumonReducer } from "../reducer";
import {
  selectDashboardProjects,
  selectDashboardCards,
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

const makeMultiProjectState = (projectAOverrides = {}, projectBOverrides = {}) =>
  createLumonState(
    {
      projects: [
        makeMinimalProject(projectAOverrides),
        {
          id: "project-b",
          name: "Project B",
          agents: [{ id: "project-b:agent-01", name: "B Agent 01", wave: 1, status: "queued" }],
          ...projectBOverrides,
        },
      ],
      selection: { projectId: "test-project" },
    },
    { now: NOW },
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

const makeRunningBuildState = () =>
  makeProvisionedProject({
    status: "running",
    agents: [{ agentId: "agent-abc", agentType: "claude", status: "running", pid: 100 }],
    startedAt: NOW,
  });

// ---------------------------------------------------------------------------
// normalizeEscalationState
// ---------------------------------------------------------------------------

describe("normalizeEscalationState", () => {
  it("returns default shape for null", () => {
    expect(normalizeEscalationState(null)).toEqual({
      status: "none",
      reason: null,
      acknowledgedAt: null,
      decision: null,
    });
  });

  it("returns default shape for undefined", () => {
    expect(normalizeEscalationState(undefined)).toEqual({
      status: "none",
      reason: null,
      acknowledgedAt: null,
      decision: null,
    });
  });

  it("normalizes valid raised escalation", () => {
    const result = normalizeEscalationState({
      status: "raised",
      reason: "Exit code 1 after retry",
      acknowledgedAt: null,
      decision: null,
    });
    expect(result.status).toBe("raised");
    expect(result.reason).toBe("Exit code 1 after retry");
  });

  it("normalizes valid acknowledged escalation", () => {
    const result = normalizeEscalationState({
      status: "acknowledged",
      reason: "Timeout",
      acknowledgedAt: NOW,
      decision: "retry",
    });
    expect(result.status).toBe("acknowledged");
    expect(result.decision).toBe("retry");
    expect(result.acknowledgedAt).toBe(NOW);
  });

  it("coerces invalid status to none", () => {
    expect(normalizeEscalationState({ status: "bogus" }).status).toBe("none");
  });

  it("coerces non-string reason to null", () => {
    expect(normalizeEscalationState({ reason: 42 }).reason).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeAgentTelemetry
// ---------------------------------------------------------------------------

describe("normalizeAgentTelemetry", () => {
  it("returns default shape for null", () => {
    const result = normalizeAgentTelemetry(null);
    expect(result).toEqual({
      tokens: { input: 0, output: 0 },
      costUsd: 0,
      progress: 0,
      lastOutputSummary: "",
    });
  });

  it("normalizes valid telemetry", () => {
    const result = normalizeAgentTelemetry({
      tokens: { input: 5000, output: 2000 },
      costUsd: 0.35,
      progress: 60,
      lastOutputSummary: "Building components...",
    });
    expect(result.tokens.input).toBe(5000);
    expect(result.tokens.output).toBe(2000);
    expect(result.costUsd).toBe(0.35);
    expect(result.progress).toBe(60);
    expect(result.lastOutputSummary).toBe("Building components...");
  });

  it("coerces non-numeric values to 0", () => {
    const result = normalizeAgentTelemetry({
      tokens: { input: "bad", output: null },
      costUsd: "invalid",
      progress: undefined,
    });
    expect(result.tokens.input).toBe(0);
    expect(result.tokens.output).toBe(0);
    expect(result.costUsd).toBe(0);
    expect(result.progress).toBe(0);
  });

  it("handles missing tokens object", () => {
    const result = normalizeAgentTelemetry({ costUsd: 0.5 });
    expect(result.tokens).toEqual({ input: 0, output: 0 });
  });
});

// ---------------------------------------------------------------------------
// normalizeBuildExecutionState — escalation and telemetry fields
// ---------------------------------------------------------------------------

describe("normalizeBuildExecutionState — escalation/telemetry extensions", () => {
  it("includes retryCount and escalation in default shape", () => {
    const result = normalizeBuildExecutionState(null);
    expect(result.retryCount).toBe(0);
    expect(result.escalation).toEqual({
      status: "none",
      reason: null,
      acknowledgedAt: null,
      decision: null,
    });
  });

  it("preserves retryCount from input", () => {
    const result = normalizeBuildExecutionState({ retryCount: 2 });
    expect(result.retryCount).toBe(2);
  });

  it("normalizes escalation from input", () => {
    const result = normalizeBuildExecutionState({
      escalation: { status: "raised", reason: "Agent timeout" },
    });
    expect(result.escalation.status).toBe("raised");
    expect(result.escalation.reason).toBe("Agent timeout");
  });

  it("normalizes agent telemetry in agents array", () => {
    const result = normalizeBuildExecutionState({
      agents: [
        {
          agentId: "a1",
          status: "running",
          telemetry: { tokens: { input: 1000, output: 500 }, costUsd: 0.1, progress: 25, lastOutputSummary: "Working..." },
        },
      ],
    });
    const agent = result.agents[0];
    expect(agent.telemetry).toBeDefined();
    expect(agent.telemetry.tokens.input).toBe(1000);
    expect(agent.telemetry.tokens.output).toBe(500);
    expect(agent.telemetry.costUsd).toBe(0.1);
    expect(agent.telemetry.lastOutputSummary).toBe("Working...");
  });

  it("initializes default telemetry for agents without telemetry", () => {
    const result = normalizeBuildExecutionState({
      agents: [{ agentId: "a1", status: "running" }],
    });
    expect(result.agents[0].telemetry).toEqual({
      tokens: { input: 0, output: 0 },
      costUsd: 0,
      progress: 0,
      lastOutputSummary: "",
    });
  });

  it("accepts escalated as a valid status", () => {
    expect(VALID_BUILD_EXECUTION_STATUSES.has("escalated")).toBe(true);
    const result = normalizeBuildExecutionState({ status: "escalated" });
    expect(result.status).toBe("escalated");
  });
});

// ---------------------------------------------------------------------------
// Reducer — retry action
// ---------------------------------------------------------------------------

describe("lumonReducer — lumon/retry-build-agent", () => {
  it("increments retryCount and resets escalation", () => {
    const state = makeProvisionedProject({
      status: "escalated",
      agents: [{ agentId: "agent-abc", status: "failed" }],
      startedAt: NOW,
      retryCount: 0,
      escalation: { status: "raised", reason: "Exit code 1", acknowledgedAt: null, decision: null },
    });
    const next = lumonReducer(state, lumonActions.retryBuildAgent("test-project", "agent-abc"));
    const be = next.projects[0].buildExecution;
    expect(be.retryCount).toBe(1);
    expect(be.status).toBe("running");
    expect(be.escalation.status).toBe("none");
    expect(be.error).toBeNull();
  });

  it("sets retrying agent status to running", () => {
    const state = makeProvisionedProject({
      status: "failed",
      agents: [{ agentId: "agent-abc", status: "failed", error: "Exit code 1" }],
      startedAt: NOW,
    });
    const next = lumonReducer(state, lumonActions.retryBuildAgent("test-project", "agent-abc"));
    const agent = next.projects[0].buildExecution.agents[0];
    expect(agent.status).toBe("running");
    expect(agent.error).toBeNull();
  });

  it("ignores unknown projectId", () => {
    const state = makeRunningBuildState();
    const next = lumonReducer(state, lumonActions.retryBuildAgent("nonexistent", "agent-abc"));
    expect(next).toBe(state);
  });

  it("ignores missing projectId", () => {
    const state = makeRunningBuildState();
    const next = lumonReducer(state, { type: lumonActionTypes.retryBuildAgent, payload: {} });
    expect(next).toBe(state);
  });

  it("stacks retryCount on successive retries", () => {
    const state = makeProvisionedProject({
      status: "failed",
      agents: [{ agentId: "agent-abc", status: "failed" }],
      startedAt: NOW,
      retryCount: 1,
    });
    const next = lumonReducer(state, lumonActions.retryBuildAgent("test-project", "agent-abc"));
    expect(next.projects[0].buildExecution.retryCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Reducer — escalate action
// ---------------------------------------------------------------------------

describe("lumonReducer — lumon/escalate-build", () => {
  it("sets status to escalated and populates escalation", () => {
    const state = makeRunningBuildState();
    const next = lumonReducer(state, lumonActions.escalateBuild("test-project", "Exit code 1 after retry"));
    const be = next.projects[0].buildExecution;
    expect(be.status).toBe("escalated");
    expect(be.escalation.status).toBe("raised");
    expect(be.escalation.reason).toBe("Exit code 1 after retry");
    expect(be.escalation.acknowledgedAt).toBeNull();
    expect(be.escalation.decision).toBeNull();
  });

  it("uses default reason when none provided", () => {
    const state = makeRunningBuildState();
    const next = lumonReducer(state, lumonActions.escalateBuild("test-project"));
    expect(next.projects[0].buildExecution.escalation.reason).toBe("Unknown escalation");
  });

  it("ignores unknown projectId", () => {
    const state = makeRunningBuildState();
    const next = lumonReducer(state, lumonActions.escalateBuild("nonexistent", "reason"));
    expect(next).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// Reducer — acknowledge escalation action
// ---------------------------------------------------------------------------

describe("lumonReducer — lumon/acknowledge-escalation", () => {
  it("acknowledges with retry decision", () => {
    const state = makeProvisionedProject({
      status: "escalated",
      agents: [{ agentId: "agent-abc", status: "failed" }],
      startedAt: NOW,
      escalation: { status: "raised", reason: "Failure", acknowledgedAt: null, decision: null },
    });
    const next = lumonReducer(state, lumonActions.acknowledgeEscalation("test-project", "retry"));
    const be = next.projects[0].buildExecution;
    expect(be.escalation.status).toBe("acknowledged");
    expect(be.escalation.decision).toBe("retry");
    expect(be.escalation.acknowledgedAt).toBeTruthy();
    // Status remains escalated — the retry action will set it to running
    expect(be.status).toBe("escalated");
  });

  it("acknowledges with abort decision and sets status to failed", () => {
    const state = makeProvisionedProject({
      status: "escalated",
      agents: [{ agentId: "agent-abc", status: "failed" }],
      startedAt: NOW,
      escalation: { status: "raised", reason: "Timeout", acknowledgedAt: null, decision: null },
    });
    const next = lumonReducer(state, lumonActions.acknowledgeEscalation("test-project", "abort"));
    const be = next.projects[0].buildExecution;
    expect(be.escalation.status).toBe("acknowledged");
    expect(be.escalation.decision).toBe("abort");
    expect(be.status).toBe("failed");
  });

  it("preserves original escalation reason through acknowledge", () => {
    const state = makeProvisionedProject({
      status: "escalated",
      agents: [{ agentId: "agent-abc", status: "failed" }],
      startedAt: NOW,
      escalation: { status: "raised", reason: "Agent timeout at 300s", acknowledgedAt: null, decision: null },
    });
    const next = lumonReducer(state, lumonActions.acknowledgeEscalation("test-project", "retry"));
    expect(next.projects[0].buildExecution.escalation.reason).toBe("Agent timeout at 300s");
  });

  it("ignores missing decision", () => {
    const state = makeProvisionedProject({
      status: "escalated",
      startedAt: NOW,
      escalation: { status: "raised", reason: "x" },
    });
    const next = lumonReducer(state, { type: lumonActionTypes.acknowledgeEscalation, payload: { projectId: "test-project" } });
    expect(next).toBe(state);
  });

  it("ignores unknown projectId", () => {
    const state = makeRunningBuildState();
    const next = lumonReducer(state, lumonActions.acknowledgeEscalation("nonexistent", "retry"));
    expect(next).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// Reducer — update build telemetry action
// ---------------------------------------------------------------------------

describe("lumonReducer — lumon/update-build-telemetry", () => {
  it("updates agent telemetry fields", () => {
    const state = makeProvisionedProject({
      status: "running",
      agents: [{ agentId: "agent-abc", agentType: "claude", status: "running" }],
      startedAt: NOW,
    });
    const next = lumonReducer(
      state,
      lumonActions.updateBuildTelemetry("test-project", "agent-abc", {
        tokens: { input: 3000, output: 1500 },
        costUsd: 0.22,
        progress: 40,
        lastOutputSummary: "Refactoring module...",
      }),
    );
    const agent = next.projects[0].buildExecution.agents[0];
    expect(agent.telemetry.tokens.input).toBe(3000);
    expect(agent.telemetry.tokens.output).toBe(1500);
    expect(agent.telemetry.costUsd).toBe(0.22);
    expect(agent.telemetry.progress).toBe(40);
    expect(agent.telemetry.lastOutputSummary).toBe("Refactoring module...");
  });

  it("merges partial telemetry into existing", () => {
    const state = makeProvisionedProject({
      status: "running",
      agents: [
        {
          agentId: "agent-abc",
          status: "running",
          telemetry: { tokens: { input: 1000, output: 500 }, costUsd: 0.1, progress: 20, lastOutputSummary: "Starting..." },
        },
      ],
      startedAt: NOW,
    });
    const next = lumonReducer(
      state,
      lumonActions.updateBuildTelemetry("test-project", "agent-abc", {
        costUsd: 0.25,
        progress: 50,
      }),
    );
    const telemetry = next.projects[0].buildExecution.agents[0].telemetry;
    expect(telemetry.costUsd).toBe(0.25);
    expect(telemetry.progress).toBe(50);
    // Existing fields preserved via merge
    expect(telemetry.tokens).toBeDefined();
  });

  it("ignores unknown agentId", () => {
    const state = makeProvisionedProject({
      status: "running",
      agents: [{ agentId: "agent-abc", status: "running" }],
      startedAt: NOW,
    });
    const next = lumonReducer(
      state,
      lumonActions.updateBuildTelemetry("test-project", "nonexistent", { progress: 50 }),
    );
    expect(next).toBe(state);
  });

  it("ignores missing telemetry payload", () => {
    const state = makeRunningBuildState();
    const next = lumonReducer(state, {
      type: lumonActionTypes.updateBuildTelemetry,
      payload: { projectId: "test-project", agentId: "agent-abc" },
    });
    expect(next).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// Action types and creators — new escalation types
// ---------------------------------------------------------------------------

describe("lumonActionTypes — escalation actions", () => {
  it("defines all four new escalation action types", () => {
    expect(lumonActionTypes.retryBuildAgent).toBe("lumon/retry-build-agent");
    expect(lumonActionTypes.escalateBuild).toBe("lumon/escalate-build");
    expect(lumonActionTypes.acknowledgeEscalation).toBe("lumon/acknowledge-escalation");
    expect(lumonActionTypes.updateBuildTelemetry).toBe("lumon/update-build-telemetry");
  });
});

describe("lumonActions — escalation creators", () => {
  it("creates retryBuildAgent action", () => {
    const action = lumonActions.retryBuildAgent("proj-1", "agent-1");
    expect(action.type).toBe("lumon/retry-build-agent");
    expect(action.payload.projectId).toBe("proj-1");
    expect(action.payload.agentId).toBe("agent-1");
  });

  it("creates escalateBuild action", () => {
    const action = lumonActions.escalateBuild("proj-1", "Exit code 1 after retry");
    expect(action.type).toBe("lumon/escalate-build");
    expect(action.payload.projectId).toBe("proj-1");
    expect(action.payload.reason).toBe("Exit code 1 after retry");
  });

  it("creates acknowledgeEscalation action", () => {
    const action = lumonActions.acknowledgeEscalation("proj-1", "abort");
    expect(action.type).toBe("lumon/acknowledge-escalation");
    expect(action.payload.projectId).toBe("proj-1");
    expect(action.payload.decision).toBe("abort");
  });

  it("creates updateBuildTelemetry action", () => {
    const action = lumonActions.updateBuildTelemetry("proj-1", "agent-1", { progress: 50 });
    expect(action.type).toBe("lumon/update-build-telemetry");
    expect(action.payload.projectId).toBe("proj-1");
    expect(action.payload.agentId).toBe("agent-1");
    expect(action.payload.telemetry.progress).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Selectors — escalation indicators on buildExecution view model
// ---------------------------------------------------------------------------

describe("selectors — buildExecution escalation indicators", () => {
  it("includes isEscalated=true when escalation is raised", () => {
    const state = makeProvisionedProject({
      status: "escalated",
      startedAt: NOW,
      escalation: { status: "raised", reason: "Agent failed twice" },
    });
    const projects = selectDashboardProjects(state);
    const be = projects[0].buildExecution;
    expect(be.isEscalated).toBe(true);
    expect(be.escalationReason).toBe("Agent failed twice");
    expect(be.canRetry).toBe(true);
    expect(be.canAbort).toBe(true);
  });

  it("includes isEscalated=false when escalation is none", () => {
    const state = makeProvisionedProject({ status: "running", startedAt: NOW });
    const projects = selectDashboardProjects(state);
    const be = projects[0].buildExecution;
    expect(be.isEscalated).toBe(false);
    expect(be.canRetry).toBe(false);
    expect(be.canAbort).toBe(false);
  });

  it("shows acknowledged escalation state", () => {
    const state = makeProvisionedProject({
      status: "escalated",
      startedAt: NOW,
      escalation: { status: "acknowledged", reason: "Timeout", acknowledgedAt: NOW, decision: "retry" },
    });
    const projects = selectDashboardProjects(state);
    const be = projects[0].buildExecution;
    expect(be.isEscalationAcknowledged).toBe(true);
    expect(be.escalation.decision).toBe("retry");
  });

  it("includes retryCount in view model", () => {
    const state = makeProvisionedProject({
      status: "running",
      startedAt: NOW,
      retryCount: 2,
    });
    const projects = selectDashboardProjects(state);
    expect(projects[0].buildExecution.retryCount).toBe(2);
  });

  it("shows escalated status label and tone", () => {
    const state = makeProvisionedProject({
      status: "escalated",
      startedAt: NOW,
      escalation: { status: "raised", reason: "x" },
    });
    const projects = selectDashboardProjects(state);
    const be = projects[0].buildExecution;
    expect(be.statusLabel).toBe("Escalated");
    expect(be.statusTone).toBe("escalated");
  });
});

// ---------------------------------------------------------------------------
// Selectors — telemetry in agent view model
// ---------------------------------------------------------------------------

describe("selectors — agent telemetry in view model", () => {
  it("surfaces telemetry when available", () => {
    const state = makeProvisionedProject({
      status: "running",
      startedAt: NOW,
      agents: [
        {
          agentId: "agent-abc",
          agentType: "claude",
          status: "running",
          telemetry: {
            tokens: { input: 5000, output: 2000 },
            costUsd: 0.35,
            progress: 60,
            lastOutputSummary: "Building...",
          },
        },
      ],
    });
    const projects = selectDashboardProjects(state);
    const agent = projects[0].buildExecution.agents[0];
    expect(agent.telemetry).toBeDefined();
    expect(agent.telemetry.tokens.input).toBe(5000);
    expect(agent.telemetry.tokens.output).toBe(2000);
    expect(agent.telemetry.costUsd).toBe(0.35);
    expect(agent.telemetry.progress).toBe(60);
    expect(agent.telemetry.lastOutputSummary).toBe("Building...");
    expect(agent.telemetry.tokensLabel).toBe("7k");
    expect(agent.telemetry.costLabel).toBe("$0.35");
  });

  it("returns null telemetry when not provided", () => {
    const state = makeProvisionedProject({
      status: "running",
      startedAt: NOW,
      agents: [{ agentId: "agent-abc", agentType: "claude", status: "running" }],
    });
    const projects = selectDashboardProjects(state);
    const agent = projects[0].buildExecution.agents[0];
    // Telemetry gets normalized with defaults by normalizeBuildExecutionState
    expect(agent.telemetry).toBeDefined();
    expect(agent.telemetry.tokens).toEqual({ input: 0, output: 0 });
  });
});

// ---------------------------------------------------------------------------
// Selectors — dashboard escalation badge
// ---------------------------------------------------------------------------

describe("selectors — dashboard escalation badge", () => {
  it("adds escalation card when projects are escalated", () => {
    const state = makeMultiProjectState(
      {
        provisioning: { status: "complete" },
        buildExecution: {
          status: "escalated",
          startedAt: NOW,
          escalation: { status: "raised", reason: "Failed" },
        },
      },
      {
        provisioning: { status: "complete" },
        buildExecution: { status: "running", startedAt: NOW },
      },
    );
    const cards = selectDashboardCards(state);
    const escalationCard = cards.find((c) => c.id === "escalations");
    expect(escalationCard).toBeDefined();
    expect(escalationCard.value).toBe("1");
    expect(escalationCard.tone).toBe("escalated");
  });

  it("does not add escalation card when no escalations", () => {
    const state = makeState();
    const cards = selectDashboardCards(state);
    const escalationCard = cards.find((c) => c.id === "escalations");
    expect(escalationCard).toBeUndefined();
  });

  it("counts multiple escalated projects", () => {
    const state = makeMultiProjectState(
      {
        provisioning: { status: "complete" },
        buildExecution: {
          status: "escalated",
          startedAt: NOW,
          escalation: { status: "raised", reason: "Fail A" },
        },
      },
      {
        provisioning: { status: "complete" },
        buildExecution: {
          status: "escalated",
          startedAt: NOW,
          escalation: { status: "raised", reason: "Fail B" },
        },
      },
    );
    const cards = selectDashboardCards(state);
    const escalationCard = cards.find((c) => c.id === "escalations");
    expect(escalationCard).toBeDefined();
    expect(escalationCard.value).toBe("2");
  });
});

// ---------------------------------------------------------------------------
// Selectors — floor agent location for retrying/escalated
// ---------------------------------------------------------------------------

describe("selectors — floor agent location for retrying/escalated agents", () => {
  it("maps agents to break-room when build is escalated", () => {
    const state = makeState({
      agents: [{ id: "test-project:agent-01", name: "Agent 01", wave: 1, status: "queued" }],
      buildExecution: {
        status: "escalated",
        agents: [{ agentId: "build-agent-1", status: "failed" }],
        startedAt: NOW,
        escalation: { status: "raised", reason: "Exit code 1 after retry" },
      },
    });
    const floorAgents = selectFloorAgents(state);
    expect(floorAgents[0].location).toBe("break-room");
    expect(floorAgents[0].isBuildEscalated).toBe(true);
  });

  it("maps retrying agents to department with isRetrying flag", () => {
    const state = makeState({
      agents: [{ id: "test-project:agent-01", name: "Agent 01", wave: 1, status: "queued" }],
      buildExecution: {
        status: "running",
        agents: [{ agentId: "build-agent-1", status: "running" }],
        startedAt: NOW,
        retryCount: 1,
      },
    });
    const floorAgents = selectFloorAgents(state);
    expect(floorAgents[0].location).toBe("department");
    expect(floorAgents[0].isRetrying).toBe(true);
    expect(floorAgents[0].buildRetryCount).toBe(1);
  });

  it("does not flag isRetrying when retryCount is 0", () => {
    const state = makeState({
      agents: [{ id: "test-project:agent-01", name: "Agent 01", wave: 1, status: "queued" }],
      buildExecution: {
        status: "running",
        agents: [{ agentId: "build-agent-1", status: "running" }],
        startedAt: NOW,
        retryCount: 0,
      },
    });
    const floorAgents = selectFloorAgents(state);
    expect(floorAgents[0].isRetrying).toBe(false);
  });

  it("escalated overrides running agents — sends to break-room", () => {
    const state = makeState({
      agents: [{ id: "test-project:agent-01", name: "Agent 01", wave: 1, status: "running" }],
      buildExecution: {
        status: "escalated",
        agents: [{ agentId: "build-agent-1", status: "running" }],
        startedAt: NOW,
        escalation: { status: "raised", reason: "x" },
      },
    });
    const floorAgents = selectFloorAgents(state);
    expect(floorAgents[0].location).toBe("break-room");
  });
});

// ---------------------------------------------------------------------------
// Full lifecycle: start → retry → escalate → acknowledge
// ---------------------------------------------------------------------------

describe("full lifecycle: start → fail → retry → fail → escalate → acknowledge", () => {
  it("walks through the complete escalation lifecycle", () => {
    const initial = makeProvisionedProject();

    // 1. Start build
    const s1 = lumonReducer(initial, lumonActions.startBuild("test-project"));
    expect(s1.projects[0].buildExecution.status).toBe("running");

    // 2. Agent spawned
    const s2 = lumonReducer(
      s1,
      lumonActions.updateBuildAgent("test-project", "agent-abc", {
        agentType: "claude",
        status: "running",
        pid: 100,
      }),
    );

    // 3. Agent fails → retry
    const s3 = lumonReducer(s2, lumonActions.retryBuildAgent("test-project", "agent-abc"));
    expect(s3.projects[0].buildExecution.retryCount).toBe(1);
    expect(s3.projects[0].buildExecution.status).toBe("running");
    expect(s3.projects[0].buildExecution.escalation.status).toBe("none");

    // 4. Agent fails again → escalate
    const s4 = lumonReducer(s3, lumonActions.escalateBuild("test-project", "Exit code 1 after retry"));
    expect(s4.projects[0].buildExecution.status).toBe("escalated");
    expect(s4.projects[0].buildExecution.escalation.status).toBe("raised");
    expect(s4.projects[0].buildExecution.escalation.reason).toBe("Exit code 1 after retry");

    // 5. Operator acknowledges with retry
    const s5 = lumonReducer(s4, lumonActions.acknowledgeEscalation("test-project", "retry"));
    expect(s5.projects[0].buildExecution.escalation.status).toBe("acknowledged");
    expect(s5.projects[0].buildExecution.escalation.decision).toBe("retry");
  });

  it("walks through escalation to abort", () => {
    const state = makeProvisionedProject({
      status: "escalated",
      agents: [{ agentId: "agent-abc", status: "failed" }],
      startedAt: NOW,
      retryCount: 1,
      escalation: { status: "raised", reason: "Agent timeout" },
    });

    const next = lumonReducer(state, lumonActions.acknowledgeEscalation("test-project", "abort"));
    expect(next.projects[0].buildExecution.status).toBe("failed");
    expect(next.projects[0].buildExecution.escalation.status).toBe("acknowledged");
    expect(next.projects[0].buildExecution.escalation.decision).toBe("abort");
  });
});
