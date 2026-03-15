import { fireEvent, render, screen } from "@testing-library/react";
import MissionControl from "@/mission-control";
import { createCanonicalPrebuildStages, createLumonState } from "@/lumon/model";

// ── Factory helpers for proof projects ──────────────────────────

const createWaitingProject = () => {
  const agents = [
    {
      id: "waiting-agent",
      name: "Waiting Agent",
      wave: 1,
      status: "complete",
      progress: 100,
      elapsedLabel: "4m",
    },
  ];

  return {
    id: "waiting-proj",
    name: "Waiting Project",
    description: "Project waiting for operator approval at intake.",
    phaseLabel: "Phase 1 — Waiting Project",
    agents,
    waves: { current: 1, total: 1 },
    execution: {
      stages: createCanonicalPrebuildStages({
        projectId: "waiting-proj",
        projectName: "Waiting Project",
        agents,
        waveCount: 1,
        stageOverrides: {
          intake: {
            status: "queued",
            approval: { state: "pending" },
          },
        },
      }),
    },
  };
};

const createBlockedProject = () => {
  const agents = [
    {
      id: "blocked-agent",
      name: "Blocked Agent",
      wave: 1,
      status: "complete",
      progress: 100,
      elapsedLabel: "9m",
    },
  ];

  return {
    id: "blocked-proj",
    name: "Blocked Project",
    description: "Project blocked at plan gate due to rejection.",
    phaseLabel: "Phase 1 — Blocked Project",
    agents,
    waves: { current: 1, total: 1 },
    execution: {
      stages: createCanonicalPrebuildStages({
        projectId: "blocked-proj",
        projectName: "Blocked Project",
        agents,
        waveCount: 1,
        stageOverrides: {
          intake: {
            status: "complete",
            output: "Intake cleared",
            approval: { state: "approved" },
          },
          research: {
            status: "complete",
            output: "Research done",
          },
          plan: {
            status: "queued",
            approval: {
              state: "rejected",
              note: "Plan needs rework before proceeding",
            },
          },
        },
      }),
    },
  };
};

const createHandoffReadyProject = () => {
  const agents = [
    {
      id: "handoff-agent",
      name: "Handoff Agent",
      wave: 1,
      status: "complete",
      progress: 100,
      elapsedLabel: "17m",
    },
  ];

  return {
    id: "handoff-floor",
    name: "Handoff Floor",
    description: "Project that should surface handoff-ready diagnostics on the floor.",
    phaseLabel: "Phase 1 — Handoff Floor",
    agents,
    waves: { current: 1, total: 1 },
    execution: {
      stages: createCanonicalPrebuildStages({
        projectId: "handoff-floor",
        projectName: "Handoff Floor",
        agents,
        waveCount: 1,
        stageOverrides: {
          intake: {
            status: "complete",
            output: "Intake approved",
            approval: { state: "approved" },
          },
          research: {
            status: "complete",
            output: "Research complete",
          },
          plan: {
            status: "complete",
            output: "Plan approved",
            approval: { state: "approved" },
          },
          "wave-1": {
            status: "complete",
            output: "Wave complete",
            agentIds: ["handoff-agent"],
          },
          verification: {
            status: "complete",
            output: "Verification approved",
            approval: { state: "approved" },
          },
          handoff: {
            status: "queued",
            output: "Awaiting handoff approval",
            approval: {
              state: "pending",
              note: "Awaiting final handoff approval",
            },
          },
        },
      }),
    },
  };
};

const createRunningProject = () => {
  const agents = [
    {
      id: "running-agent",
      name: "Running Agent",
      wave: 1,
      status: "running",
      progress: 42,
      elapsedLabel: "3m",
    },
  ];

  return {
    id: "running-proj",
    name: "Running Project",
    description: "Project actively executing wave-1.",
    phaseLabel: "Phase 1 — Running Project",
    agents,
    waves: { current: 1, total: 1 },
    execution: {
      stages: createCanonicalPrebuildStages({
        projectId: "running-proj",
        projectName: "Running Project",
        agents,
        waveCount: 1,
        stageOverrides: {
          intake: {
            status: "complete",
            output: "Intake done",
            approval: { state: "approved" },
          },
          research: {
            status: "complete",
            output: "Research done",
          },
          plan: {
            status: "complete",
            output: "Plan approved",
            approval: { state: "approved" },
          },
          "wave-1": {
            status: "running",
            agentIds: ["running-agent"],
          },
        },
      }),
    },
  };
};

// ── Tests ───────────────────────────────────────────────────────

describe("Severed floor live-state integration", () => {
  it("shows canonical handoff-ready diagnostics in the selected project panel", () => {
    const initialState = createLumonState({
      projects: [createHandoffReadyProject()],
      selection: { projectId: "handoff-floor" },
    });

    render(<MissionControl initialState={initialState} />);

    fireEvent.click(screen.getByRole("tab", { name: /Severed Floor/i }));

    expect(screen.getByTestId("severance-floor-selected-project")).toHaveTextContent("Handoff Floor");
    expect(screen.getByTestId("severance-floor-selected-project-status")).toHaveTextContent("Handoff ready");
    expect(screen.getByTestId("severance-floor-selected-project-gate")).toHaveTextContent("Handoff approval");
  });

  it("synchronizes dashboard selection to floor diagnostics for waiting projects", () => {
    const initialState = createLumonState({
      projects: [createWaitingProject(), createRunningProject()],
      selection: { projectId: "running-proj" },
    });

    render(<MissionControl initialState={initialState} />);

    // Select the waiting project from the dashboard
    fireEvent.click(screen.getByRole("button", { name: /Select Waiting Project project/i }));

    // Switch to the floor
    fireEvent.click(screen.getByRole("tab", { name: /Severed Floor/i }));

    expect(screen.getByTestId("severance-floor-selected-project")).toHaveTextContent("Waiting Project");
    expect(screen.getByTestId("severance-floor-selected-project-status")).toHaveTextContent("waiting");
    expect(screen.getByTestId("severance-floor-selected-project-stage")).toBeInTheDocument();
    expect(screen.getByTestId("severance-floor-selected-project-approval")).toBeInTheDocument();
  });

  it("synchronizes dashboard selection to floor diagnostics for blocked projects", () => {
    const initialState = createLumonState({
      projects: [createBlockedProject()],
      selection: { projectId: "blocked-proj" },
    });

    render(<MissionControl initialState={initialState} />);

    fireEvent.click(screen.getByRole("tab", { name: /Severed Floor/i }));

    expect(screen.getByTestId("severance-floor-selected-project")).toHaveTextContent("Blocked Project");
    expect(screen.getByTestId("severance-floor-selected-project-status")).toHaveTextContent("blocked");
    expect(screen.getByTestId("severance-floor-selected-project-gate")).toHaveTextContent("Plan approval");
    expect(screen.getByTestId("severance-floor-selected-project-approval-note")).toHaveTextContent("Plan needs rework before proceeding");
  });

  it("synchronizes dashboard selection to floor diagnostics for running projects", () => {
    const initialState = createLumonState({
      projects: [createRunningProject()],
      selection: { projectId: "running-proj" },
    });

    render(<MissionControl initialState={initialState} />);

    fireEvent.click(screen.getByRole("tab", { name: /Severed Floor/i }));

    expect(screen.getByTestId("severance-floor-selected-project")).toHaveTextContent("Running Project");
    expect(screen.getByTestId("severance-floor-selected-project-status")).toHaveTextContent("running");
    expect(screen.getByTestId("severance-floor-selected-project-stage")).toBeInTheDocument();
  });

  it("surfaces summary-strip counts for waiting, blocked, and handoff-ready departments", () => {
    const initialState = createLumonState({
      projects: [
        createWaitingProject(),
        createBlockedProject(),
        createHandoffReadyProject(),
        createRunningProject(),
      ],
      selection: { projectId: "running-proj" },
    });

    render(<MissionControl initialState={initialState} />);

    fireEvent.click(screen.getByRole("tab", { name: /Severed Floor/i }));

    expect(screen.getByTestId("severance-floor-waiting-count")).toHaveTextContent("1 WAITING");
    expect(screen.getByTestId("severance-floor-blocked-count")).toHaveTextContent("1 BLOCKED");
    expect(screen.getByTestId("severance-floor-handoff-ready-count")).toHaveTextContent("1 HANDOFF");
  });

  it("keeps floor in sync when selecting different projects from the floor itself", () => {
    const initialState = createLumonState({
      projects: [createWaitingProject(), createHandoffReadyProject()],
      selection: { projectId: "waiting-proj" },
    });

    render(<MissionControl initialState={initialState} />);

    fireEvent.click(screen.getByRole("tab", { name: /Severed Floor/i }));

    // Floor initially shows the waiting project
    expect(screen.getByTestId("severance-floor-selected-project")).toHaveTextContent("Waiting Project");
    expect(screen.getByTestId("severance-floor-selected-project-status")).toHaveTextContent("waiting");

    // Select the handoff project from the floor
    fireEvent.click(screen.getByRole("button", { name: /Select Handoff Floor department/i }));

    expect(screen.getByTestId("severance-floor-selected-project")).toHaveTextContent("Handoff Floor");
    expect(screen.getByTestId("severance-floor-selected-project-status")).toHaveTextContent("Handoff ready");
    expect(screen.getByTestId("severance-floor-selected-project-gate")).toHaveTextContent("Handoff approval");

    // Switch back to dashboard — same project should be selected
    fireEvent.click(screen.getByRole("tab", { name: /Dashboard/i }));
    expect(screen.getByRole("heading", { name: /Handoff Floor/i })).toBeInTheDocument();
  });

  it("renders per-department pipeline status labels from diagnostics", () => {
    const initialState = createLumonState({
      projects: [createWaitingProject(), createBlockedProject(), createRunningProject()],
      selection: { projectId: "running-proj" },
    });

    render(<MissionControl initialState={initialState} />);

    fireEvent.click(screen.getByRole("tab", { name: /Severed Floor/i }));

    expect(screen.getByTestId("dept-pipeline-status-waiting-proj")).toHaveTextContent("Waiting");
    expect(screen.getByTestId("dept-pipeline-status-blocked-proj")).toHaveTextContent("Blocked");
    expect(screen.getByTestId("dept-pipeline-status-running-proj")).toHaveTextContent("Running");
  });
});
