import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import MissionControl from "@/mission-control";
import { createLumonState } from "@/lumon/model";
import { LUMON_REGISTRY_STORAGE_KEY, saveLumonState } from "@/lumon/persistence";

function assertSelectedProjectDetailTabs(description) {
  expect(screen.getByRole("tab", { name: /^overview$/i })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /^dossier$/i })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /^handoff$/i })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: /^dossier$/i }));

  expect(screen.getByTestId("selected-project-dossier-panel")).toBeVisible();
  expect(screen.getByTestId("selected-project-dossier-brief-summary")).toHaveTextContent(description);
  expect(screen.getByTestId("selected-project-dossier-stage-intake-summary")).toHaveTextContent(
    /awaiting operator intake approval/i,
  );
  expect(screen.getByTestId("selected-project-dossier-current-approval-summary")).toHaveTextContent(
    /awaiting operator approval/i,
  );

  fireEvent.click(screen.getByRole("tab", { name: /^handoff$/i }));

  expect(screen.getByTestId("selected-project-handoff-panel")).toBeVisible();
  expect(screen.getByTestId("selected-project-handoff-status")).toHaveTextContent("Waiting");
  expect(screen.getByTestId("selected-project-handoff-section-handoff-approval-summary")).toHaveTextContent(
    /awaiting operator approval/i,
  );
}

describe("MissionControl project registry", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates canonical projects and preserves stage-first pipeline state across reload", async () => {
    const initialState = createLumonState({ projects: [], selection: {} });
    const firstRender = render(<MissionControl initialState={initialState} />);

    expect(screen.getByTestId("dashboard-empty-registry")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-no-selected-project")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /spawn new project/i })[0]);

    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: "Registry Orbit" },
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Reload-proof registry creation flow" },
    });
    fireEvent.click(screen.getByRole("button", { name: /claude code/i }));
    fireEvent.change(screen.getByLabelText(/agents to seed/i), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create canonical project/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Registry Orbit" })).toBeInTheDocument();
    });

    expect(screen.getByTestId("selected-project-engine")).toHaveTextContent("Claude Code");
    expect(screen.getByTestId("dashboard-project-engine-registry-orbit")).toHaveTextContent("Claude Code");
    expect(screen.getAllByText(/Reload-proof registry creation flow/i)).toHaveLength(2);
    expect(screen.getByTestId("selected-project-pipeline-status")).toHaveTextContent("Waiting");
    expect(screen.getByTestId("selected-project-current-stage")).toHaveTextContent("Intake");
    expect(screen.getByTestId("selected-project-current-gate")).toHaveTextContent("Intake approval");
    expect(screen.getByTestId("selected-project-current-approval")).toHaveTextContent("Pending approval");
    expect(screen.getByTestId("dashboard-project-current-stage-registry-orbit")).toHaveTextContent("Intake");
    expect(screen.getByTestId("dashboard-project-current-gate-registry-orbit")).toHaveTextContent("Intake approval");
    expect(screen.getByTestId("dashboard-project-approval-state-registry-orbit")).toHaveTextContent("Pending approval");
    assertSelectedProjectDetailTabs("Reload-proof registry creation flow");

    await waitFor(() => {
      const envelope = JSON.parse(window.localStorage.getItem(LUMON_REGISTRY_STORAGE_KEY) ?? "null");
      expect(envelope?.state?.projects).toHaveLength(1);
      expect(envelope?.state?.projects?.[0]).toMatchObject({
        id: "registry-orbit",
        name: "Registry Orbit",
        engineChoice: "claude",
        execution: {
          currentStageId: "registry-orbit:intake",
          currentGateId: "gate:intake-review",
          currentApprovalState: "pending",
          pipelineStatus: "waiting",
        },
      });
      expect(envelope?.state?.selection).toEqual({
        projectId: "registry-orbit",
        agentId: null,
        stageId: null,
      });
    });

    firstRender.unmount();
    render(<MissionControl />);

    expect(screen.getByRole("heading", { name: "Registry Orbit" })).toBeInTheDocument();
    expect(screen.getByTestId("selected-project-engine")).toHaveTextContent("Claude Code");
    expect(screen.getByTestId("dashboard-project-engine-registry-orbit")).toHaveTextContent("Claude Code");
    expect(screen.getByTestId("selected-project-pipeline-status")).toHaveTextContent("Waiting");
    expect(screen.getByTestId("selected-project-current-stage")).toHaveTextContent("Intake");
    expect(screen.getByTestId("selected-project-current-gate")).toHaveTextContent("Intake approval");
    expect(screen.getByTestId("selected-project-current-approval")).toHaveTextContent("Pending approval");
    expect(screen.queryByTestId("dashboard-empty-registry")).not.toBeInTheDocument();
    assertSelectedProjectDetailTabs("Reload-proof registry creation flow");

    fireEvent.click(screen.getByRole("tab", { name: /orchestration/i }));

    expect(screen.getByTestId("orchestration-pipeline-status")).toHaveTextContent("Waiting");
    expect(screen.getByTestId("orchestration-current-stage-label")).toHaveTextContent("Intake");
    expect(screen.getByTestId("orchestration-current-gate-label")).toHaveTextContent("Intake approval");
    expect(screen.getByTestId("orchestration-current-approval-state")).toHaveTextContent("Pending approval");
  });

  it("renders a safe create-first shell when the persisted registry is intentionally empty", () => {
    saveLumonState(createLumonState({ projects: [], selection: {} }));

    render(<MissionControl />);

    expect(screen.getByTestId("dashboard-empty-registry")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-no-selected-project")).toBeInTheDocument();
    expect(screen.getByText(/registry empty · spawn the first project/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /orchestration/i }));

    expect(screen.getByTestId("orchestration-empty-registry")).toBeInTheDocument();
    expect(screen.getByText(/restored registry is intentionally empty/i)).toBeInTheDocument();
  });
});
