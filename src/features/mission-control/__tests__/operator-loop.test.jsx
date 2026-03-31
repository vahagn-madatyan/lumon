import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import MissionControl from "@/mission-control";
import { createCanonicalPrebuildStages, createLumonState } from "@/lumon/model";
import { LUMON_REGISTRY_STORAGE_KEY } from "@/lumon/persistence";

// ── Factory helpers ─────────────────────────────────────────────

const createWaitingProject = (overrides = {}) => {
  const id = overrides.id ?? "waiting-proj";
  const name = overrides.name ?? "Waiting Project";
  const agents = [
    {
      id: `${id}:agent-01`,
      name: `${name} Agent 01`,
      wave: 1,
      status: "complete",
      progress: 100,
      elapsedLabel: "4m",
    },
  ];

  return {
    id,
    name,
    description: overrides.description ?? "Project waiting for operator approval at intake.",
    phaseLabel: `Phase 1 — ${name}`,
    agents,
    waves: { current: 1, total: 1 },
    execution: {
      stages: createCanonicalPrebuildStages({
        projectId: id,
        projectName: name,
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

const createHandoffReadyProject = (overrides = {}) => {
  const id = overrides.id ?? "handoff-proj";
  const name = overrides.name ?? "Handoff Project";
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
    description: overrides.description ?? "Project at handoff approval gate.",
    phaseLabel: `Phase 1 — ${name}`,
    agents,
    waves: { current: 1, total: 1 },
    execution: {
      stages: createCanonicalPrebuildStages({
        projectId: id,
        projectName: name,
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
            agentIds: [`${id}:agent-01`],
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

// ── Tests ───────────────────────────────────────────────────────

describe("Operator loop integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("full create → dashboard → dossier → handoff → orchestration → floor loop", async () => {
    const initialState = createLumonState({ projects: [], selection: {} });
    render(<MissionControl initialState={initialState} />);

    // ── Empty state ──
    expect(screen.getByTestId("dashboard-empty-registry")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-no-selected-project")).toBeInTheDocument();

    // ── Create project via modal ──
    fireEvent.click(screen.getAllByRole("button", { name: /spawn new project/i })[0]);

    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: "Orbit Alpha" },
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Full loop integration proof" },
    });
    fireEvent.click(screen.getByRole("button", { name: /claude code/i }));
    fireEvent.change(screen.getByLabelText(/agents to seed/i), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create canonical project/i }));

    // ── Dashboard surface ──
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Orbit Alpha" })).toBeInTheDocument();
    });

    expect(screen.getByTestId("selected-project-pipeline-status")).toHaveTextContent("Waiting");
    expect(screen.getByTestId("selected-project-current-stage")).toHaveTextContent("Intake");
    expect(screen.getByTestId("selected-project-current-gate")).toHaveTextContent("Intake approval");
    expect(screen.getByTestId("selected-project-current-approval")).toHaveTextContent("Pending approval");
    expect(screen.getByTestId("dashboard-project-current-stage-orbit-alpha")).toHaveTextContent("Intake");
    expect(screen.getByTestId("dashboard-project-current-gate-orbit-alpha")).toHaveTextContent("Intake approval");
    expect(screen.getByTestId("dashboard-project-approval-state-orbit-alpha")).toHaveTextContent("Pending approval");

    // ── Dossier tab ──
    fireEvent.click(screen.getByRole("tab", { name: /^dossier$/i }));

    expect(screen.getByTestId("selected-project-dossier-panel")).toBeVisible();
    expect(screen.getByTestId("selected-project-dossier-brief-summary")).toHaveTextContent(
      "Full loop integration proof",
    );
    expect(screen.getByTestId("selected-project-dossier-stage-intake-summary")).toHaveTextContent(
      /awaiting operator intake approval/i,
    );
    expect(screen.getByTestId("selected-project-dossier-current-approval-summary")).toHaveTextContent(
      /awaiting operator approval/i,
    );

    // ── Handoff tab ──
    fireEvent.click(screen.getByRole("tab", { name: /^handoff$/i }));

    expect(screen.getByTestId("selected-project-handoff-panel")).toBeVisible();
    expect(screen.getByTestId("selected-project-handoff-status")).toHaveTextContent("Waiting");
    expect(screen.getByTestId("selected-project-handoff-section-handoff-approval-summary")).toHaveTextContent(
      /awaiting operator approval/i,
    );

    // ── Orchestration tab ──
    fireEvent.click(screen.getByRole("tab", { name: /orchestration/i }));

    expect(screen.getByTestId("orchestration-pipeline-status")).toHaveTextContent("Waiting");
    expect(screen.getByTestId("orchestration-current-stage-label")).toHaveTextContent("Intake");
    expect(screen.getByTestId("orchestration-current-gate-label")).toHaveTextContent("Intake approval");
    expect(screen.getByTestId("orchestration-current-approval-state")).toHaveTextContent("Pending approval");

    // ── Severed Floor tab ──
    fireEvent.click(screen.getByRole("tab", { name: /Severed Floor/i }));

    expect(screen.getByTestId("severance-floor-selected-project")).toHaveTextContent("Orbit Alpha");
    expect(screen.getByTestId("severance-floor-selected-project-status")).toHaveTextContent("waiting");
    expect(screen.getByTestId("severance-floor-selected-project-stage")).toBeInTheDocument();
    expect(screen.getByTestId("severance-floor-selected-project-approval")).toBeInTheDocument();

    // ── Summary-strip counts reflect single waiting project ──
    expect(screen.getByTestId("severance-floor-waiting-count")).toHaveTextContent("1 WAITING");
  });

  it("cross-surface selection propagation between dashboard and floor", () => {
    const initialState = createLumonState({
      projects: [createWaitingProject(), createHandoffReadyProject()],
      selection: { projectId: "waiting-proj" },
    });

    render(<MissionControl initialState={initialState} />);

    // Dashboard shows the waiting project selected
    expect(screen.getByRole("heading", { name: "Waiting Project" })).toBeInTheDocument();
    expect(screen.getByTestId("selected-project-pipeline-status")).toHaveTextContent("Waiting");

    // ── Switch to floor → floor agrees with dashboard selection ──
    fireEvent.click(screen.getByRole("tab", { name: /Severed Floor/i }));

    expect(screen.getByTestId("severance-floor-selected-project")).toHaveTextContent("Waiting Project");
    expect(screen.getByTestId("severance-floor-selected-project-status")).toHaveTextContent("waiting");

    // ── Select different project on floor ──
    fireEvent.click(screen.getByRole("button", { name: /Select Handoff Project department/i }));

    expect(screen.getByTestId("severance-floor-selected-project")).toHaveTextContent("Handoff Project");
    expect(screen.getByTestId("severance-floor-selected-project-status")).toHaveTextContent("Handoff ready");
    expect(screen.getByTestId("severance-floor-selected-project-gate")).toHaveTextContent("Handoff approval");

    // ── Switch back to dashboard → dashboard agrees with floor selection ──
    fireEvent.click(screen.getByRole("tab", { name: /Dashboard/i }));

    expect(screen.getByRole("heading", { name: "Handoff Project" })).toBeInTheDocument();
    expect(screen.getByTestId("selected-project-pipeline-status")).toHaveTextContent("Handoff ready");
    expect(screen.getByTestId("selected-project-current-gate")).toHaveTextContent("Handoff approval");

    // ── Select back on dashboard → floor agrees ──
    fireEvent.click(screen.getByRole("button", { name: /Select Waiting Project project/i }));

    expect(screen.getByRole("heading", { name: "Waiting Project" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Severed Floor/i }));

    expect(screen.getByTestId("severance-floor-selected-project")).toHaveTextContent("Waiting Project");
    expect(screen.getByTestId("severance-floor-selected-project-status")).toHaveTextContent("waiting");

    // ── Summary-strip counts reflect both projects ──
    expect(screen.getByTestId("severance-floor-waiting-count")).toHaveTextContent("1 WAITING");
    expect(screen.getByTestId("severance-floor-handoff-ready-count")).toHaveTextContent("1 HANDOFF");
  });

  it("persistence round-trip through unmount/remount", async () => {
    // ── Create a project from empty state ──
    const initialState = createLumonState({ projects: [], selection: {} });
    const firstRender = render(<MissionControl initialState={initialState} />);

    fireEvent.click(screen.getAllByRole("button", { name: /spawn new project/i })[0]);

    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: "Persist Loop" },
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Survives unmount-remount cycle" },
    });
    fireEvent.click(screen.getByRole("button", { name: /claude code/i }));
    fireEvent.change(screen.getByLabelText(/agents to seed/i), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create canonical project/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Persist Loop" })).toBeInTheDocument();
    });

    // ── Confirm persisted to localStorage ──
    await waitFor(() => {
      const envelope = JSON.parse(window.localStorage.getItem(LUMON_REGISTRY_STORAGE_KEY) ?? "null");
      expect(envelope?.state?.projects).toHaveLength(1);
      expect(envelope?.state?.projects?.[0]).toMatchObject({
        id: "persist-loop",
        name: "Persist Loop",
      });
    });

    // ── Unmount and remount without initialState (falls through to localStorage) ──
    firstRender.unmount();
    render(<MissionControl />);

    // ── Dashboard survives ──
    expect(screen.getByRole("heading", { name: "Persist Loop" })).toBeInTheDocument();
    expect(screen.getByTestId("selected-project-pipeline-status")).toHaveTextContent("Waiting");
    expect(screen.getByTestId("selected-project-current-stage")).toHaveTextContent("Intake");
    expect(screen.getByTestId("selected-project-current-gate")).toHaveTextContent("Intake approval");
    expect(screen.getByTestId("selected-project-current-approval")).toHaveTextContent("Pending approval");
    expect(screen.queryByTestId("dashboard-empty-registry")).not.toBeInTheDocument();

    // ── Dossier survives ──
    fireEvent.click(screen.getByRole("tab", { name: /^dossier$/i }));
    expect(screen.getByTestId("selected-project-dossier-panel")).toBeVisible();
    expect(screen.getByTestId("selected-project-dossier-brief-summary")).toHaveTextContent(
      "Survives unmount-remount cycle",
    );

    // ── Floor diagnostics survive ──
    fireEvent.click(screen.getByRole("tab", { name: /Severed Floor/i }));
    expect(screen.getByTestId("severance-floor-selected-project")).toHaveTextContent("Persist Loop");
    expect(screen.getByTestId("severance-floor-selected-project-status")).toHaveTextContent("waiting");
    expect(screen.getByTestId("severance-floor-waiting-count")).toHaveTextContent("1 WAITING");
  });
});
