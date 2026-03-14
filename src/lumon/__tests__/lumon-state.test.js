import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createLumonState } from "../model";
import { createSeedLumonState } from "../seed";
import { lumonActions, lumonReducer } from "../reducer";
import {
  selectDashboardCards,
  selectFleetMetrics,
  selectFloorAgents,
  selectFloorViewModel,
  selectOrchestrationInput,
  selectSelectedAgentDetail,
  selectSelectedProjectDetail,
} from "../selectors";

function StateProbe({ state }) {
  const project = selectSelectedProjectDetail(state);
  const agent = selectSelectedAgentDetail(state);
  const cards = selectDashboardCards(state);
  const orchestration = selectOrchestrationInput(state);

  return createElement(
    "section",
    null,
    createElement("h1", null, project?.name ?? "No project"),
    createElement("p", null, cards.map((card) => `${card.label}:${card.value}`).join(" | ")),
    createElement("p", null, agent ? `${agent.name} • ${agent.status}` : "No agent selected"),
    createElement(
      "p",
      null,
      `${orchestration.projectName} • ${orchestration.progressPercent}% • ${orchestration.status}`,
    ),
  );
}

describe("Lumon state contract", () => {
  it("creates the canonical demo seed and projects dashboard cards through the jsdom harness", () => {
    const state = createSeedLumonState();
    const metrics = selectFleetMetrics(state);
    const cards = selectDashboardCards(state);
    const selectedProject = selectSelectedProjectDetail(state);

    expect(state.projects).toHaveLength(14);
    expect(state.projects[0]).toMatchObject({
      id: "wheely",
      engineChoice: "claude",
      createdAt: "2026-01-13T16:00:00.000Z",
      updatedAt: "2026-01-13T16:15:00.000Z",
    });
    expect(state.projects.every((project) => typeof project.createdAt === "string")).toBe(true);
    expect(state.projects.every((project) => typeof project.updatedAt === "string")).toBe(true);
    expect(metrics).toMatchObject({
      active: 14,
      total: 33,
      queued: 9,
      complete: 8,
      failed: 2,
      totalCostUsd: 64.75,
      totalTokens: 3980116,
      totalCostLabel: "$64.75",
      totalTokensLabel: "3980k",
    });
    expect(cards.map((card) => `${card.label}:${card.value}`)).toEqual([
      "Active:14",
      "Total:33",
      "Cost:$64.75",
      "Tokens:3980k",
    ]);
    expect(selectedProject).toMatchObject({
      id: "wheely",
      name: "Wheely",
      phaseLabel: "Phase 2 — Booking Engine",
      waveLabel: "Wave 1/2",
      agentCount: 3,
      metrics: { running: 2, queued: 1, complete: 0, failed: 0 },
    });

    render(createElement(StateProbe, { state }));

    expect(screen.getByRole("heading", { name: "Wheely" })).toBeVisible();
    expect(screen.getByText(/Active:14 \| Total:33 \| Cost:\$64.75 \| Tokens:3980k/)).toBeVisible();
    expect(screen.getByText("No agent selected")).toBeVisible();
    expect(screen.getByText("Wheely • 43% • running")).toBeVisible();
  });

  it("reconciles project, agent, and stage selection tuples during canonical state creation", () => {
    const projects = [
      {
        id: "alpha",
        name: "Alpha",
        agents: [{ id: "alpha-agent", name: "Alpha Agent" }],
        execution: {
          stages: [{ id: "alpha-stage", label: "Alpha Stage" }],
        },
      },
      {
        id: "beta",
        name: "Beta",
        engineChoice: "codex",
        agents: [{ id: "beta-agent", name: "Beta Agent", type: "codex" }],
        execution: {
          stages: [{ id: "beta-stage", label: "Beta Stage" }],
        },
      },
    ];

    const reconciledToProject = createLumonState({
      projects,
      selection: {
        projectId: "alpha",
        agentId: "beta-agent",
        stageId: "beta-stage",
      },
    });

    const recoveredFromValidTuple = createLumonState({
      projects,
      selection: {
        projectId: "missing",
        agentId: "beta-agent",
        stageId: "beta-stage",
      },
    });

    expect(reconciledToProject.selection).toEqual({
      projectId: "alpha",
      agentId: null,
      stageId: null,
    });
    expect(recoveredFromValidTuple.selection).toEqual({
      projectId: "beta",
      agentId: "beta-agent",
      stageId: "beta-stage",
    });
  });

  it("keeps selected project and agent detail synchronized through reducer transitions", () => {
    let state = createSeedLumonState();

    state = lumonReducer(state, lumonActions.selectAgent("a6"));

    expect(selectSelectedProjectDetail(state)).toMatchObject({
      id: "policy-gsd",
      name: "Policy Engine",
      waveLabel: "Wave 1/1",
      metrics: { running: 0, queued: 0, complete: 0, failed: 1 },
    });
    expect(selectSelectedAgentDetail(state)).toMatchObject({
      id: "a6",
      name: "Agent-06",
      projectId: "policy-gsd",
      projectName: "Policy Engine",
      status: "failed",
      modelLabel: "Codex CLI",
      costLabel: "$0.21",
    });

    state = lumonReducer(state, lumonActions.selectProject("tattoo-bot"));

    expect(selectSelectedProjectDetail(state)).toMatchObject({
      id: "tattoo-bot",
      name: "Tattoo Bot",
      metrics: { running: 1, queued: 0, complete: 1, failed: 0 },
    });
    expect(selectSelectedAgentDetail(state)).toBeNull();
  });

  it("keeps project CRUD transitions canonical and selection-safe", () => {
    let state = createLumonState({
      projects: [
        {
          id: "alpha",
          name: "Alpha",
          engineChoice: "claude",
          createdAt: "2026-02-01T00:00:00.000Z",
          updatedAt: "2026-02-01T00:00:00.000Z",
          agents: [{ id: "alpha-agent", name: "Alpha Agent" }],
          execution: {
            stages: [{ id: "alpha-stage", label: "Alpha Stage" }],
          },
        },
      ],
      selection: {
        projectId: "alpha",
        agentId: "alpha-agent",
        stageId: "alpha-stage",
      },
    });

    state = lumonReducer(
      state,
      lumonActions.addProject(
        {
          name: "Beta Project",
          description: "Registry test project",
          engineChoice: "codex",
          agents: [{ id: "beta-agent", name: "Beta Agent", type: "codex" }],
          execution: {
            stages: [{ id: "beta-stage", label: "Beta Stage" }],
          },
        },
        { now: "2026-02-02T00:00:00.000Z" },
      ),
    );

    expect(state.projects.map((project) => project.id)).toEqual(["alpha", "beta-project"]);
    expect(state.selection).toEqual({
      projectId: "beta-project",
      agentId: null,
      stageId: null,
    });
    expect(state.projects.find((project) => project.id === "beta-project")).toMatchObject({
      engineChoice: "codex",
      createdAt: "2026-02-02T00:00:00.000Z",
      updatedAt: "2026-02-02T00:00:00.000Z",
    });

    state = lumonReducer(state, lumonActions.selectAgent("alpha-agent"));
    state = lumonReducer(state, lumonActions.selectStage("beta-stage"));

    expect(state.selection).toEqual({
      projectId: "beta-project",
      agentId: null,
      stageId: "beta-stage",
    });

    state = lumonReducer(
      state,
      lumonActions.updateProject(
        "beta-project",
        {
          name: "Beta Prime",
          engineChoice: "claude",
        },
        { now: "2026-02-03T00:00:00.000Z" },
      ),
    );

    expect(state.projects.find((project) => project.id === "beta-project")).toMatchObject({
      id: "beta-project",
      name: "Beta Prime",
      engineChoice: "claude",
      createdAt: "2026-02-02T00:00:00.000Z",
      updatedAt: "2026-02-03T00:00:00.000Z",
    });

    state = lumonReducer(state, lumonActions.removeProject("beta-project"));

    expect(state.projects.map((project) => project.id)).toEqual(["alpha"]);
    expect(state.selection).toEqual({
      projectId: "alpha",
      agentId: null,
      stageId: null,
    });
  });

  it("projects shared floor and orchestration view models from a single reducer-backed source of truth", () => {
    let state = createSeedLumonState({
      selection: {
        projectId: "policy-gsd",
        agentId: "a6",
      },
    });

    const floorBefore = selectFloorAgents(state);
    const floorViewBefore = selectFloorViewModel(state);
    const orchestrationBefore = selectOrchestrationInput(state);

    expect(floorBefore.find((agent) => agent.id === "a6")).toMatchObject({
      departmentLabel: "Policy Engine",
      location: "break-room",
      isSelected: true,
    });
    expect(floorViewBefore).toMatchObject({
      layoutSeedLabel: "severance-floor-v1",
      summary: {
        departmentCount: 14,
        runningCount: 14,
        failedCount: 2,
        awayCount: 17,
      },
      selectedProject: {
        id: "policy-gsd",
        name: "Policy Engine",
        status: "failed",
      },
      selectedAgent: {
        id: "a6",
        status: "failed",
        amenityRoomId: null,
      },
    });
    expect(orchestrationBefore).toMatchObject({
      projectId: "policy-gsd",
      projectName: "Policy Engine",
      progressPercent: 50,
      status: "failed",
      currentStage: { id: "pe-wave-1", status: "failed" },
    });
    expect(orchestrationBefore.stages.find((stage) => stage.id === "pe-wave-1")).toMatchObject({
      status: "failed",
      agents: [{ id: "a6", name: "Agent-06", status: "failed" }],
    });

    state = lumonReducer(
      state,
      lumonActions.updateAgent("a6", {
        status: "running",
        progress: 61,
        tokens: 48210,
        costUsd: 0.49,
        elapsedLabel: "14m",
      }),
    );
    state = lumonReducer(state, lumonActions.selectStage("pe-merge"));
    state = lumonReducer(
      state,
      lumonActions.updateStage("pe-merge", {
        approval: {
          id: "approval:security-review",
          label: "Security review",
          state: "waiting",
        },
      }),
    );

    const floorAfter = selectFloorAgents(state);
    const floorViewAfter = selectFloorViewModel(state);
    const orchestrationAfter = selectOrchestrationInput(state);
    const updatedAgent = selectSelectedAgentDetail(state);

    expect(floorAfter.find((agent) => agent.id === "a6")).toMatchObject({
      location: "department",
      progress: 61,
      costLabel: "$0.49",
      tokensLabel: "48.2k",
    });
    expect(updatedAgent).toMatchObject({
      id: "a6",
      status: "running",
      progress: 61,
      elapsedLabel: "14m",
    });
    expect(floorViewAfter).toMatchObject({
      summary: {
        runningCount: 15,
        failedCount: 1,
        awayCount: 17,
      },
      selectedProject: {
        id: "policy-gsd",
        status: "running",
      },
      selectedAgent: {
        id: "a6",
        status: "running",
      },
    });
    expect(orchestrationAfter.status).toBe("running");
    expect(orchestrationAfter.stages.find((stage) => stage.id === "pe-wave-1")).toMatchObject({
      status: "running",
      progress: 61,
    });
    expect(orchestrationAfter.selectedStage).toMatchObject({
      id: "pe-merge",
      approval: {
        id: "approval:security-review",
        label: "Security review",
        state: "waiting",
      },
    });
  });
});
