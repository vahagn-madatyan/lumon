import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useLumonActions, useLumonSelector, useLumonState } from "@/lumon/context";
import { createProjectId } from "@/lumon/model";
import { selectFleetMetrics, selectFloorViewModel } from "@/lumon/selectors";
import SeveranceFloor from "@/severance-floor";
import { Clock, Shield } from "lucide-react";
import ArchitectureTab from "./ArchitectureTab";
import DashboardTab from "./DashboardTab";
import NewProjectModal from "./NewProjectModal";
import OrchestrationTab from "./OrchestrationTab";

const ENGINE_LABELS = {
  claude: "Claude Code",
  codex: "Codex CLI",
};

const DEFAULT_PROJECT_PHASE = "Phase 1 — Operator Intake";
const DEFAULT_PROJECT_DESCRIPTION = "Operator-created project awaiting mission assignment.";

const createProjectAgents = (projectId, name, engineChoice, agentCount) =>
  Array.from({ length: agentCount }, (_, index) => {
    const ordinal = String(index + 1).padStart(2, "0");

    return {
      id: `${projectId}:agent-${ordinal}`,
      name: `${name} Agent ${ordinal}`,
      type: engineChoice,
      planId: `${projectId}-${ordinal}`,
      task: "Awaiting operator dispatch",
      wave: 1,
      status: "queued",
      progress: 0,
      tokens: 0,
      costUsd: 0,
      elapsedLabel: "—",
    };
  });

const createProjectStages = (projectId, agentIds, engineLabel, agentCount) => [
  {
    id: `${projectId}:research`,
    kind: "research",
    label: "Research",
    description: `${engineLabel} intake staged for canonical registry review`,
    icon: "Search",
    status: "queued",
    durationLabel: "—",
    output: "Awaiting operator kickoff",
  },
  {
    id: `${projectId}:plan`,
    kind: "plan",
    label: "Plan",
    description: `Define the first execution wave for ${agentCount} ${engineLabel} agent${agentCount === 1 ? "" : "s"}`,
    icon: "FileText",
    status: "queued",
    durationLabel: "—",
    output: "Pending stage design",
  },
  {
    id: `${projectId}:wave-1`,
    kind: "wave",
    label: "Wave 1",
    description: `${agentCount} ${engineLabel} agent${agentCount === 1 ? "" : "s"} reserved for the opening wave`,
    icon: "Layers",
    status: "queued",
    durationLabel: "—",
    output: "Awaiting operator dispatch",
    agentIds,
  },
  {
    id: `${projectId}:test`,
    kind: "test",
    label: "Test Suite",
    description: "Run verification before operator handoff",
    icon: "CheckCircle2",
    status: "queued",
    durationLabel: "—",
    output: "Pending",
  },
  {
    id: `${projectId}:merge`,
    kind: "merge",
    label: "Merge & Deploy",
    description: "Operator approval and release handoff",
    icon: "GitBranch",
    status: "queued",
    durationLabel: "—",
    output: "Pending",
  },
];

function buildCanonicalProjectInput(draft, existingProjects) {
  const projectId = createProjectId(
    draft.name,
    existingProjects.map((project) => project.id),
  );
  const engineLabel = ENGINE_LABELS[draft.engineChoice] ?? ENGINE_LABELS.claude;
  const agents = createProjectAgents(projectId, draft.name, draft.engineChoice, draft.agentCount);

  return {
    id: projectId,
    name: draft.name,
    description: draft.description || `${engineLabel} project registry entry created from Mission Control.`,
    phaseLabel: DEFAULT_PROJECT_PHASE,
    engineChoice: draft.engineChoice,
    waves: {
      current: 1,
      total: 1,
    },
    agents,
    execution: {
      id: `engine:${projectId}`,
      label: `${draft.name} pipeline`,
      currentStageId: `${projectId}:research`,
      stages: createProjectStages(
        projectId,
        agents.map((agent) => agent.id),
        engineLabel,
        draft.agentCount,
      ),
    },
    meta: {
      source: "mission-control-shell",
      createdFrom: "new-project-modal",
      defaultDescription: draft.description ? null : DEFAULT_PROJECT_DESCRIPTION,
    },
  };
}

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
    addProject(buildCanonicalProjectInput(draft, state.projects));
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
