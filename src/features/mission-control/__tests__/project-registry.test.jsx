import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import MissionControl from "@/mission-control";
import { createLumonState } from "@/lumon/model";
import { LUMON_REGISTRY_STORAGE_KEY, saveLumonState } from "@/lumon/persistence";

describe("MissionControl project registry", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates canonical projects, persists engine choice, and restores selection on remount", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: /codex cli/i }));
    fireEvent.change(screen.getByLabelText(/agents to seed/i), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create canonical project/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Registry Orbit" })).toBeInTheDocument();
    });

    expect(screen.getByTestId("selected-project-engine")).toHaveTextContent("Codex CLI");
    expect(screen.getByTestId("dashboard-project-engine-registry-orbit")).toHaveTextContent("Codex CLI");
    expect(screen.getAllByText(/Reload-proof registry creation flow/i)).toHaveLength(2);

    await waitFor(() => {
      const envelope = JSON.parse(window.localStorage.getItem(LUMON_REGISTRY_STORAGE_KEY) ?? "null");
      expect(envelope?.state?.projects).toHaveLength(1);
      expect(envelope?.state?.projects?.[0]).toMatchObject({
        id: "registry-orbit",
        name: "Registry Orbit",
        engineChoice: "codex",
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
    expect(screen.getByTestId("selected-project-engine")).toHaveTextContent("Codex CLI");
    expect(screen.getByTestId("dashboard-project-engine-registry-orbit")).toHaveTextContent("Codex CLI");
    expect(screen.queryByTestId("dashboard-empty-registry")).not.toBeInTheDocument();
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
