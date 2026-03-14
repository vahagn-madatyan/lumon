import MissionControlShell from "@/features/mission-control/MissionControlShell";
import { LumonProvider } from "@/lumon/context";

export default function MissionControl({ initialState, persistence }) {
  return (
    <LumonProvider initialState={initialState} persistence={persistence}>
      <MissionControlShell />
    </LumonProvider>
  );
}
