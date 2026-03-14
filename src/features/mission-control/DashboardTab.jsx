import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLumonActions, useLumonSelector } from "@/lumon/context";
import {
  selectDashboardCards,
  selectDashboardProjects,
  selectSelectedAgentDetail,
  selectSelectedProjectDetail,
} from "@/lumon/selectors";
import {
  Activity,
  DollarSign,
  Hash,
  Plus,
  Server,
  Zap,
} from "lucide-react";
import TerminalPanel from "./TerminalPanel";

const CARD_ICONS = {
  active: Activity,
  total: Hash,
  cost: DollarSign,
  tokens: Zap,
};

const TONE_CLASSES = {
  success: "text-emerald-400",
  info: "text-blue-400",
  warning: "text-amber-400",
  accent: "text-purple-400",
};

const STATUS_CLASSES = {
  running: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  complete: "bg-green-500/15 text-green-400 border-green-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
  queued: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

function StatusBadge({ status }) {
  return (
    <Badge
      variant="outline"
      className={`font-mono text-[10px] font-bold tracking-widest uppercase ${STATUS_CLASSES[status] ?? STATUS_CLASSES.queued}`}
    >
      {status}
    </Badge>
  );
}

function EngineBadge({ engineLabel, className = "", testId }) {
  return (
    <Badge
      data-testid={testId}
      variant="secondary"
      className={`bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[9px] font-mono uppercase tracking-[0.08em] ${className}`}
    >
      {engineLabel}
    </Badge>
  );
}

function MetricCard({ card }) {
  const Icon = CARD_ICONS[card.id] ?? Activity;
  const toneClass = TONE_CLASSES[card.tone] ?? "text-zinc-300";

  return (
    <Card className="bg-zinc-900/60 border-zinc-800">
      <CardContent className="p-2.5 text-center">
        <Icon size={12} className={`mx-auto mb-1 opacity-60 ${toneClass}`} />
        <div className={`text-lg font-bold ${toneClass}`}>{card.value}</div>
        <div className="text-[9px] text-zinc-500 tracking-[0.08em] uppercase">{card.label}</div>
      </CardContent>
    </Card>
  );
}

function EmptyRegistryNotice({ onOpenNewProject }) {
  return (
    <Card className="bg-zinc-900/60 border-dashed border-zinc-700" data-testid="dashboard-empty-registry">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-amber-300">
          <Server size={14} />
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">Registry empty</div>
        </div>
        <div className="font-mono text-[11px] text-zinc-400 leading-relaxed">
          No canonical projects are registered yet. Spawn the first project to bring the dashboard, orchestration canvas, and severed floor online.
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onOpenNewProject}
          className="font-mono text-[11px] font-semibold bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
        >
          <Plus size={12} className="mr-2" />
          Spawn new project
        </Button>
      </CardContent>
    </Card>
  );
}

export default function DashboardTab({ onOpenNewProject }) {
  const dashboardCards = useLumonSelector(selectDashboardCards);
  const projects = useLumonSelector(selectDashboardProjects);
  const selectedAgent = useLumonSelector(selectSelectedAgentDetail);
  const selectedProject = useLumonSelector(selectSelectedProjectDetail);
  const { selectAgent, selectProject } = useLumonActions();
  const hasProjects = projects.length > 0;

  return (
    <div className="flex h-full">
      <ScrollArea className="w-[420px] border-r border-zinc-800">
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {dashboardCards.map((card) => (
              <MetricCard key={card.id} card={card} />
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={onOpenNewProject}
            className="w-full border-dashed border-emerald-500/25 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40 font-mono text-[11px] font-semibold tracking-[0.08em]"
          >
            <Plus size={14} className="mr-2" />
            Spawn new project
          </Button>

          {!hasProjects ? (
            <EmptyRegistryNotice onOpenNewProject={onOpenNewProject} />
          ) : (
            <div className="space-y-3">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className={`border transition-colors ${
                    project.isSelected
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "bg-zinc-900/60 border-zinc-800"
                  }`}
                >
                  <CardContent className="p-3.5">
                    <button
                      type="button"
                      onClick={() => selectProject(project.id)}
                      className="w-full text-left"
                      aria-label={`Select ${project.name} project`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-mono text-[13px] font-bold text-zinc-200">{project.name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] text-zinc-500">
                            <span>{project.phaseLabel}</span>
                            <span>•</span>
                            <span>{project.waveLabel}</span>
                            <EngineBadge
                              engineLabel={project.engineLabel}
                              testId={`dashboard-project-engine-${project.id}`}
                              className="ml-1"
                            />
                          </div>
                          <div className="mt-2 font-mono text-[11px] text-zinc-400 leading-relaxed">
                            {project.description}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <StatusBadge status={project.status} />
                          <Badge variant="secondary" className="bg-zinc-800 text-zinc-500 text-[9px] border-none font-mono">
                            {project.agentCount} agent{project.agentCount === 1 ? "" : "s"}
                          </Badge>
                        </div>
                      </div>
                    </button>

                    <div className="mt-3 flex gap-2 text-[9px] font-mono uppercase tracking-[0.08em] text-zinc-500">
                      <span>{project.metrics.running} running</span>
                      <span>{project.metrics.queued} queued</span>
                      <span>{project.metrics.complete} complete</span>
                      <span>{project.metrics.failed} failed</span>
                    </div>

                    <div className="mt-3 flex flex-col gap-1.5">
                      {project.agents.map((agent) => (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => selectAgent(agent.id)}
                          aria-label={`Select ${agent.name}`}
                          className={`rounded-lg border px-3 py-2 text-left transition-all ${
                            agent.isSelected
                              ? "border-emerald-500/40 bg-emerald-500/5"
                              : "border-zinc-800 bg-zinc-950/70 hover:border-zinc-700"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-mono text-[11px] font-semibold text-zinc-200">{agent.name}</div>
                              <div className="mt-1 font-mono text-[10px] text-zinc-500">
                                {agent.modelLabel} · {agent.planId} · Wave {agent.wave}
                              </div>
                            </div>
                            <StatusBadge status={agent.status} />
                          </div>
                          <div className="mt-2 font-mono text-[11px] text-zinc-400 leading-relaxed">
                            {agent.task}
                          </div>
                          <div className="mt-2 h-[3px] rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${agent.status === "failed" ? "bg-red-500" : agent.status === "complete" ? "bg-green-500" : "bg-emerald-400"}`}
                              style={{ width: `${agent.progress}%` }}
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="flex-1 p-4 flex flex-col min-h-0 gap-3">
        {selectedProject ? (
          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardContent className="p-3.5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="font-mono text-sm font-bold text-zinc-200">{selectedProject.name}</h2>
                  <StatusBadge status={selectedProject.status} />
                  <EngineBadge engineLabel={selectedProject.engineLabel} testId="selected-project-engine" />
                </div>
                <div className="mt-1 font-mono text-[11px] text-zinc-500">
                  {selectedProject.phaseLabel} · {selectedProject.waveLabel}
                </div>
                <div className="mt-2 font-mono text-[11px] text-zinc-400 max-w-2xl">
                  {selectedProject.description}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-[10px] font-mono">
                {[
                  { label: "Running", value: selectedProject.metrics.running },
                  { label: "Queued", value: selectedProject.metrics.queued },
                  { label: "Complete", value: selectedProject.metrics.complete },
                  { label: "Failed", value: selectedProject.metrics.failed },
                ].map((metric) => (
                  <div key={metric.label} className="rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-2">
                    <div className="uppercase tracking-[0.08em] text-zinc-600">{metric.label}</div>
                    <div className="mt-1 text-zinc-200 font-semibold">{metric.value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-zinc-900/60 border-dashed border-zinc-700" data-testid="dashboard-no-selected-project">
            <CardContent className="p-4 space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Project detail</div>
              <div className="font-mono text-sm font-bold text-zinc-200">Create the first registry project</div>
              <div className="font-mono text-[11px] text-zinc-400 leading-relaxed max-w-2xl">
                This restored state contains no selected project. Spawn a canonical project to light up the detail pane and downstream orchestration surfaces.
              </div>
              <Button
                type="button"
                size="sm"
                onClick={onOpenNewProject}
                className="w-fit font-mono text-[11px] font-semibold bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
              >
                <Plus size={12} className="mr-2" />
                Spawn new project
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex-1 min-h-0">
          <TerminalPanel
            key={`${selectedAgent?.id ?? "no-agent"}:${selectedAgent?.status ?? "idle"}`}
            agent={selectedAgent}
          />
        </div>
      </div>
    </div>
  );
}
