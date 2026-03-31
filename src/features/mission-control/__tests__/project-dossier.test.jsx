import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import MissionControl from "@/mission-control";
import { createCanonicalPrebuildStages, createLumonState } from "@/lumon/model";

const createProject = ({
  id = "brief-loop",
  name = "Brief Loop",
  description = "Canonical dossier packet proof for the selected-project pane.",
  planOutput = "Plan of record drafted",
  verificationApprovalState = "pending",
  verificationApprovalNote = "Awaiting operator sign-off",
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
    description,
    phaseLabel: "Phase 1 — Operator Intake",
    engineChoice: "claude",
    agents,
    waves: { current: 1, total: 1 },
    execution: {
      stages: createCanonicalPrebuildStages({
        projectId: id,
        projectName: name,
        engineChoice: "claude",
        agents,
        waveCount: 1,
        stageOverrides: {
          intake: {
            status: "complete",
            output: "Operator brief accepted",
            approval: { state: "approved" },
          },
          research: {
            status: "complete",
            output: "Constraint scan recorded",
          },
          plan: {
            status: "complete",
            output: planOutput,
            approval: { state: "approved" },
          },
          "wave-1": {
            status: "complete",
            output: "Prototype wave complete",
            agentIds: [`${id}:agent-01`],
          },
          verification: {
            status: "complete",
            output: "Checks green",
            approval: { state: verificationApprovalState, note: verificationApprovalNote },
          },
          handoff: {
            status: "queued",
            output: "Pending handoff",
          },
        },
      }),
    },
  };
};

describe("MissionControl project dossier", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("switches between Overview, Dossier, and Handoff while rendering selector-owned dossier and packet content", () => {
    const initialState = createLumonState({
      projects: [createProject()],
      selection: {
        projectId: "brief-loop",
      },
    });

    render(<MissionControl initialState={initialState} />);

    expect(screen.getByRole("tab", { name: /^overview$/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^dossier$/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^handoff$/i })).toBeInTheDocument();
    expect(screen.getByTestId("selected-project-overview-panel")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Brief Loop" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /^dossier$/i }));

    expect(screen.getByTestId("selected-project-dossier-panel")).toBeVisible();
    expect(screen.getByTestId("selected-project-dossier-brief-summary")).toHaveTextContent(
      "Canonical dossier packet proof for the selected-project pane.",
    );
    expect(screen.getByTestId("selected-project-dossier-current-approval-summary")).toHaveTextContent(
      /awaiting operator approval/i,
    );
    expect(screen.getByTestId("selected-project-dossier-stage-verification-summary")).toHaveTextContent(
      "Checks green",
    );
    expect(screen.getByTestId("selected-project-dossier-stage-verification-reason")).toHaveTextContent(
      /waiting on verification approval/i,
    );

    fireEvent.click(screen.getByRole("tab", { name: /^handoff$/i }));

    expect(screen.getByTestId("selected-project-handoff-panel")).toBeVisible();
    expect(screen.getByTestId("selected-project-handoff-status")).toHaveTextContent("Waiting");
    expect(screen.getByTestId("selected-project-handoff-section-handoff-architecture-summary")).toHaveTextContent(
      /no architecture artifact is stored/i,
    );
    expect(screen.getByTestId("selected-project-handoff-section-handoff-prototype-summary")).toHaveTextContent(
      /waiting on verification/i,
    );
    expect(screen.getByTestId("selected-project-handoff-section-handoff-approval-summary")).toHaveTextContent(
      /awaiting operator approval/i,
    );
  });

  it("keeps missing-output messaging honest in dossier and handoff views", () => {
    const initialState = createLumonState({
      projects: [
        createProject({
          id: "missing-loop",
          name: "Missing Loop",
          description: "Missing plan output should stay visible instead of collapsing.",
          planOutput: "",
          verificationApprovalState: "approved",
          verificationApprovalNote: "Verification approved",
        }),
      ],
      selection: {
        projectId: "missing-loop",
      },
    });

    render(<MissionControl initialState={initialState} />);

    fireEvent.click(screen.getByRole("tab", { name: /^dossier$/i }));

    expect(screen.getByTestId("selected-project-dossier-stage-plan-summary")).toHaveTextContent(
      /plan has no stage output recorded yet/i,
    );
    expect(screen.getByTestId("selected-project-dossier-stage-plan-reason")).toHaveTextContent(
      /no stage output recorded yet/i,
    );

    fireEvent.click(screen.getByRole("tab", { name: /^handoff$/i }));

    expect(screen.getByTestId("selected-project-handoff-status")).toHaveTextContent("Missing");
    expect(screen.getByTestId("selected-project-handoff-section-handoff-architecture-summary")).toHaveTextContent(
      /cannot be assembled because plan has no recorded output/i,
    );
    expect(screen.getByTestId("selected-project-handoff-section-handoff-specification-summary")).toHaveTextContent(
      /cannot be assembled because plan has no recorded output/i,
    );
  });

  it("renders the explicit no-selection fallback when the registry is empty", () => {
    const initialState = createLumonState({ projects: [], selection: {} });

    render(<MissionControl initialState={initialState} />);

    expect(screen.getByTestId("dashboard-empty-registry")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-no-selected-project")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /^overview$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/light up the overview, dossier, and handoff views/i)).toBeInTheDocument();
  });
});
