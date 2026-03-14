import { fireEvent, render, screen } from "@testing-library/react";
import MissionControl from "@/mission-control";
import { createSeedLumonState } from "@/lumon/seed";

describe("MissionControl shell integration", () => {
  it("keeps dashboard, severed floor, and orchestration surfaces synchronized through shared Lumon state", () => {
    const initialState = createSeedLumonState();
    render(<MissionControl initialState={initialState} />);

    expect(screen.getByText("MISSION CONTROL")).toBeInTheDocument();
    expect(screen.getByText("Twin Coast Labs · 14 projects · 14/33 agents active")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Select Policy Engine project/i }));
    fireEvent.click(screen.getByRole("button", { name: /Select Agent-06/i }));

    expect(screen.getByRole("heading", { name: /Policy Engine/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry agent/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Severed Floor/i }));

    expect(screen.getByTestId("severance-floor-selected-project")).toHaveTextContent("Policy Engine");
    expect(screen.getByTestId("severance-floor-selected-agent")).toHaveTextContent("Agent-06");
    expect(screen.getByTestId("severance-floor-selected-agent-status")).toHaveTextContent("BREAK ROOM");
    expect(screen.getByTestId("severance-floor-break-room-count")).toHaveTextContent("2");

    fireEvent.click(screen.getByRole("button", { name: /Select Agent-07 on Severance floor/i }));
    fireEvent.click(screen.getByRole("tab", { name: /Dashboard/i }));

    expect(screen.getByRole("heading", { name: /CRM AI/i })).toBeInTheDocument();
    expect(screen.getByText(/tmux:agent-07/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Select Policy Engine project/i }));
    fireEvent.click(screen.getByRole("button", { name: /Select Agent-06/i }));
    fireEvent.click(screen.getByRole("button", { name: /Retry agent/i }));

    expect(screen.getAllByText("running").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: /Severed Floor/i }));

    expect(screen.getByTestId("severance-floor-selected-project")).toHaveTextContent("Policy Engine");
    expect(screen.getByTestId("severance-floor-selected-agent")).toHaveTextContent("Agent-06");
    expect(screen.getByTestId("severance-floor-selected-agent-status")).toHaveTextContent("running");
    expect(screen.getByTestId("severance-floor-break-room-count")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("tab", { name: /Orchestration/i }));

    expect(screen.getByText(/Policy Engine — Phase 1 — Log Ingestion/i)).toBeInTheDocument();
    expect(screen.getByTestId("orchestration-current-stage-status")).toHaveTextContent("running");
    expect(screen.getByText(/Selected stage/i)).toBeInTheDocument();
  });
});
