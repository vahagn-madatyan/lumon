import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  LUMON_DOSSIER_SECTION_DEFINITIONS,
  LUMON_HANDOFF_PACKET_SECTION_DEFINITIONS,
  buildLumonDossierStageSectionId,
  createCanonicalPrebuildStages,
  createLumonState,
  createProjectSpawnInput,
} from "../model";
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

const createApprovalContractProject = (stageOverrides = {}) => {
  const agents = [
    {
      id: "alpha-agent",
      name: "Alpha Agent",
      wave: 1,
      status: "complete",
      progress: 100,
      elapsedLabel: "12m",
    },
  ];

  return {
    id: "alpha",
    name: "Alpha",
    phaseLabel: "Phase 1 - Operator Intake",
    description: "Thin dossier contract project",
    agents,
    waves: { current: 1, total: 1 },
    execution: {
      stages: createCanonicalPrebuildStages({
        projectId: "alpha",
        projectName: "Alpha",
        agents,
        waveCount: 1,
        stageOverrides: {
          intake: {
            status: "complete",
            output: "Intake packet captured",
            approval: { state: "approved" },
          },
          research: {
            status: "complete",
            output: "Research complete",
          },
          plan: {
            status: "complete",
            output: "Plan locked",
            approval: { state: "approved" },
          },
          "wave-1": {
            status: "complete",
            output: "Wave 1 complete",
            agentIds: ["alpha-agent"],
          },
          verification: {
            status: "complete",
            output: "Checks green",
            approval: { state: "pending", note: "Awaiting verification sign-off" },
          },
          handoff: {
            status: "queued",
            output: "Pending handoff",
          },
          ...stageOverrides,
        },
      }),
    },
  };
};

describe("Lumon state contract", () => {
  it("creates the canonical demo seed and exposes approval-aware execution state through selectors", () => {
    const state = createSeedLumonState();
    const metrics = selectFleetMetrics(state);
    const cards = selectDashboardCards(state);
    const selectedProject = selectSelectedProjectDetail(state);
    const selectedExecution = state.projects[0].execution;
    const selectedStageIds = state.projects[0].execution.stages.map((stage) => stage.id);

    expect(state.projects).toHaveLength(14);
    expect(state.projects[0]).toMatchObject({
      id: "wheely",
      engineChoice: "claude",
      createdAt: "2026-01-13T16:00:00.000Z",
      updatedAt: "2026-01-13T16:15:00.000Z",
    });
    expect(selectedStageIds).toEqual([
      "wheely:intake",
      "wheely:research",
      "wheely:plan",
      "wheely:wave-1",
      "wheely:wave-2",
      "wheely:verification",
      "wheely:handoff",
    ]);
    expect(selectedExecution).toMatchObject({
      currentStageId: "wheely:wave-1",
      currentGateId: "gate:wave-auto-advance",
      currentApprovalState: "not_required",
      pipelineStatus: "running",
      progressPercent: 43,
    });
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
      executionStatus: "running",
    });

    render(createElement(StateProbe, { state }));

    expect(screen.getByRole("heading", { name: "Wheely" })).toBeVisible();
    expect(screen.getByText(/Active:14 \| Total:33 \| Cost:\$64.75 \| Tokens:3980k/)).toBeVisible();
    expect(screen.getByText("No agent selected")).toBeVisible();
    expect(screen.getByText("Wheely • 43% • running")).toBeVisible();
  });

  it("canonicalizes legacy stage ids while reconciling project, agent, and stage selection tuples", () => {
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
      stageId: "beta:beta-stage",
    });
    expect(recoveredFromValidTuple.projects[1].execution.stages[0]).toMatchObject({
      id: "beta:beta-stage",
      meta: {
        aliasIds: ["beta-stage"],
      },
    });
  });

  it("spawns new projects from the same canonical intake-to-handoff taxonomy as seeded projects", () => {
    let state = createSeedLumonState({
      projects: [createSeedLumonState().projects.find((project) => project.id === "policy-gsd")],
      selection: { projectId: "policy-gsd" },
    });

    state = lumonReducer(
      state,
      lumonActions.addProject(
        createProjectSpawnInput(
          {
            name: "Registry Orbit",
            description: "Reload-proof registry creation flow",
            engineChoice: "codex",
            agentCount: 3,
          },
          state.projects,
        ),
        { now: "2026-02-02T00:00:00.000Z" },
      ),
    );

    const seededProject = state.projects.find((project) => project.id === "policy-gsd");
    const spawnedProject = state.projects.find((project) => project.id === "registry-orbit");

    expect(spawnedProject).toMatchObject({
      engineChoice: "codex",
      createdAt: "2026-02-02T00:00:00.000Z",
      updatedAt: "2026-02-02T00:00:00.000Z",
      execution: {
        currentStageId: "registry-orbit:intake",
        currentGateId: "gate:intake-review",
        currentApprovalState: "pending",
        pipelineStatus: "waiting",
      },
    });
    expect(seededProject.execution.stages.map((stage) => [stage.stageKey, stage.approval.id])).toEqual(
      spawnedProject.execution.stages.map((stage) => [stage.stageKey, stage.approval.id]),
    );
    expect(state.selection).toEqual({
      projectId: "registry-orbit",
      agentId: null,
      stageId: null,
    });
  });

  it("projects stable dossier and handoff packet sections from current selector truth", () => {
    const state = createLumonState({
      projects: [createApprovalContractProject()],
      selection: {
        projectId: "alpha",
      },
    });
    const project = selectSelectedProjectDetail(state);
    const architectureSection = project.handoffPacket.sections.find(
      (section) => section.id === LUMON_HANDOFF_PACKET_SECTION_DEFINITIONS.architecture.id,
    );
    const prototypeSection = project.handoffPacket.sections.find(
      (section) => section.id === LUMON_HANDOFF_PACKET_SECTION_DEFINITIONS.prototype.id,
    );
    const approvalSection = project.handoffPacket.sections.find(
      (section) => section.id === LUMON_HANDOFF_PACKET_SECTION_DEFINITIONS.approval.id,
    );

    expect(state.projects[0]).not.toHaveProperty("dossier");
    expect(state.projects[0]).not.toHaveProperty("handoffPacket");
    expect(project.dossier.sections.map((section) => section.id)).toEqual([
      LUMON_DOSSIER_SECTION_DEFINITIONS.brief.id,
      LUMON_DOSSIER_SECTION_DEFINITIONS.currentApproval.id,
      buildLumonDossierStageSectionId("intake"),
      buildLumonDossierStageSectionId("research"),
      buildLumonDossierStageSectionId("plan"),
      buildLumonDossierStageSectionId("wave-1"),
      buildLumonDossierStageSectionId("verification"),
      buildLumonDossierStageSectionId("handoff"),
    ]);
    expect(project.dossier.brief).toMatchObject({
      id: LUMON_DOSSIER_SECTION_DEFINITIONS.brief.id,
      state: "ready",
      summary: "Thin dossier contract project",
    });
    expect(project.currentApprovalSummary).toMatchObject({
      id: LUMON_DOSSIER_SECTION_DEFINITIONS.currentApproval.id,
      state: "waiting",
      stageId: "alpha:verification",
      stageKey: "verification",
      gateId: "gate:verification-review",
      gateLabel: "Verification approval",
      approval: {
        state: "pending",
        note: "Awaiting verification sign-off",
      },
    });
    expect(project.dossier.stageOutputs.find((section) => section.stageKey === "verification")).toMatchObject({
      id: buildLumonDossierStageSectionId("verification"),
      state: "waiting",
      output: "Checks green",
      approval: {
        state: "pending",
        note: "Awaiting verification sign-off",
      },
    });
    expect(project.handoffPacket.sections.map((section) => section.id)).toEqual([
      LUMON_HANDOFF_PACKET_SECTION_DEFINITIONS.architecture.id,
      LUMON_HANDOFF_PACKET_SECTION_DEFINITIONS.specification.id,
      LUMON_HANDOFF_PACKET_SECTION_DEFINITIONS.prototype.id,
      LUMON_HANDOFF_PACKET_SECTION_DEFINITIONS.approval.id,
    ]);
    expect(architectureSection).toMatchObject({
      state: "missing",
      content: null,
      sourceStageKeys: ["research", "plan"],
    });
    expect(architectureSection.reason).toMatch(/no architecture artifact/i);
    expect(prototypeSection).toMatchObject({
      state: "waiting",
      content: null,
    });
    expect(prototypeSection.reason).toMatch(/verification/i);
    expect(approvalSection).toMatchObject({
      state: "waiting",
      approval: {
        state: "pending",
      },
    });
    expect(project.handoffPacket).toMatchObject({
      status: "waiting",
      pipelineReady: false,
      readyForBuild: false,
    });
  });

  it("surfaces missing stage outputs and handoff packet transitions from canonical project state", () => {
    const missingOutputState = createLumonState({
      projects: [
        createApprovalContractProject({
          plan: {
            status: "complete",
            output: "",
            approval: { state: "approved" },
          },
        }),
      ],
      selection: {
        projectId: "alpha",
      },
    });
    const missingOutputProject = selectSelectedProjectDetail(missingOutputState);
    const missingPlanSection = missingOutputProject.dossier.stageOutputs.find((section) => section.stageKey === "plan");

    expect(missingPlanSection).toMatchObject({
      id: buildLumonDossierStageSectionId("plan"),
      state: "missing",
      output: null,
      outputMissing: true,
    });
    expect(missingPlanSection.reason).toMatch(/no stage output recorded/i);

    let state = createLumonState({
      projects: [createApprovalContractProject()],
      selection: {
        projectId: "alpha",
      },
    });

    state = lumonReducer(
      state,
      lumonActions.updateStage("alpha:verification", {
        approval: {
          state: "approved",
          note: "Verification approved",
        },
      }),
    );

    let project = selectSelectedProjectDetail(state);
    let approvalSection = project.handoffPacket.sections.find(
      (section) => section.id === LUMON_HANDOFF_PACKET_SECTION_DEFINITIONS.approval.id,
    );
    let prototypeSection = project.handoffPacket.sections.find(
      (section) => section.id === LUMON_HANDOFF_PACKET_SECTION_DEFINITIONS.prototype.id,
    );

    expect(project.pipeline.status).toBe("handoff_ready");
    expect(project.handoffPacket).toMatchObject({
      status: "missing",
      pipelineReady: true,
      readyForBuild: false,
    });
    expect(approvalSection).toMatchObject({
      state: "ready",
      approval: {
        state: "pending",
      },
    });
    expect(prototypeSection).toMatchObject({
      state: "missing",
      content: null,
    });
    expect(prototypeSection.reason).toMatch(/no prototype artifact/i);

    state = lumonReducer(
      state,
      lumonActions.updateStage("alpha:handoff", {
        approval: {
          state: "needs_iteration",
          note: "Need another operator pass",
        },
      }),
    );

    project = selectSelectedProjectDetail(state);
    approvalSection = project.handoffPacket.sections.find(
      (section) => section.id === LUMON_HANDOFF_PACKET_SECTION_DEFINITIONS.approval.id,
    );

    expect(project.handoffPacket.status).toBe("blocked");
    expect(approvalSection).toMatchObject({
      state: "blocked",
      approval: {
        state: "needs_iteration",
        note: "Need another operator pass",
      },
    });
  });

  it("keeps approval-aware progression, current gate derivation, and selection coherent through reducer transitions", () => {
    let state = createLumonState({
      projects: [createApprovalContractProject()],
      selection: {
        projectId: "alpha",
        stageId: "alpha:verification",
      },
    });

    expect(state.projects[0].execution).toMatchObject({
      currentStageId: "alpha:verification",
      currentGateId: "gate:verification-review",
      currentApprovalState: "pending",
      pipelineStatus: "waiting",
      status: "queued",
    });

    state = lumonReducer(
      state,
      lumonActions.updateStage("alpha:verification", {
        approval: {
          state: "approved",
          note: "Verification approved",
        },
      }),
    );

    expect(state.projects[0].execution).toMatchObject({
      currentStageId: "alpha:handoff",
      currentGateId: "gate:handoff-approval",
      currentApprovalState: "pending",
      pipelineStatus: "handoff_ready",
    });
    expect(state.selection.stageId).toBe("alpha:verification");

    state = lumonReducer(
      state,
      lumonActions.updateStage("alpha:handoff", {
        approval: {
          state: "rejected",
          note: "Packet incomplete",
        },
      }),
    );

    expect(state.projects[0].execution).toMatchObject({
      currentStageId: "alpha:handoff",
      currentGateId: "gate:handoff-approval",
      currentApprovalState: "rejected",
      pipelineStatus: "blocked",
      status: "queued",
    });

    state = lumonReducer(
      state,
      lumonActions.updateStage("alpha:handoff", {
        approval: {
          state: "needs_iteration",
          note: "Need another operator pass",
        },
      }),
    );

    expect(state.projects[0].execution).toMatchObject({
      currentApprovalState: "needs_iteration",
      pipelineStatus: "blocked",
    });

    state = lumonReducer(
      state,
      lumonActions.updateStage("alpha:handoff", {
        status: "complete",
        output: "Handoff packet delivered",
        approval: {
          state: "approved",
          note: "Ready for build handoff",
        },
      }),
    );

    expect(state.projects[0].execution).toMatchObject({
      currentStageId: "alpha:handoff",
      currentGateId: "gate:handoff-approval",
      currentApprovalState: "approved",
      pipelineStatus: "complete",
      status: "complete",
      handoffReady: false,
      progressPercent: 100,
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
      currentStage: { id: "policy-gsd:wave-1", status: "failed" },
    });
    expect(orchestrationBefore.stages.find((stage) => stage.id === "policy-gsd:wave-1")).toMatchObject({
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
    state = lumonReducer(state, lumonActions.selectStage("policy-gsd:handoff"));
    state = lumonReducer(
      state,
      lumonActions.updateStage("policy-gsd:handoff", {
        approval: {
          id: "gate:handoff-approval",
          label: "Handoff approval",
          state: "waiting",
        },
      }),
    );

    const floorAfter = selectFloorAgents(state);
    const floorViewAfter = selectFloorViewModel(state);
    const orchestrationAfter = selectOrchestrationInput(state);
    const updatedAgent = selectSelectedAgentDetail(state);
    const updatedProject = state.projects.find((project) => project.id === "policy-gsd");

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
    expect(updatedProject.execution).toMatchObject({
      currentStageId: "policy-gsd:wave-1",
      pipelineStatus: "running",
      currentGateId: "gate:wave-auto-advance",
      currentApprovalState: "not_required",
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
    expect(orchestrationAfter.stages.find((stage) => stage.id === "policy-gsd:wave-1")).toMatchObject({
      status: "running",
      progress: 61,
    });
    expect(orchestrationAfter.selectedStage).toMatchObject({
      id: "policy-gsd:handoff",
      approval: {
        id: "gate:handoff-approval",
        label: "Handoff approval",
        state: "pending",
      },
    });
  });
});
