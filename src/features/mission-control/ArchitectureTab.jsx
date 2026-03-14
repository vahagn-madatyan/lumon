import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useLumonSelector } from "@/lumon/context";
import {
  selectFleetMetrics,
  selectOrchestrationInput,
  selectSelectedProjectDetail,
} from "@/lumon/selectors";
import { Database, Globe, Layers, Monitor, Server, Shield } from "lucide-react";

const ARCHITECTURE_LAYERS = [
  {
    id: "browser",
    title: "Browser layer",
    subtitle: "Mission shell, dashboard cards, terminals, and flow canvas",
    icon: Monitor,
    color: "text-blue-400",
    points: [
      "Dashboard and orchestration surfaces read shared Lumon selectors.",
      "React Flow nodes and edges stay local to the orchestration module.",
      "Transient UI state (modal intake queue, terminal playback) stays surface-owned.",
    ],
  },
  {
    id: "server",
    title: "Application layer",
    subtitle: "Reducer-backed provider boundary for project, agent, and stage state",
    icon: Server,
    color: "text-emerald-400",
    points: [
      "MissionControl mounts a Lumon provider seeded from canonical demo state.",
      "Dashboard, orchestration, and floor tabs synchronize through one selection contract.",
      "Status transitions update agent records without freezing stage labels into the store.",
    ],
  },
  {
    id: "data",
    title: "Domain layer",
    subtitle: "Canonical project, execution, and approval models from T01",
    icon: Database,
    color: "text-purple-400",
    points: [
      "Projects own agents; execution stages reference agent IDs.",
      "Selectors project dashboard, orchestration, and floor view models from one state tree.",
      "Approval metadata remains open-ended for later taxonomy work.",
    ],
  },
];

const SUBSYSTEMS = [
  {
    label: "Transport",
    icon: Globe,
    text: "Tailscale + WebSocket transport stays outside the provider contract; this tab documents the runtime boundary rather than hardcoding runtime state.",
  },
  {
    label: "Operator guardrails",
    icon: Shield,
    text: "Shared selectors feed explicit proof surfaces: reducer tests, shell integration tests, browser assertions, and later floor synchronization checks.",
  },
];

export default function ArchitectureTab() {
  const metrics = useLumonSelector(selectFleetMetrics);
  const selectedProject = useLumonSelector(selectSelectedProjectDetail);
  const orchestration = useLumonSelector(selectOrchestrationInput);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(0,229,155,0.6)]" />
        <div>
          <h2 className="font-mono text-base font-bold text-zinc-200 tracking-[0.15em] uppercase">
            System architecture
          </h2>
          <div className="font-mono text-[11px] text-zinc-500">
            Provider-backed shell modules over one canonical Lumon state spine.
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Active control lens</div>
                <div className="mt-1 font-mono text-sm font-bold text-zinc-200">{selectedProject?.name}</div>
                <div className="mt-1 font-mono text-[11px] text-zinc-500">{selectedProject?.phaseLabel}</div>
              </div>
              <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 font-mono text-[10px] font-semibold">
                {orchestration.currentStage?.label ?? "No active stage"}
              </Badge>
            </div>
            <div className="font-mono text-[11px] text-zinc-400 leading-relaxed">
              {selectedProject?.description}
            </div>
            <div className="grid gap-2 sm:grid-cols-4 text-[10px] font-mono">
              {[
                { label: "Projects", value: orchestration.availableProjects.length },
                { label: "Agents", value: metrics.total },
                { label: "Running", value: metrics.running },
                { label: "Cost", value: metrics.totalCostLabel },
              ].map((item) => (
                <div key={item.label} className="rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-2">
                  <div className="uppercase tracking-[0.08em] text-zinc-600">{item.label}</div>
                  <div className="mt-1 text-zinc-200 font-semibold">{item.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardContent className="p-4 space-y-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Control-shell guarantees</div>
            <div className="space-y-2">
              {[
                "Dashboard cards consume selector output instead of inline mock arrays.",
                "Orchestration stages are adapter view models over canonical project/agent state.",
                "Modal drafts and canvas gestures stay local so the provider does not absorb purely presentational concerns.",
              ].map((item) => (
                <div key={item} className="rounded border border-zinc-800 bg-zinc-950/70 px-3 py-2 font-mono text-[11px] text-zinc-400">
                  {item}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {ARCHITECTURE_LAYERS.map((layer) => {
          const Icon = layer.icon;
          return (
            <Card key={layer.id} className="bg-zinc-900/60 border-zinc-800">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Icon size={14} className={layer.color} />
                  <div>
                    <div className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-200">
                      {layer.title}
                    </div>
                    <div className="font-mono text-[10px] text-zinc-500">{layer.subtitle}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {layer.points.map((point) => (
                    <div key={point} className="rounded border border-zinc-800 bg-zinc-950/70 px-3 py-2 font-mono text-[11px] text-zinc-400 leading-relaxed">
                      {point}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {SUBSYSTEMS.map((subsystem) => {
          const Icon = subsystem.icon;
          return (
            <Card key={subsystem.label} className="bg-zinc-900/60 border-zinc-800">
              <CardContent className="p-4 flex gap-3">
                <div className="mt-0.5 rounded-md border border-zinc-800 bg-zinc-950/70 p-2 h-fit">
                  <Icon size={14} className="text-zinc-400" />
                </div>
                <div>
                  <div className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-200">
                    {subsystem.label}
                  </div>
                  <div className="mt-2 font-mono text-[11px] text-zinc-400 leading-relaxed">
                    {subsystem.text}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
