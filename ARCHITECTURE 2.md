# Mission Control — Architecture Plan

> **Project**: Mission Control
> **Organization**: Twin Coast Labs
> **Status**: Architecture Complete — Ready for Implementation
> **License**: Open Source (MIT)
> **Last Updated**: 2026-03-09

---

## 1. Vision

Mission Control is a web-based orchestration dashboard that spawns, monitors, and manages multiple AI coding agents (Claude Code and OpenAI Codex CLI) running in tmux sessions. It replaces the current manual tmux workflow with a GUI that treats agents as employees — assigned to projects, executing structured plans via GSD (Get Shit Done), and monitored in real time from any device via Tailscale.

### What It Is

- A local-first web server with a React dashboard
- An orchestration engine that reads GSD planning files and spawns agents accordingly
- A tmux bridge that streams real-time terminal output to the browser
- A remote access layer via Tailscale Serve with zero-config auth

### What It Is NOT

- Not a replacement for GSD — it consumes GSD's planning system, does not reimplement it
- Not a cloud service — runs on your machine, accessed via tailnet
- Not an IDE — agents work in their terminals, Mission Control observes and directs

---

## 2. System Architecture

### 2.1 Layer Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  BROWSER LAYER                                                       │
│  React 19 + xterm.js 5 + WebSocket client                          │
│                                                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────┐ ┌─────────────────┐  │
│  │ Agent        │ │ Agent       │ │ Project  │ │ GSD Planning    │  │
│  │ Terminals    │ │ Status      │ │ Overview │ │ Viewer          │  │
│  │ (xterm.js)   │ │ Cards       │ │          │ │                 │  │
│  └──────┬───────┘ └──────┬──────┘ └────┬─────┘ └───────┬─────────┘  │
│         └────────────────┴─────────────┴───────────────┘            │
│                            │ WebSocket                               │
└────────────────────────────┼─────────────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────────────┐
│  TRANSPORT LAYER           │                                         │
│                            │                                         │
│  ┌─────────────────────────┼───────────────────────────────────────┐ │
│  │  Tailscale Serve (auto-HTTPS, MagicDNS, identity headers)     │ │
│  └─────────────────────────┼───────────────────────────────────────┘ │
│                            │                                         │
└────────────────────────────┼─────────────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────────────┐
│  SERVER LAYER              │                                         │
│  Node.js 22 + Custom HTTP Server + ws                               │
│                                                                      │
│  ┌──────────────┐  ┌──────┴────────┐  ┌───────────────────────────┐ │
│  │ REST API     │  │ WebSocket     │  │ Orchestration Engine      │ │
│  │ /api/*       │  │ Server        │  │                           │ │
│  │              │  │ (per-pane     │  │ ┌───────────────────────┐ │ │
│  │ • projects   │  │  rooms)       │  │ │ Wave Scheduler        │ │ │
│  │ • agents     │  │              │  │ │ Parallel in wave,     │ │ │
│  │ • commands   │  │ • terminal   │  │ │ sequential between    │ │ │
│  │ • gsd state  │  │   output     │  │ └───────────┬───────────┘ │ │
│  │              │  │ • status     │  │             │             │ │
│  └──────────────┘  │   updates   │  │ ┌───────────┴───────────┐ │ │
│                    │ • commands   │  │ │ Agent Lifecycle Mgr   │ │ │
│                    └──────────────┘  │ │ spawn → monitor →     │ │ │
│                                      │ │ complete/fail/retry   │ │ │
│  ┌──────────────┐  ┌──────────────┐  │ └───────────┬───────────┘ │ │
│  │ tmux Bridge  │  │ GSD Bridge   │  │             │             │ │
│  │              │  │              │  │ ┌───────────┴───────────┐ │ │
│  │ control mode │  │ gsd-tools    │  │ │ Health Monitor        │ │ │
│  │ (-CC) child  │  │ .cjs CLI     │  │ │ list-panes polling    │ │ │
│  │ process      │  │ calls        │  │ │ + pane-died hooks     │ │ │
│  │              │  │              │  │ └───────────────────────┘ │ │
│  │ %output →    │  │ .planning/   │  └───────────────────────────┘ │
│  │ parse → WS   │  │ file parser  │                                │
│  └──────────────┘  └──────────────┘                                │
│                                                                      │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────────────┐
│  DATA LAYER              │                                           │
│                          │                                           │
│  ┌───────────────┐  ┌────┴──────────┐  ┌──────────────────────────┐ │
│  │ SQLite        │  │ .planning/    │  │ Git Worktrees            │ │
│  │ (better-      │  │ Filesystem    │  │                          │ │
│  │  sqlite3)     │  │               │  │ One worktree per agent   │ │
│  │               │  │ PROJECT.md    │  │ for file isolation       │ │
│  │ • agents      │  │ ROADMAP.md    │  │                          │ │
│  │ • sessions    │  │ phases/       │  │ Auto-created on spawn    │ │
│  │ • events      │  │  CONTEXT.md   │  │ Auto-cleaned on complete │ │
│  │ • costs       │  │  PLAN.md      │  │                          │ │
│  │ • projects    │  │  RESEARCH.md  │  │                          │ │
│  └───────────────┘  └───────────────┘  └──────────────────────────┘ │
│                                                                      │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────────────┐
│  RUNTIME LAYER           │                                           │
│  tmux server + AI agent processes                                    │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Session: │  │ Session: │  │ Session: │  │ Session: │            │
│  │ mc-a001  │  │ mc-a002  │  │ mc-a003  │  │ mc-a004  │   . . .   │
│  │          │  │          │  │          │  │          │            │
│  │ Claude   │  │ Claude   │  │ Codex    │  │ Claude   │            │
│  │ Code     │  │ Code     │  │ CLI      │  │ Code     │            │
│  │          │  │          │  │          │  │          │            │
│  │ wave: 1  │  │ wave: 1  │  │ wave: 2  │  │ wave: 2  │            │
│  │ plan:    │  │ plan:    │  │ plan:    │  │ plan:    │            │
│  │ 03-01    │  │ 03-02    │  │ 03-03    │  │ auth-01  │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
│                                                                      │
│  remain-on-exit: on  |  hooks: pane-died  |  isolation: worktrees   │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
Agent Spawn Flow:
  User clicks "Spawn Project" in GUI
    → REST POST /api/projects
    → Orchestrator reads GSD .planning/ via gsd-tools.cjs
    → Parses wave assignments from plan frontmatter
    → For each plan in Wave 1:
        → Creates git worktree: git worktree add .worktrees/<agent-id> <branch>
        → Creates tmux session: tmux new-session -d -s mc-<agent-id> -c <worktree>
        → Sends agent command: tmux send-keys -t mc-<agent-id> '<claude|codex cmd>' C-m
        → Registers agent in SQLite
        → tmux Bridge attaches control mode to session
    → WebSocket broadcasts agent:spawned event

Terminal Streaming Flow:
  tmux control mode (-CC) child process
    → Emits: %output %<pane_id> <octal-escaped-data>
    → tmux Bridge parses, decodes octal escapes
    → Routes to WebSocket room: terminal:<pane_id>
    → Browser xterm.js instance renders output

Wave Transition Flow:
  Health Monitor detects all Wave N agents complete (pane_dead + exit 0)
    → Orchestrator calls gsd-tools.cjs state advance-plan for each
    → Reads Wave N+1 plans
    → Spawns new agent sessions
    → WebSocket broadcasts wave:advanced event

User Input Flow (interactive):
  User types in xterm.js terminal
    → WebSocket message: { type: "input", paneId: "%5", data: "ls\r" }
    → Server: tmux send-keys -t %5 "ls" Enter
    → Output flows back via control mode %output
```

### 2.3 Naming Conventions

| Entity | Pattern | Example |
|--------|---------|---------|
| tmux session | `mc-<agent-id>` | `mc-a001` |
| Agent ID | `a<NNN>` | `a001`, `a042` |
| Git worktree | `.worktrees/<agent-id>` | `.worktrees/a001` |
| WebSocket room | `terminal:<pane-id>` | `terminal:%5` |
| SQLite event | `<timestamp>:<event-type>` | `1741...:agent:spawned` |
| GSD plan ref | `<phase>-<plan>` | `03-01`, `auth-02` |

---

## 3. Technology Stack

### 3.1 Core Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Runtime** | Node.js 22 LTS | Native child_process for tmux, async/await, strong ecosystem |
| **HTTP Server** | Custom Node.js `http.createServer` | Need raw server for WebSocket upgrade, Next.js custom server pattern |
| **Frontend Framework** | React 19 | Component model, hooks, concurrent features |
| **Build Tool** | Vite 6 | Fast HMR, React plugin, simple config |
| **Terminal Rendering** | xterm.js 5 + xterm-addon-fit + xterm-addon-webgl | Industry standard browser terminal, GPU-accelerated rendering |
| **WebSocket** | ws (Node.js) | Zero-dependency, high-performance, handles binary frames |
| **Database** | better-sqlite3 | Synchronous API (no async overhead), WAL mode, zero config |
| **Process Management** | tmux 3.x (control mode) | Already in use, proven, event-driven output streaming |
| **CSS** | Tailwind CSS 4 | Utility-first, fast iteration, tree-shaking |
| **Remote Access** | Tailscale Serve | Auto-HTTPS, MagicDNS, identity headers, zero config |

### 3.2 Key Dependencies

```json
{
  "dependencies": {
    "ws": "^8.18",
    "better-sqlite3": "^11.0",
    "xterm": "^5.5",
    "@xterm/addon-fit": "^0.10",
    "@xterm/addon-webgl": "^0.18",
    "react": "^19.0",
    "react-dom": "^19.0",
    "gray-matter": "^4.0",
    "glob": "^11.0",
    "strip-ansi": "^7.1"
  },
  "devDependencies": {
    "vite": "^6.0",
    "@vitejs/plugin-react": "^4.3",
    "typescript": "^5.7",
    "vitest": "^3.0",
    "tailwindcss": "^4.0"
  }
}
```

### 3.3 System Requirements

- **OS**: macOS or Linux (tmux required)
- **Node.js**: 22.x LTS
- **tmux**: 3.3+ (control mode support)
- **Git**: 2.40+ (worktree support)
- **Tailscale**: Latest (for remote access)
- **Claude Code**: Latest (`claude` CLI in PATH)
- **Codex CLI**: Latest (`codex` CLI in PATH, optional)
- **GSD**: Cloned and configured (`gsd-tools.cjs` accessible)

---

## 4. Directory Structure

```
mission-control/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── .env.example                    # MC_PORT, MC_GSD_PATH, MC_DATA_DIR
├── CLAUDE.md                       # Instructions for agents working on MC
├── PROJECT.md                      # GSD project definition
├── README.md
│
├── src/
│   ├── server/                     # Node.js backend
│   │   ├── index.ts                # Entry: HTTP + WS server bootstrap
│   │   ├── config.ts               # Environment + defaults
│   │   │
│   │   ├── api/                    # REST API routes
│   │   │   ├── router.ts           # Route dispatcher
│   │   │   ├── projects.ts         # CRUD projects
│   │   │   ├── agents.ts           # Spawn, kill, restart, list
│   │   │   ├── gsd.ts              # GSD state reads
│   │   │   └── system.ts           # Health, stats, tailscale status
│   │   │
│   │   ├── tmux/                   # tmux Bridge
│   │   │   ├── bridge.ts           # Control mode child process manager
│   │   │   ├── parser.ts           # Parse %output, %window-add, etc.
│   │   │   ├── commands.ts         # Typed wrappers: new-session, send-keys, list-panes
│   │   │   └── session-manager.ts  # Session lifecycle: create, destroy, health check
│   │   │
│   │   ├── orchestrator/           # Orchestration Engine
│   │   │   ├── engine.ts           # Main orchestrator state machine
│   │   │   ├── wave-scheduler.ts   # Wave dependency resolution + parallel dispatch
│   │   │   ├── agent-lifecycle.ts  # Spawn → monitor → complete/fail/retry
│   │   │   └── health-monitor.ts   # Polling loop + event-based detection
│   │   │
│   │   ├── gsd/                    # GSD Bridge
│   │   │   ├── tools-bridge.ts     # Shell out to gsd-tools.cjs
│   │   │   ├── planning-parser.ts  # Parse .planning/ markdown + YAML frontmatter
│   │   │   └── state-manager.ts    # Read/advance plan state
│   │   │
│   │   ├── ws/                     # WebSocket layer
│   │   │   ├── server.ts           # WS server setup, upgrade handling
│   │   │   ├── rooms.ts            # Room-based pub/sub (terminal:<pane>, status, events)
│   │   │   └── protocol.ts         # Message type definitions
│   │   │
│   │   └── db/                     # Data layer
│   │       ├── sqlite.ts           # Database init, migrations
│   │       ├── schema.sql          # Table definitions
│   │       ├── agents.ts           # Agent CRUD + query
│   │       ├── events.ts           # Append-only event log
│   │       └── projects.ts         # Project CRUD
│   │
│   └── client/                     # React frontend
│       ├── index.html
│       ├── main.tsx                # React entry point
│       ├── App.tsx                 # Root layout + routing
│       │
│       ├── hooks/                  # React hooks
│       │   ├── useWebSocket.ts     # WS connection + reconnect
│       │   ├── useTerminal.ts      # xterm.js instance management
│       │   ├── useAgents.ts        # Agent state subscription
│       │   └── useProjects.ts      # Project data fetching
│       │
│       ├── components/             # UI components
│       │   ├── layout/
│       │   │   ├── TopBar.tsx
│       │   │   ├── Sidebar.tsx
│       │   │   └── StatusBar.tsx
│       │   │
│       │   ├── agents/
│       │   │   ├── AgentCard.tsx
│       │   │   ├── AgentTerminal.tsx    # xterm.js wrapper
│       │   │   ├── AgentGrid.tsx        # Multi-terminal grid view
│       │   │   └── AgentDetail.tsx
│       │   │
│       │   ├── projects/
│       │   │   ├── ProjectList.tsx
│       │   │   ├── ProjectOverview.tsx
│       │   │   └── NewProjectModal.tsx
│       │   │
│       │   ├── gsd/
│       │   │   ├── PlanViewer.tsx
│       │   │   ├── WaveTimeline.tsx
│       │   │   └── PhaseTree.tsx
│       │   │
│       │   └── shared/
│       │       ├── StatusBadge.tsx
│       │       ├── ProgressBar.tsx
│       │       └── CostDisplay.tsx
│       │
│       └── lib/
│           ├── api.ts              # REST client
│           ├── ws-client.ts        # WebSocket client wrapper
│           └── types.ts            # Shared TypeScript types
│
├── scripts/
│   ├── dev.sh                      # Start dev server + tmux session
│   ├── start.sh                    # Production start
│   └── setup-tailscale.sh          # Configure tailscale serve
│
└── data/                           # Runtime data (gitignored)
    ├── mission-control.db          # SQLite database
    └── logs/                       # Server logs
```

---

## 5. Core Subsystem Specifications

### 5.1 tmux Bridge

The tmux bridge is the most critical subsystem. It manages a single `tmux -CC` control mode connection to the tmux server and multiplexes all pane output to WebSocket subscribers.

**Control Mode Protocol:**
- Commands sent to stdin: standard tmux commands
- Notifications received on stdout, prefixed with `%`:
  - `%output %<pane_id> <octal-escaped-data>` — pane output (primary data stream)
  - `%window-add @<window_id>` — window created
  - `%window-close @<window_id>` — window destroyed
  - `%session-changed $<session_id> <name>` — session switch
  - `%exit` — control mode terminated

**Implementation pattern:**
```
spawn('tmux', ['-CC', 'attach', '-t', 'mc-control'])
  → on stdout line:
      if starts with '%output': parse pane_id + decode octal → emit to WS room
      if starts with '%window-close': mark agent as exited
      else: log for debugging
  → on stdin (from WS):
      write tmux command (e.g., 'send-keys -t %5 "ls" Enter')
```

**Health check (parallel polling):**
- Every 3 seconds: `tmux list-panes -a -F '#{pane_id}|#{pane_dead}|#{pane_dead_status}|#{pane_current_command}|#{session_name}'`
- Parse results, update agent status in SQLite
- Emit status change events via WebSocket

**Session configuration:**
- `set-option -g remain-on-exit on` — preserve output after process exit
- `set-hook -g pane-died 'run-shell "curl -s http://localhost:$MC_PORT/api/hooks/pane-died?pane=#{pane_id}&status=#{pane_dead_status}"'`

### 5.2 Orchestration Engine

The orchestrator is a state machine per project that manages wave-based agent execution.

**States per project:**
```
IDLE → PLANNING → WAVE_RUNNING → WAVE_COMPLETE → WAVE_RUNNING → ... → PROJECT_COMPLETE
                                       ↓
                                  WAVE_FAILED → WAITING_INTERVENTION
```

**Wave execution logic:**
1. Read plan index: `node gsd-tools.cjs phase-plan-index <phase_number>`
2. Group plans by wave number
3. For current wave, spawn one agent per plan (parallel)
4. Monitor all agents in wave
5. When all agents exit 0 → advance to next wave
6. When any agent exits non-zero → pause wave, notify user
7. When all waves complete → mark phase complete

**Agent spawn command templates:**

Claude Code:
```bash
claude -p "<plan_prompt>" \
  --dangerously-skip-permissions \
  --output-format stream-json \
  --max-turns 250 \
  --max-budget-usd 15 \
  --allowedTools "Bash,Write,Read,Glob,Grep"
```

Codex CLI:
```bash
codex exec \
  --full-auto \
  --json \
  "<plan_prompt>"
```

### 5.3 GSD Bridge

Interfaces with GSD without reimplementing its logic. Two communication paths:

**CLI calls (gsd-tools.cjs):**
```
node <gsd_path>/bin/gsd-tools.cjs init                        → JSON project context
node <gsd_path>/bin/gsd-tools.cjs phase-plan-index <N>        → wave/plan assignments
node <gsd_path>/bin/gsd-tools.cjs state advance-plan <plan>   → update plan status
node <gsd_path>/bin/gsd-tools.cjs verify plan-structure <plan> → validate plan
node <gsd_path>/bin/gsd-tools.cjs roadmap get-phase <N>       → phase metadata
```

**Filesystem parsing (.planning/):**
- Parse YAML frontmatter from plan files using `gray-matter`
- Watch `.planning/` with `fs.watch` for external changes (GSD running in separate terminal)
- Extract: `wave`, `depends_on`, `files_modified`, `autonomous`, `status`

### 5.4 SQLite Schema

```sql
CREATE TABLE projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    path        TEXT NOT NULL,           -- absolute path to project root
    gsd_path    TEXT,                    -- path to .planning/ directory
    phase       INTEGER DEFAULT 1,
    status      TEXT DEFAULT 'active',   -- active, paused, complete
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE agents (
    id          TEXT PRIMARY KEY,        -- a001, a002, ...
    project_id  TEXT NOT NULL REFERENCES projects(id),
    name        TEXT NOT NULL,           -- Agent-01, Agent-02, ...
    type        TEXT NOT NULL,           -- 'claude' or 'codex'
    plan_ref    TEXT,                    -- GSD plan reference (03-01, auth-02)
    wave        INTEGER,
    task        TEXT,                    -- human-readable task description
    status      TEXT DEFAULT 'queued',   -- queued, running, complete, failed, stopped
    tmux_session TEXT,                   -- tmux session name (mc-a001)
    tmux_pane   TEXT,                    -- tmux pane id (%5)
    worktree    TEXT,                    -- git worktree path
    tokens_used INTEGER DEFAULT 0,
    cost_usd    REAL DEFAULT 0,
    exit_code   INTEGER,
    started_at  TEXT,
    finished_at TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp   TEXT DEFAULT (datetime('now')),
    type        TEXT NOT NULL,           -- agent:spawned, agent:completed, wave:advanced, etc.
    project_id  TEXT,
    agent_id    TEXT,
    data        TEXT,                    -- JSON payload
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX idx_events_project ON events(project_id, timestamp);
CREATE INDEX idx_events_type ON events(type, timestamp);
CREATE INDEX idx_agents_project ON agents(project_id, status);
```

### 5.5 WebSocket Protocol

All messages are JSON. Client and server share a typed protocol.

**Server → Client:**
```typescript
// Terminal output (binary-safe via base64)
{ type: "terminal:output", paneId: string, data: string }

// Agent status change
{ type: "agent:status", agentId: string, status: AgentStatus, meta?: object }

// Wave lifecycle
{ type: "wave:started", projectId: string, wave: number, agents: string[] }
{ type: "wave:completed", projectId: string, wave: number }
{ type: "wave:failed", projectId: string, wave: number, failedAgents: string[] }

// System events
{ type: "system:stats", activeAgents: number, totalCost: number, uptime: number }
```

**Client → Server:**
```typescript
// Terminal input
{ type: "terminal:input", paneId: string, data: string }

// Subscribe/unsubscribe to terminal rooms
{ type: "terminal:subscribe", paneId: string }
{ type: "terminal:unsubscribe", paneId: string }

// Agent commands
{ type: "agent:stop", agentId: string }
{ type: "agent:retry", agentId: string }
```

### 5.6 REST API

```
GET    /api/projects                  → list all projects
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
GET    /api/system/stats              → aggregate stats (agents, costs, tokens)
GET    /api/events                    → event log (filterable, paginated)

POST   /api/hooks/pane-died           → tmux hook callback (pane exit)
```

---

## 6. Tailscale Integration

### 6.1 Setup

```bash
# One-time setup
tailscale up                              # Connect to tailnet
tailscale serve --bg 3000                 # Expose MC on HTTPS

# Access from any device on tailnet
# https://<hostname>.your-tailnet.ts.net
```

### 6.2 Authentication via Identity Headers

Tailscale Serve injects these headers into proxied requests:
- `Tailscale-User-Login` — email address
- `Tailscale-User-Name` — display name
- `Tailscale-User-Profile-Pic` — avatar URL

Mission Control reads these server-side for zero-config auth. No login page needed.

### 6.3 Access Control

Tailscale ACL policy (recommended):
```json
{
  "grants": [{
    "src": ["group:engineering"],
    "dst": ["tag:mission-ctrl"],
    "app": {
      "tailscale.com/cap/mission-ctrl": [{
        "role": ["operator"]
      }]
    }
  }]
}
```

### 6.4 WebSocket Through Tailscale Serve

WebSocket upgrade works through Tailscale Serve. One caveat: pass auth tokens via WS message protocol (first message after connect), not URL query params, as Serve may strip query parameters in some configurations.

---

## 7. Security Model

### 7.1 Local-First Trust Model

Mission Control runs on your machine. The threat model is:
- **Tailnet access**: Only devices on your tailnet can reach the dashboard
- **Agent isolation**: Git worktrees provide filesystem isolation between agents
- **tmux isolation**: Each agent runs in its own tmux session/pane
- **No secrets in DB**: API keys stay in environment variables, never stored in SQLite
- **Agent permissions**: `--dangerously-skip-permissions` is opt-in per spawn config

### 7.2 Agent Sandboxing Levels

| Level | Claude Code | Codex CLI |
|-------|------------|-----------|
| **Restricted** | Default (asks permission) | `--sandbox network-none` |
| **Autonomous** | `--dangerously-skip-permissions` | `--full-auto` |
| **Custom** | `--allowedTools` whitelist | `--sandbox workspace-write` |

Mission Control defaults to **Autonomous** for GSD-managed agents (plans include verification steps). Users can override per-agent.

---

## 8. Scalability Considerations

### 8.1 Current Target

- 3-5 concurrent projects
- 2-8 agents per project
- 10-20 total concurrent agents
- Single machine, single tmux server

### 8.2 Resource Constraints

- **tmux**: Handles hundreds of sessions, not a bottleneck
- **WebSocket**: Each terminal subscription is ~1KB/s during active coding
- **SQLite**: WAL mode handles concurrent reads, single-writer is fine
- **CPU**: AI agents are API-bound (network I/O), not CPU-bound locally
- **Memory**: ~50MB base + ~5MB per xterm.js instance in browser

### 8.3 Future Scaling Path

If needed beyond single-machine:
1. Multi-machine: Run tmux sessions on remote machines, bridge via SSH + tmux attach
2. Distributed: Replace SQLite with PostgreSQL, add Redis pub/sub for WS
3. Cloud agents: Integrate Codex App Server (cloud-hosted) alongside local tmux

Not architected for now. Single machine handles the target scale.

---

## 9. Key Architectural Decisions

### ADR-001: tmux Control Mode over Polling
**Decision**: Use tmux control mode (-CC) for real-time output streaming.
**Rationale**: Polling `capture-pane` at intervals wastes CPU and introduces latency. Control mode is event-driven, delivers output as it occurs, and provides lifecycle notifications. Validated by tmuxy, WebMux, and Agentboard.
**Trade-off**: Control mode is a single connection per tmux server — if it drops, all streams stop. Mitigation: auto-reconnect with exponential backoff.

### ADR-002: GSD as External Dependency, Not Embedded
**Decision**: Shell out to gsd-tools.cjs and parse .planning/ files rather than embedding GSD.
**Rationale**: GSD evolves independently. Embedding creates tight coupling and version conflicts. CLI + filesystem is a stable interface. GSD can still run in its own terminal alongside Mission Control.
**Trade-off**: CLI calls add ~50-100ms latency per invocation. Acceptable for non-real-time operations.

### ADR-003: SQLite over PostgreSQL
**Decision**: Use better-sqlite3 for all persistence.
**Rationale**: Zero config, no daemon, single-file backup, WAL mode handles concurrent reads. Target scale (10-20 agents) is well within SQLite limits. Portable — the entire data directory can be copied or backed up trivially.
**Trade-off**: Single-writer. Not a problem at target scale. Migration path to PostgreSQL exists if needed.

### ADR-004: Custom Node.js Server over Next.js App Router
**Decision**: Use Vite for frontend build, custom Node.js http server for backend.
**Rationale**: Next.js App Router's serverless model conflicts with long-lived WebSocket connections and persistent tmux control mode processes. A custom server gives full control over the process lifecycle.
**Trade-off**: No SSR, no file-based routing. Acceptable — this is an SPA dashboard, not a content site.

### ADR-005: Git Worktrees for Agent Isolation
**Decision**: Each agent spawns in its own git worktree branched from main.
**Rationale**: Prevents file conflicts when multiple agents modify the same codebase. Worktrees share the git object store (space efficient) while providing independent working directories. Validated by Claude Code Agent Teams, Stoneforge, and Overstory.
**Trade-off**: Requires merging worktree branches back. GSD's branching strategy (feature branches per plan) already handles this.
