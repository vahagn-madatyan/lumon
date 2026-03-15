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
  ArrowRight,
  CheckCircle2,
  Clock3,
  DollarSign,
  GitBranch,
  Hash,
  Plus,
  Server,
  ShieldAlert,
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
  running: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  complete: "bg-green-500/15 text-green-300 border-green-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
  queued: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

const PIPELINE_CLASSES = {
  queued: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  running: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  waiting: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  blocked: "bg-red-500/15 text-red-300 border-red-500/30",
  needs_iteration: "bg-red-500/15 text-red-300 border-red-500/30",
  handoff_ready: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  complete: "bg-green-500/15 text-green-300 border-green-500/30",
};

const APPROVAL_CLASSES = {
  not_required: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  pending: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  approved: "bg-green-500/10 text-green-300 border-green-500/20",
  rejected: "bg-red-500/10 text-red-300 border-red-500/20",
  needs_iteration: "bg-red-500/10 text-red-300 border-red-500/20",
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

function PipelineBadge({ status, label, testId }) {
  return (
    <Badge
      data-testid={testId}
      variant="outline"
      className={`font-mono text-[10px] font-bold tracking-[0.12em] uppercase ${PIPELINE_CLASSES[status] ?? PIPELINE_CLASSES.queued}`}
    >
      {label}
    </Badge>
  );
}

function ApprovalBadge({ approval, testId }) {
  return (
    <Badge
      data-testid={testId}
      variant="outline"
      className={`font-mono text-[9px] font-semibold tracking-[0.08em] uppercase ${APPROVAL_CLASSES[approval?.state] ?? APPROVAL_CLASSES.not_required}`}
    >
      {approval?.stateLabel ?? "Auto advance"}
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

function StagePill({ stage, onSelectStage, testId }) {
  return (
    <button
      type="button"
      onClick={() => onSelectStage(stage.id)}
      data-testid={testId}
      className={`rounded-xl border px-3 py-2 text-left transition-colors ${
        stage.isSelected
          ? "border-cyan-400/40 bg-cyan-500/10"
          : stage.isCurrent
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-200">
          {stage.label}
        </span>
        <Badge
          variant="outline"
          className={`font-mono text-[8px] font-bold uppercase tracking-[0.08em] ${PIPELINE_CLASSES[stage.stateTone] ?? PIPELINE_CLASSES.queued}`}
        >
          {stage.isCurrent ? "current" : stage.status}
        </Badge>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[9px] font-mono text-zinc-500">
        <span>{stage.approval.label}</span>
        <span>•</span>
        <span>{stage.approval.stateLabel}</span>
      </div>
    </button>
  );
}

function PipelineSnapshot({ project, onSelectStage, currentOnly = false, prefix = "dashboard-project" }) {
  const stages = currentOnly ? project.stageTimeline.filter((stage) => stage.isCurrent) : project.stageTimeline;

  return (
    <div
      className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"
      data-testid={`${prefix}-pipeline-${project.id}`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Pipeline board</div>
            <PipelineBadge
              status={project.pipeline.status}
              label={project.pipeline.label}
              testId={`${prefix}-pipeline-status-${project.id}`}
            />
          </div>
          <div
            className="font-mono text-[11px] text-zinc-300 leading-relaxed"
            data-testid={`${prefix}-pipeline-summary-${project.id}`}
          >
            {project.pipeline.summary}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 text-[10px] font-mono sm:grid-cols-3 lg:w-[420px]">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-2">
            <div className="uppercase tracking-[0.08em] text-zinc-600">Current stage</div>
            <div className="mt-1 text-zinc-200 font-semibold" data-testid={`${prefix}-current-stage-${project.id}`}>
              {project.pipeline.currentStageLabel}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-2">
            <div className="uppercase tracking-[0.08em] text-zinc-600">Current gate</div>
            <div className="mt-1 text-zinc-200 font-semibold" data-testid={`${prefix}-current-gate-${project.id}`}>
              {project.pipeline.currentGateLabel}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-2">
            <div className="uppercase tracking-[0.08em] text-zinc-600">Approval state</div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <ApprovalBadge
                approval={project.currentGate}
                testId={`${prefix}-approval-state-${project.id}`}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {stages.map((stage) => (
          <StagePill
            key={stage.id}
            stage={stage}
            onSelectStage={onSelectStage}
            testId={`${prefix}-stage-${project.id}-${stage.stageKey}`}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[9px] font-mono uppercase tracking-[0.08em] text-zinc-500">
        <span>{project.pipeline.completedCount}/{project.pipeline.totalCount} cleared</span>
        <span>{project.pipeline.progressPercent}% progress</span>
        <span>{project.metrics.running} agents running</span>
        {project.handoffReady && <span className="text-cyan-300">Ready for handoff</span>}
      </div>
      {project.currentGate?.note && (
        <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 font-mono text-[10px] text-amber-200">
          {project.currentGate.note}
        </div>
      )}
    </div>
  );
}

function AgentRoster({ project, onSelectAgent }) {
  if (!project?.agents?.length) {
    return null;
  }

  return (
    <Card className="bg-zinc-900/60 border-zinc-800">
      <CardContent className="p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Secondary detail</div>
            <div className="mt-1 font-mono text-sm font-bold text-zinc-200">Agent roster</div>
          </div>
          <div className="flex gap-2 text-[9px] font-mono uppercase tracking-[0.08em] text-zinc-500">
            <span>{project.metrics.running} running</span>
            <span>{project.metrics.queued} queued</span>
            <span>{project.metrics.complete} complete</span>
            <span>{project.metrics.failed} failed</span>
          </div>
        </div>

        <div className="grid gap-2 lg:grid-cols-2">
          {project.agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => onSelectAgent(agent.id)}
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
                  className={`h-full rounded-full ${
                    agent.status === "failed"
                      ? "bg-red-500"
                      : agent.status === "complete"
                        ? "bg-green-500"
                        : "bg-emerald-400"
                  }`}
                  style={{ width: `${agent.progress}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SelectedProjectHeader({ project }) {
  const readinessIcon = project.pipeline.blocked
    ? ShieldAlert
    : project.handoffReady
      ? GitBranch
      : project.pipeline.complete
        ? CheckCircle2
        : Clock3;
  const ReadinessIcon = readinessIcon;

  return (
    <Card className="bg-zinc-900/60 border-zinc-800">
      <CardContent className="p-3.5 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="font-mono text-sm font-bold text-zinc-200">{project.name}</h2>
            <PipelineBadge status={project.pipeline.status} label={project.pipeline.label} testId="selected-project-pipeline-status" />
            <EngineBadge engineLabel={project.engineLabel} testId="selected-project-engine" />
          </div>
          <div className="font-mono text-[11px] text-zinc-500">
            {project.phaseLabel} · {project.waveLabel}
          </div>
          <div className="font-mono text-[11px] text-zinc-400 max-w-3xl">{project.description}</div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-300">
            <ReadinessIcon size={12} className="text-cyan-300" />
            <span data-testid="selected-project-pipeline-summary">{project.pipeline.summary}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono xl:w-[420px]">
          {[
            { label: "Current stage", value: project.pipeline.currentStageLabel, testId: "selected-project-current-stage" },
            { label: "Current gate", value: project.pipeline.currentGateLabel, testId: "selected-project-current-gate" },
            { label: "Approval", value: project.currentGate?.stateLabel ?? "Auto advance", testId: "selected-project-current-approval" },
            { label: "Progress", value: `${project.pipeline.completedCount}/${project.pipeline.totalCount} cleared`, testId: "selected-project-progress" },
          ].map((metric) => (
            <div key={metric.label} className="rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-2">
              <div className="uppercase tracking-[0.08em] text-zinc-600">{metric.label}</div>
              <div className="mt-1 text-zinc-200 font-semibold" data-testid={metric.testId}>
                {metric.value}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardTab({ onOpenNewProject }) {
  const dashboardCards = useLumonSelector(selectDashboardCards);
  const projects = useLumonSelector(selectDashboardProjects);
  const selectedAgent = useLumonSelector(selectSelectedAgentDetail);
  const selectedProject = useLumonSelector(selectSelectedProjectDetail);
  const { selectAgent, selectProject, selectStage } = useLumonActions();
  const hasProjects = projects.length > 0;

  return (
    <div className="flex h-full">
      <ScrollArea className="w-[460px] border-r border-zinc-800">
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
                  <CardContent className="p-3.5 space-y-3">
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
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <PipelineBadge
                            status={project.pipeline.status}
                            label={project.pipeline.label}
                            testId={`dashboard-project-badge-${project.id}`}
                          />
                          <Badge variant="secondary" className="bg-zinc-800 text-zinc-500 text-[9px] border-none font-mono">
                            {project.agentCount} agent{project.agentCount === 1 ? "" : "s"}
                          </Badge>
                        </div>
                      </div>
                    </button>

                    <div className="font-mono text-[11px] text-zinc-400 leading-relaxed">{project.description}</div>
                    <PipelineSnapshot project={project} onSelectStage={selectStage} prefix="dashboard-project" />
                    <div className="flex items-center justify-between gap-3 text-[9px] font-mono uppercase tracking-[0.08em] text-zinc-500">
                      <div className="flex gap-2">
                        <span>{project.metrics.running} running</span>
                        <span>{project.metrics.queued} queued</span>
                        <span>{project.metrics.complete} complete</span>
                        <span>{project.metrics.failed} failed</span>
                      </div>
                      <div className="flex items-center gap-1 text-zinc-400">
                        <ArrowRight size={10} />
                        Agent detail stays secondary
                      </div>
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
          <>
            <SelectedProjectHeader project={selectedProject} />
            <PipelineSnapshot project={selectedProject} onSelectStage={selectStage} prefix="selected-project" />
            <AgentRoster project={selectedProject} onSelectAgent={selectAgent} />
          </>
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
