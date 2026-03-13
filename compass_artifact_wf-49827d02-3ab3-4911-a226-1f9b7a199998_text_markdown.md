# Designing Mission Control: an AI agent orchestration dashboard

**A web-based "Mission Control" dashboard for Twin Coast Labs can orchestrate Claude Code and OpenAI Codex agents running in tmux sessions, managed through GSD's planning system, and served remotely via Tailscale.** The architecture is technically feasible today — several open-source projects already implement overlapping pieces — but no single tool combines GSD's structured planning, multi-agent tmux orchestration, real-time terminal rendering, and remote access into one cohesive system. This report synthesizes deep research across all seven required domains to provide a complete architectural blueprint, recommending a **Next.js + custom Node.js server + xterm.js + WebSocket + SQLite** stack, with tmux control mode as the streaming backbone and Tailscale Serve for secure remote access.

---

## GSD provides the planning brain, not the process manager

GSD (Get Shit Done) is fundamentally a **context engineering system**, not a process manager. It's a collection of carefully-crafted markdown prompts organized into four layers: thin commands (~50-100 lines) → workflow orchestrators (~200-400 lines) → specialist agents (~800-1500 lines) → a deterministic CLI tool (`gsd-tools.cjs`, zero dependencies, 40+ commands). The system solves "context rot" — the quality degradation that occurs as AI assistants fill their context windows — by spawning fresh **200K-token subagent contexts** via Claude Code's native `Task()` mechanism.

GSD does **not** use tmux or any external process management. All agent orchestration happens within a single Claude Code process. This is a critical architectural insight for Mission Control: GSD's value lies in its **planning hierarchy** (milestones → phases → waves → plans → tasks), not in its execution runtime. The planning files — `PROJECT.md`, `ROADMAP.md`, `REQUIREMENTS.md`, phase-level `CONTEXT.md`, `RESEARCH.md`, and `PLAN.md` files stored in `.planning/` — are structured markdown with YAML frontmatter that any external system can parse.

The waves system is particularly relevant. Plans within a phase are assigned wave numbers by the `gsd-planner` agent based on dependency analysis. **Within a wave, plans execute in parallel; between waves, execution is sequential.** Plans use XML-structured tasks with verification steps, and the frontmatter includes `wave`, `depends_on`, `files_modified`, and `autonomous` fields. Mission Control should read these wave assignments to determine which agents can run concurrently and which must wait.

GSD's configuration model (`config.json`) includes `parallelization.enabled`, model profiles (quality/balanced/budget mapping to Opus/Sonnet/Haiku), workflow toggles for research/plan-checking/verification, and git branching strategies. The `gsd-tools.cjs` CLI provides deterministic operations — `init` to load project context as JSON, `phase-plan-index` to get wave assignments, `state advance-plan` to update progress, and `verify plan-structure` to validate plans. Mission Control can call these directly to read and update GSD state without reimplementing the planning logic.

---

## Claude Code and Codex offer complementary automation interfaces

Both agents provide headless execution modes ideal for tmux-based orchestration, but their programmatic control surfaces differ significantly.

**Claude Code** runs headlessly via `claude -p "task" --dangerously-skip-permissions --output-format stream-json`, producing newline-delimited JSON events suitable for real-time monitoring. The `--max-turns` and `--max-budget-usd` flags bound execution, while `--allowedTools` provides scoped autonomy. The **Claude Agent SDK** (Python and TypeScript) offers full programmatic control through an async `query()` iterator with hooks for `PreToolUse`, `PostToolUse`, and `PermissionRequest` — enabling Mission Control to intercept and approve tool calls programmatically. Sessions persist to `~/.claude/sessions/` and can be resumed via `--resume <session-id>` or forked via `--fork-session`. Claude Code's experimental **Agent Teams** feature already supports tmux split-pane mode (configured via `"teammateMode": "tmux"` in settings.json), where a team lead spawns teammates into visible tmux panes with shared task lists and inter-agent communication.

**OpenAI Codex CLI** provides an even richer automation surface. The `codex exec` command runs headlessly with `--json` for JSONL event streaming (typed events: `thread.started`, `turn.started`, `turn.completed`, `item.*`). More powerfully, the **Codex App Server** (`codex app-server`) exposes a bidirectional **JSON-RPC 2.0** API over stdio or WebSocket (`--listen ws://127.0.0.1:4500`) with commands including `thread/start`, `turn/start`, `turn/steer`, and `turn/interrupt` — enabling Mission Control to steer agents mid-flight. The TypeScript SDK (`@openai/codex-sdk`) wraps this cleanly. Codex uses kernel-level sandboxing (macOS Seatbelt, Linux Landlock + seccomp) rather than containers, and its `--full-auto` mode combines `--ask-for-approval on-request` with `--sandbox workspace-write` for safe autonomous execution. Configuration lives in `.codex/config.toml` with named profiles, and `AGENTS.md` serves the same role as `CLAUDE.md`.

For Mission Control's purposes, the key differences that affect architecture are:

- **Programmatic control**: Codex's App Server (JSON-RPC, bidirectional) is superior to Claude Code's CLI-based headless mode for real-time orchestration. Claude's Agent SDK closes this gap but requires wrapping each session in a Python/TypeScript process.
- **Output streaming**: Both support JSONL event streams. Codex's typed events are more structured; Claude's `stream-json` output is simpler.
- **Session management**: Both support resume and fork. Codex sessions live in `$CODEX_HOME/sessions/`; Claude sessions in `~/.claude/sessions/`.
- **Isolation**: Both recommend git worktrees for file-level isolation when running concurrent agents on the same codebase.

---

## tmux control mode is the optimal streaming backbone

Four approaches exist for bridging tmux sessions to a web dashboard, and **tmux control mode** (`tmux -C attach`) is the clear winner for Mission Control.

Control mode provides a text-based event protocol: commands go in on stdin, structured notifications come out on stdout prefixed with `%`. The critical notification is `%output %<pane_id> <octal-escaped-data>`, which delivers real-time pane output without polling. Additional notifications cover window lifecycle (`%window-add`, `%window-close`), session changes, and layout updates. This event-driven approach eliminates the CPU waste of polling `capture-pane` while providing lower latency than `pipe-pane` file-based streaming.

The architecture pattern, validated by projects like **tmuxy** (Rust + React) and **WebMux** (Rust + Vue), works as follows:

1. Backend spawns `tmux -C attach -t <session>` as a child process
2. Backend parses `%output` events and routes them to WebSocket channels keyed by pane ID
3. Frontend xterm.js instances subscribe to their pane's channel and render output
4. User input flows back: xterm.js → WebSocket → backend → `send-keys -t %<pane_id>` via control mode stdin

For lifecycle management, set `remain-on-exit on` per window so dead panes preserve their output and expose exit codes via `#{pane_dead_status}`. tmux hooks (`pane-died`, `pane-exited`) fire on process exit, and `wait-for` provides synchronization primitives for sequential orchestration between waves. The `#{pane_id}` format variable (e.g., `%5`) serves as the canonical, globally unique identifier for every agent pane.

**libtmux** (Python, v0.53.x) provides a convenient ORM for session/window/pane creation but lacks event streaming — use it for orchestration scaffolding (creating sessions, sending commands, querying state) while using control mode for real-time output. In Node.js, shell out to tmux commands for management and spawn a control mode child process for streaming.

---

## The recommended tech stack and architecture

After evaluating Next.js, Electron, and Tauri against the requirements (web-accessible, real-time terminal rendering, tmux control, Tailscale-compatible), the recommended stack is:

**Next.js + custom Node.js server + xterm.js + ws (WebSocket) + better-sqlite3**

This stack is validated by multiple reference projects: **Agentboard** (Bun + React + xterm.js, most directly relevant — web GUI for AI agent tmux sessions), **Mission Control by Builderz Labs** (28-panel dashboard with SQLite, auto-discovers Claude Code sessions), **Stoneforge** (full agent orchestrator with live terminal output, SQLite + JSONL event sourcing), and **WebMux** (clean WebSocket protocol for tmux session management). The pattern of Next.js with a custom server for WebSocket integration is well-established and works perfectly with Tailscale Serve, since it's just a local HTTP server.

The architecture divides into five layers:

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React + xterm.js)                                  │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────┐  │
│  │ Agent     │ │ Agent     │ │ Project   │ │ GSD Planning │  │
│  │ Terminals │ │ Status    │ │ Dashboard │ │ Viewer       │  │
│  │ (xterm.js)│ │ Cards     │ │           │ │              │  │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └──────┬───────┘  │
│        └──────────────┴─────────────┴──────────────┘          │
│                        WebSocket                               │
└────────────────────────┬──────────────────────────────────────┘
                         │
┌────────────────────────┼──────────────────────────────────────┐
│  Node.js Custom Server │                                       │
│  ┌─────────────────┐ ┌─┴──────────────┐ ┌──────────────────┐ │
│  │ WebSocket Router │ │ tmux Bridge    │ │ Agent Manager    │ │
│  │ (per-pane rooms) │ │ (control mode) │ │ (spawn/kill/     │ │
│  │                  │ │                │ │  status)         │ │
│  └────────┬─────────┘ └───────┬────────┘ └────────┬─────────┘ │
│           │                   │                    │           │
│  ┌────────┴───────────────────┴────────────────────┴─────────┐│
│  │ Orchestration Engine                                       ││
│  │ - Reads GSD .planning/ state via gsd-tools.cjs            ││
│  │ - Parses wave/plan dependencies                            ││
│  │ - Spawns agents per wave (parallel within, sequential      ││
│  │   between)                                                 ││
│  │ - Monitors agent health (pane_dead, exit codes)           ││
│  │ - Tracks costs/tokens from stream-json output              ││
│  └────────┬───────────────────────────────────────────────────┘│
│  ┌────────┴───────────────────────────────────────────────────┐│
│  │ SQLite (better-sqlite3)                                    ││
│  │ - Agent sessions, status, assignments                      ││
│  │ - Token/cost tracking per agent                            ││
│  │ - Event log (append-only)                                  ││
│  │ - GSD state cache                                          ││
│  └────────────────────────────────────────────────────────────┘│
└───────────────────────────────┬────────────────────────────────┘
                                │
┌───────────────────────────────┼────────────────────────────────┐
│  tmux Server                  │                                 │
│  ┌──────────┐  ┌──────────┐  │  ┌──────────┐  ┌──────────┐   │
│  │Session:  │  │Session:  │  │  │Session:  │  │Session:  │   │
│  │agent-01  │  │agent-02  │  │  │agent-03  │  │agent-04  │   │
│  │(Claude)  │  │(Claude)  │  │  │(Codex)   │  │(Claude)  │   │
│  │Wave 1    │  │Wave 1    │  │  │Wave 2    │  │Wave 2    │   │
│  └──────────┘  └──────────┘  │  └──────────┘  └──────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## How agents spawn and execute as "employees"

The agent lifecycle in Mission Control follows a clear pattern treating each agent as an employee with a specific assignment:

**Spawning**: When the orchestration engine starts a phase execution, it reads the GSD plan index via `gsd-tools.cjs phase-plan-index <N>` to get wave assignments. For each plan in Wave 1, it creates a dedicated tmux session (`tmux new-session -d -s agent-<plan-id> -c <worktree-path>`), then sends the appropriate launch command. For Claude Code agents: `tmux send-keys -t agent-<id> 'claude -p "Execute plan..." --dangerously-skip-permissions --output-format stream-json --max-turns 250 --max-budget-usd 10' C-m`. For Codex agents: `tmux send-keys -t agent-<id> 'codex exec --full-auto --json "Execute plan..."' C-m`. Each agent operates in its own **git worktree** for file isolation.

**Monitoring**: The tmux bridge (control mode) streams all pane output to the WebSocket router, which fans it out to subscribed browser terminals. Simultaneously, a monitoring loop polls `tmux list-panes -a -F '#{pane_id} #{pane_dead} #{pane_dead_status} #{pane_current_command}'` every 2-5 seconds for health checks. Agent status cards on the dashboard show: running/complete/failed, current task, token usage (parsed from stream-json events), elapsed time, and cost estimate.

**Wave transitions**: When all agents in Wave N complete (detected via `pane_dead` + exit code 0), the engine advances GSD state via `gsd-tools.cjs state advance-plan`, reads the next wave's plans, and spawns new agent sessions. Failed agents trigger a notification; the dashboard offers retry, skip, or manual intervention options.

**Manual interaction**: Each agent's xterm.js terminal is fully interactive. An operator can click into any agent's terminal, type commands, and interact directly — useful for handling GSD's `checkpoint:decision` events where the executor detects a major architectural change requiring human input.

---

## Tailscale Serve delivers zero-config remote access

Tailscale Serve is the ideal solution for accessing Mission Control remotely. The entire setup requires three commands after installing Tailscale on your devices:

```bash
npm run dev                    # Start Mission Control on localhost:3000
tailscale serve --bg 3000      # Expose to tailnet with auto-HTTPS
# Access from any device: https://mission-ctrl.your-tailnet.ts.net
```

Tailscale Serve acts as a reverse proxy, automatically provisioning **Let's Encrypt TLS certificates** via DNS-01 challenge through MagicDNS. It injects **identity headers** (`Tailscale-User-Login`, `Tailscale-User-Name`) into proxied requests, providing zero-config authentication — Mission Control can read these headers to identify who's viewing the dashboard without building a separate auth system. **WebSocket connections work through Serve** since it handles HTTP upgrade requests, though auth tokens should be passed via message protocol rather than URL query parameters due to a known edge case with query parameter stripping.

Access control uses Tailscale ACLs or the newer grants system. A minimal policy restricting dashboard access to engineering team members:

```json
{
  "grants": [{
    "src": ["group:engineering"],
    "dst": ["tag:mission-ctrl"],
    "app": { "tailscale.com/cap/mission-ctrl": [{ "role": "operator" }] }
  }]
}
```

Connections are **peer-to-peer via WireGuard** when possible, with near-native latency. No port forwarding, no public IP exposure, no firewall configuration needed. The dashboard machine's IP never touches the public internet (unless Funnel is explicitly enabled, which is not recommended for this use case).

---

## Key reference projects that validate this architecture

Five open-source projects collectively validate every component of the proposed architecture:

- **Agentboard** (github.com/gbasin/agentboard): Web GUI for AI agent tmux sessions built with Bun, React, and xterm.js. Discovers tmux sessions, streams output via WebSocket, detects agent status (working/waiting/permission). Most directly relevant to Mission Control's core terminal management needs.

- **Stoneforge** (stoneforge.ai): The most feature-complete AI agent orchestrator. Provides live terminal output, a Linear-like inbox, Monaco editor, automatic git worktrees per worker, SQLite + JSONL event sourcing, and supports Claude Code, OpenCode, and Codex.

- **Mission Control by Builderz Labs** (github.com/builderz-labs/mission-control): A **28-panel** dashboard for AI agent orchestration with real-time WebSocket + SSE updates, SQLite persistence, auto-discovery of Claude Code sessions, and role-based access. Shares the exact name and concept.

- **tmuxy** (github.com/flplima/tmuxy): Rust backend connecting to tmux via control mode, streaming state via SSE to a React frontend rendered in Tauri. Proves the control mode → SSE/WebSocket → browser pattern works.

- **Codeman**: Web UI for managing Claude Code in tmux featuring xterm.js terminals, a respawn controller with circuit breaker, per-session token/cost tracking, and presets for solo work, subagent workflows, team-lead mode, and overnight autonomous operation.

---

## Conclusion: a modular, buildable system

Mission Control is not a moonshot — it's an integration project. The core innovation is connecting GSD's structured planning system (which currently only runs inside a single Claude Code process) to a multi-agent tmux runtime with a real-time web dashboard. The critical architectural decisions are:

1. **Use tmux control mode** as the streaming backbone, not polling. This is the single most impactful technical choice.
2. **Parse GSD's `.planning/` files and call `gsd-tools.cjs`** for state management rather than reimplementing planning logic. GSD's wave system maps directly to parallel/sequential agent spawning.
3. **Support both Claude Code and Codex as first-class agents** via their headless modes (`claude -p` and `codex exec`), with Codex's App Server as an advanced integration path for steering agents mid-flight.
4. **Use git worktrees** for agent isolation — this pattern is validated across Agentboard, Overstory, Stoneforge, and Claude Code's own Agent Teams feature.
5. **Store everything in SQLite** with an append-only event log. This enables the dashboard to survive restarts, track costs, and provide historical views.
6. **Ship Tailscale Serve as the default remote access method**, leveraging its identity headers for zero-config auth.

The modular architecture means each layer can be built and tested independently: the tmux bridge, the GSD state reader, the agent spawner, the WebSocket router, the xterm.js frontend, and the Tailscale integration. Start with Agentboard's pattern for terminal management, layer GSD's planning system on top, and add Codex support alongside Claude Code. The result is a system where AI coding agents truly operate as employees — assigned tasks from a structured plan, monitored in real time, and managed through a single pane of glass.