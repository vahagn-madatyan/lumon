import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, DollarSign, Clock, History, RefreshCw, AlertCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Event-type → badge colour mapping
// ---------------------------------------------------------------------------
const EVENT_TYPE_CLASSES = {
  "pipeline-triggered": "bg-blue-500/15 text-blue-300 border-blue-500/30",
  "stage-started": "bg-blue-500/15 text-blue-300 border-blue-500/30",
  "stage-completed": "bg-green-500/15 text-green-300 border-green-500/30",
  "pipeline-complete": "bg-green-500/15 text-green-300 border-green-500/30",
  "stage-failed": "bg-red-500/15 text-red-300 border-red-500/30",
  "pipeline-failed": "bg-red-500/15 text-red-300 border-red-500/30",
  "escalation-raised": "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "approval-granted": "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "action-confirmed": "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  "action-cancelled": "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

const DEFAULT_TYPE_CLASS = "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";

function eventBadgeClass(eventType) {
  return EVENT_TYPE_CLASSES[eventType] ?? DEFAULT_TYPE_CLASS;
}

// ---------------------------------------------------------------------------
// Relative timestamp helper
// ---------------------------------------------------------------------------
function relativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Extract a human-readable summary line from event data
// ---------------------------------------------------------------------------
function eventSummary(event) {
  const data = event.data;
  if (!data) return event.eventType;

  if (data.stageName) {
    return `${data.stageName}${data.status ? ` → ${data.status}` : ""}`;
  }
  if (data.message) return data.message;
  if (data.reason) return data.reason;
  if (typeof data === "string") return data;

  return event.eventType;
}

// ---------------------------------------------------------------------------
// Format USD cost
// ---------------------------------------------------------------------------
function fmtCost(v) {
  return `$${Number(v).toFixed(4)}`;
}

function fmtTokens(v) {
  const n = Number(v);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// ActivityTab component
// ---------------------------------------------------------------------------
export default function ActivityTab() {
  const [events, setEvents] = useState([]);
  const [cost, setCost] = useState([]);
  const [eventsError, setEventsError] = useState(null);
  const [costError, setCostError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setEventsError(null);
    setCostError(null);

    const [eventsResult, costResult] = await Promise.allSettled([
      fetch("/api/audit/events?limit=50").then((r) => {
        if (!r.ok) throw new Error(`Events fetch failed (${r.status})`);
        return r.json();
      }),
      fetch("/api/audit/cost").then((r) => {
        if (!r.ok) throw new Error(`Cost fetch failed (${r.status})`);
        return r.json();
      }),
    ]);

    if (eventsResult.status === "fulfilled") {
      setEvents(eventsResult.value);
    } else {
      setEventsError(eventsResult.reason.message);
    }

    if (costResult.status === "fulfilled") {
      setCost(costResult.value);
    } else {
      setCostError(costResult.reason.message);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fleet totals for cost table
  const fleetTotals = cost.reduce(
    (acc, row) => ({
      totalCostUsd: acc.totalCostUsd + (row.totalCostUsd ?? 0),
      tokensInput: acc.tokensInput + (row.tokensInput ?? 0),
      tokensOutput: acc.tokensOutput + (row.tokensOutput ?? 0),
      invocations: acc.invocations + (row.invocations ?? 0),
    }),
    { totalCostUsd: 0, tokensInput: 0, tokensOutput: 0, invocations: 0 },
  );

  return (
    <div className="flex flex-col gap-5 p-5 h-full overflow-auto">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History size={16} className="text-emerald-400" />
          <span className="font-mono text-sm font-bold tracking-wide text-zinc-200">
            ACTIVITY HISTORY
          </span>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-colors font-mono text-[11px] disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Activity Timeline */}
      <Card className="bg-zinc-900/50 border-zinc-700">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} className="text-blue-400" />
            <span className="font-mono text-[11px] font-semibold tracking-wide text-zinc-300">
              EVENT TIMELINE
            </span>
          </div>

          {eventsError ? (
            <div className="flex items-center gap-2 text-red-400 font-mono text-[11px] py-3">
              <AlertCircle size={14} />
              <span>{eventsError}</span>
            </div>
          ) : events.length === 0 ? (
            <div className="flex items-center gap-2 text-zinc-500 font-mono text-[11px] py-6 justify-center">
              <Clock size={14} />
              <span>No activity recorded yet</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-[400px] overflow-auto">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-zinc-800/50 transition-colors"
                >
                  <span className="font-mono text-[10px] text-zinc-500 tabular-nums w-14 shrink-0 text-right">
                    {relativeTime(ev.timestamp)}
                  </span>
                  <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/30 font-mono text-[10px] shrink-0">
                    {ev.projectId}
                  </Badge>
                  <Badge className={`${eventBadgeClass(ev.eventType)} font-mono text-[10px] shrink-0`}>
                    {ev.eventType}
                  </Badge>
                  <span className="font-mono text-[11px] text-zinc-400 truncate">
                    {eventSummary(ev)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost History */}
      <Card className="bg-zinc-900/50 border-zinc-700">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={14} className="text-emerald-400" />
            <span className="font-mono text-[11px] font-semibold tracking-wide text-zinc-300">
              COST HISTORY
            </span>
          </div>

          {costError ? (
            <div className="flex items-center gap-2 text-red-400 font-mono text-[11px] py-3">
              <AlertCircle size={14} />
              <span>{costError}</span>
            </div>
          ) : cost.length === 0 ? (
            <div className="flex items-center gap-2 text-zinc-500 font-mono text-[11px] py-6 justify-center">
              <DollarSign size={14} />
              <span>No cost data available</span>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full font-mono text-[11px]">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-700/50">
                    <th className="text-left py-1.5 px-2 font-semibold">Project</th>
                    <th className="text-right py-1.5 px-2 font-semibold">Cost (USD)</th>
                    <th className="text-right py-1.5 px-2 font-semibold">Input Tokens</th>
                    <th className="text-right py-1.5 px-2 font-semibold">Output Tokens</th>
                    <th className="text-right py-1.5 px-2 font-semibold">Agents</th>
                  </tr>
                </thead>
                <tbody>
                  {cost.map((row) => (
                    <tr key={row.projectId} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="py-1.5 px-2 text-zinc-300">{row.projectId}</td>
                      <td className="py-1.5 px-2 text-right text-emerald-400 tabular-nums">{fmtCost(row.totalCostUsd)}</td>
                      <td className="py-1.5 px-2 text-right text-zinc-400 tabular-nums">{fmtTokens(row.tokensInput)}</td>
                      <td className="py-1.5 px-2 text-right text-zinc-400 tabular-nums">{fmtTokens(row.tokensOutput)}</td>
                      <td className="py-1.5 px-2 text-right text-zinc-400 tabular-nums">{row.invocations}</td>
                    </tr>
                  ))}
                  {/* Fleet totals row */}
                  <tr className="border-t border-zinc-600/50 font-semibold">
                    <td className="py-1.5 px-2 text-zinc-200">Fleet Total</td>
                    <td className="py-1.5 px-2 text-right text-emerald-300 tabular-nums">{fmtCost(fleetTotals.totalCostUsd)}</td>
                    <td className="py-1.5 px-2 text-right text-zinc-300 tabular-nums">{fmtTokens(fleetTotals.tokensInput)}</td>
                    <td className="py-1.5 px-2 text-right text-zinc-300 tabular-nums">{fmtTokens(fleetTotals.tokensOutput)}</td>
                    <td className="py-1.5 px-2 text-right text-zinc-300 tabular-nums">{fleetTotals.invocations}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
