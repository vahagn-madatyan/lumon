import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLumonActions, useServerSyncStatus } from "@/lumon/context";
import {
  Check,
  DollarSign,
  Globe,
  Loader2,
  Play,
  ShoppingCart,
  X,
} from "lucide-react";
import { useState } from "react";

const ACTION_STATUS_CLASSES = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  confirmed: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  executing: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  completed: "bg-green-500/15 text-green-300 border-green-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
  cancelled: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

function ActionStatusBadge({ status, label }) {
  return (
    <Badge
      variant="outline"
      className={`font-mono text-[9px] font-bold tracking-[0.12em] uppercase ${ACTION_STATUS_CLASSES[status] ?? ACTION_STATUS_CLASSES.pending}`}
    >
      {label}
    </Badge>
  );
}

function ActionResultDetails({ result }) {
  if (!result || typeof result !== "object") return null;

  const fields = [];
  if (result.orderId) fields.push({ label: "Order ID", value: result.orderId });
  if (result.cost != null) fields.push({ label: "Cost", value: typeof result.cost === "number" ? `$${(result.cost / 100).toFixed(2)}` : String(result.cost) });
  if (result.balance != null) fields.push({ label: "Balance", value: typeof result.balance === "number" ? `$${(result.balance / 100).toFixed(2)}` : String(result.balance) });

  if (fields.length === 0) return null;

  return (
    <div className="grid gap-1.5 md:grid-cols-3">
      {fields.map((field) => (
        <div
          key={field.label}
          className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5"
        >
          <div className="font-mono text-[8px] uppercase tracking-[0.08em] text-zinc-600">{field.label}</div>
          <div className="mt-0.5 font-mono text-[11px] text-zinc-200 font-semibold">{field.value}</div>
        </div>
      ))}
    </div>
  );
}

function PendingActionCard({ action, projectId, onConfirm, onCancel }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] font-semibold text-zinc-200">{action.domainLabel}</div>
          {action.params?.cost != null && (
            <div className="mt-1 flex items-center gap-1 font-mono text-[10px] text-zinc-400">
              <DollarSign size={10} className="text-amber-400" />
              <span>${(action.params.cost / 100).toFixed(2)}</span>
            </div>
          )}
        </div>
        <ActionStatusBadge status={action.status} label={action.statusLabel} />
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => onConfirm(projectId, action.id)}
          data-testid="external-action-confirm-btn"
          className="font-mono text-[10px] font-semibold bg-amber-500 text-zinc-950 hover:bg-amber-400"
        >
          <Check size={12} className="mr-1.5" />
          Confirm
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onCancel(projectId, action.id)}
          data-testid="external-action-cancel-btn"
          className="font-mono text-[10px] font-semibold border-zinc-600 text-zinc-400 hover:bg-zinc-800"
        >
          <X size={12} className="mr-1.5" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ConfirmedActionCard({ action, projectId, onExecute }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] font-semibold text-zinc-200">{action.domainLabel}</div>
          {action.params?.cost != null && (
            <div className="mt-1 flex items-center gap-1 font-mono text-[10px] text-zinc-400">
              <DollarSign size={10} className="text-cyan-400" />
              <span>${(action.params.cost / 100).toFixed(2)}</span>
            </div>
          )}
        </div>
        <ActionStatusBadge status={action.status} label={action.statusLabel} />
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => onExecute(projectId, action.id)}
          data-testid="external-action-execute-btn"
          className="font-mono text-[10px] font-semibold bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
        >
          <Play size={12} className="mr-1.5" />
          Execute
        </Button>
      </div>
    </div>
  );
}

function ExecutingActionCard({ action }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Loader2 size={14} className="text-emerald-400 animate-spin" />
          <div className="font-mono text-[11px] font-semibold text-zinc-200">{action.domainLabel}</div>
        </div>
        <ActionStatusBadge status={action.status} label={action.statusLabel} />
      </div>
      <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div className="h-full w-2/3 rounded-full bg-emerald-400 animate-pulse" />
      </div>
    </div>
  );
}

function CompletedActionCard({ action }) {
  return (
    <div className="space-y-2" data-testid={`external-action-${action.id}-result`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] font-semibold text-zinc-200">{action.domainLabel}</div>
        </div>
        <ActionStatusBadge status={action.status} label={action.statusLabel} />
      </div>
      <ActionResultDetails result={action.result} />
    </div>
  );
}

function FailedActionCard({ action }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] font-semibold text-zinc-200">{action.domainLabel}</div>
        </div>
        <ActionStatusBadge status={action.status} label={action.statusLabel} />
      </div>
      {action.error && (
        <div
          className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 font-mono text-[10px] text-red-200"
          data-testid={`external-action-${action.id}-error`}
        >
          {typeof action.error === "string" ? action.error : action.error.message ?? JSON.stringify(action.error)}
        </div>
      )}
    </div>
  );
}

function CancelledActionCard({ action }) {
  return (
    <div className="flex items-start justify-between gap-3 opacity-60">
      <div>
        <div className="font-mono text-[11px] font-semibold text-zinc-400">{action.domainLabel}</div>
      </div>
      <ActionStatusBadge status={action.status} label={action.statusLabel} />
    </div>
  );
}

function ActionCard({ action, projectId, onConfirm, onCancel, onExecute }) {
  const borderTone = {
    pending: "border-amber-500/20",
    confirmed: "border-cyan-500/20",
    executing: "border-emerald-500/20",
    completed: "border-green-500/20",
    failed: "border-red-500/20",
    cancelled: "border-zinc-700",
  };

  return (
    <div
      className={`rounded-lg border bg-zinc-950/50 px-3 py-2.5 ${borderTone[action.status] ?? "border-zinc-800"}`}
      data-testid={`external-action-${action.id}`}
    >
      {action.status === "pending" && (
        <PendingActionCard action={action} projectId={projectId} onConfirm={onConfirm} onCancel={onCancel} />
      )}
      {action.status === "confirmed" && (
        <ConfirmedActionCard action={action} projectId={projectId} onExecute={onExecute} />
      )}
      {action.status === "executing" && <ExecutingActionCard action={action} />}
      {action.status === "completed" && <CompletedActionCard action={action} />}
      {action.status === "failed" && <FailedActionCard action={action} />}
      {action.status === "cancelled" && <CancelledActionCard action={action} />}
    </div>
  );
}

function PurchaseDomainInitiator({ projectId, domainSignals, onRequest }) {
  const [loading, setLoading] = useState(false);
  const { connected } = useServerSyncStatus();

  if (!domainSignals?.signals?.length) return null;

  const availableDomains = domainSignals.signals.filter(
    (s) => s.status === "available",
  );

  if (availableDomains.length === 0) return null;

  const handlePurchase = async (domain, cost) => {
    setLoading(true);
    try {
      await onRequest(projectId, "domain-purchase", { domain, cost });
    } finally {
      setLoading(false);
    }
  };

  // Parse cost from price string (e.g. "$29/yr" → 2900 pennies)
  const parseCost = (priceStr) => {
    if (!priceStr) return null;
    const match = priceStr.match(/\$?([\d.]+)/);
    if (!match) return null;
    return Math.round(parseFloat(match[1]) * 100);
  };

  return (
    <div className="space-y-2">
      <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-zinc-500">Available domains</div>
      {availableDomains.map((signal, i) => {
        const cost = parseCost(signal.price);
        return (
          <div
            key={signal.domain}
            className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <Globe size={12} className="text-emerald-400" />
              <span className="font-mono text-[11px] text-zinc-200">{signal.domain}</span>
              {signal.price && (
                <span className="font-mono text-[10px] text-zinc-400">{signal.price}</span>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => handlePurchase(signal.domain, cost)}
              disabled={loading || !connected}
              data-testid={`purchase-domain-btn-${i}`}
              className="font-mono text-[10px] font-semibold bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={12} className="mr-1.5 animate-spin" />
              ) : (
                <ShoppingCart size={12} className="mr-1.5" />
              )}
              Purchase
            </Button>
          </div>
        );
      })}
    </div>
  );
}

export default function ExternalActionsPanel({ project, domainSignals }) {
  const {
    confirmExternalAction,
    cancelExternalAction,
    executeExternalAction,
    requestExternalAction,
  } = useLumonActions();

  const externalActions = project?.externalActions;
  const hasActions = externalActions?.hasActions;
  const hasDomainSignals = domainSignals?.signals?.length > 0;

  // Don't render if there's nothing to show
  if (!hasActions && !hasDomainSignals) return null;

  return (
    <Card className="bg-zinc-900/60 border-zinc-800" data-testid="external-actions-panel">
      <CardContent className="p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">External actions</div>
            <div className="mt-1 font-mono text-sm font-bold text-zinc-200">Domain purchases</div>
          </div>
          {hasActions && (
            <div className="flex gap-2 text-[9px] font-mono uppercase tracking-[0.08em] text-zinc-500">
              {externalActions.pendingCount > 0 && (
                <span className="text-amber-300">{externalActions.pendingCount} pending</span>
              )}
              {externalActions.confirmedCount > 0 && (
                <span className="text-cyan-300">{externalActions.confirmedCount} confirmed</span>
              )}
              {externalActions.completedCount > 0 && (
                <span className="text-green-300">{externalActions.completedCount} completed</span>
              )}
              {externalActions.failedCount > 0 && (
                <span className="text-red-300">{externalActions.failedCount} failed</span>
              )}
            </div>
          )}
        </div>

        {/* Purchase domain initiation — only shown when domain signals have available domains */}
        {hasDomainSignals && (
          <PurchaseDomainInitiator
            projectId={project.id}
            domainSignals={domainSignals}
            onRequest={requestExternalAction}
          />
        )}

        {/* Empty state when no actions exist yet */}
        {!hasActions && hasDomainSignals && (
          <div className="font-mono text-[10px] text-zinc-500 leading-relaxed">
            No domain purchase actions initiated yet. Select an available domain above to begin.
          </div>
        )}

        {/* Action list */}
        {hasActions && (
          <div className="space-y-2">
            {externalActions.actions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                projectId={project.id}
                onConfirm={confirmExternalAction}
                onCancel={cancelExternalAction}
                onExecute={executeExternalAction}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
