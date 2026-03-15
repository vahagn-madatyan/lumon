import { fireEvent, render, screen } from "@testing-library/react";
import MissionControl from "@/mission-control";
import { createCanonicalPrebuildStages, createLumonState } from "@/lumon/model";

const createProject = ({
  id,
  name,
  verificationApprovalState = "pending",
  verificationApprovalNote = "Awaiting operator sign-off",
  handoffStatus = "queued",
  handoffApprovalState,
  selectionStageId,
} = {}) => {
  const agents = [
    {
      id: `${id}:agent-01`,
      name: `${name} Agent 01`,
      wave: 1,
      status: "complete",
      progress: 100,
      elapsedLabel: "17m",
    },
  ];

  return {
    id,
    name,
    description: `${name} pipeline board proof for canonical gate-aware state.`,
    phaseLabel: "Phase 1 — Operator Intake",
    agents,
    waves: { current: 1, total: 1 },
    execution: {
      stages: createCanonicalPrebuildStages({
        projectId: id,
        projectName: name,
        agents,
        waveCount: 1,
        stageOverrides: {
          intake: { status: "complete", approval: { state: "approved" } },
          research: { status: "complete" },
          plan: { status: "complete", approval: { state: "approved" } },
          "wave-1": {
            status: "complete",
            output: "Wave complete",
            agentIds: [`${id}:agent-01`],
          },
          verification: {
            status: "complete",
            output: "Checks green",
            approval: { state: verificationApprovalState, note: verificationApprovalNote },
          },
          handoff: {
            status: handoffStatus,
            output: handoffStatus === "complete" ? "Handoff packet delivered" : "Pending handoff",
            approval: handoffApprovalState ? { state: handoffApprovalState } : undefined,
          },
        },
      }),
    },
    meta: {
      selectionStageId,
    },
  };
};

describe("MissionControl pipeline board", () => {
  it("surfaces waiting approval state in the dashboard and reuses the same stage/gate truth in orchestration", () => {
    const initialState = createLumonState({
      projects: [
        createProject({
          id: "approval-loop",
          name: "Approval Loop",
          verificationApprovalState: "pending",
          verificationApprovalNote: "Awaiting operator sign-off",
        }),
      ],
      selection: {
        projectId: "approval-loop",
        stageId: "approval-loop:verification",
      },
    });

    render(<MissionControl initialState={initialState} />);

    expect(screen.getByTestId("dashboard-project-pipeline-approval-loop")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-project-badge-approval-loop")).toHaveTextContent("Waiting");
    expect(screen.getByTestId("dashboard-project-current-stage-approval-loop")).toHaveTextContent("Verification");
    expect(screen.getByTestId("dashboard-project-current-gate-approval-loop")).toHaveTextContent("Verification approval");
    expect(screen.getByTestId("dashboard-project-approval-state-approval-loop")).toHaveTextContent("Pending approval");
    expect(screen.getByTestId("selected-project-pipeline-status")).toHaveTextContent("Waiting");
    expect(screen.getByTestId("selected-project-current-stage")).toHaveTextContent("Verification");
    expect(screen.getByTestId("selected-project-current-gate")).toHaveTextContent("Verification approval");
    expect(screen.getByTestId("selected-project-current-approval")).toHaveTextContent("Pending approval");

    fireEvent.click(screen.getByRole("tab", { name: /orchestration/i }));

    expect(screen.getByText(/Approval Loop — Phase 1 — Operator Intake/i)).toBeInTheDocument();
    expect(screen.getByTestId("orchestration-pipeline-status")).toHaveTextContent("Waiting");
    expect(screen.getByTestId("orchestration-current-stage-label")).toHaveTextContent("Verification");
    expect(screen.getByTestId("orchestration-current-gate-label")).toHaveTextContent("Verification approval");
    expect(screen.getByTestId("orchestration-current-approval-state")).toHaveTextContent("Pending approval");
    expect(screen.getByTestId("orchestration-selected-stage-gate")).toHaveTextContent("Verification approval");
    expect(screen.getByTestId("orchestration-current-stage-status")).toHaveTextContent("complete");
    expect(screen.getByTestId("orchestration-selected-stage-summary")).toHaveTextContent("Awaiting Operator approval");
    expect(screen.getByText(/Checks green/i)).toBeInTheDocument();
  });

  it("renders blocked and handoff-ready pipeline summaries from the shared selector contract", () => {
    const initialState = createLumonState({
      projects: [
        createProject({
          id: "iteration-loop",
          name: "Iteration Loop",
          verificationApprovalState: "approved",
          handoffApprovalState: "needs_iteration",
        }),
        createProject({
          id: "handoff-loop",
          name: "Handoff Loop",
          verificationApprovalState: "approved",
        }),
      ],
      selection: {
        projectId: "iteration-loop",
        stageId: "iteration-loop:handoff",
      },
    });

    render(<MissionControl initialState={initialState} />);

    expect(screen.getByTestId("dashboard-project-badge-iteration-loop")).toHaveTextContent("Blocked");
    expect(screen.getByTestId("dashboard-project-current-stage-iteration-loop")).toHaveTextContent("Handoff");
    expect(screen.getByTestId("dashboard-project-current-gate-iteration-loop")).toHaveTextContent("Handoff approval");
    expect(screen.getByTestId("dashboard-project-approval-state-iteration-loop")).toHaveTextContent("Needs iteration");

    expect(screen.getByTestId("dashboard-project-badge-handoff-loop")).toHaveTextContent("Handoff ready");
    expect(screen.getByTestId("dashboard-project-current-stage-handoff-loop")).toHaveTextContent("Handoff");
    expect(screen.getByTestId("dashboard-project-current-gate-handoff-loop")).toHaveTextContent("Handoff approval");
    expect(screen.getByTestId("dashboard-project-approval-state-handoff-loop")).toHaveTextContent("Pending approval");

    fireEvent.click(screen.getByRole("tab", { name: /orchestration/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /handoff loop/i })[1]);

    expect(screen.getByTestId("orchestration-pipeline-status")).toHaveTextContent("Handoff ready");
    expect(screen.getByTestId("orchestration-current-stage-label")).toHaveTextContent("Handoff");
    expect(screen.getByTestId("orchestration-current-gate-label")).toHaveTextContent("Handoff approval");
    expect(screen.getByTestId("orchestration-current-approval-state")).toHaveTextContent("Pending approval");
    expect(screen.getByTestId("orchestration-handoff-readiness")).toHaveTextContent("Ready for handoff");
  });
});
