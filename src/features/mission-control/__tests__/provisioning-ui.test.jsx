import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MissionControl from "@/mission-control";
import { createCanonicalPrebuildStages, createLumonState } from "@/lumon/model";

/**
 * Creates a project at handoff_ready with optional provisioning state.
 * handoff_ready requires: handoff stage is queued with pending approval,
 * all prior stages complete/approved.
 */
const createHandoffReadyProject = ({
  id = "prov-test",
  name = "Provisioning Test",
  provisioning = undefined,
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
    description: "Project used for provisioning UI tests.",
    phaseLabel: "Phase 1 — Operator Intake",
    engineChoice: "claude",
    agents,
    waves: { current: 1, total: 1 },
    provisioning,
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
 * Creates a project NOT at handoff_ready (still in plan stage).
 */
const createEarlyStageProject = ({ id = "early-test", name = "Early Stage" } = {}) => {
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
    description: "Project not yet at handoff.",
    phaseLabel: "Phase 1 — Operator Intake",
    engineChoice: "codex",
    agents,
    waves: { current: 1, total: 1 },
    execution: {
      stages: createCanonicalPrebuildStages({
        projectId: id,
        projectName: name,
        engineChoice: "codex",
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

const SAMPLE_PREVIEW_PLAN = {
  repoName: "test-project-repo",
  engineChoice: "claude",
  workspacePath: "/home/user/projects/test-project-repo",
  files: [
    "docs/viability-analysis.md",
    "docs/business-plan.md",
    "docs/architecture-outline.md",
    ".gsd/PROJECT.md",
    ".gsd/REQUIREMENTS.md",
    ".gsd/preferences.md",
  ],
};

const SAMPLE_STEPS = [
  { name: "repo-create", status: "complete", startedAt: "2026-03-18T10:00:00Z", completedAt: "2026-03-18T10:00:02Z" },
  { name: "clone", status: "complete", startedAt: "2026-03-18T10:00:02Z", completedAt: "2026-03-18T10:00:04Z" },
  { name: "artifact-write", status: "running", startedAt: "2026-03-18T10:00:04Z" },
  { name: "gsd-init", status: "pending" },
  { name: "commit-push", status: "pending" },
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

describe("Provisioning UI in HandoffPanel", () => {
  let origEventSource;

  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();

    // Mock EventSource globally — sync.js creates one per render.
    // Default: listeners registered but no "connected" event fires → connected=false.
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
    it("does NOT render provisioning controls when project is not handoff_ready", () => {
      renderHandoffTab(createEarlyStageProject());

      expect(screen.queryByTestId("provisioning-section")).not.toBeInTheDocument();
      expect(screen.queryByTestId("provisioning-preview-btn")).not.toBeInTheDocument();
    });

    it("renders preview button when handoff_ready and provisioning is idle", () => {
      renderHandoffTab(createHandoffReadyProject());

      expect(screen.getByTestId("provisioning-section")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-preview-btn")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-preview-btn")).toHaveTextContent(/preview provisioning/i);
    });

    it("hides provisioning controls completely when not handoff_ready", () => {
      renderHandoffTab(createEarlyStageProject());

      expect(screen.queryByTestId("provisioning-section")).not.toBeInTheDocument();
      expect(screen.queryByTestId("provisioning-confirm-dialog")).not.toBeInTheDocument();
      expect(screen.queryByTestId("provisioning-progress")).not.toBeInTheDocument();
    });
  });

  describe("preview button", () => {
    it("calls previewProvisioning when clicked", async () => {
      // Override EventSource to fire connected event → button enabled
      globalThis.EventSource = function ConnectedEventSource() {
        this.close = vi.fn();
        this.addEventListener = vi.fn((event, cb) => {
          if (event === "connected") setTimeout(() => cb(), 0);
        });
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => SAMPLE_PREVIEW_PLAN,
      });

      renderHandoffTab(createHandoffReadyProject());

      // Wait for SSE connected → button enabled
      await waitFor(() => {
        expect(screen.getByTestId("provisioning-preview-btn")).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId("provisioning-preview-btn"));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith("/api/provisioning/preview", expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("prov-test"),
        }));
      });
    });
  });

  describe("confirmation dialog", () => {
    it("shows plan details when provisioning status is confirming", () => {
      renderHandoffTab(createHandoffReadyProject({
        provisioning: {
          status: "confirming",
          previewPlan: SAMPLE_PREVIEW_PLAN,
        },
      }));

      expect(screen.getByTestId("provisioning-confirm-dialog")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-plan-repo")).toHaveTextContent("test-project-repo");
      expect(screen.getByTestId("provisioning-plan-engine")).toHaveTextContent("Claude Code");
      expect(screen.getByTestId("provisioning-plan-workspace")).toHaveTextContent("/home/user/projects/test-project-repo");
      expect(screen.getByTestId("provisioning-plan-file-count")).toHaveTextContent("6 files");
    });

    it("shows the file list in the confirmation dialog", () => {
      renderHandoffTab(createHandoffReadyProject({
        provisioning: {
          status: "confirming",
          previewPlan: SAMPLE_PREVIEW_PLAN,
        },
      }));

      const fileList = screen.getByTestId("provisioning-plan-files");
      expect(fileList).toBeInTheDocument();
      expect(within(fileList).getByText("docs/viability-analysis.md")).toBeInTheDocument();
      expect(within(fileList).getByText(".gsd/PROJECT.md")).toBeInTheDocument();
    });

    it("shows warning text about irreversible action", () => {
      renderHandoffTab(createHandoffReadyProject({
        provisioning: {
          status: "confirming",
          previewPlan: SAMPLE_PREVIEW_PLAN,
        },
      }));

      expect(screen.getByText(/this will create a github repository/i)).toBeInTheDocument();
    });

    it("renders Cancel and Confirm buttons with proper testids", () => {
      renderHandoffTab(createHandoffReadyProject({
        provisioning: {
          status: "confirming",
          previewPlan: SAMPLE_PREVIEW_PLAN,
        },
      }));

      expect(screen.getByTestId("provisioning-cancel-btn")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-confirm-btn")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-cancel-btn")).toHaveTextContent("Cancel");
      expect(screen.getByTestId("provisioning-confirm-btn")).toHaveTextContent("Confirm & Provision");
    });

    it("Cancel button resets provisioning state to idle", () => {
      renderHandoffTab(createHandoffReadyProject({
        provisioning: {
          status: "confirming",
          previewPlan: SAMPLE_PREVIEW_PLAN,
        },
      }));

      expect(screen.getByTestId("provisioning-confirm-dialog")).toBeInTheDocument();

      fireEvent.click(screen.getByTestId("provisioning-cancel-btn"));

      // After cancel, the dialog should disappear and preview button should return
      expect(screen.queryByTestId("provisioning-confirm-dialog")).not.toBeInTheDocument();
      expect(screen.getByTestId("provisioning-preview-btn")).toBeInTheDocument();
    });

    it("Confirm button calls executeProvisioning", () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ status: "provisioning" }),
      });

      renderHandoffTab(createHandoffReadyProject({
        provisioning: {
          status: "confirming",
          previewPlan: SAMPLE_PREVIEW_PLAN,
        },
      }));

      fireEvent.click(screen.getByTestId("provisioning-confirm-btn"));

      expect(fetchSpy).toHaveBeenCalledWith("/api/provisioning/execute", expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("prov-test"),
      }));
    });
  });

  describe("progress display", () => {
    it("shows step-level progress with status indicators", () => {
      renderHandoffTab(createHandoffReadyProject({
        provisioning: {
          status: "provisioning",
          steps: SAMPLE_STEPS,
        },
      }));

      expect(screen.getByTestId("provisioning-progress")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-step-repo-create")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-step-clone")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-step-artifact-write")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-step-gsd-init")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-step-commit-push")).toBeInTheDocument();
    });

    it("shows human-readable step labels", () => {
      renderHandoffTab(createHandoffReadyProject({
        provisioning: {
          status: "provisioning",
          steps: SAMPLE_STEPS,
        },
      }));

      expect(screen.getByText("Create GitHub repository")).toBeInTheDocument();
      expect(screen.getByText("Clone repository")).toBeInTheDocument();
      expect(screen.getByText("Write artifact files")).toBeInTheDocument();
      expect(screen.getByText("Initialize GSD structure")).toBeInTheDocument();
      expect(screen.getByText("Commit and push")).toBeInTheDocument();
    });

    it("shows progress summary with current step", () => {
      renderHandoffTab(createHandoffReadyProject({
        provisioning: {
          status: "provisioning",
          steps: SAMPLE_STEPS,
        },
      }));

      expect(screen.getByTestId("provisioning-progress-label")).toHaveTextContent(
        /step 3 of 5.*write artifact files/i,
      );
    });
  });

  describe("success state", () => {
    it("shows repo URL and workspace path on completion", () => {
      const completedSteps = SAMPLE_STEPS.map((s) => ({
        ...s,
        status: "complete",
        completedAt: "2026-03-18T10:01:00Z",
      }));

      renderHandoffTab(createHandoffReadyProject({
        provisioning: {
          status: "complete",
          repoUrl: "https://github.com/user/test-project-repo",
          workspacePath: "/home/user/projects/test-project-repo",
          steps: completedSteps,
        },
      }));

      expect(screen.getByTestId("provisioning-progress")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-repo-url")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-repo-url")).toHaveTextContent("https://github.com/user/test-project-repo");
      expect(screen.getByTestId("provisioning-repo-url")).toHaveAttribute("href", "https://github.com/user/test-project-repo");
      expect(screen.getByTestId("provisioning-workspace-path")).toHaveTextContent("/home/user/projects/test-project-repo");
    });

    it("shows completion label", () => {
      const completedSteps = SAMPLE_STEPS.map((s) => ({
        ...s,
        status: "complete",
        completedAt: "2026-03-18T10:01:00Z",
      }));

      renderHandoffTab(createHandoffReadyProject({
        provisioning: {
          status: "complete",
          repoUrl: "https://github.com/user/test-project-repo",
          workspacePath: "/home/user/projects/test-project-repo",
          steps: completedSteps,
        },
      }));

      expect(screen.getByTestId("provisioning-progress-label")).toHaveTextContent(/provisioning complete/i);
    });
  });

  describe("error state", () => {
    it("shows error message and failed step", () => {
      const failedSteps = [
        { name: "repo-create", status: "complete" },
        { name: "clone", status: "failed", error: "git clone failed: access denied" },
        { name: "artifact-write", status: "pending" },
        { name: "gsd-init", status: "pending" },
        { name: "commit-push", status: "pending" },
      ];

      renderHandoffTab(createHandoffReadyProject({
        provisioning: {
          status: "failed",
          error: "Step 'clone' failed: git clone failed: access denied",
          steps: failedSteps,
        },
      }));

      expect(screen.getByTestId("provisioning-progress")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-error")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-error")).toHaveTextContent(/git clone failed/i);
      expect(screen.getByTestId("provisioning-progress-label")).toHaveTextContent(/failed at.*clone repository/i);
    });
  });

  describe("previewing state", () => {
    it("shows loading indicator when previewing", () => {
      renderHandoffTab(createHandoffReadyProject({
        provisioning: {
          status: "previewing",
        },
      }));

      expect(screen.getByTestId("provisioning-previewing")).toBeInTheDocument();
      expect(screen.getByText(/loading provisioning preview/i)).toBeInTheDocument();
    });
  });

  describe("data-testid coverage", () => {
    it("all provisioning interactive elements have data-testid attributes", () => {
      renderHandoffTab(createHandoffReadyProject({
        provisioning: {
          status: "confirming",
          previewPlan: SAMPLE_PREVIEW_PLAN,
        },
      }));

      // Confirm dialog elements
      expect(screen.getByTestId("provisioning-confirm-dialog")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-plan-repo")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-plan-engine")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-plan-workspace")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-plan-file-count")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-plan-files")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-cancel-btn")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-confirm-btn")).toBeInTheDocument();
    });

    it("progress elements have data-testid attributes", () => {
      renderHandoffTab(createHandoffReadyProject({
        provisioning: {
          status: "provisioning",
          steps: SAMPLE_STEPS,
        },
      }));

      expect(screen.getByTestId("provisioning-progress")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-progress-label")).toBeInTheDocument();
      SAMPLE_STEPS.forEach((step) => {
        expect(screen.getByTestId(`provisioning-step-${step.name}`)).toBeInTheDocument();
      });
    });

    it("success elements have data-testid attributes", () => {
      const completedSteps = SAMPLE_STEPS.map((s) => ({
        ...s,
        status: "complete",
      }));

      renderHandoffTab(createHandoffReadyProject({
        provisioning: {
          status: "complete",
          repoUrl: "https://github.com/user/repo",
          workspacePath: "/home/user/repo",
          steps: completedSteps,
        },
      }));

      expect(screen.getByTestId("provisioning-repo-url")).toBeInTheDocument();
      expect(screen.getByTestId("provisioning-workspace-path")).toBeInTheDocument();
    });
  });

  describe("engine label display", () => {
    it("displays 'Codex CLI' for codex engine choice", () => {
      const codexPlan = { ...SAMPLE_PREVIEW_PLAN, engineChoice: "codex" };

      renderHandoffTab(createHandoffReadyProject({
        provisioning: {
          status: "confirming",
          previewPlan: codexPlan,
        },
      }));

      expect(screen.getByTestId("provisioning-plan-engine")).toHaveTextContent("Codex CLI");
    });
  });
});
