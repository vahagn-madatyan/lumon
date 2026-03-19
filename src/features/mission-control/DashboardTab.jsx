import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLumonActions, useLumonSelector, useServerSyncStatus } from "@/lumon/context";
import {
  selectDashboardCards,
  selectDashboardProjects,
  selectSelectedAgentDetail,
  selectSelectedProjectDetail,
} from "@/lumon/selectors";
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  DollarSign,
  GitBranch,
  Hash,
  Loader2,
  Play,
  Plus,
  Server,
  ShieldAlert,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import TerminalPanel from "./TerminalPanel";
import ArtifactRenderer from "./ArtifactRenderer";
import { useArtifact } from "@/lumon/useArtifact";

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

const DETAIL_STATE_CLASSES = {
  ready: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  waiting: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  blocked: "bg-red-500/15 text-red-300 border-red-500/30",
  missing: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

const DETAIL_STATE_LABELS = {
  ready: "Ready",
  waiting: "Waiting",
  blocked: "Blocked",
  missing: "Missing",
};

function toTestIdSegment(value) {
  const normalized = String(value ?? "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "unknown";
}

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

function DetailStateBadge({ state, testId }) {
  return (
    <Badge
      data-testid={testId}
      variant="outline"
      className={`font-mono text-[9px] font-semibold tracking-[0.08em] uppercase ${DETAIL_STATE_CLASSES[state] ?? DETAIL_STATE_CLASSES.missing}`}
    >
      {DETAIL_STATE_LABELS[state] ?? state ?? "Unknown"}
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

function DossierBriefCard({ brief }) {
  return (
    <Card className="bg-zinc-900/60 border-zinc-800" data-testid="selected-project-dossier-brief">
      <CardContent className="p-3.5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Dossier</div>
            <div className="mt-1 font-mono text-sm font-bold text-zinc-200">{brief.label}</div>
            <div className="mt-1 font-mono text-[10px] text-zinc-500 max-w-2xl">{brief.description}</div>
          </div>
          <DetailStateBadge state={brief.state} testId="selected-project-dossier-brief-state" />
        </div>

        <div
          className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 font-mono text-[11px] text-zinc-300"
          data-testid="selected-project-dossier-brief-summary"
        >
          {brief.summary}
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {brief.fields.map((field) => (
            <div
              key={field.id}
              className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2"
              data-testid={`selected-project-dossier-brief-field-${field.id}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-zinc-500">{field.label}</div>
                {field.missing && (
                  <Badge variant="outline" className="border-zinc-700 text-zinc-300 font-mono text-[8px] uppercase tracking-[0.08em]">
                    Missing
                  </Badge>
                )}
              </div>
              <div className={`mt-2 font-mono text-[11px] leading-relaxed ${field.missing ? "text-amber-200" : "text-zinc-200"}`}>
                {field.value ?? field.reason}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DossierCurrentApprovalCard({ section }) {
  return (
    <Card className="bg-zinc-900/60 border-zinc-800" data-testid="selected-project-dossier-current-approval">
      <CardContent className="p-3.5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Approval</div>
            <div className="mt-1 font-mono text-sm font-bold text-zinc-200">{section.label}</div>
            <div className="mt-1 font-mono text-[10px] text-zinc-500 max-w-2xl">{section.description}</div>
          </div>
          <DetailStateBadge state={section.state} testId="selected-project-dossier-current-approval-state" />
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-zinc-500">Stage</div>
            <div className="mt-1 font-mono text-[11px] text-zinc-200">{section.stageLabel ?? "No active stage"}</div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-zinc-500">Gate</div>
            <div className="mt-1 font-mono text-[11px] text-zinc-200">{section.gateLabel ?? "No active gate"}</div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-zinc-500">Approval state</div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <ApprovalBadge approval={section.approval} testId="selected-project-dossier-current-approval-badge" />
            </div>
          </div>
        </div>

        <div
          className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 font-mono text-[11px] text-zinc-300"
          data-testid="selected-project-dossier-current-approval-summary"
        >
          {section.summary}
        </div>
        <div className="font-mono text-[10px] text-zinc-500" data-testid="selected-project-dossier-current-approval-reason">
          {section.reason}
        </div>
        {section.approval?.note && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 font-mono text-[10px] text-amber-200">
            {section.approval.note}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ArtifactDetailPanel({ artifactId, testId, onAction }) {
  const { artifact, loading, error } = useArtifact(artifactId);

  if (loading) {
    return (
      <div
        className="animate-pulse space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2"
        data-testid={`${testId}-loading`}
      >
        <div className="h-3 w-2/3 rounded bg-zinc-800" />
        <div className="h-3 w-1/2 rounded bg-zinc-800" />
        <div className="h-3 w-3/4 rounded bg-zinc-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 font-mono text-[10px] text-red-300"
        data-testid={`${testId}-error`}
      >
        Failed to load artifact: {error}
      </div>
    );
  }

  if (!artifact) return null;

  return (
    <div data-testid={testId}>
      <ArtifactRenderer artifact={artifact} onAction={onAction} />
    </div>
  );
}

function DossierStageOutputCard({ section, projectId }) {
  const { triggerPipeline } = useLumonActions();
  const baseTestId = `selected-project-dossier-stage-${section.stageKey}`;
  const hasMultipleArtifacts = section.artifactIds?.length > 1;

  const onAction = (action) => {
    if (action?.type === "select-name" && action.selectedName && projectId) {
      triggerPipeline(projectId, "plan", {
        subStage: "domain_signals",
        context: { selectedName: action.selectedName },
      });
    }
  };

  return (
    <Card className="bg-zinc-900/60 border-zinc-800" data-testid={baseTestId}>
      <CardContent className="p-3.5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Stage output</div>
            <div className="mt-1 font-mono text-sm font-bold text-zinc-200">{section.label}</div>
            <div className="mt-1 font-mono text-[10px] text-zinc-500">{section.description}</div>
          </div>
          <DetailStateBadge state={section.state} testId={`${baseTestId}-state`} />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`font-mono text-[9px] font-semibold uppercase tracking-[0.08em] ${PIPELINE_CLASSES[section.stateTone] ?? PIPELINE_CLASSES.queued}`}>
            {section.isCurrent ? "current" : section.status}
          </Badge>
          <ApprovalBadge approval={section.approval} testId={`${baseTestId}-approval`} />
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 border-none font-mono text-[9px] uppercase tracking-[0.08em]">
            {section.durationLabel}
          </Badge>
          {hasMultipleArtifacts && (
            <Badge variant="secondary" className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono text-[9px] uppercase tracking-[0.08em]">
              {section.artifactIds.length} artifacts
            </Badge>
          )}
        </div>

        {/* Summary text renders immediately */}
        <div
          className={`rounded-lg border px-3 py-2 font-mono text-[11px] leading-relaxed ${
            section.outputMissing
              ? "border-amber-500/20 bg-amber-500/5 text-amber-100"
              : "border-zinc-800 bg-zinc-950/70 text-zinc-300"
          }`}
          data-testid={`${baseTestId}-summary`}
        >
          {section.hasArtifact ? section.outputSummary : (section.output ?? section.reason)}
        </div>

        {/* Full artifact content loads progressively */}
        {section.hasArtifact && !hasMultipleArtifacts && (
          <ArtifactDetailPanel
            artifactId={section.artifactId}
            testId={`${baseTestId}-artifact`}
            onAction={onAction}
          />
        )}

        {/* Multi-artifact: render each in its own panel */}
        {hasMultipleArtifacts && section.artifactIds.map((id, index) => (
          <ArtifactDetailPanel
            key={id}
            artifactId={id}
            testId={`${baseTestId}-artifact-${index}`}
            onAction={onAction}
          />
        ))}

        <div className="font-mono text-[10px] text-zinc-500" data-testid={`${baseTestId}-reason`}>
          {section.reason}
        </div>
      </CardContent>
    </Card>
  );
}

function DossierPanel({ project }) {
  return (
    <ScrollArea className="max-h-[52vh] rounded-xl border border-zinc-800 bg-zinc-950/30" data-testid="selected-project-dossier-panel">
      <div className="p-3.5 space-y-3">
        <DossierBriefCard brief={project.dossier.brief} />
        <DossierCurrentApprovalCard section={project.currentApprovalSummary} />

        <div className="space-y-2">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Stage ledger</div>
            <div className="mt-1 font-mono text-sm font-bold text-zinc-200">Per-stage outputs</div>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {project.dossier.stageOutputs.map((section) => (
              <DossierStageOutputCard key={section.id} section={section} projectId={project.id} />
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function HandoffSectionCard({ section }) {
  const testIdSegment = toTestIdSegment(section.id);
  const baseTestId = `selected-project-handoff-section-${testIdSegment}`;
  const showReason = section.reason && section.reason !== section.summary;

  return (
    <Card className="bg-zinc-900/60 border-zinc-800" data-testid={baseTestId}>
      <CardContent className="p-3.5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Packet section</div>
            <div className="mt-1 font-mono text-sm font-bold text-zinc-200">{section.label}</div>
            <div className="mt-1 font-mono text-[10px] text-zinc-500 max-w-xl">{section.description}</div>
          </div>
          <DetailStateBadge state={section.state} testId={`${baseTestId}-state`} />
        </div>

        <div
          className={`rounded-lg border px-3 py-2 font-mono text-[11px] leading-relaxed ${
            section.state === "blocked"
              ? "border-red-500/20 bg-red-500/5 text-red-100"
              : section.state === "waiting"
                ? "border-amber-500/20 bg-amber-500/5 text-amber-100"
                : section.state === "missing"
                  ? "border-zinc-700 bg-zinc-950/70 text-zinc-300"
                  : "border-emerald-500/20 bg-emerald-500/5 text-emerald-100"
          }`}
          data-testid={`${baseTestId}-summary`}
        >
          {section.summary}
        </div>

        {showReason && (
          <div className="font-mono text-[10px] text-zinc-500" data-testid={`${baseTestId}-reason`}>
            {section.reason}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap text-[9px] font-mono uppercase tracking-[0.08em] text-zinc-500">
          {section.gateLabel && <span>{section.gateLabel}</span>}
          {section.approval && <ApprovalBadge approval={section.approval} testId={`${baseTestId}-approval`} />}
          {section.sourceStageKeys?.length > 0 && (
            <span data-testid={`${baseTestId}-sources`}>Sources: {section.sourceStageKeys.join(", ")}</span>
          )}
        </div>

        {section.evidence?.length > 0 && (
          <div className="grid gap-2">
            {section.evidence.map((evidence) => (
              <div
                key={`${section.id}:${evidence.stageKey}`}
                className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2"
                data-testid={`${baseTestId}-evidence-${evidence.stageKey}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-[10px] font-semibold text-zinc-200">{evidence.stageLabel}</div>
                    <div className="mt-1 font-mono text-[10px] text-zinc-500">{evidence.reason}</div>
                  </div>
                  <DetailStateBadge state={evidence.state} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const PROVISIONING_STEP_LABELS = {
  "repo-create": "Create GitHub repository",
  "clone": "Clone repository",
  "artifact-write": "Write artifact files",
  "gsd-init": "Initialize GSD structure",
  "commit-push": "Commit and push",
};

const ENGINE_LABELS = {
  claude: "Claude Code",
  codex: "Codex CLI",
};

function ProvisioningConfirmDialog({ plan, projectId }) {
  const { updateProvisioning, executeProvisioning } = useLumonActions();

  const handleCancel = () => {
    updateProvisioning(projectId, { status: "idle", previewPlan: null });
  };

  const handleConfirm = () => {
    executeProvisioning(projectId, plan);
  };

  return (
    <Card className="bg-zinc-900/80 border-zinc-600" data-testid="provisioning-confirm-dialog">
      <CardContent className="p-3.5 space-y-3">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-300">
          Provision Repository
        </div>

        <div className="grid gap-2 md:grid-cols-2 text-[10px] font-mono">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
            <div className="uppercase tracking-[0.08em] text-zinc-600">Repo name</div>
            <div className="mt-1 text-zinc-200 font-semibold" data-testid="provisioning-plan-repo">
              {plan?.repoName ?? "—"}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
            <div className="uppercase tracking-[0.08em] text-zinc-600">Engine</div>
            <div className="mt-1 text-zinc-200 font-semibold" data-testid="provisioning-plan-engine">
              {ENGINE_LABELS[plan?.engineChoice] ?? plan?.engineChoice ?? "—"}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
            <div className="uppercase tracking-[0.08em] text-zinc-600">Workspace</div>
            <div className="mt-1 text-zinc-200 font-semibold truncate" data-testid="provisioning-plan-workspace">
              {plan?.workspacePath ?? "—"}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
            <div className="uppercase tracking-[0.08em] text-zinc-600">Files</div>
            <div className="mt-1 text-zinc-200 font-semibold" data-testid="provisioning-plan-file-count">
              {plan?.files?.length ?? 0} files
            </div>
          </div>
        </div>

        {plan?.files?.length > 0 && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 max-h-32 overflow-y-auto">
            <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-zinc-600 mb-1">File list</div>
            <div className="space-y-0.5" data-testid="provisioning-plan-files">
              {plan.files.map((file) => (
                <div key={file} className="font-mono text-[10px] text-zinc-400">{file}</div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 font-mono text-[10px] text-amber-200">
          This will create a GitHub repository and write files to your local filesystem.
        </div>

        <div className="flex items-center gap-2 justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCancel}
            data-testid="provisioning-cancel-btn"
            className="font-mono text-[10px] font-semibold border-zinc-600 text-zinc-400 hover:bg-zinc-800"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            data-testid="provisioning-confirm-btn"
            className="font-mono text-[10px] font-semibold bg-cyan-500 text-zinc-950 hover:bg-cyan-400"
          >
            Confirm & Provision
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProvisioningProgress({ provisioning }) {
  const steps = provisioning.steps ?? [];
  const completedCount = steps.filter((s) => s.status === "complete").length;
  const runningStep = steps.find((s) => s.status === "running");
  const failedStep = steps.find((s) => s.status === "failed");
  const isComplete = provisioning.status === "complete";
  const isFailed = provisioning.status === "failed";

  const progressLabel = isComplete
    ? "Provisioning complete"
    : isFailed
      ? `Failed at: ${PROVISIONING_STEP_LABELS[failedStep?.name] ?? failedStep?.name ?? "unknown"}`
      : runningStep
        ? `Step ${completedCount + 1} of ${steps.length}: ${PROVISIONING_STEP_LABELS[runningStep.name] ?? runningStep.name}...`
        : `${completedCount} of ${steps.length} steps complete`;

  return (
    <Card className="bg-zinc-900/60 border-zinc-800" data-testid="provisioning-progress">
      <CardContent className="p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Provisioning</div>
          <div
            className={`font-mono text-[10px] font-semibold ${
              isComplete ? "text-green-300" : isFailed ? "text-red-300" : "text-cyan-300"
            }`}
            data-testid="provisioning-progress-label"
          >
            {progressLabel}
          </div>
        </div>

        <div className="space-y-1.5">
          {steps.map((step) => (
            <div
              key={step.name}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${
                step.status === "failed"
                  ? "border-red-500/30 bg-red-500/5"
                  : step.status === "complete"
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : step.status === "running"
                      ? "border-cyan-500/30 bg-cyan-500/5"
                      : "border-zinc-800 bg-zinc-950/50"
              }`}
              data-testid={`provisioning-step-${step.name}`}
            >
              {step.status === "pending" && (
                <div className="h-2 w-2 rounded-full bg-zinc-600 shrink-0" />
              )}
              {step.status === "running" && (
                <Loader2 size={12} className="text-cyan-400 animate-spin shrink-0" />
              )}
              {step.status === "complete" && (
                <Check size={12} className="text-emerald-400 shrink-0" />
              )}
              {step.status === "failed" && (
                <X size={12} className="text-red-400 shrink-0" />
              )}
              <div className="font-mono text-[11px] text-zinc-200">
                {PROVISIONING_STEP_LABELS[step.name] ?? step.name}
              </div>
            </div>
          ))}
        </div>

        {isComplete && (
          <div className="space-y-2">
            {provisioning.repoUrl && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-zinc-500">Repository</div>
                <a
                  href={provisioning.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block font-mono text-[11px] text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
                  data-testid="provisioning-repo-url"
                >
                  {provisioning.repoUrl}
                </a>
              </div>
            )}
            {provisioning.workspacePath && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-zinc-500">Workspace</div>
                <div
                  className="mt-1 font-mono text-[11px] text-zinc-200"
                  data-testid="provisioning-workspace-path"
                >
                  {provisioning.workspacePath}
                </div>
              </div>
            )}
          </div>
        )}

        {isFailed && provisioning.error && (
          <div
            className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 font-mono text-[10px] text-red-200"
            data-testid="provisioning-error"
          >
            {provisioning.error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProvisioningSection({ project }) {
  const { previewProvisioning } = useLumonActions();
  const { connected } = useServerSyncStatus();
  const provisioning = project.provisioning;
  const provisioningReady = project.handoffPacket?.provisioning?.provisioningReady;

  // Only show provisioning controls when handoff_ready
  if (!project.handoffReady) return null;

  return (
    <div className="space-y-3" data-testid="provisioning-section">
      {provisioning.status === "idle" && provisioningReady && (
        <Button
          type="button"
          size="sm"
          onClick={() => previewProvisioning(project.id)}
          disabled={!connected}
          data-testid="provisioning-preview-btn"
          className="font-mono text-[10px] font-semibold bg-cyan-500 text-zinc-950 hover:bg-cyan-400 disabled:opacity-50"
        >
          <GitBranch size={12} className="mr-1.5" />
          Preview provisioning
        </Button>
      )}

      {provisioning.status === "previewing" && (
        <div
          className="flex items-center gap-2 font-mono text-[10px] text-cyan-300"
          data-testid="provisioning-previewing"
        >
          <Loader2 size={12} className="animate-spin" />
          Loading provisioning preview…
        </div>
      )}

      {provisioning.status === "confirming" && provisioning.previewPlan && (
        <ProvisioningConfirmDialog plan={provisioning.previewPlan} projectId={project.id} />
      )}

      {(provisioning.status === "provisioning" || provisioning.status === "complete" || provisioning.status === "failed") && (
        <ProvisioningProgress provisioning={provisioning} />
      )}
    </div>
  );
}

function HandoffPanel({ project }) {
  const packet = project.handoffPacket;

  return (
    <ScrollArea className="max-h-[52vh] rounded-xl border border-zinc-800 bg-zinc-950/30" data-testid="selected-project-handoff-panel">
      <div className="p-3.5 space-y-3">
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardContent className="p-3.5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Build handoff</div>
                <div className="mt-1 font-mono text-sm font-bold text-zinc-200">Packet readiness</div>
                <div className="mt-1 font-mono text-[10px] text-zinc-500 max-w-2xl">
                  Canonical packet outline for architecture, specs, prototype coverage, and final approval readiness.
                </div>
              </div>
              <DetailStateBadge state={packet.status} testId="selected-project-handoff-status" />
            </div>

            <div
              className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 font-mono text-[11px] text-zinc-300"
              data-testid="selected-project-handoff-summary"
            >
              {packet.summary}
            </div>

            <div className="grid gap-2 md:grid-cols-5 text-[10px] font-mono">
              {[
                { label: "Packet state", value: packet.status },
                { label: "Ready", value: String(packet.readyCount) },
                { label: "Waiting", value: String(packet.waitingCount) },
                { label: "Blocked", value: String(packet.blockedCount) },
                { label: "Missing", value: String(packet.missingCount) },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                  <div className="uppercase tracking-[0.08em] text-zinc-600">{item.label}</div>
                  <div className="mt-1 text-zinc-200 font-semibold">{item.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 xl:grid-cols-2">
          {packet.sections.map((section) => (
            <HandoffSectionCard key={section.id} section={section} />
          ))}
        </div>

        <ProvisioningSection project={project} />
      </div>
    </ScrollArea>
  );
}

function SelectedProjectOverview({ project, onSelectStage, onSelectAgent }) {
  return (
    <div className="space-y-3" data-testid="selected-project-overview-panel">
      <SelectedProjectHeader project={project} />
      <PipelineSnapshot project={project} onSelectStage={onSelectStage} prefix="selected-project" />
      <AgentRoster project={project} onSelectAgent={onSelectAgent} />
    </div>
  );
}

function SelectedProjectPane({ project, onSelectStage, onSelectAgent }) {
  return (
    <Tabs defaultValue="overview" className="gap-3" data-testid="selected-project-detail-tabs">
      <Card className="bg-zinc-900/60 border-zinc-800">
        <CardContent className="p-3.5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Selected project detail</div>
              <div className="mt-1 font-mono text-sm font-bold text-zinc-200">Overview, dossier, and handoff</div>
              <div className="mt-1 font-mono text-[10px] text-zinc-500 max-w-2xl">
                One selector-owned detail seam: inspect the live overview, the canonical dossier, or the build handoff packet without leaving the dashboard.
              </div>
            </div>
            <PipelineActions project={project} />
          </div>

          <TabsList className="bg-zinc-950/70 border border-zinc-800" aria-label="Selected project detail views">
            <TabsTrigger
              value="overview"
              data-testid="selected-project-tab-overview"
              className="font-mono text-[11px] font-semibold tracking-wide data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 text-zinc-500"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="dossier"
              data-testid="selected-project-tab-dossier"
              className="font-mono text-[11px] font-semibold tracking-wide data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 text-zinc-500"
            >
              Dossier
            </TabsTrigger>
            <TabsTrigger
              value="handoff"
              data-testid="selected-project-tab-handoff"
              className="font-mono text-[11px] font-semibold tracking-wide data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 text-zinc-500"
            >
              Handoff
            </TabsTrigger>
          </TabsList>
        </CardContent>
      </Card>

      <TabsContent value="overview" className="m-0">
        <SelectedProjectOverview project={project} onSelectStage={onSelectStage} onSelectAgent={onSelectAgent} />
      </TabsContent>

      <TabsContent value="dossier" className="m-0">
        <DossierPanel project={project} />
      </TabsContent>

      <TabsContent value="handoff" className="m-0">
        <HandoffPanel project={project} />
      </TabsContent>
    </Tabs>
  );
}

function ConnectionStatusIndicator() {
  const { connected, error } = useServerSyncStatus();

  return (
    <div
      className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.08em]"
      data-testid="sync-connection-status"
    >
      {connected ? (
        <>
          <Wifi size={10} className="text-emerald-400" />
          <span className="text-emerald-400">Connected</span>
        </>
      ) : (
        <>
          <WifiOff size={10} className="text-zinc-500" />
          <span className="text-zinc-500">{error || "Disconnected"}</span>
        </>
      )}
    </div>
  );
}

function PipelineActions({ project }) {
  const { triggerPipeline, approvePipeline } = useLumonActions();
  const { connected } = useServerSyncStatus();
  const [loading, setLoading] = useState(null); // "trigger" | "approve" | "reject" | null

  if (!project) return null;

  const currentStage = project.currentStage;
  const canTrigger = currentStage?.status === "queued";
  const canApprove =
    currentStage?.approval?.state === "pending" && currentStage?.approval?.required;

  const isDisabled = loading !== null || !connected;

  const handleTrigger = async () => {
    setLoading("trigger");
    try {
      await triggerPipeline(project.id, currentStage.stageKey);
    } finally {
      setLoading(null);
    }
  };

  const handleApprove = async () => {
    setLoading("approve");
    try {
      await approvePipeline(project.id, currentStage.stageKey, "approved");
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    setLoading("reject");
    try {
      await approvePipeline(project.id, currentStage.stageKey, "rejected");
    } finally {
      setLoading(null);
    }
  };

  if (!canTrigger && !canApprove) return null;

  return (
    <div className="flex items-center gap-2" data-testid="pipeline-actions">
      {!connected && (
        <div
          className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1 font-mono text-[9px] text-zinc-400"
          data-testid="pipeline-actions-offline"
        >
          <WifiOff size={10} />
          <span>Server offline — triggers disabled</span>
        </div>
      )}
      {canTrigger && (
        <Button
          type="button"
          size="sm"
          onClick={handleTrigger}
          disabled={isDisabled}
          data-testid="trigger-discovery-btn"
          className="font-mono text-[10px] font-semibold bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {loading === "trigger" ? (
            <Loader2 size={12} className="mr-1.5 animate-spin" />
          ) : (
            <Play size={12} className="mr-1.5" />
          )}
          Trigger Discovery
        </Button>
      )}
      {canApprove && (
        <>
          <Button
            type="button"
            size="sm"
            onClick={handleApprove}
            disabled={isDisabled}
            data-testid="approve-btn"
            className="font-mono text-[10px] font-semibold bg-green-500 text-zinc-950 hover:bg-green-400 disabled:opacity-50"
          >
            {loading === "approve" ? (
              <Loader2 size={12} className="mr-1.5 animate-spin" />
            ) : (
              <Check size={12} className="mr-1.5" />
            )}
            Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleReject}
            disabled={isDisabled}
            data-testid="reject-btn"
            className="font-mono text-[10px] font-semibold border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            {loading === "reject" ? (
              <Loader2 size={12} className="mr-1.5 animate-spin" />
            ) : (
              <X size={12} className="mr-1.5" />
            )}
            Reject
          </Button>
        </>
      )}
    </div>
  );
}

export { PipelineActions };

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
          <div className="flex items-center justify-between gap-3">
            <div className="grid grid-cols-4 gap-2 flex-1">
              {dashboardCards.map((card) => (
                <MetricCard key={card.id} card={card} />
              ))}
            </div>
            <ConnectionStatusIndicator />
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
          <SelectedProjectPane
            project={selectedProject}
            onSelectStage={selectStage}
            onSelectAgent={selectAgent}
          />
        ) : (
          <Card className="bg-zinc-900/60 border-dashed border-zinc-700" data-testid="dashboard-no-selected-project">
            <CardContent className="p-4 space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Project detail</div>
              <div className="font-mono text-sm font-bold text-zinc-200">Create the first registry project</div>
              <div className="font-mono text-[11px] text-zinc-400 leading-relaxed max-w-2xl">
                This restored state contains no selected project. Spawn a canonical project to light up the overview, dossier, and handoff views in the detail pane.
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
