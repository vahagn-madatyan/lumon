import { useEffect, useMemo } from "react";
import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  getBezierPath,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLumonActions, useLumonSelector } from "@/lumon/context";
import { selectOrchestrationInput } from "@/lumon/selectors";
import {
  Bot,
  CheckCircle2,
  FileText,
  GitBranch,
  Inbox,
  Layers,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  Timer,
  Workflow,
  XCircle,
} from "lucide-react";

const ICON_MAP = {
  Inbox,
  GitBranch,
  Search,
  FileText,
  Layers,
  CheckCircle2,
  Workflow,
};

const STATUS_CLASSES = {
  running: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  complete: "bg-green-500/15 text-green-400 border-green-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
  queued: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  idle: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  waiting: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  blocked: "bg-red-500/15 text-red-300 border-red-500/30",
  needs_iteration: "bg-red-500/15 text-red-300 border-red-500/30",
  handoff_ready: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
};

const APPROVAL_CLASSES = {
  not_required: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  pending: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  approved: "bg-green-500/10 text-green-300 border-green-500/20",
  rejected: "bg-red-500/10 text-red-300 border-red-500/20",
  needs_iteration: "bg-red-500/10 text-red-300 border-red-500/20",
};

function StatusBadge({ status, label = status, className = "", testId }) {
  return (
    <Badge
      data-testid={testId}
      variant="outline"
      className={`font-mono text-[10px] font-bold tracking-widest uppercase ${STATUS_CLASSES[status] ?? STATUS_CLASSES.queued} ${className}`}
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

function PipelineNode({ data }) {
  const stage = data.stage;
  const Icon = ICON_MAP[stage.icon] ?? Workflow;
  const nodeTone = stage.stateTone ?? stage.status;
  const borderClass =
    nodeTone === "running"
      ? "border-emerald-500/60 shadow-[0_0_20px_rgba(0,229,155,0.15)]"
      : nodeTone === "complete"
        ? "border-green-500/40"
        : nodeTone === "waiting"
          ? "border-amber-500/50 shadow-[0_0_18px_rgba(245,158,11,0.12)]"
          : nodeTone === "handoff_ready"
            ? "border-cyan-500/50 shadow-[0_0_18px_rgba(34,211,238,0.12)]"
            : nodeTone === "blocked" || nodeTone === "needs_iteration" || nodeTone === "failed"
              ? "border-red-500/50 shadow-[0_0_15px_rgba(248,81,73,0.12)]"
              : "border-zinc-800";
  const backgroundClass =
    nodeTone === "running"
      ? "bg-emerald-500/5"
      : nodeTone === "complete"
        ? "bg-green-500/5"
        : nodeTone === "waiting"
          ? "bg-amber-500/5"
          : nodeTone === "handoff_ready"
            ? "bg-cyan-500/5"
            : nodeTone === "blocked" || nodeTone === "needs_iteration" || nodeTone === "failed"
              ? "bg-red-500/5"
              : "bg-zinc-900/80";

  return (
    <div
      className={`min-w-[220px] rounded-xl border ${borderClass} ${backgroundClass} ${
        data.selected ? "ring-1 ring-cyan-400/50" : ""
      } transition-all`}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-zinc-600 !border-zinc-500" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-zinc-600 !border-zinc-500" />

      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/60 bg-zinc-900/60 rounded-t-xl">
        <div className="flex items-center gap-2">
          <Icon
            size={13}
            className={
              nodeTone === "running"
                ? "text-emerald-400"
                : nodeTone === "complete"
                  ? "text-green-400"
                  : nodeTone === "waiting"
                    ? "text-amber-300"
                    : nodeTone === "handoff_ready"
                      ? "text-cyan-300"
                      : nodeTone === "blocked" || nodeTone === "needs_iteration" || nodeTone === "failed"
                        ? "text-red-400"
                        : "text-zinc-500"
            }
          />
          <span className="font-mono text-[11px] font-bold text-zinc-200">{stage.label}</span>
        </div>
        {nodeTone === "running" && <Loader2 size={12} className="text-emerald-400 animate-spin" />}
        {nodeTone === "complete" && <CheckCircle2 size={12} className="text-green-400" />}
        {(nodeTone === "blocked" || nodeTone === "needs_iteration" || nodeTone === "failed") && (
          <XCircle size={12} className="text-red-400" />
        )}
        {nodeTone === "waiting" && <ShieldAlert size={12} className="text-amber-300" />}
        {nodeTone === "handoff_ready" && <GitBranch size={12} className="text-cyan-300" />}
        {nodeTone === "queued" && <div className="w-2 h-2 rounded-full bg-zinc-600" />}
      </div>

      <div className="px-3 py-2 space-y-2">
        <div className="font-mono text-[10px] text-zinc-500 leading-snug">{stage.description}</div>
        <div className="flex items-center gap-1 font-mono text-[9px] text-zinc-600">
          <Timer size={9} className="opacity-60" />
          {stage.durationLabel}
        </div>
        <div className="flex items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-1.5">
          <div className="min-w-0">
            <div className="font-mono text-[8px] uppercase tracking-[0.08em] text-zinc-600">Gate</div>
            <div className="truncate font-mono text-[10px] text-zinc-300">{stage.approval.label}</div>
          </div>
          <ApprovalBadge approval={stage.approval} />
        </div>
        {stage.approval.note && (
          <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 font-mono text-[9px] text-amber-100 leading-relaxed">
            {stage.approval.note}
          </div>
        )}

        {stage.agents.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {stage.agents.map((agent) => (
              <div key={agent.id} className="rounded-md border border-zinc-800 bg-zinc-950/70 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Bot size={10} className="text-zinc-500" />
                    <span className="font-mono text-[10px] font-semibold text-zinc-300">{agent.name}</span>
                  </div>
                  <span className="font-mono text-[8px] text-zinc-500 uppercase tracking-[0.08em]">
                    {agent.modelLabel}
                  </span>
                </div>
                <div className="mt-1 h-[3px] rounded-full bg-zinc-800 overflow-hidden">
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AnimatedEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const status = data?.status ?? "queued";
  const strokeColor =
    status === "complete"
      ? "#3fb950"
      : status === "running"
        ? "#00e59b"
        : status === "waiting"
          ? "#f59e0b"
          : status === "handoff_ready"
            ? "#22d3ee"
            : status === "failed" || status === "blocked" || status === "needs_iteration"
              ? "#f85149"
              : "#27272a";

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: "#27272a", strokeWidth: 2 }} />
      {status !== "queued" && (
        <path d={edgePath} fill="none" stroke={strokeColor} strokeWidth={2} opacity={0.5} style={{ pointerEvents: "none" }} />
      )}
    </>
  );
}

const NODE_TYPES = { pipeline: PipelineNode };
const EDGE_TYPES = { animated: AnimatedEdge };

const resolveEdgeStatus = (previousStage, nextStage) => {
  if ([previousStage.stateTone, nextStage.stateTone].some((status) => ["failed", "blocked", "needs_iteration"].includes(status))) {
    return nextStage.stateTone === "failed" ? "failed" : nextStage.stateTone;
  }

  if ([previousStage.stateTone, nextStage.stateTone].includes("handoff_ready")) {
    return "handoff_ready";
  }

  if ([previousStage.stateTone, nextStage.stateTone].includes("waiting")) {
    return "waiting";
  }

  if (previousStage.status === "running" || nextStage.status === "running") {
    return "running";
  }

  if (previousStage.status === "complete") {
    return "complete";
  }

  return "queued";
};

const buildFlowGraph = (stages, selectedStageId) => {
  const nodes = stages.map((stage, index) => ({
    id: stage.id,
    type: "pipeline",
    position: { x: index * 300, y: 0 },
    draggable: true,
    data: {
      stage,
      selected: stage.id === selectedStageId,
    },
  }));

  const edges = stages.slice(1).map((stage, index) => {
    const previousStage = stages[index];

    return {
      id: `edge:${previousStage.id}:${stage.id}`,
      source: previousStage.id,
      target: stage.id,
      type: "animated",
      data: {
        status: resolveEdgeStatus(previousStage, stage),
      },
    };
  });

  return { nodes, edges };
};

function EmptyOrchestrationState({ onOpenNewProject }) {
  return (
    <Card className="bg-zinc-900/60 border-dashed border-zinc-700" data-testid="orchestration-empty-registry">
      <CardContent className="p-5 space-y-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Workflow orchestration</div>
          <div className="mt-2 font-mono text-sm font-bold text-zinc-200">No canonical project selected</div>
          <div className="mt-2 max-w-2xl font-mono text-[11px] text-zinc-400 leading-relaxed">
            The restored registry is intentionally empty, so the orchestration canvas has nothing to project yet. Spawn a project to seed a canonical pipeline and make reload state visible here.
          </div>
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
  );
}

export default function OrchestrationTab({ onOpenNewProject }) {
  const orchestration = useLumonSelector(selectOrchestrationInput);
  const { selectProject, selectStage } = useLumonActions();
  const detailStage = orchestration.selectedStage ?? orchestration.currentStage;
  const graph = useMemo(
    () => buildFlowGraph(orchestration.stages, detailStage?.id ?? null),
    [detailStage?.id, orchestration.stages],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [graph.edges, graph.nodes, setEdges, setNodes]);

  if (!orchestration.projectId) {
    return (
      <div className="p-4 h-full flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-mono text-sm font-bold text-zinc-200 tracking-[0.15em] uppercase">
              Workflow orchestration
            </h2>
            <div className="mt-1 font-mono text-[11px] text-zinc-500">
              React Flow stays local. Stage, gate, and approval truth come from shared selectors.
            </div>
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
        </div>

        <EmptyOrchestrationState onOpenNewProject={onOpenNewProject} />
      </div>
    );
  }

  return (
    <div className="p-4 h-full flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-mono text-sm font-bold text-zinc-200 tracking-[0.15em] uppercase">
            Workflow orchestration
          </h2>
          <div className="mt-1 font-mono text-[11px] text-zinc-500">
            React Flow stays local. Stage, gate, and approval truth come from shared selectors.
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          {orchestration.availableProjects.map((project) => (
            <Button
              key={project.id}
              type="button"
              variant={project.isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => selectProject(project.id)}
              className={`h-auto min-w-[180px] flex-col items-start gap-1.5 px-3 py-2 font-mono ${
                project.isSelected
                  ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/20"
                  : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-[11px] font-semibold">{project.label}</span>
                <StatusBadge status={project.pipelineStatus} label={project.pipelineStatusLabel} className="text-[8px]" />
              </div>
              <div className="text-[9px] text-left leading-relaxed text-zinc-400">
                {project.currentStageLabel} · {project.currentGateLabel}
              </div>
            </Button>
          ))}
        </div>
      </div>

      <Card className="bg-zinc-900/60 border-zinc-800">
        <CardContent className="p-3 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[12px] font-semibold text-zinc-200">
                {orchestration.projectName} — {orchestration.phaseLabel}
              </span>
              <StatusBadge
                status={orchestration.pipelineStatus}
                label={orchestration.pipelineStatusLabel}
                testId="orchestration-pipeline-status"
              />
              <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/20 font-mono text-[9px] uppercase tracking-[0.08em]">
                {orchestration.engineLabel}
              </Badge>
            </div>
            <div className="font-mono text-[11px] text-zinc-300" data-testid="orchestration-pipeline-summary">
              {orchestration.pipelineSummary}
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <div className="h-1.5 flex-1 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-700"
                  style={{ width: `${orchestration.progressPercent}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-zinc-500 shrink-0">
                {orchestration.completedCount}/{orchestration.totalCount} stages · {orchestration.progressPercent}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono xl:w-[420px]">
            <div className="rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-2">
              <div className="uppercase tracking-[0.08em] text-zinc-600">Current stage</div>
              <div className="mt-1 text-zinc-200 font-semibold" data-testid="orchestration-current-stage-label">
                {orchestration.currentStage?.label ?? "—"}
              </div>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-2">
              <div className="uppercase tracking-[0.08em] text-zinc-600">Current gate</div>
              <div className="mt-1 text-zinc-200 font-semibold" data-testid="orchestration-current-gate-label">
                {orchestration.currentGate?.label ?? "No approval required"}
              </div>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-2">
              <div className="uppercase tracking-[0.08em] text-zinc-600">Approval state</div>
              <div className="mt-1 flex items-center gap-2">
                <ApprovalBadge approval={orchestration.currentGate} testId="orchestration-current-approval-state" />
              </div>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-2">
              <div className="uppercase tracking-[0.08em] text-zinc-600">Handoff</div>
              <div className="mt-1 text-zinc-200 font-semibold" data-testid="orchestration-handoff-readiness">
                {orchestration.handoffReady ? "Ready for handoff" : "Not ready"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-zinc-800 h-[420px]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => selectStage(node.id)}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          style={{ background: "#09090b" }}
        >
          <Background color="#27272a" gap={20} size={1} />
          <Controls
            showInteractive={false}
            className="!bg-zinc-900 !border-zinc-700 !rounded-lg [&>button]:!bg-zinc-800 [&>button]:!border-zinc-700 [&>button]:!text-zinc-400 [&>button:hover]:!bg-zinc-700"
          />
          <MiniMap
            nodeColor={(node) => {
              const status = node.data?.stage?.stateTone ?? node.data?.stage?.status;
              return status === "running"
                ? "#00e59b"
                : status === "complete"
                  ? "#3fb950"
                  : status === "waiting"
                    ? "#f59e0b"
                    : status === "handoff_ready"
                      ? "#22d3ee"
                      : status === "blocked" || status === "needs_iteration" || status === "failed"
                        ? "#f85149"
                        : "#3f3f46";
            }}
            maskColor="rgba(0,0,0,0.7)"
            className="!bg-zinc-900 !border-zinc-700 !rounded-lg"
          />
        </ReactFlow>
      </div>

      {detailStage && (
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardContent className="p-3.5 space-y-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Selected stage</div>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[13px] font-bold text-zinc-200">{detailStage.label}</span>
                  <StatusBadge status={detailStage.stateTone} label={detailStage.isCurrent ? "Current" : detailStage.status} className="shrink-0" />
                </div>
                <div className="font-mono text-[11px] text-zinc-400">{detailStage.description}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono xl:w-[420px]">
                <div className="rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-2">
                  <div className="uppercase tracking-[0.08em] text-zinc-600">Stage status</div>
                  <div className="mt-1 text-zinc-200 font-semibold" data-testid="orchestration-current-stage-status">
                    {detailStage.status}
                  </div>
                </div>
                <div className="rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-2">
                  <div className="uppercase tracking-[0.08em] text-zinc-600">Output</div>
                  <div className="mt-1 text-zinc-200 font-semibold">{detailStage.output}</div>
                </div>
                <div className="rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-2">
                  <div className="uppercase tracking-[0.08em] text-zinc-600">Approval gate</div>
                  <div className="mt-1 text-zinc-200 font-semibold" data-testid="orchestration-selected-stage-gate">
                    {detailStage.approval.label}
                  </div>
                </div>
                <div className="rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-2">
                  <div className="uppercase tracking-[0.08em] text-zinc-600">Approval state</div>
                  <div className="mt-1 flex items-center gap-2">
                    <ApprovalBadge approval={detailStage.approval} testId="orchestration-selected-stage-approval" />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-zinc-600">Gate summary</div>
              <div className="mt-1 font-mono text-[11px] text-zinc-300" data-testid="orchestration-selected-stage-summary">
                {detailStage.approval.summary}
              </div>
              {detailStage.approval.note && (
                <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 font-mono text-[10px] text-amber-100 leading-relaxed">
                  {detailStage.approval.note}
                </div>
              )}
            </div>

            {detailStage.agents.length > 0 && (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {detailStage.agents.map((agent) => (
                  <div key={agent.id} className="rounded border border-zinc-800 bg-zinc-950/70 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[11px] font-semibold text-zinc-200">{agent.name}</div>
                        <div className="mt-1 font-mono text-[10px] text-zinc-500">{agent.modelLabel}</div>
                      </div>
                      <StatusBadge status={agent.status} />
                    </div>
                    <div className="mt-2 font-mono text-[11px] text-zinc-400 leading-relaxed">{agent.task}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
