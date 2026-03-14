import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLumonActions } from "@/lumon/context";
import { CheckCircle2, RotateCcw, Square } from "lucide-react";

const SAMPLE_TERMINAL_LINES = [
  { id: 1, text: "$ gsd execute --plan active --surface mission-control" },
  { id: 2, text: '{"type":"system","message":"Lumon orchestration stream attached"}' },
  { id: 3, text: '{"type":"assistant","message":"Reading canonical reducer state before writing files."}' },
  { id: 4, text: '{"type":"tool_use","tool":"Read","target":"src/lumon/selectors.js"}' },
  { id: 5, text: '{"type":"tool_use","tool":"Write","target":"src/features/mission-control/OrchestrationTab.jsx"}' },
  { id: 6, text: " PASS src/features/mission-control/__tests__/mission-control-shell.test.jsx" },
  { id: 7, text: "State sync verified across dashboard + orchestration detail surfaces." },
];

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

const colorizeLine = (text) => {
  if (text.startsWith("$")) return "text-emerald-400";
  if (text.startsWith(" PASS")) return "text-green-400";
  if (text.includes('"tool_use"')) return "text-amber-400";
  if (text.includes('"assistant"')) return "text-blue-400";
  return "text-zinc-500";
};

export default function TerminalPanel({ agent }) {
  const { setAgentStatus } = useLumonActions();
  const [lines, setLines] = useState([]);
  const viewportRef = useRef(null);

  useEffect(() => {
    if (!agent || agent.status === "queued") {
      return undefined;
    }

    let cursor = 0;
    const intervalId = window.setInterval(() => {
      cursor += 1;
      setLines(SAMPLE_TERMINAL_LINES.slice(0, cursor));

      if (cursor >= SAMPLE_TERMINAL_LINES.length) {
        window.clearInterval(intervalId);
      }
    }, 180);

    return () => window.clearInterval(intervalId);
  }, [agent]);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [lines]);

  const actionButtons = useMemo(() => {
    if (!agent) {
      return null;
    }

    if (agent.status === "failed") {
      return (
        <Button
          type="button"
          size="sm"
          onClick={() => setAgentStatus(agent, "running", { progress: Math.max(agent.progress, 18) })}
          className="bg-amber-500 text-zinc-950 hover:bg-amber-400 font-mono text-[10px] font-bold h-7 px-3"
        >
          <RotateCcw size={12} className="mr-1" />
          Retry agent
        </Button>
      );
    }

    if (agent.status === "running") {
      return (
        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAgentStatus(agent, "failed")}
            className="border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 font-mono text-[10px] font-bold h-7 px-3"
          >
            <Square size={10} className="mr-1" />
            Stop agent
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setAgentStatus(agent, "complete")}
            className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400 font-mono text-[10px] font-bold h-7 px-3"
          >
            <CheckCircle2 size={12} className="mr-1" />
            Mark complete
          </Button>
        </div>
      );
    }

    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setAgentStatus(agent, "queued")}
        className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-mono text-[10px] font-bold h-7 px-3"
      >
        Queue again
      </Button>
    );
  }, [agent, setAgentStatus]);

  return (
    <Card className="h-full flex flex-col overflow-hidden bg-black border-zinc-800">
      <div className="flex items-center justify-between gap-4 px-3.5 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            </div>
            <span className="font-mono text-[11px] text-zinc-500 truncate">
              {agent ? `tmux:${agent.name.toLowerCase()} · ${agent.modelLabel}` : "Select an agent to attach a session"}
            </span>
          </div>
          {agent && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono text-zinc-500">
              <span>{agent.projectName}</span>
              <span>•</span>
              <span>{agent.planId}</span>
              <span>•</span>
              <span>{agent.task}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {agent && <StatusBadge status={agent.status} />}
          {actionButtons}
        </div>
      </div>

      <div className="px-3.5 py-2 border-b border-zinc-900 bg-zinc-950/80">
        <div className="grid grid-cols-4 gap-2 font-mono text-[10px]">
          {[
            { label: "Progress", value: agent ? `${agent.progress}%` : "—" },
            { label: "Tokens", value: agent ? agent.tokensLabel : "—" },
            { label: "Cost", value: agent ? agent.costLabel : "—" },
            { label: "Elapsed", value: agent ? agent.elapsedLabel : "—" },
          ].map((item) => (
            <div key={item.label} className="rounded border border-zinc-900 bg-zinc-950/80 px-2 py-1.5">
              <div className="text-zinc-600 uppercase tracking-[0.08em]">{item.label}</div>
              <div className="mt-1 text-zinc-300 font-semibold">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div ref={viewportRef} className="p-3.5 font-mono text-[12px] leading-[1.7]">
          {!agent ? (
            <span className="text-zinc-600">Select an agent from the dashboard to inspect its live terminal surface.</span>
          ) : agent.status === "queued" ? (
            <span className="text-zinc-600">Agent queued — waiting for upstream wave capacity before booting the terminal stream.</span>
          ) : (
            lines.map((line) => (
              <div key={line.id} className={`break-all ${colorizeLine(line.text)}`}>
                {line.text}
              </div>
            ))
          )}
          {agent?.status === "running" && <span className="text-emerald-400 animate-pulse">█</span>}
        </div>
      </ScrollArea>
    </Card>
  );
}
