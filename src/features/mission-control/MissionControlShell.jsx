import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useLumonActions, useLumonSelector, useLumonState } from "@/lumon/context";
import { createProjectSpawnInput } from "@/lumon/model";
import { selectFleetMetrics, selectFloorViewModel } from "@/lumon/selectors";
import SeveranceFloor from "@/severance-floor";
import { Clock, Shield } from "lucide-react";
import ArchitectureTab from "./ArchitectureTab";
import DashboardTab from "./DashboardTab";
import NewProjectModal from "./NewProjectModal";
import OrchestrationTab from "./OrchestrationTab";

export default function MissionControlShell() {
  const state = useLumonState();
  const metrics = useLumonSelector(selectFleetMetrics);
  const floor = useLumonSelector(selectFloorViewModel);
  const { addProject, selectAgent, selectProject } = useLumonActions();
  const [showNewProject, setShowNewProject] = useState(false);
  const [time, setTime] = useState(() => new Date());
  const projectCount = state.projects.length;
  const registryBadgeLabel = useMemo(
    () => (projectCount === 0 ? "REGISTRY EMPTY" : `${projectCount} PROJECT${projectCount === 1 ? "" : "S"}`),
    [projectCount],
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const handleCreateProject = (draft) => {
    addProject(createProjectSpawnInput(draft, state.projects));
    setShowNewProject(false);
    return true;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-mono">
      <Tabs defaultValue="dashboard" className="flex flex-col h-screen">
        <div className="flex items-center justify-between gap-4 px-5 py-2.5 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center text-sm font-extrabold text-zinc-950 shrink-0">
              MC
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-[0.12em] text-zinc-200">MISSION CONTROL</div>
              <div className="text-[10px] text-zinc-500 tracking-wide truncate">
                Twin Coast Labs · {orchestratedSummary(floor.summary.departmentCount, metrics)}
              </div>
            </div>
          </div>

          <TabsList className="bg-zinc-800/60 border border-zinc-700/50">
            <TabsTrigger value="dashboard" className="font-mono text-[11px] font-semibold tracking-wide data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 text-zinc-500">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="orchestration" className="font-mono text-[11px] font-semibold tracking-wide data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 text-zinc-500">
              Orchestration
            </TabsTrigger>
            <TabsTrigger value="architecture" className="font-mono text-[11px] font-semibold tracking-wide data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 text-zinc-500">
              Architecture
            </TabsTrigger>
            <TabsTrigger value="severed-floor" className="font-mono text-[11px] font-semibold tracking-wide data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 text-zinc-500">
              Severed Floor
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3 shrink-0">
            <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 font-mono text-[10px] font-semibold">
              {registryBadgeLabel}
            </Badge>
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-mono text-[10px] font-semibold">
              <Shield size={10} className="mr-1.5" />
              TAILSCALE
            </Badge>
            <span className="font-mono text-[12px] text-zinc-500 tabular-nums">
              <Clock size={12} className="inline mr-1.5 opacity-50" />
              {time.toLocaleTimeString("en-US", { hour12: false })}
            </span>
          </div>
        </div>

        <TabsContent value="dashboard" className="flex-1 m-0 overflow-hidden">
          <DashboardTab onOpenNewProject={() => setShowNewProject(true)} />
        </TabsContent>

        <TabsContent value="orchestration" className="flex-1 overflow-hidden m-0">
          <OrchestrationTab onOpenNewProject={() => setShowNewProject(true)} />
        </TabsContent>

        <TabsContent value="architecture" className="flex-1 overflow-auto m-0">
          <ArchitectureTab />
        </TabsContent>

        <TabsContent value="severed-floor" className="flex-1 overflow-hidden m-0">
          <SeveranceFloor
            floor={floor}
            onSelectAgent={selectAgent}
            onSelectProject={selectProject}
          />
        </TabsContent>
      </Tabs>

      <NewProjectModal
        open={showNewProject}
        onClose={() => setShowNewProject(false)}
        onSubmit={handleCreateProject}
      />
    </div>
  );
}

function orchestratedSummary(projectCount, metrics) {
  if (projectCount === 0) {
    return "registry empty · spawn the first project";
  }

  return `${projectCount} projects · ${metrics.active}/${metrics.total} agents active`;
}
