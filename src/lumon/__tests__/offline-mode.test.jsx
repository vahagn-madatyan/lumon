import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock the context hooks before importing components
const mockConnected = vi.fn(() => true);
const mockTriggerPipeline = vi.fn();
const mockApprovePipeline = vi.fn();

vi.mock("@/lumon/context", () => ({
  useServerSyncStatus: () => ({
    connected: mockConnected(),
    error: mockConnected() ? null : "Connection lost",
  }),
  useLumonActions: () => ({
    triggerPipeline: mockTriggerPipeline,
    approvePipeline: mockApprovePipeline,
    selectAgent: vi.fn(),
    selectProject: vi.fn(),
    selectStage: vi.fn(),
  }),
  useLumonSelector: () => null,
}));

vi.mock("@/lumon/useArtifact", () => ({
  useArtifact: () => ({
    artifact: {
      type: "architecture_outline",
      content: { systemOverview: "Cached architecture overview" },
    },
    loading: false,
    error: null,
  }),
}));

import { PipelineActions } from "@/features/mission-control/DashboardTab";

// --- Offline mode: PipelineActions ---

describe("PipelineActions — offline mode", () => {
  const queuedProject = {
    id: "proj-1",
    currentStage: {
      stageKey: "intake",
      status: "queued",
      label: "Intake",
      approval: { state: "not_required", required: false },
    },
  };

  const pendingApprovalProject = {
    id: "proj-2",
    currentStage: {
      stageKey: "research",
      status: "running",
      label: "Research",
      approval: { state: "pending", required: true },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnected.mockReturnValue(true);
  });

  it("shows offline banner when disconnected", () => {
    mockConnected.mockReturnValue(false);
    render(<PipelineActions project={queuedProject} />);
    expect(screen.getByTestId("pipeline-actions-offline")).toBeInTheDocument();
    expect(screen.getByText("Server offline — triggers disabled")).toBeInTheDocument();
  });

  it("trigger button is disabled when disconnected", () => {
    mockConnected.mockReturnValue(false);
    render(<PipelineActions project={queuedProject} />);
    const btn = screen.getByTestId("trigger-discovery-btn");
    expect(btn).toBeDisabled();
  });

  it("approve and reject buttons are disabled when disconnected", () => {
    mockConnected.mockReturnValue(false);
    render(<PipelineActions project={pendingApprovalProject} />);
    expect(screen.getByTestId("approve-btn")).toBeDisabled();
    expect(screen.getByTestId("reject-btn")).toBeDisabled();
  });

  it("buttons are enabled when connected", () => {
    mockConnected.mockReturnValue(true);
    render(<PipelineActions project={queuedProject} />);
    const btn = screen.getByTestId("trigger-discovery-btn");
    expect(btn).not.toBeDisabled();
    expect(screen.queryByTestId("pipeline-actions-offline")).not.toBeInTheDocument();
  });

  it("approve and reject buttons are enabled when connected", () => {
    mockConnected.mockReturnValue(true);
    render(<PipelineActions project={pendingApprovalProject} />);
    expect(screen.getByTestId("approve-btn")).not.toBeDisabled();
    expect(screen.getByTestId("reject-btn")).not.toBeDisabled();
  });

  it("triggers any queued stage, not just intake", () => {
    mockConnected.mockReturnValue(true);
    const verificationProject = {
      id: "proj-3",
      currentStage: {
        stageKey: "verification",
        status: "queued",
        label: "Verification",
        approval: { state: "not_required", required: false },
      },
    };
    render(<PipelineActions project={verificationProject} />);
    expect(screen.getByTestId("trigger-discovery-btn")).toBeInTheDocument();
    expect(screen.getByTestId("trigger-discovery-btn")).not.toBeDisabled();
  });
});

// --- Cached dossier rendering when offline ---

describe("Cached dossier rendering when offline", () => {
  it("ArtifactRenderer renders cached architecture content even when disconnected", async () => {
    // useArtifact is mocked to return cached data regardless of connection state
    // Import ArtifactRenderer directly — it doesn't depend on connection status
    const { default: ArtifactRenderer } = await import("@/features/mission-control/ArtifactRenderer");

    mockConnected.mockReturnValue(false);
    render(
      <ArtifactRenderer
        artifact={{
          type: "architecture_outline",
          content: { systemOverview: "Cached architecture overview" },
        }}
      />,
    );

    expect(screen.getByTestId("architecture-renderer")).toBeInTheDocument();
    expect(screen.getByText("Cached architecture overview")).toBeInTheDocument();
  });
});
