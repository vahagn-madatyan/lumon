import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MissionControl from "@/mission-control";
import { createCanonicalPrebuildStages, createLumonState } from "@/lumon/model";

/**
 * Creates a project at handoff_ready with optional externalActions and provisioning state.
 */
const createHandoffReadyProject = ({
  id = "ext-test",
  name = "External Actions Test",
  externalActions,
  provisioning,
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
    description: "Project used for external actions UI tests.",
    phaseLabel: "Phase 1 — Operator Intake",
    engineChoice: "claude",
    agents,
    waves: { current: 1, total: 1 },
    externalActions,
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
 * Creates an early-stage project with no external actions.
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

const SAMPLE_ACTIONS = {
  pending: {
    id: "act-001",
    type: "domain-purchase",
    params: { domain: "nexus.io", cost: 2900 },
    status: "pending",
    requestedAt: "2026-03-21T10:00:00Z",
  },
  confirmed: {
    id: "act-002",
    type: "domain-purchase",
    params: { domain: "arcline.com", cost: 1200 },
    status: "confirmed",
    requestedAt: "2026-03-21T10:00:00Z",
    confirmedAt: "2026-03-21T10:01:00Z",
  },
  executing: {
    id: "act-003",
    type: "domain-purchase",
    params: { domain: "zenith.dev", cost: 4500 },
    status: "executing",
    requestedAt: "2026-03-21T10:00:00Z",
    confirmedAt: "2026-03-21T10:01:00Z",
  },
  completed: {
    id: "act-004",
    type: "domain-purchase",
    params: { domain: "orbital.app", cost: 3500 },
    status: "completed",
    requestedAt: "2026-03-21T10:00:00Z",
    confirmedAt: "2026-03-21T10:01:00Z",
    completedAt: "2026-03-21T10:02:00Z",
    result: { orderId: "ORD-12345", cost: 3500, balance: 9800 },
  },
  failed: {
    id: "act-005",
    type: "domain-purchase",
    params: { domain: "taken.io", cost: 2900 },
    status: "failed",
    requestedAt: "2026-03-21T10:00:00Z",
    confirmedAt: "2026-03-21T10:01:00Z",
    error: "Domain already registered by another party",
  },
  cancelled: {
    id: "act-006",
    type: "domain-purchase",
    params: { domain: "scratch.xyz", cost: 1500 },
    status: "cancelled",
    requestedAt: "2026-03-21T10:00:00Z",
  },
};

const renderHandoffTab = (project, selection) => {
  const initialState = createLumonState({
    projects: [project],
    selection: selection ?? { projectId: project.id },
  });

  render(<MissionControl initialState={initialState} />);

  // Navigate to handoff tab
  fireEvent.click(screen.getByRole("tab", { name: /^handoff$/i }));
};

describe("ExternalActionsPanel UI", () => {
  let origEventSource;

  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();

    // Mock EventSource globally — sync.js creates one per render.
    origEventSource = globalThis.EventSource;
    globalThis.EventSource = function MockEventSource() {
      this.addEventListener = vi.fn();
      this.close = vi.fn();
    };
  });

  afterEach(() => {
    globalThis.EventSource = origEventSource;
  });

  describe("visibility", () => {
    it("renders panel when project has external actions", () => {
      renderHandoffTab(
        createHandoffReadyProject({
          externalActions: { actions: [SAMPLE_ACTIONS.pending] },
        }),
      );

      expect(screen.getByTestId("external-actions-panel")).toBeInTheDocument();
    });

    it("does NOT render panel when project has no actions and no domain signals", () => {
      renderHandoffTab(createHandoffReadyProject());

      expect(screen.queryByTestId("external-actions-panel")).not.toBeInTheDocument();
    });

    it("does NOT render panel for early-stage projects with no actions", () => {
      renderHandoffTab(createEarlyStageProject());

      expect(screen.queryByTestId("external-actions-panel")).not.toBeInTheDocument();
    });
  });

  describe("pending action", () => {
    it("shows Confirm and Cancel buttons for pending action", () => {
      renderHandoffTab(
        createHandoffReadyProject({
          externalActions: { actions: [SAMPLE_ACTIONS.pending] },
        }),
      );

      const actionCard = screen.getByTestId("external-action-act-001");
      expect(actionCard).toBeInTheDocument();
      expect(within(actionCard).getByTestId("external-action-confirm-btn")).toBeInTheDocument();
      expect(within(actionCard).getByTestId("external-action-cancel-btn")).toBeInTheDocument();
      expect(within(actionCard).getByText("nexus.io")).toBeInTheDocument();
    });

    it("clicking Confirm calls confirmExternalAction with correct args", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      renderHandoffTab(
        createHandoffReadyProject({
          externalActions: { actions: [SAMPLE_ACTIONS.pending] },
        }),
      );

      fireEvent.click(screen.getByTestId("external-action-confirm-btn"));

      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/external-actions/confirm/act-001",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("ext-test"),
        }),
      );
    });

    it("clicking Cancel calls cancelExternalAction with correct args", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      renderHandoffTab(
        createHandoffReadyProject({
          externalActions: { actions: [SAMPLE_ACTIONS.pending] },
        }),
      );

      fireEvent.click(screen.getByTestId("external-action-cancel-btn"));

      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/external-actions/cancel/act-001",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("ext-test"),
        }),
      );
    });
  });

  describe("confirmed action", () => {
    it("shows Execute button for confirmed action", () => {
      renderHandoffTab(
        createHandoffReadyProject({
          externalActions: { actions: [SAMPLE_ACTIONS.confirmed] },
        }),
      );

      const actionCard = screen.getByTestId("external-action-act-002");
      expect(actionCard).toBeInTheDocument();
      expect(within(actionCard).getByTestId("external-action-execute-btn")).toBeInTheDocument();
      expect(within(actionCard).getByText("arcline.com")).toBeInTheDocument();
    });

    it("clicking Execute calls executeExternalAction with correct args", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      renderHandoffTab(
        createHandoffReadyProject({
          externalActions: { actions: [SAMPLE_ACTIONS.confirmed] },
        }),
      );

      fireEvent.click(screen.getByTestId("external-action-execute-btn"));

      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/external-actions/execute/act-002",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("ext-test"),
        }),
      );
    });
  });

  describe("executing action", () => {
    it("shows spinner and no action buttons for executing action", () => {
      renderHandoffTab(
        createHandoffReadyProject({
          externalActions: { actions: [SAMPLE_ACTIONS.executing] },
        }),
      );

      const actionCard = screen.getByTestId("external-action-act-003");
      expect(actionCard).toBeInTheDocument();
      expect(within(actionCard).getByText("zenith.dev")).toBeInTheDocument();
      // No action buttons should be present
      expect(within(actionCard).queryByTestId("external-action-confirm-btn")).not.toBeInTheDocument();
      expect(within(actionCard).queryByTestId("external-action-cancel-btn")).not.toBeInTheDocument();
      expect(within(actionCard).queryByTestId("external-action-execute-btn")).not.toBeInTheDocument();
    });
  });

  describe("completed action", () => {
    it("shows result details and no action buttons for completed action", () => {
      renderHandoffTab(
        createHandoffReadyProject({
          externalActions: { actions: [SAMPLE_ACTIONS.completed] },
        }),
      );

      const actionCard = screen.getByTestId("external-action-act-004");
      expect(actionCard).toBeInTheDocument();
      expect(within(actionCard).getByText("orbital.app")).toBeInTheDocument();
      // No action buttons
      expect(within(actionCard).queryByTestId("external-action-confirm-btn")).not.toBeInTheDocument();
      expect(within(actionCard).queryByTestId("external-action-execute-btn")).not.toBeInTheDocument();
      // Result details visible
      const resultArea = screen.getByTestId("external-action-act-004-result");
      expect(resultArea).toBeInTheDocument();
      expect(within(resultArea).getByText("ORD-12345")).toBeInTheDocument();
      expect(within(resultArea).getByText("$35.00")).toBeInTheDocument();
      expect(within(resultArea).getByText("$98.00")).toBeInTheDocument();
    });
  });

  describe("failed action", () => {
    it("shows error message for failed action", () => {
      renderHandoffTab(
        createHandoffReadyProject({
          externalActions: { actions: [SAMPLE_ACTIONS.failed] },
        }),
      );

      const actionCard = screen.getByTestId("external-action-act-005");
      expect(actionCard).toBeInTheDocument();
      expect(within(actionCard).getByText("taken.io")).toBeInTheDocument();
      // Error message visible
      const errorArea = screen.getByTestId("external-action-act-005-error");
      expect(errorArea).toBeInTheDocument();
      expect(errorArea).toHaveTextContent("Domain already registered by another party");
    });
  });

  describe("cancelled action", () => {
    it("shows cancelled badge for cancelled action", () => {
      renderHandoffTab(
        createHandoffReadyProject({
          externalActions: { actions: [SAMPLE_ACTIONS.cancelled] },
        }),
      );

      const actionCard = screen.getByTestId("external-action-act-006");
      expect(actionCard).toBeInTheDocument();
      expect(within(actionCard).getByText("scratch.xyz")).toBeInTheDocument();
      // No action buttons
      expect(within(actionCard).queryByTestId("external-action-confirm-btn")).not.toBeInTheDocument();
      expect(within(actionCard).queryByTestId("external-action-execute-btn")).not.toBeInTheDocument();
    });
  });

  describe("multiple actions", () => {
    it("renders all actions correctly when multiple exist", () => {
      renderHandoffTab(
        createHandoffReadyProject({
          externalActions: {
            actions: [
              SAMPLE_ACTIONS.pending,
              SAMPLE_ACTIONS.confirmed,
              SAMPLE_ACTIONS.completed,
            ],
          },
        }),
      );

      expect(screen.getByTestId("external-action-act-001")).toBeInTheDocument();
      expect(screen.getByTestId("external-action-act-002")).toBeInTheDocument();
      expect(screen.getByTestId("external-action-act-004")).toBeInTheDocument();
    });

    it("shows aggregate counts in panel header", () => {
      renderHandoffTab(
        createHandoffReadyProject({
          externalActions: {
            actions: [
              SAMPLE_ACTIONS.pending,
              SAMPLE_ACTIONS.confirmed,
              SAMPLE_ACTIONS.completed,
              SAMPLE_ACTIONS.failed,
            ],
          },
        }),
      );

      const panel = screen.getByTestId("external-actions-panel");
      expect(within(panel).getByText("1 pending")).toBeInTheDocument();
      expect(within(panel).getByText("1 confirmed")).toBeInTheDocument();
      expect(within(panel).getByText("1 completed")).toBeInTheDocument();
      expect(within(panel).getByText("1 failed")).toBeInTheDocument();
    });
  });

  describe("data-testid coverage", () => {
    it("all action cards have data-testid attributes", () => {
      renderHandoffTab(
        createHandoffReadyProject({
          externalActions: {
            actions: [
              SAMPLE_ACTIONS.pending,
              SAMPLE_ACTIONS.confirmed,
              SAMPLE_ACTIONS.executing,
              SAMPLE_ACTIONS.completed,
              SAMPLE_ACTIONS.failed,
              SAMPLE_ACTIONS.cancelled,
            ],
          },
        }),
      );

      expect(screen.getByTestId("external-actions-panel")).toBeInTheDocument();
      expect(screen.getByTestId("external-action-act-001")).toBeInTheDocument();
      expect(screen.getByTestId("external-action-act-002")).toBeInTheDocument();
      expect(screen.getByTestId("external-action-act-003")).toBeInTheDocument();
      expect(screen.getByTestId("external-action-act-004")).toBeInTheDocument();
      expect(screen.getByTestId("external-action-act-005")).toBeInTheDocument();
      expect(screen.getByTestId("external-action-act-006")).toBeInTheDocument();
    });

    it("pending action has confirm and cancel button testids", () => {
      renderHandoffTab(
        createHandoffReadyProject({
          externalActions: { actions: [SAMPLE_ACTIONS.pending] },
        }),
      );

      expect(screen.getByTestId("external-action-confirm-btn")).toBeInTheDocument();
      expect(screen.getByTestId("external-action-cancel-btn")).toBeInTheDocument();
    });

    it("confirmed action has execute button testid", () => {
      renderHandoffTab(
        createHandoffReadyProject({
          externalActions: { actions: [SAMPLE_ACTIONS.confirmed] },
        }),
      );

      expect(screen.getByTestId("external-action-execute-btn")).toBeInTheDocument();
    });
  });

  describe("status badge labels", () => {
    it("shows correct status labels for each state", () => {
      renderHandoffTab(
        createHandoffReadyProject({
          externalActions: {
            actions: [
              SAMPLE_ACTIONS.pending,
              SAMPLE_ACTIONS.confirmed,
              SAMPLE_ACTIONS.executing,
              SAMPLE_ACTIONS.completed,
              SAMPLE_ACTIONS.failed,
              SAMPLE_ACTIONS.cancelled,
            ],
          },
        }),
      );

      // Each action card should display its status label text
      expect(screen.getByText("Pending confirmation")).toBeInTheDocument();
      expect(screen.getByText("Confirmed")).toBeInTheDocument();
      expect(screen.getByText("Executing…")).toBeInTheDocument();
      expect(screen.getByText("Completed")).toBeInTheDocument();
      expect(screen.getByText("Failed")).toBeInTheDocument();
      expect(screen.getByText("Cancelled")).toBeInTheDocument();
    });
  });
});
