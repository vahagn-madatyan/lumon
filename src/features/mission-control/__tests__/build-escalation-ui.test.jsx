import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MissionControl from "@/mission-control";
import { createCanonicalPrebuildStages, createLumonState } from "@/lumon/model";

/**
 * Creates a project at handoff_ready with provisioning complete and
 * configurable buildExecution state for escalation UI tests.
 */
const createProvisionedProject = ({
  id = "esc-test",
  name = "Escalation Test Project",
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
    description: "Project used for build escalation UI tests.",
    phaseLabel: "Phase 1 — Operator Intake",
    engineChoice: "claude",
    agents,
    waves: { current: 1, total: 1 },
    provisioning: {
      status: "complete",
      repoUrl: "https://github.com/user/esc-test-repo",
      workspacePath: "/home/user/projects/esc-test-repo",
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
          intake: { status: "complete", output: "Brief accepted", approval: { state: "approved" } },
          research: { status: "complete", output: "Research complete" },
          plan: { status: "complete", output: "Plan drafted", approval: { state: "approved" } },
          "wave-1": { status: "complete", output: "Wave complete", agentIds: [`${id}:agent-01`] },
          verification: { status: "complete", output: "Checks green", approval: { state: "approved" } },
          handoff: { status: "queued", output: "", approval: { state: "pending", required: true } },
        },
      }),
    },
  };
};

const ESCALATED_BUILD = {
  status: "escalated",
  agents: [
    {
      agentId: "agent-claude-01",
      agentType: "claude",
      status: "failed",
      lastOutput: "Error: segfault at 0x0001",
      elapsed: 125000,
      tokens: 15000,
      costUsd: 0.42,
      pid: 12345,
    },
  ],
  startedAt: "2026-03-21T10:00:00Z",
  retryCount: 1,
  escalation: {
    status: "raised",
    reason: "Agent failed after retry: exit code 1 — segmentation fault",
    acknowledgedAt: null,
    decision: null,
  },
};

const RETRYING_BUILD = {
  status: "running",
  agents: [
    {
      agentId: "agent-claude-01",
      agentType: "claude",
      status: "running",
      lastOutput: "Retrying auth module...",
      elapsed: 5000,
      tokens: 1000,
      costUsd: 0.03,
      pid: 12346,
    },
  ],
  startedAt: "2026-03-21T10:00:00Z",
  retryCount: 1,
  escalation: { status: "none", reason: null, acknowledgedAt: null, decision: null },
};

const TELEMETRY_BUILD = {
  status: "running",
  agents: [
    {
      agentId: "agent-claude-01",
      agentType: "claude",
      status: "running",
      lastOutput: "Building components...",
      elapsed: 60000,
      tokens: 12000,
      costUsd: 0.35,
      pid: 12345,
      telemetry: {
        tokens: { input: 8000, output: 4000 },
        costUsd: 0.35,
        progress: 65,
        lastOutputSummary: "Writing auth module",
      },
    },
    {
      agentId: "agent-claude-extra",
      agentType: "claude",
      status: "running",
      lastOutput: "Generating tests...",
      elapsed: 45000,
      tokens: 6000,
      costUsd: 0.12,
      pid: 12346,
      telemetry: null, // No telemetry — raw fallback
    },
  ],
  startedAt: "2026-03-21T10:00:00Z",
  retryCount: 0,
  escalation: { status: "none", reason: null, acknowledgedAt: null, decision: null },
};

const TIMEOUT_BUILD = {
  status: "running",
  agents: [
    {
      agentId: "agent-claude-01",
      agentType: "claude",
      status: "timed-out",
      lastOutput: "Last known output before timeout",
      elapsed: 300000,
      tokens: 20000,
      costUsd: 0.55,
      pid: 12345,
    },
  ],
  startedAt: "2026-03-21T10:00:00Z",
  retryCount: 0,
  escalation: { status: "none", reason: null, acknowledgedAt: null, decision: null },
};

const renderHandoffTab = (project, selection) => {
  const initialState = createLumonState({
    projects: [project],
    selection: selection ?? { projectId: project.id },
  });

  render(<MissionControl initialState={initialState} />);
  fireEvent.click(screen.getByRole("tab", { name: /^handoff$/i }));
};

const renderDashboardTab = (projects, selection) => {
  const initialState = createLumonState({
    projects,
    selection: selection ?? { projectId: projects[0]?.id },
  });

  render(<MissionControl initialState={initialState} />);
  // Dashboard tab is the default — no click needed
};

describe("Build Escalation UI", () => {
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

  describe("escalation banner", () => {
    it("renders escalation banner when build is escalated", () => {
      renderHandoffTab(createProvisionedProject({ buildExecution: ESCALATED_BUILD }));

      expect(screen.getByTestId("build-escalation-banner")).toBeInTheDocument();
    });

    it("shows failure reason in escalation banner", () => {
      renderHandoffTab(createProvisionedProject({ buildExecution: ESCALATED_BUILD }));

      expect(screen.getByTestId("build-escalation-reason")).toHaveTextContent(
        /agent failed after retry.*segmentation fault/i,
      );
    });

    it("does NOT render escalation banner when build is not escalated", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "running",
          agents: TELEMETRY_BUILD.agents,
          startedAt: "2026-03-21T10:00:00Z",
        },
      }));

      expect(screen.queryByTestId("build-escalation-banner")).not.toBeInTheDocument();
    });

    it("renders retry button in escalation banner", () => {
      renderHandoffTab(createProvisionedProject({ buildExecution: ESCALATED_BUILD }));

      expect(screen.getByTestId("escalation-retry-btn")).toBeInTheDocument();
      expect(screen.getByTestId("escalation-retry-btn")).toHaveTextContent(/retry/i);
    });

    it("renders abort button in escalation banner", () => {
      renderHandoffTab(createProvisionedProject({ buildExecution: ESCALATED_BUILD }));

      expect(screen.getByTestId("escalation-abort-btn")).toBeInTheDocument();
      expect(screen.getByTestId("escalation-abort-btn")).toHaveTextContent(/abort/i);
    });

    it("retry button calls acknowledgeEscalation with 'retry' decision", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ status: "acknowledged", decision: "retry" }),
      });

      renderHandoffTab(createProvisionedProject({ buildExecution: ESCALATED_BUILD }));

      fireEvent.click(screen.getByTestId("escalation-retry-btn"));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          "/api/execution/escalation/acknowledge",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"retry"'),
          }),
        );
      });
    });

    it("abort button calls acknowledgeEscalation with 'abort' decision", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ status: "acknowledged", decision: "abort" }),
      });

      renderHandoffTab(createProvisionedProject({ buildExecution: ESCALATED_BUILD }));

      fireEvent.click(screen.getByTestId("escalation-abort-btn"));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          "/api/execution/escalation/acknowledge",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"abort"'),
          }),
        );
      });
    });

    it("shows escalated status badge in header", () => {
      renderHandoffTab(createProvisionedProject({ buildExecution: ESCALATED_BUILD }));

      expect(screen.getByTestId("build-status-badge")).toHaveTextContent(/escalated/i);
    });

    it("shows retry count in header when retryCount > 0", () => {
      renderHandoffTab(createProvisionedProject({ buildExecution: ESCALATED_BUILD }));

      expect(screen.getByTestId("build-retry-count")).toHaveTextContent(/retry #1/i);
    });
  });

  describe("retry-in-progress indicator", () => {
    it("shows retrying indicator when agent is retrying", () => {
      renderHandoffTab(createProvisionedProject({ buildExecution: RETRYING_BUILD }));

      expect(screen.getByTestId("build-agent-retrying-agent-claude-01")).toBeInTheDocument();
    });

    it("retrying indicator shows 'Retrying…' label", () => {
      renderHandoffTab(createProvisionedProject({ buildExecution: RETRYING_BUILD }));

      expect(screen.getByTestId("build-agent-retrying-agent-claude-01")).toHaveTextContent(/retrying/i);
    });

    it("does NOT show retrying indicator when retryCount is 0", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          ...TELEMETRY_BUILD,
          retryCount: 0,
        },
      }));

      expect(screen.queryByTestId("build-agent-retrying-agent-claude-01")).not.toBeInTheDocument();
    });
  });

  describe("telemetry display", () => {
    it("renders telemetry bar when telemetry data is available", () => {
      renderHandoffTab(createProvisionedProject({ buildExecution: TELEMETRY_BUILD }));

      expect(screen.getByTestId("build-agent-telemetry-agent-claude-01")).toBeInTheDocument();
    });

    it("shows token count in telemetry", () => {
      renderHandoffTab(createProvisionedProject({ buildExecution: TELEMETRY_BUILD }));

      expect(screen.getByTestId("build-agent-telemetry-tokens-agent-claude-01")).toBeInTheDocument();
    });

    it("shows cost in telemetry", () => {
      renderHandoffTab(createProvisionedProject({ buildExecution: TELEMETRY_BUILD }));

      expect(screen.getByTestId("build-agent-telemetry-cost-agent-claude-01")).toBeInTheDocument();
    });

    it("shows progress bar in telemetry", () => {
      renderHandoffTab(createProvisionedProject({ buildExecution: TELEMETRY_BUILD }));

      expect(screen.getByTestId("build-agent-telemetry-progress-agent-claude-01")).toBeInTheDocument();
    });

    it("shows last output summary in telemetry", () => {
      renderHandoffTab(createProvisionedProject({ buildExecution: TELEMETRY_BUILD }));

      expect(screen.getByTestId("build-agent-telemetry-summary-agent-claude-01")).toHaveTextContent(
        "Writing auth module",
      );
    });

    it("does NOT render telemetry bar when telemetry is null (raw fallback)", () => {
      renderHandoffTab(createProvisionedProject({ buildExecution: TELEMETRY_BUILD }));

      // agent-claude-extra has telemetry: null
      expect(screen.queryByTestId("build-agent-telemetry-agent-claude-extra")).not.toBeInTheDocument();
    });
  });

  describe("timeout indicator", () => {
    it("renders timeout indicator for timed-out agents", () => {
      renderHandoffTab(createProvisionedProject({ buildExecution: TIMEOUT_BUILD }));

      expect(screen.getByTestId("build-agent-timeout-agent-claude-01")).toBeInTheDocument();
    });

    it("timeout indicator shows 'Timed out' label", () => {
      renderHandoffTab(createProvisionedProject({ buildExecution: TIMEOUT_BUILD }));

      expect(screen.getByTestId("build-agent-timeout-agent-claude-01")).toHaveTextContent(/timed out/i);
    });

    it("timeout is visually distinct from failure (orange styling)", () => {
      renderHandoffTab(createProvisionedProject({ buildExecution: TIMEOUT_BUILD }));

      const agentCard = screen.getByTestId("build-agent-card-agent-claude-01");
      expect(agentCard.className).toContain("orange");
    });

    it("does NOT show timeout indicator for running agents", () => {
      renderHandoffTab(createProvisionedProject({ buildExecution: TELEMETRY_BUILD }));

      expect(screen.queryByTestId("build-agent-timeout-agent-claude-01")).not.toBeInTheDocument();
    });
  });

  describe("dashboard escalation badge on project cards", () => {
    it("shows escalation badge on project card when build is escalated", () => {
      renderDashboardTab([createProvisionedProject({ buildExecution: ESCALATED_BUILD })]);

      expect(screen.getByTestId("dashboard-project-escalation-badge-esc-test")).toBeInTheDocument();
    });

    it("escalation badge shows 'Escalated' text", () => {
      renderDashboardTab([createProvisionedProject({ buildExecution: ESCALATED_BUILD })]);

      expect(screen.getByTestId("dashboard-project-escalation-badge-esc-test")).toHaveTextContent(/escalated/i);
    });

    it("does NOT show escalation badge when build is not escalated", () => {
      renderDashboardTab([createProvisionedProject({
        buildExecution: { status: "running", agents: [], startedAt: "2026-03-21T10:00:00Z" },
      })]);

      expect(screen.queryByTestId("dashboard-project-escalation-badge-esc-test")).not.toBeInTheDocument();
    });
  });

  describe("fleet metrics — escalated count", () => {
    it("shows escalation metric card when escalated projects exist", () => {
      renderDashboardTab([createProvisionedProject({ buildExecution: ESCALATED_BUILD })]);

      const escalationCard = screen.getByText("Escalations");
      expect(escalationCard).toBeInTheDocument();
    });

    it("escalation metric card shows correct count", () => {
      renderDashboardTab([
        createProvisionedProject({ id: "proj-1", name: "Project 1", buildExecution: ESCALATED_BUILD }),
        createProvisionedProject({ id: "proj-2", name: "Project 2", buildExecution: ESCALATED_BUILD }),
      ]);

      // Find the escalation metric card by its label and check its sibling value
      const escalationsLabel = screen.getByText("Escalations");
      const cardContent = escalationsLabel.closest("[class*='p-2']");
      expect(cardContent).toBeInTheDocument();
      expect(within(cardContent).getByText("2")).toBeInTheDocument();
    });

    it("does NOT show escalation metric card when no projects are escalated", () => {
      renderDashboardTab([createProvisionedProject({
        buildExecution: { status: "running", agents: [], startedAt: "2026-03-21T10:00:00Z" },
      })]);

      expect(screen.queryByText("Escalations")).not.toBeInTheDocument();
    });
  });

  describe("multi-project independent build status", () => {
    it("renders multiple project cards with independent build statuses", () => {
      const projects = [
        createProvisionedProject({
          id: "proj-a",
          name: "Project Alpha",
          buildExecution: ESCALATED_BUILD,
        }),
        createProvisionedProject({
          id: "proj-b",
          name: "Project Beta",
          buildExecution: {
            status: "running",
            agents: [
              {
                agentId: "agent-beta-01",
                agentType: "claude",
                status: "running",
                lastOutput: "All good here",
                elapsed: 30000,
                tokens: 5000,
                costUsd: 0.1,
                pid: 55555,
              },
            ],
            startedAt: "2026-03-21T10:00:00Z",
          },
        }),
      ];

      renderDashboardTab(projects);

      // Project Alpha should have escalation badge
      expect(screen.getByTestId("dashboard-project-escalation-badge-proj-a")).toBeInTheDocument();

      // Project Beta should NOT have escalation badge
      expect(screen.queryByTestId("dashboard-project-escalation-badge-proj-b")).not.toBeInTheDocument();
    });
  });

  describe("existing UI non-regression", () => {
    it("build execution panel still renders correctly for idle state", () => {
      renderHandoffTab(createProvisionedProject());

      expect(screen.getByTestId("build-execution-panel")).toBeInTheDocument();
      expect(screen.getByTestId("build-status-badge")).toHaveTextContent(/idle/i);
      expect(screen.getByTestId("start-build-btn")).toBeInTheDocument();
    });

    it("build execution panel still renders correctly for running state", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "running",
          agents: TELEMETRY_BUILD.agents,
          startedAt: "2026-03-21T10:00:00Z",
        },
      }));

      expect(screen.getByTestId("build-status-badge")).toHaveTextContent(/running/i);
      expect(screen.getByText(/build in progress/i)).toBeInTheDocument();
    });

    it("build execution panel still renders correctly for failed state", () => {
      renderHandoffTab(createProvisionedProject({
        buildExecution: {
          status: "failed",
          agents: [],
          error: "Build crashed",
          startedAt: "2026-03-21T10:00:00Z",
        },
      }));

      expect(screen.getByTestId("build-status-badge")).toHaveTextContent(/failed/i);
      expect(screen.getByTestId("build-error")).toHaveTextContent("Build crashed");
      expect(screen.getByTestId("start-build-btn")).toHaveTextContent(/retry build/i);
    });

    it("provisioning section and handoff panel still render", () => {
      renderHandoffTab(createProvisionedProject());

      expect(screen.getByTestId("provisioning-progress")).toBeInTheDocument();
      expect(screen.getByTestId("selected-project-handoff-panel")).toBeInTheDocument();
    });
  });
});
