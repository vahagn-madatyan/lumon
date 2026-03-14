import MissionControlShell from "@/features/mission-control/MissionControlShell";
import { LumonProvider } from "@/lumon/context";

export default function MissionControl({ initialState }) {
  return (
    <LumonProvider initialState={initialState}>
      <MissionControlShell />
    </LumonProvider>
  );
}
