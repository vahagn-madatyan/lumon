import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Monitor,
  Server,
  Database,
  Cpu,
  Globe,
  Play,
  Square,
  RotateCcw,
  Plus,
  ChevronDown,
  Terminal as TerminalIcon,
  Activity,
  Zap,
  DollarSign,
  Hash,
  Shield,
  Clock,
  GitBranch,
  Search,
  FileText,
  Layers,
  Bot,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Workflow,
  Timer,
} from "lucide-react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  getBezierPath,
  BaseEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import SeveranceFloor from "./severance-floor";

// ── Color tokens ───────────────────────────────────────────────────
const C = {
  accent: "#00e59b",
  amber: "#f0a030",
  red: "#f85149",
  blue: "#58a6ff",
  purple: "#bc8cff",
  cyan: "#39d2e0",
  green: "#3fb950",
};

// ── Mock Data ──────────────────────────────────────────────────────
const MOCK_PROJECTS = [
  {
    id: "wheely",
    name: "Wheely",
    desc: "Stock screening & portfolio analytics platform",
    phase: "Phase 2 — Booking Engine",
    agents: [
      { id: "a1", name: "Agent-01", type: "claude", plan: "03-01", task: "Filter functions & HV computation", wave: 1, status: "running", tokens: 147832, cost: 2.41, elapsed: "24m", progress: 68 },
      { id: "a2", name: "Agent-02", type: "claude", plan: "03-02", task: "Scoring engine + pipeline orchestrator", wave: 1, status: "running", tokens: 89214, cost: 1.55, elapsed: "18m", progress: 42 },
      { id: "a3", name: "Agent-03", type: "codex", plan: "03-03", task: "API routes & validation layer", wave: 2, status: "queued", tokens: 0, cost: 0, elapsed: "—", progress: 0 },
    ],
    waves: { current: 1, total: 2 },
  },
  {
    id: "tattoo-bot",
    name: "Tattoo Bot",
    desc: "AI tattoo design assistant with style transfer",
    phase: "Phase 2 — Authentication",
    agents: [
      { id: "a4", name: "Agent-04", type: "claude", plan: "auth-01", task: "Login/signup screens + magic link", wave: 1, status: "running", tokens: 52100, cost: 0.88, elapsed: "11m", progress: 35 },
      { id: "a5", name: "Agent-05", type: "claude", plan: "auth-02", task: "Session persistence & auth store", wave: 1, status: "complete", tokens: 186420, cost: 3.12, elapsed: "42m", progress: 100 },
    ],
    waves: { current: 1, total: 3 },
  },
  {
    id: "policy-gsd",
    name: "Policy Engine",
    desc: "VPC flow log parser & normalization pipeline",
    phase: "Phase 1 — Log Ingestion",
    agents: [
      { id: "a6", name: "Agent-06", type: "codex", plan: "log-01", task: "S3 discovery pattern + VPC Flow Log versions", wave: 1, status: "failed", tokens: 34210, cost: 0.21, elapsed: "8m", progress: 23 },
    ],
    waves: { current: 1, total: 1 },
  },
  {
    id: "crm-ai", name: "CRM AI", desc: "Intelligent CRM with deal scoring & forecasting",
    phase: "Phase 3 — Pipeline Analytics",
    agents: [
      { id: "a7", name: "Agent-07", type: "claude", plan: "crm-01", task: "Deal scoring ML model integration", wave: 1, status: "running", tokens: 201440, cost: 3.45, elapsed: "32m", progress: 78 },
      { id: "a8", name: "Agent-08", type: "claude", plan: "crm-02", task: "Revenue forecast dashboard", wave: 1, status: "running", tokens: 112300, cost: 1.92, elapsed: "21m", progress: 55 },
      { id: "a9", name: "Agent-09", type: "codex", plan: "crm-03", task: "Email sync & thread parsing", wave: 2, status: "queued", tokens: 0, cost: 0, elapsed: "—", progress: 0 },
    ],
    waves: { current: 1, total: 3 },
  },
  {
    id: "mesh-net", name: "MeshNet", desc: "Decentralized mesh networking protocol",
    phase: "Phase 1 — Core Protocol",
    agents: [
      { id: "a10", name: "Agent-10", type: "claude", plan: "mesh-01", task: "Peer discovery & NAT traversal", wave: 1, status: "running", tokens: 178200, cost: 2.88, elapsed: "28m", progress: 61 },
      { id: "a11", name: "Agent-11", type: "codex", plan: "mesh-02", task: "Gossip protocol implementation", wave: 1, status: "complete", tokens: 245000, cost: 4.10, elapsed: "51m", progress: 100 },
    ],
    waves: { current: 1, total: 2 },
  },
  {
    id: "doc-mind", name: "DocMind", desc: "AI document understanding & extraction pipeline",
    phase: "Phase 2 — Table Extraction",
    agents: [
      { id: "a12", name: "Agent-12", type: "claude", plan: "doc-01", task: "PDF table detection with vision model", wave: 1, status: "running", tokens: 94500, cost: 1.62, elapsed: "15m", progress: 38 },
      { id: "a13", name: "Agent-13", type: "claude", plan: "doc-02", task: "OCR fallback for scanned docs", wave: 1, status: "queued", tokens: 0, cost: 0, elapsed: "—", progress: 0 },
      { id: "a14", name: "Agent-14", type: "codex", plan: "doc-03", task: "Schema inference from headers", wave: 2, status: "queued", tokens: 0, cost: 0, elapsed: "—", progress: 0 },
    ],
    waves: { current: 1, total: 2 },
  },
  {
    id: "fleet-ops", name: "FleetOps", desc: "Vehicle fleet management & route optimization",
    phase: "Phase 1 — GPS Ingestion",
    agents: [
      { id: "a15", name: "Agent-15", type: "claude", plan: "fleet-01", task: "Real-time GPS stream processor", wave: 1, status: "complete", tokens: 310000, cost: 5.30, elapsed: "1h 12m", progress: 100 },
      { id: "a16", name: "Agent-16", type: "codex", plan: "fleet-02", task: "Geofence alerting engine", wave: 1, status: "complete", tokens: 198000, cost: 3.40, elapsed: "48m", progress: 100 },
    ],
    waves: { current: 2, total: 2 },
  },
  {
    id: "sonic-id", name: "SonicID", desc: "Audio fingerprinting & music recognition",
    phase: "Phase 1 — Feature Extraction",
    agents: [
      { id: "a17", name: "Agent-17", type: "claude", plan: "sonic-01", task: "Spectrogram generator & chromaprint", wave: 1, status: "running", tokens: 67200, cost: 1.15, elapsed: "9m", progress: 22 },
    ],
    waves: { current: 1, total: 3 },
  },
  {
    id: "pixel-forge", name: "PixelForge", desc: "AI image generation pipeline with LoRA training",
    phase: "Phase 2 — Training Pipeline",
    agents: [
      { id: "a18", name: "Agent-18", type: "claude", plan: "pf-01", task: "Dataset curator & augmentation", wave: 1, status: "running", tokens: 156000, cost: 2.67, elapsed: "26m", progress: 72 },
      { id: "a19", name: "Agent-19", type: "codex", plan: "pf-02", task: "LoRA training loop & checkpoints", wave: 1, status: "failed", tokens: 88400, cost: 0.52, elapsed: "12m", progress: 31 },
      { id: "a20", name: "Agent-20", type: "claude", plan: "pf-03", task: "Inference API with batching", wave: 2, status: "queued", tokens: 0, cost: 0, elapsed: "—", progress: 0 },
      { id: "a21", name: "Agent-21", type: "codex", plan: "pf-04", task: "Image quality scoring model", wave: 2, status: "queued", tokens: 0, cost: 0, elapsed: "—", progress: 0 },
    ],
    waves: { current: 1, total: 2 },
  },
  {
    id: "lingua", name: "Lingua", desc: "Real-time translation & localization engine",
    phase: "Phase 1 — Core Translation",
    agents: [
      { id: "a22", name: "Agent-22", type: "claude", plan: "lng-01", task: "Transformer model fine-tuning pipeline", wave: 1, status: "complete", tokens: 402000, cost: 6.88, elapsed: "1h 34m", progress: 100 },
      { id: "a23", name: "Agent-23", type: "claude", plan: "lng-02", task: "Context-aware glossary system", wave: 1, status: "complete", tokens: 287000, cost: 4.91, elapsed: "58m", progress: 100 },
      { id: "a24", name: "Agent-24", type: "codex", plan: "lng-03", task: "Streaming translation WebSocket API", wave: 2, status: "running", tokens: 134000, cost: 2.29, elapsed: "22m", progress: 48 },
    ],
    waves: { current: 2, total: 3 },
  },
  {
    id: "vault-guard", name: "VaultGuard", desc: "Secret rotation & compliance automation",
    phase: "Phase 2 — Auto-Rotation",
    agents: [
      { id: "a25", name: "Agent-25", type: "claude", plan: "vg-01", task: "Credential scanner & inventory", wave: 1, status: "complete", tokens: 178000, cost: 3.05, elapsed: "35m", progress: 100 },
      { id: "a26", name: "Agent-26", type: "claude", plan: "vg-02", task: "Rotation scheduler with rollback", wave: 2, status: "running", tokens: 92300, cost: 1.58, elapsed: "14m", progress: 44 },
    ],
    waves: { current: 2, total: 3 },
  },
  {
    id: "event-hive", name: "EventHive", desc: "Event-driven microservice orchestration",
    phase: "Phase 1 — Message Bus",
    agents: [
      { id: "a27", name: "Agent-27", type: "codex", plan: "eh-01", task: "NATS JetStream wrapper & retry logic", wave: 1, status: "running", tokens: 143000, cost: 0.88, elapsed: "19m", progress: 56 },
      { id: "a28", name: "Agent-28", type: "claude", plan: "eh-02", task: "Dead letter queue & monitoring", wave: 1, status: "queued", tokens: 0, cost: 0, elapsed: "—", progress: 0 },
      { id: "a29", name: "Agent-29", type: "codex", plan: "eh-03", task: "Schema registry & versioning", wave: 1, status: "queued", tokens: 0, cost: 0, elapsed: "—", progress: 0 },
    ],
    waves: { current: 1, total: 2 },
  },
  {
    id: "holo-meet", name: "HoloMeet", desc: "Spatial video conferencing with 3D avatars",
    phase: "Phase 3 — Avatar System",
    agents: [
      { id: "a30", name: "Agent-30", type: "claude", plan: "hm-01", task: "Face mesh tracking & rigging", wave: 1, status: "running", tokens: 221000, cost: 3.78, elapsed: "37m", progress: 82 },
      { id: "a31", name: "Agent-31", type: "claude", plan: "hm-02", task: "Lip-sync audio alignment", wave: 1, status: "running", tokens: 167000, cost: 2.86, elapsed: "29m", progress: 63 },
      { id: "a32", name: "Agent-32", type: "codex", plan: "hm-03", task: "WebRTC spatial audio mixing", wave: 2, status: "queued", tokens: 0, cost: 0, elapsed: "—", progress: 0 },
    ],
    waves: { current: 1, total: 3 },
  },
  {
    id: "carbon-track", name: "CarbonTrack", desc: "Supply chain carbon footprint calculator",
    phase: "Phase 1 — Data Collection",
    agents: [
      { id: "a33", name: "Agent-33", type: "claude", plan: "ct-01", task: "Emission factor database & API", wave: 1, status: "complete", tokens: 195000, cost: 3.34, elapsed: "41m", progress: 100 },
    ],
    waves: { current: 2, total: 2 },
  },
];

const MOCK_TERMINAL_LINES = [
  { t: 0, text: "$ claude -p 'Execute plan 03-01...' --dangerously-skip-permissions --output-format stream-json" },
  { t: 1, text: '{"type":"system","message":"Claude Code v1.0.31 | Model: claude-sonnet-4-20250514"}' },
  { t: 2, text: '{"type":"assistant","message":"I\'ll implement the 10 screening filter functions..."}' },
  { t: 3, text: '{"type":"tool_use","tool":"Write","file":"src/filters/price-range.ts"}' },
  { t: 4, text: '{"type":"tool_use","tool":"Write","file":"src/filters/volume-filter.ts"}' },
  { t: 5, text: '{"type":"tool_use","tool":"Write","file":"src/filters/rsi-filter.ts"}' },
  { t: 6, text: '{"type":"tool_use","tool":"Bash","command":"npm run test -- --filter=filters"}' },
  { t: 7, text: " PASS  tests/filters/price-range.test.ts (4 tests)" },
  { t: 8, text: " PASS  tests/filters/volume-filter.test.ts (3 tests)" },
  { t: 9, text: " PASS  tests/filters/rsi-filter.test.ts (5 tests)" },
  { t: 10, text: '{"type":"assistant","message":"All filter functions passing. Now implementing SMA200..."}' },
  { t: 11, text: '{"type":"tool_use","tool":"Write","file":"src/filters/sma200-filter.ts"}' },
  { t: 12, text: '{"type":"tool_use","tool":"Write","file":"src/filters/market-cap-filter.ts"}' },
  { t: 13, text: '{"type":"tool_use","tool":"Bash","command":"git add . && git commit -m \\"feat(03-01): add filter functions\\""}' },
  { t: 14, text: "Architecting... (2m 42s · ↑ 7.3k tokens)" },
];

const ARCH_LAYERS = [
  {
    id: "browser", label: "BROWSER LAYER", sublabel: "React 19 + xterm.js 5 + WebSocket client", color: C.blue, icon: Monitor,
    nodes: [
      { id: "terminals", label: "Agent Terminals", desc: "xterm.js 5 instances per tmux pane — full interactive I/O with WebGL rendering" },
      { id: "status", label: "Agent Status Cards", desc: "Real-time health, tokens, cost, wave assignment per agent" },
      { id: "dashboard", label: "Project Overview", desc: "Multi-project dashboard: progress tracking, cost rollup, wave timeline" },
      { id: "gsd-viewer", label: "GSD Planning Viewer", desc: "Renders .planning/ hierarchy: phases → waves → plans → tasks from markdown + YAML" },
    ],
  },
  {
    id: "transport", label: "TRANSPORT LAYER", sublabel: "Tailscale Serve (auto-HTTPS, MagicDNS, identity headers)", color: C.cyan, icon: Globe,
    nodes: [
      { id: "ws-router", label: "WebSocket (ws)", desc: "Per-pane rooms, fan-out to subscribers, binary frames for terminal data, auth via first-message token" },
      { id: "tailscale", label: "Tailscale Serve", desc: "Auto-HTTPS, MagicDNS, WireGuard P2P. Identity headers: Tailscale-User-Login, -Name, -Profile-Pic for zero-config auth" },
    ],
  },
  {
    id: "server", label: "SERVER LAYER", sublabel: "Node.js 22 + Custom HTTP Server + ws", color: C.accent, icon: Server,
    nodes: [
      { id: "rest-api", label: "REST API", desc: "/api/projects CRUD, /api/agents spawn/kill/retry, /api/gsd state reads, /api/system health, /api/hooks/pane-died callback" },
      { id: "ws-server", label: "WebSocket Server", desc: "Per-pane rooms for terminal output, status update broadcast, command relay. Handles terminal:subscribe/unsubscribe" },
      { id: "tmux-bridge", label: "tmux Bridge", desc: "Control mode (-CC) child process. Parses %output octal-escaped data, routes to WS rooms. Reconnect with exponential backoff" },
      { id: "orchestrator", label: "Orchestration Engine", desc: "State machine per project: IDLE → PLANNING → WAVE_RUNNING → WAVE_COMPLETE → ... → PROJECT_COMPLETE. Manages wave transitions" },
      { id: "wave-sched", label: "Wave Scheduler", desc: "Reads GSD wave assignments from plan frontmatter. Parallel dispatch within wave, sequential between waves. Triggers next wave on all-complete" },
      { id: "agent-lifecycle", label: "Agent Lifecycle Mgr", desc: "spawn → monitor → complete/fail/retry. Creates git worktree, tmux session, sends agent command, registers in SQLite" },
      { id: "health-monitor", label: "Health Monitor", desc: "Polls tmux list-panes every 3s for #{pane_dead}, #{pane_dead_status}. Hooks: pane-died → curl /api/hooks/pane-died" },
      { id: "gsd-bridge", label: "GSD Bridge", desc: "Shells out to gsd-tools.cjs CLI (init, phase-plan-index, state advance-plan, verify). Parses .planning/ YAML frontmatter via gray-matter" },
    ],
  },
  {
    id: "data", label: "DATA LAYER", sublabel: "SQLite (better-sqlite3) + .planning/ filesystem + git worktrees", color: C.purple, icon: Database,
    nodes: [
      { id: "sqlite", label: "SQLite (WAL)", desc: "Tables: projects, agents (status/tokens/cost/tmux_pane/worktree), events (append-only log). Indexes on project+timestamp, type+timestamp" },
      { id: "planning", label: ".planning/ Filesystem", desc: "PROJECT.md, ROADMAP.md, phase dirs with CONTEXT.md, PLAN.md, RESEARCH.md. Watched via fs.watch for external GSD changes" },
      { id: "worktrees", label: "Git Worktrees", desc: "One worktree per agent at .worktrees/<agent-id>. Auto-created on spawn, auto-cleaned on complete. Shares git object store" },
    ],
  },
  {
    id: "runtime", label: "RUNTIME LAYER", sublabel: "tmux server + AI agent processes", color: C.amber, icon: Cpu,
    nodes: [
      { id: "claude", label: "Claude Code Agent", desc: "claude -p '<prompt>' --dangerously-skip-permissions --output-format stream-json --max-turns 250 --max-budget-usd 15 --allowedTools Bash,Write,Read,Glob,Grep" },
      { id: "codex", label: "Codex CLI Agent", desc: "codex exec --full-auto --json '<prompt>'. Sandbox: network-none (restricted) or workspace-write (custom)" },
      { id: "tmux-sessions", label: "tmux Sessions", desc: "Session per agent: mc-a001, mc-a002, ... remain-on-exit: on. Hooks: pane-died → curl callback. Wave + plan ref per session" },
    ],
  },
];

const ARCH_CONNECTIONS = [
  { label: "WS frames + xterm I/O" },
  { label: "HTTPS + WS upgrade" },
  { label: "SQLite reads/writes + fs.watch" },
  { label: "tmux -CC control mode + send-keys" },
];

// ── Data Flows (from architecture doc) ──────────────────────────────
const DATA_FLOWS = [
  {
    id: "spawn", label: "Agent Spawn Flow", color: C.accent,
    steps: [
      'User clicks "Spawn Project" in GUI',
      "REST POST /api/projects",
      "Orchestrator reads GSD .planning/ via gsd-tools.cjs",
      "Parses wave assignments from plan frontmatter",
      "For each plan in Wave 1:",
      "  → git worktree add .worktrees/<agent-id>",
      "  → tmux new-session -d -s mc-<agent-id>",
      "  → send-keys '<claude|codex cmd>' C-m",
      "  → Register agent in SQLite",
      "  → tmux Bridge attaches control mode",
      "WebSocket broadcasts agent:spawned",
    ],
  },
  {
    id: "terminal", label: "Terminal Streaming Flow", color: C.blue,
    steps: [
      "tmux control mode (-CC) child process",
      "Emits: %output %<pane_id> <octal-escaped-data>",
      "tmux Bridge parses, decodes octal escapes",
      "Routes to WebSocket room: terminal:<pane_id>",
      "Browser xterm.js instance renders output",
    ],
  },
  {
    id: "wave", label: "Wave Transition Flow", color: C.amber,
    steps: [
      "Health Monitor detects all Wave N agents complete",
      "  (pane_dead + exit 0 for every agent in wave)",
      "Orchestrator calls gsd-tools.cjs state advance-plan",
      "Reads Wave N+1 plans from .planning/",
      "Spawns new agent sessions for next wave",
      "WebSocket broadcasts wave:advanced event",
    ],
  },
  {
    id: "input", label: "User Input Flow", color: C.cyan,
    steps: [
      "User types in xterm.js terminal in browser",
      'WS message: { type: "input", paneId: "%5", data: "ls\\r" }',
      'Server: tmux send-keys -t %5 "ls" Enter',
      "Output flows back via control mode %output",
    ],
  },
];

// ── ADRs ────────────────────────────────────────────────────────────
const ADRS = [
  { id: "001", title: "tmux Control Mode over Polling", decision: "Use tmux -CC for real-time output streaming instead of polling capture-pane.", rationale: "Event-driven, delivers output as it occurs, provides lifecycle notifications. Validated by tmuxy, WebMux, Agentboard.", tradeoff: "Single connection per tmux server — if it drops, all streams stop. Mitigated with auto-reconnect + exponential backoff." },
  { id: "002", title: "GSD as External Dependency", decision: "Shell out to gsd-tools.cjs and parse .planning/ files rather than embedding GSD.", rationale: "GSD evolves independently. CLI + filesystem is a stable interface. GSD can run in its own terminal alongside Mission Control.", tradeoff: "CLI calls add ~50-100ms latency per invocation. Acceptable for non-real-time operations." },
  { id: "003", title: "SQLite over PostgreSQL", decision: "Use better-sqlite3 for all persistence.", rationale: "Zero config, no daemon, single-file backup, WAL mode handles concurrent reads. 10-20 agents well within limits.", tradeoff: "Single-writer. Not a problem at target scale. Migration path to PostgreSQL exists." },
  { id: "004", title: "Custom Server over Next.js", decision: "Use Vite for frontend build, custom Node.js http server for backend.", rationale: "Next.js serverless model conflicts with long-lived WebSocket connections and persistent tmux control mode processes.", tradeoff: "No SSR, no file-based routing. Acceptable — this is an SPA dashboard, not a content site." },
  { id: "005", title: "Git Worktrees for Isolation", decision: "Each agent spawns in its own git worktree branched from main.", rationale: "Prevents file conflicts when multiple agents modify the same codebase. Worktrees share git object store (space efficient).", tradeoff: "Requires merging branches back. GSD's branching strategy (feature branches per plan) handles this." },
];

// ── StatusBadge ────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const variants = {
    running: { classes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", pulse: true },
    complete: { classes: "bg-green-500/15 text-green-400 border-green-500/30", pulse: false },
    failed: { classes: "bg-red-500/15 text-red-400 border-red-500/30", pulse: false },
    queued: { classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30", pulse: false },
  };
  const v = variants[status] || variants.queued;
  return (
    <Badge variant="outline" className={`font-mono text-[10px] font-bold tracking-widest uppercase ${v.classes}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
        status === "running" ? "bg-emerald-400 shadow-[0_0_8px_rgba(0,229,155,0.6)] animate-pulse"
        : status === "complete" ? "bg-green-400"
        : status === "failed" ? "bg-red-400"
        : "bg-zinc-500"
      }`} />
      {status}
    </Badge>
  );
}

// ── Architecture Diagram ───────────────────────────────────────────
function ArchDiagram() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [expandedFlow, setExpandedFlow] = useState(null);
  const [expandedAdr, setExpandedAdr] = useState(null);
  const [showEndpoints, setShowEndpoints] = useState(false);
  const [showWsProtocol, setShowWsProtocol] = useState(false);
  const [showSchema, setShowSchema] = useState(false);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(0,229,155,0.6)]" />
        <h2 className="font-mono text-base font-bold text-zinc-200 tracking-[0.15em] uppercase">
          System Architecture
        </h2>
        <span className="font-mono text-[11px] text-zinc-500">
          MISSION CONTROL v1.0 — Twin Coast Labs
        </span>
      </div>

      {/* ── Layer Diagram ── */}
      <div className="flex flex-col gap-1.5">
        {ARCH_LAYERS.map((layer, li) => {
          const Icon = layer.icon;
          // Server layer has 8 nodes — use 2-row layout
          const isLargeLayer = layer.nodes.length > 4;
          return (
            <div key={layer.id}>
              <Card className="bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 transition-colors group">
                <CardHeader className="p-3.5 pb-2">
                  <div className="flex items-center gap-2.5">
                    <Icon size={14} style={{ color: layer.color }} className="group-hover:drop-shadow-lg transition-all" />
                    <span className="font-mono text-[11px] font-bold tracking-[0.15em]" style={{ color: layer.color }}>
                      {layer.label}
                    </span>
                    <Badge variant="secondary" className="bg-zinc-800 text-zinc-500 text-[10px] font-mono border-none">
                      {layer.sublabel}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-3.5 pt-0">
                  <div className={`grid gap-2 ${
                    isLargeLayer ? "grid-cols-4" :
                    layer.nodes.length <= 2 ? "grid-cols-2" :
                    layer.nodes.length === 3 ? "grid-cols-3" : "grid-cols-4"
                  }`}>
                    {layer.nodes.map((node) => {
                      const isSelected = selectedNode === node.id;
                      return (
                        <button
                          key={node.id}
                          onClick={() => setSelectedNode(isSelected ? null : node.id)}
                          className={`text-left p-2.5 rounded-md border transition-all ${
                            isSelected
                              ? "border-zinc-600 bg-zinc-800"
                              : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800/70 hover:border-zinc-700"
                          }`}
                        >
                          <span className="font-mono text-[11px] font-semibold text-zinc-300">
                            {node.label}
                          </span>
                          {isSelected && (
                            <p className="font-mono text-[10px] text-zinc-500 mt-1.5 leading-relaxed">
                              {node.desc}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {li < ARCH_LAYERS.length - 1 && (
                <div className="flex flex-col items-center py-1 gap-0.5">
                  <div className="w-px h-2 bg-zinc-700" />
                  <span className="font-mono text-[9px] text-zinc-600">
                    {ARCH_CONNECTIONS[li]?.label}
                  </span>
                  <ChevronDown size={12} className="text-zinc-600" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Data Flows ── */}
      <div>
        <h3 className="font-mono text-[11px] font-bold text-zinc-400 tracking-[0.15em] uppercase mb-3 flex items-center gap-2">
          <Activity size={13} className="text-emerald-400" />
          Data Flows
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {DATA_FLOWS.map((flow) => {
            const isOpen = expandedFlow === flow.id;
            return (
              <Card key={flow.id} className={`bg-zinc-900/60 border-zinc-800 cursor-pointer transition-all ${isOpen ? "border-zinc-600 col-span-2" : "hover:border-zinc-700"}`}
                onClick={() => setExpandedFlow(isOpen ? null : flow.id)}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: flow.color }} />
                      <span className="font-mono text-[11px] font-semibold text-zinc-300">{flow.label}</span>
                    </div>
                    <ChevronDown size={12} className={`text-zinc-600 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                  {isOpen && (
                    <div className="mt-3 pl-4 border-l-2 space-y-1" style={{ borderColor: `${flow.color}40` }}>
                      {flow.steps.map((step, i) => (
                        <div key={i} className="font-mono text-[10px] text-zinc-400 leading-relaxed">
                          {step.startsWith("  →") ? (
                            <span className="text-zinc-500 ml-2">{step}</span>
                          ) : (
                            <span>{step}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Subsystem Details (collapsible) ── */}
      <div>
        <h3 className="font-mono text-[11px] font-bold text-zinc-400 tracking-[0.15em] uppercase mb-3 flex items-center gap-2">
          <Layers size={13} className="text-purple-400" />
          Subsystem Specifications
        </h3>
        <div className="space-y-2">
          {/* REST API Endpoints */}
          <Card className={`bg-zinc-900/60 border-zinc-800 cursor-pointer transition-all ${showEndpoints ? "border-zinc-600" : "hover:border-zinc-700"}`}
            onClick={() => setShowEndpoints(!showEndpoints)}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe size={12} className="text-cyan-400" />
                  <span className="font-mono text-[11px] font-semibold text-zinc-300">REST API Endpoints</span>
                  <Badge variant="secondary" className="bg-zinc-800 text-zinc-600 text-[9px] font-mono border-none">14 routes</Badge>
                </div>
                <ChevronDown size={12} className={`text-zinc-600 transition-transform ${showEndpoints ? "rotate-180" : ""}`} />
              </div>
              {showEndpoints && (
                <pre className="mt-3 font-mono text-[10px] text-zinc-400 leading-[1.8] whitespace-pre overflow-x-auto">{`GET    /api/projects                  → list all projects
POST   /api/projects                  → create project (triggers GSD init)
GET    /api/projects/:id              → project detail + agents
DELETE /api/projects/:id              → archive project

GET    /api/projects/:id/agents       → list agents for project
POST   /api/projects/:id/agents       → spawn new agent
DELETE /api/agents/:id                → stop + cleanup agent
POST   /api/agents/:id/retry          → retry failed agent
POST   /api/agents/:id/send           → send command to agent terminal

GET    /api/projects/:id/gsd          → GSD planning state
GET    /api/projects/:id/gsd/waves    → wave assignments + status
POST   /api/projects/:id/gsd/advance  → advance to next wave

GET    /api/system/health             → server health + tmux status
POST   /api/hooks/pane-died           → tmux hook callback`}</pre>
              )}
            </CardContent>
          </Card>

          {/* WebSocket Protocol */}
          <Card className={`bg-zinc-900/60 border-zinc-800 cursor-pointer transition-all ${showWsProtocol ? "border-zinc-600" : "hover:border-zinc-700"}`}
            onClick={() => setShowWsProtocol(!showWsProtocol)}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={12} className="text-amber-400" />
                  <span className="font-mono text-[11px] font-semibold text-zinc-300">WebSocket Protocol</span>
                  <Badge variant="secondary" className="bg-zinc-800 text-zinc-600 text-[9px] font-mono border-none">JSON messages</Badge>
                </div>
                <ChevronDown size={12} className={`text-zinc-600 transition-transform ${showWsProtocol ? "rotate-180" : ""}`} />
              </div>
              {showWsProtocol && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <div className="font-mono text-[9px] text-emerald-400 tracking-wider mb-1.5 font-bold">SERVER → CLIENT</div>
                    <pre className="font-mono text-[10px] text-zinc-400 leading-[1.7] whitespace-pre">{`terminal:output  { paneId, data }
agent:status     { agentId, status, meta }
wave:started     { projectId, wave, agents[] }
wave:completed   { projectId, wave }
wave:failed      { projectId, failedAgents[] }
system:stats     { activeAgents, totalCost }`}</pre>
                  </div>
                  <div>
                    <div className="font-mono text-[9px] text-blue-400 tracking-wider mb-1.5 font-bold">CLIENT → SERVER</div>
                    <pre className="font-mono text-[10px] text-zinc-400 leading-[1.7] whitespace-pre">{`terminal:input       { paneId, data }
terminal:subscribe   { paneId }
terminal:unsubscribe { paneId }
agent:stop           { agentId }
agent:retry          { agentId }`}</pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SQLite Schema */}
          <Card className={`bg-zinc-900/60 border-zinc-800 cursor-pointer transition-all ${showSchema ? "border-zinc-600" : "hover:border-zinc-700"}`}
            onClick={() => setShowSchema(!showSchema)}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database size={12} className="text-purple-400" />
                  <span className="font-mono text-[11px] font-semibold text-zinc-300">SQLite Schema</span>
                  <Badge variant="secondary" className="bg-zinc-800 text-zinc-600 text-[9px] font-mono border-none">3 tables</Badge>
                </div>
                <ChevronDown size={12} className={`text-zinc-600 transition-transform ${showSchema ? "rotate-180" : ""}`} />
              </div>
              {showSchema && (
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {[
                    { name: "projects", cols: ["id TEXT PK", "name TEXT", "path TEXT", "gsd_path TEXT", "phase INT", "status TEXT", "created_at", "updated_at"] },
                    { name: "agents", cols: ["id TEXT PK", "project_id FK", "name TEXT", "type TEXT", "plan_ref TEXT", "wave INT", "task TEXT", "status TEXT", "tmux_session", "tmux_pane", "worktree", "tokens_used INT", "cost_usd REAL", "exit_code INT", "started_at", "finished_at"] },
                    { name: "events", cols: ["id INT PK AUTO", "timestamp TEXT", "type TEXT", "project_id FK", "agent_id FK", "data JSON"] },
                  ].map((t) => (
                    <div key={t.name} className="border border-zinc-800 rounded-md p-2 bg-zinc-900">
                      <div className="font-mono text-[10px] font-bold text-purple-400 mb-1.5">{t.name}</div>
                      {t.cols.map((c) => (
                        <div key={c} className="font-mono text-[9px] text-zinc-500 leading-relaxed">{c}</div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Naming Conventions ── */}
      <Card className="bg-zinc-900/60 border-zinc-800">
        <CardContent className="p-3">
          <div className="font-mono text-[10px] text-zinc-500 tracking-[0.12em] uppercase font-bold mb-2">Naming Conventions</div>
          <div className="grid grid-cols-3 gap-x-4 gap-y-1">
            {[
              ["tmux session", "mc-<agent-id>", "mc-a001"],
              ["Agent ID", "a<NNN>", "a001, a042"],
              ["Git worktree", ".worktrees/<agent-id>", ".worktrees/a001"],
              ["WS room", "terminal:<pane-id>", "terminal:%5"],
              ["SQLite event", "<ts>:<event-type>", "1741...:agent:spawned"],
              ["GSD plan ref", "<phase>-<plan>", "03-01, auth-02"],
            ].map(([entity, pattern, example]) => (
              <div key={entity} className="flex gap-2">
                <span className="font-mono text-[10px] text-zinc-400 font-semibold w-20 flex-shrink-0">{entity}</span>
                <span className="font-mono text-[10px] text-zinc-500">{pattern}</span>
                <span className="font-mono text-[10px] text-zinc-600">({example})</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Architecture Decision Records ── */}
      <div>
        <h3 className="font-mono text-[11px] font-bold text-zinc-400 tracking-[0.15em] uppercase mb-3 flex items-center gap-2">
          <Shield size={13} className="text-amber-400" />
          Architecture Decision Records
        </h3>
        <div className="space-y-2">
          {ADRS.map((adr) => {
            const isOpen = expandedAdr === adr.id;
            return (
              <Card key={adr.id} className={`bg-zinc-900/60 border-zinc-800 cursor-pointer transition-all ${isOpen ? "border-zinc-600" : "hover:border-zinc-700"}`}
                onClick={() => setExpandedAdr(isOpen ? null : adr.id)}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-zinc-800 text-zinc-500 text-[9px] font-mono border-none">ADR-{adr.id}</Badge>
                      <span className="font-mono text-[11px] font-semibold text-zinc-300">{adr.title}</span>
                    </div>
                    <ChevronDown size={12} className={`text-zinc-600 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                  {isOpen && (
                    <div className="mt-3 space-y-2 pl-3 border-l-2 border-amber-400/20">
                      <div>
                        <div className="font-mono text-[9px] text-emerald-400 tracking-wider font-bold">DECISION</div>
                        <div className="font-mono text-[10px] text-zinc-300 mt-0.5">{adr.decision}</div>
                      </div>
                      <div>
                        <div className="font-mono text-[9px] text-blue-400 tracking-wider font-bold">RATIONALE</div>
                        <div className="font-mono text-[10px] text-zinc-400 mt-0.5">{adr.rationale}</div>
                      </div>
                      <div>
                        <div className="font-mono text-[9px] text-amber-400 tracking-wider font-bold">TRADE-OFF</div>
                        <div className="font-mono text-[10px] text-zinc-500 mt-0.5">{adr.tradeoff}</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Scale Target ── */}
      <Card className="bg-zinc-900/60 border-zinc-800">
        <CardContent className="p-3">
          <div className="font-mono text-[10px] text-zinc-500 tracking-[0.12em] uppercase font-bold mb-2">Scale Target</div>
          <div className="flex gap-6">
            {[
              { v: "3–5", l: "concurrent projects" },
              { v: "2–8", l: "agents per project" },
              { v: "10–20", l: "total concurrent agents" },
              { v: "1", l: "machine, 1 tmux server" },
            ].map((s) => (
              <div key={s.l}>
                <div className="font-mono text-lg font-bold text-zinc-200">{s.v}</div>
                <div className="font-mono text-[9px] text-zinc-600">{s.l}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── AgentCard ──────────────────────────────────────────────────────
function AgentCard({ agent, onSelect, isSelected }) {
  const progressColor = agent.status === "failed" ? "bg-red-500" : agent.status === "complete" ? "bg-green-500" : "bg-emerald-400";

  return (
    <Card
      onClick={onSelect}
      className={`cursor-pointer transition-all ${
        isSelected
          ? "border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_20px_rgba(0,229,155,0.05)]"
          : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900"
      }`}
    >
      <CardContent className="p-3.5">
        {/* Header */}
        <div className="flex justify-between items-start mb-2.5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[13px] font-bold text-zinc-200">{agent.name}</span>
              <Badge variant="outline" className={`text-[9px] font-mono font-semibold tracking-wide uppercase border ${
                agent.type === "claude"
                  ? "text-amber-400 bg-amber-400/10 border-amber-400/30"
                  : "text-blue-400 bg-blue-400/10 border-blue-400/30"
              }`}>
                {agent.type === "claude" ? "Claude Code" : "Codex CLI"}
              </Badge>
            </div>
            <div className="font-mono text-[10px] text-zinc-500">
              Plan {agent.plan} · Wave {agent.wave}
            </div>
          </div>
          <StatusBadge status={agent.status} />
        </div>

        {/* Task */}
        <div className="font-mono text-[11px] text-zinc-300 opacity-85 mb-3">
          {agent.task}
        </div>

        {/* Progress */}
        <div className="h-[3px] rounded-full bg-zinc-800 mb-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${agent.progress}%` }}
          />
        </div>

        {/* Stats */}
        <div className="flex gap-5">
          {[
            { label: "tokens", value: agent.tokens > 0 ? (agent.tokens / 1000).toFixed(1) + "k" : "—" },
            { label: "cost", value: agent.cost > 0 ? "$" + agent.cost.toFixed(2) : "—" },
            { label: "elapsed", value: agent.elapsed },
          ].map((s) => (
            <div key={s.label}>
              <div className="font-mono text-[10px] text-zinc-600 mb-0.5">{s.label}</div>
              <div className="font-mono text-[12px] text-zinc-300 font-semibold">{s.value}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Terminal ───────────────────────────────────────────────────────
function TerminalPanel({ agent }) {
  const [lines, setLines] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    setLines([]);
    if (!agent || agent.status === "queued") return;
    let i = 0;
    const iv = setInterval(() => {
      if (i >= MOCK_TERMINAL_LINES.length) { clearInterval(iv); return; }
      setLines((prev) => [...prev, MOCK_TERMINAL_LINES[i]]);
      i++;
    }, 400);
    return () => clearInterval(iv);
  }, [agent?.id]);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  const colorize = (text) => {
    if (text.startsWith("$")) return "text-emerald-400";
    if (text.startsWith(" PASS")) return "text-green-400";
    if (text.startsWith(" FAIL")) return "text-red-400";
    if (text.includes('"type":"tool_use"')) return "text-amber-400";
    if (text.includes('"type":"assistant"')) return "text-blue-400";
    if (text.startsWith("Architecting")) return "text-purple-400";
    return "text-zinc-500";
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden bg-black border-zinc-800">
      {/* Terminal header bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          </div>
          <span className="font-mono text-[11px] text-zinc-500">
            tmux:{agent?.name || "no-session"} — {agent?.type === "codex" ? "codex" : "claude"}
          </span>
        </div>
        {agent && <StatusBadge status={agent.status} />}
      </div>

      {/* Terminal body */}
      <ScrollArea className="flex-1">
        <div ref={ref} className="p-3.5 font-mono text-[12px] leading-[1.7]">
          {!agent ? (
            <span className="text-zinc-600">Select an agent to view terminal output...</span>
          ) : agent.status === "queued" ? (
            <span className="text-zinc-600">Agent queued — waiting for Wave {agent.wave - 1} to complete...</span>
          ) : (
            lines.map((l, i) => (
              <div key={i} className={`break-all ${colorize(l.text)}`}>
                {l.text}
              </div>
            ))
          )}
          {agent?.status === "running" && (
            <span className="text-emerald-400 animate-pulse">█</span>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

// ── New Project Modal ──────────────────────────────────────────────
function NewProjectModal({ open, onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [agentType, setAgentType] = useState("claude");
  const [agentCount, setAgentCount] = useState(2);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-200 max-w-md font-mono shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm font-bold text-emerald-400 tracking-[0.12em] uppercase flex items-center gap-2">
            <Plus size={14} />
            Spawn New Project
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="font-mono text-[10px] text-zinc-500 tracking-[0.08em] uppercase">
              Project Name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. saas-dashboard"
              className="mt-1.5 bg-zinc-800 border-zinc-700 text-zinc-200 font-mono text-[12px] placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-emerald-500/20"
            />
          </div>
          <div>
            <Label className="font-mono text-[10px] text-zinc-500 tracking-[0.08em] uppercase">
              Description
            </Label>
            <Input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What are we building?"
              className="mt-1.5 bg-zinc-800 border-zinc-700 text-zinc-200 font-mono text-[12px] placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-emerald-500/20"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="font-mono text-[10px] text-zinc-500 tracking-[0.08em] uppercase">
                Default Agent
              </Label>
              <div className="flex gap-1.5 mt-1.5">
                {["claude", "codex"].map((t) => (
                  <Button
                    key={t}
                    variant={agentType === t ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAgentType(t)}
                    className={`flex-1 font-mono text-[11px] font-semibold uppercase tracking-wide ${
                      agentType === t
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/20"
                        : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
                    }`}
                  >
                    {t === "claude" ? "Claude Code" : "Codex CLI"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="w-24">
              <Label className="font-mono text-[10px] text-zinc-500 tracking-[0.08em] uppercase">
                Agents
              </Label>
              <Input
                type="number"
                min={1}
                max={8}
                value={agentCount}
                onChange={(e) => setAgentCount(parseInt(e.target.value) || 1)}
                className="mt-1.5 bg-zinc-800 border-zinc-700 text-zinc-200 font-mono text-[12px] text-center focus:border-emerald-500 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* GSD hint */}
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-3">
              <div className="font-mono text-[10px] text-emerald-400 mb-1 font-semibold">WILL EXECUTE</div>
              <div className="font-mono text-[11px] text-zinc-300">
                gsd init → gsd research → gsd plan → spawn {agentCount} agent(s)
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onClose(false)}
            className="font-mono text-[11px] text-zinc-500 hover:text-zinc-300"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!name}
            onClick={() => { if (name) { onSubmit({ name, desc, agentType, agentCount }); onClose(false); } }}
            className="font-mono text-[11px] font-bold bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-40"
          >
            Launch Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Workflow Orchestration (React Flow) ────────────────────────────

const WORKFLOW_PIPELINES = [
  {
    id: "wheely", project: "Wheely", phase: "Phase 2 — Booking Engine",
    steps: [
      { id: "gsd-init", label: "GSD Init", desc: "Initialize .planning/ structure", icon: "GitBranch", status: "complete", duration: "4s", output: "PROJECT.md created" },
      { id: "research", label: "Research", desc: "Codebase analysis & dependency scan", icon: "Search", status: "complete", duration: "1m 12s", output: "14 files scanned, 3 deps found" },
      { id: "plan", label: "Plan", desc: "Generate phases, waves, task breakdown", icon: "FileText", status: "complete", duration: "38s", output: "2 phases, 4 waves, 9 tasks" },
      { id: "wave-1", label: "Wave 1", desc: "Parallel: Agent-01 + Agent-02", icon: "Layers", status: "running", duration: "24m", output: "2/2 agents active",
        agents: [
          { id: "a01", label: "Agent-01", desc: "Filter functions & HV computation", status: "running", progress: 68, type: "claude" },
          { id: "a02", label: "Agent-02", desc: "Scoring engine + pipeline orchestrator", status: "running", progress: 42, type: "claude" },
        ],
      },
      { id: "wave-2", label: "Wave 2", desc: "Sequential: Agent-03", icon: "Layers", status: "queued", duration: "—", output: "Blocked on Wave 1",
        agents: [
          { id: "a03", label: "Agent-03", desc: "API routes & validation layer", status: "queued", progress: 0, type: "codex" },
        ],
      },
      { id: "test", label: "Test Suite", desc: "Run full test matrix", icon: "CheckCircle2", status: "queued", duration: "—", output: "Pending" },
      { id: "merge", label: "Merge & Deploy", desc: "PR creation, CI/CD pipeline", icon: "GitBranch", status: "queued", duration: "—", output: "Pending" },
    ],
  },
  {
    id: "tattoo-bot", project: "Tattoo Bot", phase: "Phase 2 — Authentication",
    steps: [
      { id: "tb-init", label: "GSD Init", desc: "Initialize .planning/ structure", icon: "GitBranch", status: "complete", duration: "3s", output: "PROJECT.md created" },
      { id: "tb-research", label: "Research", desc: "Auth patterns & existing code audit", icon: "Search", status: "complete", duration: "52s", output: "Supabase auth detected" },
      { id: "tb-plan", label: "Plan", desc: "Generate auth implementation plan", icon: "FileText", status: "complete", duration: "28s", output: "1 phase, 3 waves, 5 tasks" },
      { id: "tb-wave-1", label: "Wave 1", desc: "Parallel: Agent-04 + Agent-05", icon: "Layers", status: "running", duration: "42m", output: "1/2 complete",
        agents: [
          { id: "a04", label: "Agent-04", desc: "Login/signup screens + magic link", status: "running", progress: 35, type: "claude" },
          { id: "a05", label: "Agent-05", desc: "Session persistence & auth store", status: "complete", progress: 100, type: "claude" },
        ],
      },
      { id: "tb-wave-2", label: "Wave 2", desc: "Protected routes + middleware", icon: "Layers", status: "queued", duration: "—", output: "Blocked on Wave 1" },
      { id: "tb-wave-3", label: "Wave 3", desc: "E2E auth tests", icon: "Layers", status: "queued", duration: "—", output: "Blocked on Wave 2" },
      { id: "tb-merge", label: "Merge & Deploy", desc: "PR creation, CI/CD pipeline", icon: "GitBranch", status: "queued", duration: "—", output: "Pending" },
    ],
  },
  {
    id: "policy-gsd", project: "Policy Engine", phase: "Phase 1 — Log Ingestion",
    steps: [
      { id: "pe-init", label: "GSD Init", desc: "Initialize .planning/ structure", icon: "GitBranch", status: "complete", duration: "3s", output: "PROJECT.md created" },
      { id: "pe-research", label: "Research", desc: "VPC flow log format analysis", icon: "Search", status: "complete", duration: "1m 04s", output: "v2, v3, v5 formats identified" },
      { id: "pe-plan", label: "Plan", desc: "Ingestion pipeline design", icon: "FileText", status: "complete", duration: "22s", output: "1 phase, 1 wave, 3 tasks" },
      { id: "pe-wave-1", label: "Wave 1", desc: "Agent-06: S3 discovery", icon: "Layers", status: "failed", duration: "8m", output: "Agent-06 crashed — retry pending",
        agents: [
          { id: "a06", label: "Agent-06", desc: "S3 discovery pattern + VPC Flow Log versions", status: "failed", progress: 23, type: "codex" },
        ],
      },
      { id: "pe-test", label: "Test Suite", desc: "Validate parsed output", icon: "CheckCircle2", status: "queued", duration: "—", output: "Blocked" },
      { id: "pe-merge", label: "Merge & Deploy", desc: "PR creation", icon: "GitBranch", status: "queued", duration: "—", output: "Blocked" },
    ],
  },
];

const ICON_MAP = { GitBranch, Search, FileText, Layers, CheckCircle2, Bot };

// ── Custom React Flow node ─────────────────────────────────────────
function PipelineNode({ data }) {
  const { step, selected } = data;
  const Icon = ICON_MAP[step.icon] || Workflow;

  const border =
    step.status === "running" ? "border-emerald-500/60 shadow-[0_0_20px_rgba(0,229,155,0.15)]" :
    step.status === "complete" ? "border-green-500/40" :
    step.status === "failed" ? "border-red-500/50 shadow-[0_0_15px_rgba(248,81,73,0.12)]" :
    "border-zinc-800";
  const bg =
    step.status === "running" ? "bg-emerald-500/5" :
    step.status === "complete" ? "bg-green-500/5" :
    step.status === "failed" ? "bg-red-500/5" :
    "bg-zinc-900/80";

  return (
    <div className={`rounded-xl border ${border} ${bg} ${selected ? "ring-1 ring-cyan-400/50" : ""} transition-all min-w-[180px]`}>
      {/* Handles */}
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-zinc-600 !border-zinc-500" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-zinc-600 !border-zinc-500" />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/60 bg-zinc-900/60 rounded-t-xl">
        <div className="flex items-center gap-2">
          <Icon size={13} className={
            step.status === "running" ? "text-emerald-400" :
            step.status === "complete" ? "text-green-400" :
            step.status === "failed" ? "text-red-400" :
            "text-zinc-500"
          } />
          <span className="font-mono text-[11px] font-bold text-zinc-200">{step.label}</span>
        </div>
        {step.status === "running" && <Loader2 size={12} className="text-emerald-400 animate-spin" />}
        {step.status === "complete" && <CheckCircle2 size={12} className="text-green-400" />}
        {step.status === "failed" && <XCircle size={12} className="text-red-400" />}
        {step.status === "queued" && <div className="w-2 h-2 rounded-full bg-zinc-600" />}
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <div className="font-mono text-[9px] text-zinc-500 mb-1 leading-snug">{step.desc}</div>
        {step.duration !== "—" && (
          <div className="flex items-center gap-1 font-mono text-[9px] text-zinc-600 mb-1.5">
            <Timer size={9} className="opacity-60" /> {step.duration}
          </div>
        )}

        {/* Agent sub-cards */}
        {step.agents && (
          <div className="flex flex-col gap-1 mt-1">
            {step.agents.map((a) => {
              const ac =
                a.status === "running" ? "border-emerald-500/30 bg-emerald-500/5" :
                a.status === "complete" ? "border-green-500/30 bg-green-500/5" :
                a.status === "failed" ? "border-red-500/30 bg-red-500/5" :
                "border-zinc-800 bg-zinc-900/50";
              const barColor =
                a.status === "running" ? "bg-emerald-400" :
                a.status === "complete" ? "bg-green-400" :
                a.status === "failed" ? "bg-red-400" :
                "bg-zinc-700";
              return (
                <div key={a.id} className={`rounded-md border ${ac} px-2 py-1.5`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <Bot size={10} className={
                        a.status === "running" ? "text-emerald-400" :
                        a.status === "complete" ? "text-green-400" :
                        a.status === "failed" ? "text-red-400" :
                        "text-zinc-500"
                      } />
                      <span className="font-mono text-[10px] font-semibold text-zinc-300">{a.label}</span>
                    </div>
                    <Badge variant="outline" className={`text-[7px] font-mono font-bold px-1 py-0 h-3.5 ${
                      a.type === "claude" ? "text-amber-400 border-amber-400/30" : "text-blue-400 border-blue-400/30"
                    }`}>
                      {a.type === "claude" ? "CC" : "CX"}
                    </Badge>
                  </div>
                  {/* Progress bar */}
                  <div className="h-[3px] rounded-full bg-zinc-800 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${a.progress}%` }} />
                  </div>
                  <div className="font-mono text-[8px] text-zinc-600 mt-0.5 text-right">{a.progress}%</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Animated edge ──────────────────────────────────────────────────
function AnimatedEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const status = data?.status || "queued";

  const strokeColor =
    status === "complete" ? "#3fb950" :
    status === "running" ? "#00e59b" :
    status === "failed" ? "#f85149" :
    "#27272a";

  return (
    <>
      {/* Base dim line */}
      <BaseEdge id={id} path={edgePath} style={{ stroke: "#27272a", strokeWidth: 2 }} />
      {/* Active colored line */}
      {status !== "queued" && (
        <path d={edgePath} fill="none" stroke={strokeColor} strokeWidth={2} opacity={0.5} style={{ pointerEvents: "none" }} />
      )}
      {/* Animated particles for running edges */}
      {status === "running" && (
        <>
          <circle r={3.5} fill={strokeColor} filter="url(#glow)">
            <animateMotion dur="1.8s" repeatCount="indefinite">
              <mpath href={`#${id}`} />
            </animateMotion>
          </circle>
          <circle r={7} fill={strokeColor} opacity={0.15}>
            <animateMotion dur="1.8s" repeatCount="indefinite">
              <mpath href={`#${id}`} />
            </animateMotion>
          </circle>
          {/* Second particle offset */}
          <circle r={3} fill={strokeColor} opacity={0.6}>
            <animateMotion dur="1.8s" repeatCount="indefinite" begin="0.9s">
              <mpath href={`#${id}`} />
            </animateMotion>
          </circle>
          <path id={id} d={edgePath} fill="none" stroke="none" />
        </>
      )}
      {/* Dash animation for failed */}
      {status === "failed" && (
        <path
          d={edgePath} fill="none" stroke={strokeColor} strokeWidth={2} opacity={0.4}
          strokeDasharray="6 4"
          style={{ pointerEvents: "none" }}
        >
          <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1s" repeatCount="indefinite" />
        </path>
      )}
    </>
  );
}

const rfNodeTypes = { pipeline: PipelineNode };
const rfEdgeTypes = { animated: AnimatedEdge };

function buildFlowGraph(pipeline) {
  if (!pipeline) return { nodes: [], edges: [] };
  const GAP_X = 260;
  const nodes = pipeline.steps.map((step, i) => ({
    id: step.id,
    type: "pipeline",
    position: { x: i * GAP_X, y: 0 },
    data: { step, selected: false },
    draggable: true,
  }));
  const edges = pipeline.steps.slice(1).map((step, i) => {
    const prev = pipeline.steps[i];
    const connStatus = prev.status === "complete"
      ? (step.status === "queued" ? "complete" : step.status)
      : "queued";
    return {
      id: `e-${prev.id}-${step.id}`,
      source: prev.id,
      target: step.id,
      type: "animated",
      data: { status: connStatus },
    };
  });
  return { nodes, edges };
}

function WorkflowOrchestration() {
  const [selectedPipeline, setSelectedPipeline] = useState("wheely");
  const [selectedNode, setSelectedNode] = useState(null);

  const pipeline = WORKFLOW_PIPELINES.find((p) => p.id === selectedPipeline);
  const { nodes: initNodes, edges: initEdges } = useMemo(() => buildFlowGraph(pipeline), [selectedPipeline]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  // Rebuild when pipeline changes
  useEffect(() => {
    const { nodes: n, edges: e } = buildFlowGraph(pipeline);
    setNodes(n);
    setEdges(e);
    setSelectedNode(null);
  }, [selectedPipeline]);

  // Update selected state on nodes
  useEffect(() => {
    setNodes((nds) => nds.map((n) => ({
      ...n,
      data: { ...n.data, selected: n.id === selectedNode },
    })));
  }, [selectedNode]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode((prev) => prev === node.id ? null : node.id);
  }, []);

  const selStep = pipeline?.steps.find((s) => s.id === selectedNode);

  // Pipeline stats
  const completedCount = pipeline?.steps.filter((n) => n.status === "complete").length || 0;
  const totalCount = pipeline?.steps.length || 1;
  const pipelineProgress = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(57,210,224,0.6)]" />
          <h2 className="font-mono text-sm font-bold text-zinc-200 tracking-[0.15em] uppercase">
            Workflow Orchestration
          </h2>
        </div>
        <div className="flex gap-1.5">
          {WORKFLOW_PIPELINES.map((p) => {
            const isActive = selectedPipeline === p.id;
            const hasFailure = p.steps.some((n) => n.status === "failed");
            const isRunning = p.steps.some((n) => n.status === "running");
            return (
              <Button key={p.id} variant={isActive ? "default" : "outline"} size="sm"
                onClick={() => setSelectedPipeline(p.id)}
                className={`font-mono text-[11px] font-semibold ${
                  isActive ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/20"
                  : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {hasFailure && <XCircle size={10} className="mr-1.5 text-red-400" />}
                {isRunning && !hasFailure && <Loader2 size={10} className="mr-1.5 text-emerald-400 animate-spin" />}
                {!isRunning && !hasFailure && <CheckCircle2 size={10} className="mr-1.5 text-green-400 opacity-50" />}
                {p.project}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Pipeline progress bar */}
      <Card className="bg-zinc-900/60 border-zinc-800 mb-3">
        <CardContent className="p-3 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between mb-1.5">
              <span className="font-mono text-[11px] text-zinc-300 font-semibold">{pipeline?.project} — {pipeline?.phase}</span>
              <span className="font-mono text-[10px] text-zinc-500">{completedCount}/{totalCount} stages · {pipelineProgress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-700"
                style={{ width: `${pipelineProgress}%` }} />
            </div>
          </div>
          <Badge className={`font-mono text-[9px] font-bold ${
            pipeline?.steps.some((n) => n.status === "failed") ? "bg-red-500/15 text-red-400 border-red-500/30"
            : pipeline?.steps.some((n) => n.status === "running") ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
            : "bg-green-500/15 text-green-400 border-green-500/30"
          }`}>
            {pipeline?.steps.some((n) => n.status === "failed") ? "HAS ERRORS" :
             pipeline?.steps.some((n) => n.status === "running") ? "IN PROGRESS" : "COMPLETE"}
          </Badge>
        </CardContent>
      </Card>

      {/* React Flow canvas */}
      <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-zinc-800">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={rfNodeTypes}
          edgeTypes={rfEdgeTypes}
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
            nodeColor={(n) => {
              const s = n.data?.step?.status;
              return s === "running" ? "#00e59b" : s === "complete" ? "#3fb950" : s === "failed" ? "#f85149" : "#3f3f46";
            }}
            maskColor="rgba(0,0,0,0.7)"
            className="!bg-zinc-900 !border-zinc-700 !rounded-lg"
          />
          {/* SVG defs for glow filter */}
          <svg width={0} height={0}>
            <defs>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
          </svg>
        </ReactFlow>
      </div>

      {/* Selected node detail */}
      {selStep && (
        <Card className="mt-3 bg-zinc-900/60 border-zinc-800">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                {(() => { const I = ICON_MAP[selStep.icon] || Workflow; return <I size={14} className={
                  selStep.status === "running" ? "text-emerald-400" :
                  selStep.status === "complete" ? "text-green-400" :
                  selStep.status === "failed" ? "text-red-400" :
                  "text-zinc-500"
                } />; })()}
                <span className="font-mono text-[13px] font-bold text-zinc-200">{selStep.label}</span>
                <StatusBadge status={selStep.status} />
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-zinc-500">Duration: {selStep.duration}</span>
                {selStep.status === "failed" && (
                  <Button size="sm" className="bg-amber-500 text-zinc-950 hover:bg-amber-400 font-mono text-[10px] font-bold h-6 px-2.5">
                    <RotateCcw size={10} className="mr-1" /> RETRY
                  </Button>
                )}
              </div>
            </div>
            <div className="font-mono text-[11px] text-zinc-400 mb-1">{selStep.desc}</div>
            <div className="font-mono text-[10px] text-zinc-600">Output: {selStep.output}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────
export default function MissionControl() {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const allAgents = MOCK_PROJECTS.flatMap((p) => p.agents.map((a) => ({ ...a, project: p.name })));
  const activeAgent = allAgents.find((a) => a.id === selectedAgent);
  const stats = {
    active: allAgents.filter((a) => a.status === "running").length,
    total: allAgents.length,
    totalCost: allAgents.reduce((s, a) => s + a.cost, 0),
    totalTokens: allAgents.reduce((s, a) => s + a.tokens, 0),
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-mono">
      <Tabs defaultValue="dashboard" className="flex flex-col h-screen">
        {/* ─── Top bar ─── */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center text-sm font-extrabold text-zinc-950">
              MC
            </div>
            <div>
              <div className="text-sm font-bold tracking-[0.12em] text-zinc-200">MISSION CONTROL</div>
              <div className="text-[10px] text-zinc-500 tracking-wide">
                Twin Coast Labs · {MOCK_PROJECTS.length} projects · {stats.active}/{stats.total} agents active
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

          <div className="flex items-center gap-4">
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

        {/* ─── Orchestration Tab ─── */}
        <TabsContent value="orchestration" className="flex-1 overflow-hidden m-0">
          <WorkflowOrchestration />
        </TabsContent>

        {/* ─── Severed Floor Tab ─── */}
        <TabsContent value="severed-floor" className="flex-1 overflow-hidden m-0">
          <SeveranceFloor agents={allAgents} />
        </TabsContent>

        {/* ─── Architecture Tab ─── */}
        <TabsContent value="architecture" className="flex-1 overflow-auto m-0">
          <div className="max-w-4xl mx-auto py-4">
            <ArchDiagram />
          </div>
        </TabsContent>

        {/* ─── Dashboard Tab ─── */}
        <TabsContent value="dashboard" className="flex-1 m-0 overflow-hidden">
          <div className="flex h-full">
            {/* Left panel — projects + agents */}
            <ScrollArea className="w-[420px] border-r border-zinc-800">
              <div className="p-4">
                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { label: "Active", value: stats.active, icon: Activity, color: "text-emerald-400" },
                    { label: "Total", value: stats.total, icon: Hash, color: "text-blue-400" },
                    { label: "Cost", value: "$" + stats.totalCost.toFixed(2), icon: DollarSign, color: "text-amber-400" },
                    { label: "Tokens", value: (stats.totalTokens / 1000).toFixed(0) + "k", icon: Zap, color: "text-purple-400" },
                  ].map((s) => {
                    const Icon = s.icon;
                    return (
                      <Card key={s.label} className="bg-zinc-900/60 border-zinc-800">
                        <CardContent className="p-2.5 text-center">
                          <Icon size={12} className={`mx-auto mb-1 ${s.color} opacity-60`} />
                          <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                          <div className="text-[9px] text-zinc-500 tracking-[0.08em] uppercase">{s.label}</div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* New project button */}
                <Button
                  variant="outline"
                  onClick={() => setShowNewProject(true)}
                  className="w-full mb-4 border-dashed border-emerald-500/25 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40 font-mono text-[11px] font-semibold tracking-[0.08em]"
                >
                  <Plus size={14} className="mr-2" />
                  SPAWN NEW PROJECT
                </Button>

                {/* Projects */}
                {MOCK_PROJECTS.map((project) => (
                  <div key={project.id} className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-[13px] font-bold text-zinc-200">{project.name}</div>
                        <div className="text-[10px] text-zinc-500">
                          {project.phase} · Wave {project.waves.current}/{project.waves.total}
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-zinc-800 text-zinc-500 text-[9px] border-none font-mono">
                        {project.agents.length} agent{project.agents.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {project.agents.map((agent) => (
                        <AgentCard
                          key={agent.id}
                          agent={agent}
                          isSelected={selectedAgent === agent.id}
                          onSelect={() => setSelectedAgent(agent.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Right panel — terminal */}
            <div className="flex-1 p-4 flex flex-col">
              {/* Agent detail header */}
              {activeAgent && (
                <Card className="bg-zinc-900/60 border-zinc-800 mb-3">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-zinc-200">{activeAgent.name}</span>
                      <span className="text-[11px] text-zinc-500">
                        {activeAgent.project} → {activeAgent.task}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {activeAgent.status === "failed" && (
                        <Button size="sm" className="bg-amber-500 text-zinc-950 hover:bg-amber-400 font-mono text-[10px] font-bold h-7 px-3">
                          <RotateCcw size={12} className="mr-1" />
                          RETRY
                        </Button>
                      )}
                      {activeAgent.status === "running" && (
                        <Button size="sm" variant="outline" className="border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 font-mono text-[10px] font-bold h-7 px-3">
                          <Square size={10} className="mr-1" />
                          STOP
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Terminal */}
              <div className="flex-1 min-h-0">
                <TerminalPanel agent={activeAgent} />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* New project modal */}
      <NewProjectModal
        open={showNewProject}
        onClose={() => setShowNewProject(false)}
        onSubmit={(data) => setShowNewProject(false)}
      />
    </div>
  );
}