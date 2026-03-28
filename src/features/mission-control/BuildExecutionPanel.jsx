import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLumonActions, useServerSyncStatus } from "@/lumon/context";
import {
  Activity,
  AlertTriangle,
  Check,
  Clock3,
  Loader2,
  OctagonX,
  Play,
  RotateCw,
  Terminal,
  Timer,
  WifiOff,
  X,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useCallback, useState } from "react";

const BUILD_STATUS_CLASSES = {
  idle: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  running: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  completed: "bg-green-500/15 text-green-300 border-green-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
  escalated: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

const AGENT_STATUS_CLASSES = {
  running: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  completed: "bg-green-500/15 text-green-300 border-green-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
  spawned: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  "timed-out": "bg-orange-500/15 text-orange-300 border-orange-500/30",
};

const AGENT_TYPE_LABELS = {
  claude: "Claude Code",
  codex: "Codex CLI",
};

function BuildStatusBadge({ status, label }) {
  return (
    <Badge
      variant="outline"
      className={`font-mono text-[10px] font-bold tracking-widest uppercase ${BUILD_STATUS_CLASSES[status] ?? BUILD_STATUS_CLASSES.idle}`}
      data-testid="build-status-badge"
    >
      {label}
    </Badge>
  );
}

function AgentStatusBadge({ status }) {
  return (
    <Badge
      variant="outline"
      className={`font-mono text-[9px] font-bold tracking-widest uppercase ${AGENT_STATUS_CLASSES[status] ?? AGENT_STATUS_CLASSES.running}`}
    >
      {status}
    </Badge>
  );
}

function AgentOutputPanel({ agentId }) {
  const [output, setOutput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchOutput = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/execution/agent/${agentId}/output`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      setOutput(data.output ?? data.lines ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  // Fetch on mount
  useState(() => {
    fetchOutput();
  });

  if (loading && output === null) {
    return (
      <div
        className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 font-mono text-[10px] text-cyan-300"
        data-testid={`build-agent-output-${agentId}-loading`}
      >
        <Loader2 size={10} className="animate-spin" />
        Loading agent output…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 font-mono text-[10px] text-red-300"
        data-testid={`build-agent-output-${agentId}-error`}
      >
        Failed to load output: {error}
      </div>
    );
  }

  const lines = Array.isArray(output) ? output : [];
  const displayLines = lines.slice(-50); // Show last 50 lines

  return (
    <div
      className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/80 overflow-hidden"
      data-testid={`build-agent-output-${agentId}`}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800">
        <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-zinc-500">
          <Terminal size={10} />
          Agent output ({lines.length} lines)
        </div>
        <button
          type="button"
          onClick={fetchOutput}
          className="font-mono text-[9px] text-cyan-400 hover:text-cyan-300 uppercase tracking-[0.08em]"
          data-testid={`build-agent-output-${agentId}-refresh`}
        >
          Refresh
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto px-3 py-2">
        {displayLines.length > 0 ? (
          <pre className="font-mono text-[10px] text-zinc-400 leading-relaxed whitespace-pre-wrap break-all">
            {displayLines.join("\n")}
          </pre>
        ) : (
          <div className="font-mono text-[10px] text-zinc-600 italic">No output yet</div>
        )}
      </div>
    </div>
  );
}

function AgentTelemetryBar({ telemetry, agentId }) {
  if (!telemetry) return null;
  const hasParsedData = telemetry.tokensLabel !== "—" || telemetry.costLabel !== "—" || telemetry.progress > 0;
  if (!hasParsedData) return null;

  return (
    <div
      className="mt-2 flex items-center gap-3 text-[9px] font-mono text-zinc-400"
      data-testid={`build-agent-telemetry-${agentId}`}
    >
      {telemetry.tokensLabel !== "—" && (
        <span className="flex items-center gap-1" data-testid={`build-agent-telemetry-tokens-${agentId}`}>
          <Zap size={9} className="text-purple-400" />
          {telemetry.tokensLabel} tokens
        </span>
      )}
      {telemetry.costLabel !== "—" && (
        <span data-testid={`build-agent-telemetry-cost-${agentId}`}>{telemetry.costLabel}</span>
      )}
      {telemetry.progress > 0 && (
        <div className="flex items-center gap-1.5 flex-1 min-w-[60px] max-w-[120px]">
          <div className="h-[3px] flex-1 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-purple-400"
              style={{ width: `${Math.min(telemetry.progress, 100)}%` }}
              data-testid={`build-agent-telemetry-progress-${agentId}`}
            />
          </div>
          <span className="text-zinc-500">{telemetry.progress}%</span>
        </div>
      )}
      {telemetry.lastOutputSummary && (
        <span className="truncate text-zinc-500" data-testid={`build-agent-telemetry-summary-${agentId}`}>
          {telemetry.lastOutputSummary}
        </span>
      )}
    </div>
  );
}

function RetryingIndicator({ agentId }) {
  return (
    <div
      className="mt-2 flex items-center gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5"
      data-testid={`build-agent-retrying-${agentId}`}
    >
      <Loader2 size={10} className="animate-spin text-amber-400" />
      <span className="font-mono text-[10px] text-amber-300 font-semibold">Retrying…</span>
    </div>
  );
}

function TimeoutIndicator({ agentId }) {
  return (
    <div
      className="mt-2 flex items-center gap-2 rounded border border-orange-500/20 bg-orange-500/5 px-2.5 py-1.5"
      data-testid={`build-agent-timeout-${agentId}`}
    >
      <Timer size={10} className="text-orange-400" />
      <span className="font-mono text-[10px] text-orange-300 font-semibold">Timed out</span>
    </div>
  );
}

function AgentActivityCard({ agent, isRetrying }) {
  const [expanded, setExpanded] = useState(false);

  const typeLabel = AGENT_TYPE_LABELS[agent.agentType] ?? agent.agentType ?? "Agent";
  const ExpandIcon = expanded ? ChevronUp : ChevronDown;
  const isTimedOut = agent.status === "timed-out";

  return (
    <div
      className={`rounded-lg border transition-colors hover:border-zinc-700 ${
        isRetrying
          ? "border-amber-500/30 bg-amber-500/5"
          : isTimedOut
            ? "border-orange-500/30 bg-orange-500/5"
            : "border-zinc-800 bg-zinc-950/60"
      }`}
      data-testid={`build-agent-card-${agent.agentId}`}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2.5"
        aria-label={`Toggle output for ${agent.agentId}`}
        data-testid={`build-agent-card-${agent.agentId}-toggle`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-mono text-[11px] font-semibold text-zinc-200 truncate">
                {agent.agentId}
              </div>
              <Badge
                variant="secondary"
                className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[8px] font-mono uppercase tracking-[0.08em]"
              >
                {typeLabel}
              </Badge>
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[9px] font-mono text-zinc-500">
              {agent.elapsedLabel && agent.elapsedLabel !== "—" && (
                <span className="flex items-center gap-1">
                  <Clock3 size={9} />
                  {agent.elapsedLabel}
                </span>
              )}
              {agent.tokensLabel && agent.tokensLabel !== "—" && (
                <span>{agent.tokensLabel} tokens</span>
              )}
              {agent.costLabel && agent.costLabel !== "—" && (
                <span>{agent.costLabel}</span>
              )}
              {agent.pid && (
                <span className="text-zinc-600">PID {agent.pid}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <AgentStatusBadge status={agent.status} />
            <ExpandIcon size={12} className="text-zinc-500" />
          </div>
        </div>

        {isRetrying && <RetryingIndicator agentId={agent.agentId} />}
        {isTimedOut && <TimeoutIndicator agentId={agent.agentId} />}

        <AgentTelemetryBar telemetry={agent.telemetry} agentId={agent.agentId} />

        {agent.lastOutput && (
          <div className="mt-2 rounded border border-zinc-800 bg-zinc-950/50 px-2.5 py-1.5">
            <div className="font-mono text-[10px] text-zinc-400 truncate" data-testid={`build-agent-card-${agent.agentId}-last-output`}>
              {agent.lastOutput}
            </div>
          </div>
        )}
      </button>

      {expanded && <AgentOutputPanel agentId={agent.agentId} />}
    </div>
  );
}

function EscalationBanner({ buildExecution, projectId }) {
  const { acknowledgeEscalation } = useLumonActions();
  const [actionLoading, setActionLoading] = useState(null); // "retry" | "abort" | null

  const reason = buildExecution.escalationReason ?? buildExecution.escalation?.reason ?? "Unknown failure";

  const handleRetry = async () => {
    setActionLoading("retry");
    try {
      await acknowledgeEscalation(projectId, "retry");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAbort = async () => {
    setActionLoading("abort");
    try {
      await acknowledgeEscalation(projectId, "abort");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div
      className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-3.5 py-3 space-y-2.5"
      data-testid="build-escalation-banner"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-amber-300">
            Escalation — Operator Action Required
          </div>
          <div
            className="mt-1 font-mono text-[10px] text-amber-200 leading-relaxed"
            data-testid="build-escalation-reason"
          >
            {reason}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pl-6">
        <Button
          type="button"
          size="sm"
          onClick={handleRetry}
          disabled={actionLoading !== null}
          data-testid="escalation-retry-btn"
          className="font-mono text-[10px] font-semibold bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {actionLoading === "retry" ? (
            <Loader2 size={12} className="mr-1.5 animate-spin" />
          ) : (
            <RotateCw size={12} className="mr-1.5" />
          )}
          Retry
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAbort}
          disabled={actionLoading !== null}
          data-testid="escalation-abort-btn"
          className="font-mono text-[10px] font-semibold border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          {actionLoading === "abort" ? (
            <Loader2 size={12} className="mr-1.5 animate-spin" />
          ) : (
            <OctagonX size={12} className="mr-1.5" />
          )}
          Abort
        </Button>
      </div>
    </div>
  );
}

export default function BuildExecutionPanel({ project }) {
  const { startBuild } = useLumonActions();
  const { connected } = useServerSyncStatus();
  const [loading, setLoading] = useState(false);

  const buildExecution = project.buildExecution;
  if (!buildExecution) return null;

  const {
    status,
    statusLabel,
    statusTone,
    agents,
    canStartBuild,
    elapsedLabel,
    error,
    provisioningComplete,
    isEscalated,
    retryCount,
  } = buildExecution;

  // Don't render at all if provisioning isn't complete
  if (!provisioningComplete) return null;

  const isRunning = status === "running";
  const isFailed = status === "failed";
  const isCompleted = status === "completed";
  const isIdle = status === "idle";
  const isEscalatedStatus = status === "escalated";

  const buttonDisabled = !canStartBuild || !connected || loading;
  const buttonLabel = isFailed ? "Retry Build" : isCompleted ? "Rebuild" : "Start Build";
  const ButtonIcon = isFailed ? RotateCw : isCompleted ? RotateCw : Play;

  const handleStartBuild = async () => {
    setLoading(true);
    try {
      await startBuild(project.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-zinc-900/60 border-zinc-800" data-testid="build-execution-panel">
      <CardContent className="p-3.5 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Build execution</div>
            <div className="mt-1 flex items-center gap-2.5" data-testid="build-status-header">
              <div className="font-mono text-sm font-bold text-zinc-200">Agent build</div>
              <BuildStatusBadge status={status} label={statusLabel} />
              {retryCount > 0 && (
                <span
                  className="font-mono text-[9px] text-amber-400 uppercase tracking-[0.08em]"
                  data-testid="build-retry-count"
                >
                  Retry #{retryCount}
                </span>
              )}
              {elapsedLabel && elapsedLabel !== "—" && (
                <span className="font-mono text-[10px] text-zinc-500">
                  <Clock3 size={10} className="inline mr-1" />
                  {elapsedLabel}
                </span>
              )}
            </div>
          </div>

          {/* Start / Retry button (hidden during escalation — banner has controls) */}
          {(isIdle || isCompleted || isFailed) && !isEscalatedStatus && (
            <div className="flex items-center gap-2">
              {!connected && (
                <div
                  className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1 font-mono text-[9px] text-zinc-400"
                  data-testid="build-offline-notice"
                >
                  <WifiOff size={10} />
                  <span>Offline</span>
                </div>
              )}
              <Button
                type="button"
                size="sm"
                onClick={handleStartBuild}
                disabled={buttonDisabled}
                data-testid="start-build-btn"
                className="font-mono text-[10px] font-semibold bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={12} className="mr-1.5 animate-spin" />
                ) : (
                  <ButtonIcon size={12} className="mr-1.5" />
                )}
                {buttonLabel}
              </Button>
            </div>
          )}

          {/* Running indicator */}
          {isRunning && (
            <div className="flex items-center gap-2 font-mono text-[10px] text-emerald-300">
              <Loader2 size={12} className="animate-spin" />
              <span>Build in progress…</span>
            </div>
          )}
        </div>

        {/* Escalation banner */}
        {isEscalated && (
          <EscalationBanner buildExecution={buildExecution} projectId={project.id} />
        )}

        {/* Error display */}
        {isFailed && error && (
          <div
            className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 font-mono text-[10px] text-red-200"
            data-testid="build-error"
          >
            {error}
          </div>
        )}

        {/* Completion notice */}
        {isCompleted && (
          <div
            className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 font-mono text-[10px] text-emerald-200 flex items-center gap-2"
            data-testid="build-complete-notice"
          >
            <Check size={12} />
            Build completed successfully
            {elapsedLabel && elapsedLabel !== "—" && <span className="text-zinc-500">({elapsedLabel})</span>}
          </div>
        )}

        {/* Agent cards */}
        {agents.length > 0 && (
          <div className="space-y-2" data-testid="build-agent-list">
            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-zinc-500">
                Agent activity ({agents.length})
              </div>
              <div className="flex gap-2 text-[9px] font-mono uppercase tracking-[0.08em] text-zinc-500">
                {agents.filter((a) => a.status === "running").length > 0 && (
                  <span className="flex items-center gap-1">
                    <Activity size={9} className="text-emerald-400" />
                    {agents.filter((a) => a.status === "running").length} active
                  </span>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              {agents.map((agent) => (
                <AgentActivityCard
                  key={agent.agentId}
                  agent={agent}
                  isRetrying={retryCount > 0 && (agent.status === "running" || agent.status === "spawned")}
                />
              ))}
            </div>
          </div>
        )}

        {/* Idle state hint */}
        {isIdle && agents.length === 0 && (
          <div className="font-mono text-[10px] text-zinc-500 leading-relaxed">
            Project is provisioned and ready for build. Click "Start Build" to spawn an agent CLI process.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
