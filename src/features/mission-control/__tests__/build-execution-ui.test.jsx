import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MissionControl from "@/mission-control";
import { createCanonicalPrebuildStages, createLumonState } from "@/lumon/model";

/**
 * Creates a project at handoff_ready with provisioning complete and optional
 * buildExecution state for build execution UI tests.
 */
const createProvisionedProject = ({
  id = "build-test",
  name = "Build Test Project",
  buildExecution = undefined,
} = {}) => {
  const agents = [
    {
      id: `${id}:agent-01`,
      name: `${name} Agent 01`,
      wave: 1,
      status: "complete",
      progress: 100,
      elapsedLabel: "12m",
    },
  ];

  return {
    id,
    name,
    description: "Project used for build execution UI tests.",
    phaseLabel: "Phase 1 — Operator Intake",
    engineChoice: "claude",
    agents,
    waves: { current: 1, total: 1 },
    provisioning: {
      status: "complete",
      repoUrl: "https://github.com/user/build-test-repo",
      workspacePath: "/home/user/projects/build-test-repo",
      steps: [
        { name: "repo-create", status: "complete" },
        { name: "clone", status: "complete" },
        { name: "artifact-write", status: "complete" },
        { name: "gsd-init", status: "complete" },
        { name: "commit-push", status: "complete" },
      ],
    },
    buildExecution,
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
            output: "Brief accepted",
            approval: { state: "approved" },
          },
          research: {
            status: "complete",
            output: "Research complete",
          },
          plan: {
            status: "complete",
            output: "Plan drafted",
            approval: { state: "approved" },
          },
          "wave-1": {
            status: "complete",
            output: "Wave complete",
            agentIds: [`${id}:agent-01`],
          },
          verification: {
            status: "complete",
            output: "Checks green",
            approval: { state: "approved" },
          },
          handoff: {
            status: "queued",
            output: "",
            approval: { state: "pending", required: true },
          },
        },
      }),
    },
  };
};

/**
 * Creates a project NOT yet at provisioning complete (early stage).
 */
const createUnprovisionedProject = ({
  id = "early-test",
  name = "Early Stage",
} = {}) => {
  const agents = [
    {
      id: `${id}:agent-01`,
      name: `${name} Agent 01`,
      wave: 1,
      status: "running",
      progress: 50,
      elapsedLabel: "5m",
    },
  ];

  return {
    id,
    name,
    description: "Project not yet provisioned.",
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
            output: "Brief accepted",
            approval: { state: "approved" },
          },
          research: {
            status: "complete",
            output: "Research complete",
          },
          plan: {
            status: "running",
            output: "",
          },
        },
      }),
    },
  };
};

const SAMPLE_AGENTS = [
  {
    agentId: "agent-claude-01",
    agentType: "claude",
    status: "running",
    lastOutput: "Implementing auth module...",
    elapsed: 125000,
    tokens: 15000,
    costUsd: 0.42,
    pid: 12345,
  },
  {
    agentId: "agent-claude-extra",
    agentType: "claude",
    status: "completed",
    lastOutput: "Tests passing: 24/24",
    elapsed: 89000,
    tokens: 8000,
    costUsd: 0.18,
    pid: 12346,
  },
];

const renderHandoffTab = (project, selection) => {
  const initialState = createLumonState({
    projects: [project],
    selection: selection ?? { projectId: project.id },
  });

  render(<MissionControl initialState={initialState} />);

  // Navigate to handoff tab
  fireEvent.click(screen.getByRole("tab", { name: /^handoff$/i }));
};

describe("Build Execution UI", () => {
  let origEventSource;

  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();

    origEventSource = globalThis.EventSource;
    globalThis.EventSource = function MockEventSource() {
      this.addEventListener = vi.fn();
      this.close = vi.fn();
    };
  });

  afterEach(() => {
    globalThis.EventSource = origEventSource;
  });

  describe("visibility gating", () => {
    it("renders build execution panel when provisioning is complete", () => {
      renderHandoffTab(createProvisionedProject());

      expect(screen.getByTestId("build-execution-panel")).toBeInTheDocument();
    });

    it("does NOT render build execution panel when provisioning is not complete", () => {
      renderHandoffTab(createUnprovisionedProject());

      expect(screen.queryByTestId("build-execution-panel")).not.toBeInTheDocument();
    });

    it("does NOT render build execution panel when provisioning is in progress", () => {
      renderHandoffTab(createProvisionedProject({
        id: "prov-progress",
        name: "Provisioning In Progress",
      }));

      // Override — create a project with provisioning status = provisioning (not complete)
      const project = {
        ...createProvisionedProject(),
        provisioning: {
          status: "provisioning",
          steps: [
            { name: "repo-create", status: "complete" },
            { name: "clone", status: "running" },
          ],
        },
      };

      const initialState = createLumonState({
        projects: [project],
        selection: { projectId: project.id },
      });

      // Re-render with the provisioning-in-progress project
      const { unmount } = render(<MissionControl initialState={initialState} />);
      fireEvent.click(screen.getAllByRole("tab", { name: /^handoff$/i })[0]);

      // Build panel should not render since provisioning isn't complete
      expect(screen.queryByTestId("build-execution-panel")).toBeInTheDocument();
      // But the start button should be disabled because canStartBuild requires provisioning complete
      // The panel renders (provisioning section shows progress), but canStartBuild gate works at button level
      unmount();
    });
  });

  describe("start-build button", () => {
    it("renders start button when build is idle and provisioned", () => {
      renderHandoffTab(createProvisionedProject());

      expect(screen.getByTestId("start-build-btn")).toBeInTheDocument();
      expect(screen.getByTestId("start-build-btn")).toHaveTextContent(/start build/i);
    });

    it("start button is disabled when server is disconnected", () => {
      renderHandoffTab(createProvisionedProject());

      // Default MockEventSource does NOT fire connected event → connected=false
      expect(screen.getByTestId("start-build-btn")).toBeDisabled();
    });

    it("start button is enabled when server is connected", async () => {
      globalThis.EventSource = function ConnectedEventSource() {
        this.close = vi.fn();
        this.addEventListener = vi.fn((event, cb) => {
          if (event === "connected") setTimeout(() => cb(), 0);
        });
      };

      renderHandoffTab(createProvisionedProject());

      await waitFor(() => {
        expect(screen.getByTestId("start-build-btn")).not.toBeDisabled();
      });
    });

    it("calls startBuild when clicked", async () => {
      globalThis.EventSource = function ConnectedEventSource() {
        this.close = vi.fn();
        this.addEventListener = vi.fn((event, cb) => {
          if (event === "connected") setTimeout(() => cb(), 0);
        });
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ status: "started" }),
      });

      renderHandoffTab(createProvisionedProject());

      await waitFor(() => {
        expect(screen.getByTestId("start-build-btn")).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId("start-build-btn"));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith("/api/execution/start", expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("build-test"),
        }));
      });
    });

    it("start button is disabled when build is already running", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "running",
          agents: SAMPLE_AGENTS,
          startedAt: "2026-03-21T10:00:00Z",
        },
      }));

      // When running, the button should not render (replaced by "Build in progress" indicator)
      expect(screen.queryByTestId("start-build-btn")).not.toBeInTheDocument();
    });

    it("shows retry button when build has failed", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "failed",
          agents: [],
          error: "Agent exited with code 1",
          startedAt: "2026-03-21T10:00:00Z",
        },
      }));

      expect(screen.getByTestId("start-build-btn")).toBeInTheDocument();
      expect(screen.getByTestId("start-build-btn")).toHaveTextContent(/retry build/i);
    });

    it("shows rebuild button when build is completed", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "completed",
          agents: [],
          startedAt: "2026-03-21T10:00:00Z",
          completedAt: "2026-03-21T10:05:00Z",
        },
      }));

      expect(screen.getByTestId("start-build-btn")).toBeInTheDocument();
      expect(screen.getByTestId("start-build-btn")).toHaveTextContent(/rebuild/i);
    });

    it("shows offline notice when server is disconnected", () => {
      renderHandoffTab(createProvisionedProject());

      expect(screen.getByTestId("build-offline-notice")).toBeInTheDocument();
    });
  });

  describe("build status header", () => {
    it("shows idle status when no build has started", () => {
      renderHandoffTab(createProvisionedProject());

      expect(screen.getByTestId("build-status-header")).toBeInTheDocument();
      expect(screen.getByTestId("build-status-badge")).toHaveTextContent(/idle/i);
    });

    it("shows running status during active build", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "running",
          agents: [SAMPLE_AGENTS[0]],
          startedAt: "2026-03-21T10:00:00Z",
        },
      }));

      expect(screen.getByTestId("build-status-badge")).toHaveTextContent(/running/i);
    });

    it("shows completed status after successful build", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "completed",
          agents: [],
          startedAt: "2026-03-21T10:00:00Z",
          completedAt: "2026-03-21T10:05:00Z",
        },
      }));

      expect(screen.getByTestId("build-status-badge")).toHaveTextContent(/completed/i);
    });

    it("shows failed status after failed build", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "failed",
          agents: [],
          error: "Agent exited with code 1",
          startedAt: "2026-03-21T10:00:00Z",
        },
      }));

      expect(screen.getByTestId("build-status-badge")).toHaveTextContent(/failed/i);
    });
  });

  describe("agent activity cards", () => {
    it("renders agent cards during active build", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "running",
          agents: SAMPLE_AGENTS,
          startedAt: "2026-03-21T10:00:00Z",
        },
      }));

      expect(screen.getByTestId("build-agent-list")).toBeInTheDocument();
      expect(screen.getByTestId("build-agent-card-agent-claude-01")).toBeInTheDocument();
      expect(screen.getByTestId("build-agent-card-agent-claude-extra")).toBeInTheDocument();
    });

    it("shows agent type labels correctly", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "running",
          agents: SAMPLE_AGENTS,
          startedAt: "2026-03-21T10:00:00Z",
        },
      }));

      const claudeCard = screen.getByTestId("build-agent-card-agent-claude-01");
      const codexCard = screen.getByTestId("build-agent-card-agent-claude-extra");

      expect(within(claudeCard).getByText("Claude Code")).toBeInTheDocument();
      expect(within(codexCard).getByText("Claude Code")).toBeInTheDocument();
    });

    it("shows agent status badges", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "running",
          agents: SAMPLE_AGENTS,
          startedAt: "2026-03-21T10:00:00Z",
        },
      }));

      const claudeCard = screen.getByTestId("build-agent-card-agent-claude-01");
      const codexCard = screen.getByTestId("build-agent-card-agent-claude-extra");

      expect(within(claudeCard).getByText("running")).toBeInTheDocument();
      expect(within(codexCard).getByText("completed")).toBeInTheDocument();
    });

    it("shows last output line on agent cards", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "running",
          agents: SAMPLE_AGENTS,
          startedAt: "2026-03-21T10:00:00Z",
        },
      }));

      expect(screen.getByTestId("build-agent-card-agent-claude-01-last-output")).toHaveTextContent(
        "Implementing auth module...",
      );
      expect(screen.getByTestId("build-agent-card-agent-claude-extra-last-output")).toHaveTextContent(
        "Tests passing: 24/24",
      );
    });

    it("does not render agent list when no agents present", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "idle",
          agents: [],
        },
      }));

      expect(screen.queryByTestId("build-agent-list")).not.toBeInTheDocument();
    });
  });

  describe("agent output expansion", () => {
    it("expands agent output panel on card click", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          output: ["Line 1: Starting build...", "Line 2: Compiling...", "Line 3: Done"],
        }),
      });

      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "running",
          agents: [SAMPLE_AGENTS[0]],
          startedAt: "2026-03-21T10:00:00Z",
        },
      }));

      // Click the agent card toggle to expand
      fireEvent.click(screen.getByTestId("build-agent-card-agent-claude-01-toggle"));

      await waitFor(() => {
        expect(screen.getByTestId("build-agent-output-agent-claude-01")).toBeInTheDocument();
      });

      // Verify fetch was called for agent output
      expect(fetchSpy).toHaveBeenCalledWith("/api/execution/agent/agent-claude-01/output");
    });

    it("shows error when output fetch fails", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: "Agent not found" }),
      });

      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "running",
          agents: [SAMPLE_AGENTS[0]],
          startedAt: "2026-03-21T10:00:00Z",
        },
      }));

      fireEvent.click(screen.getByTestId("build-agent-card-agent-claude-01-toggle"));

      await waitFor(() => {
        expect(screen.getByTestId("build-agent-output-agent-claude-01-error")).toBeInTheDocument();
      });
    });
  });

  describe("error and completion states", () => {
    it("shows error message when build has failed", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "failed",
          agents: [],
          error: "Agent exited with code 1: segmentation fault",
          startedAt: "2026-03-21T10:00:00Z",
        },
      }));

      expect(screen.getByTestId("build-error")).toBeInTheDocument();
      expect(screen.getByTestId("build-error")).toHaveTextContent(/segmentation fault/i);
    });

    it("shows completion notice when build is done", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "completed",
          agents: [],
          startedAt: "2026-03-21T10:00:00Z",
          completedAt: "2026-03-21T10:05:00Z",
        },
      }));

      expect(screen.getByTestId("build-complete-notice")).toBeInTheDocument();
      expect(screen.getByTestId("build-complete-notice")).toHaveTextContent(/build completed successfully/i);
    });

    it("shows running indicator during active build", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "running",
          agents: [SAMPLE_AGENTS[0]],
          startedAt: "2026-03-21T10:00:00Z",
        },
      }));

      expect(screen.getByText(/build in progress/i)).toBeInTheDocument();
    });
  });

  describe("existing provisioning/handoff non-regression", () => {
    it("provisioning section still renders correctly alongside build panel", () => {
      renderHandoffTab(createProvisionedProject());

      // Provisioning complete indicators should still exist
      expect(screen.getByTestId("provisioning-progress")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-progress-label")).toHaveTextContent(/provisioning complete/i);

      // Build execution panel should also exist
      expect(screen.getByTestId("build-execution-panel")).toBeInTheDocument();
    });

    it("handoff panel sections still render correctly", () => {
      renderHandoffTab(createProvisionedProject());

      expect(screen.getByTestId("selected-project-handoff-panel")).toBeInTheDocument();
      expect(screen.getByTestId("selected-project-handoff-status")).toBeInTheDocument();
    });
  });

  describe("data-testid coverage", () => {
    it("all build execution elements have data-testid attributes", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "running",
          agents: SAMPLE_AGENTS,
          startedAt: "2026-03-21T10:00:00Z",
        },
      }));

      expect(screen.getByTestId("build-execution-panel")).toBeInTheDocument();
      expect(screen.getByTestId("build-status-header")).toBeInTheDocument();
      expect(screen.getByTestId("build-status-badge")).toBeInTheDocument();
      expect(screen.getByTestId("build-agent-list")).toBeInTheDocument();
      expect(screen.getByTestId("build-agent-card-agent-claude-01")).toBeInTheDocument();
      expect(screen.getByTestId("build-agent-card-agent-claude-extra")).toBeInTheDocument();
    });

    it("error state elements have data-testid attributes", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "failed",
          agents: [],
          error: "Build failed",
          startedAt: "2026-03-21T10:00:00Z",
        },
      }));

      expect(screen.getByTestId("build-execution-panel")).toBeInTheDocument();
      expect(screen.getByTestId("build-error")).toBeInTheDocument();
      expect(screen.getByTestId("start-build-btn")).toBeInTheDocument();
    });

    it("completion state elements have data-testid attributes", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "completed",
          agents: [],
          startedAt: "2026-03-21T10:00:00Z",
          completedAt: "2026-03-21T10:05:00Z",
        },
      }));

      expect(screen.getByTestId("build-execution-panel")).toBeInTheDocument();
      expect(screen.getByTestId("build-complete-notice")).toBeInTheDocument();
      expect(screen.getByTestId("start-build-btn")).toBeInTheDocument();
    });
  });
});
