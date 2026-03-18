# Lumon — Publish & Distribution Roadmap

> **Package name**: `lumon` (available on npm as of 2026-03-17)
> **Repository**: github.com/vahagn-madatyan/lumon
> **License**: Apache-2.0
> **Organization**: Twin Coast Labs

---

## What Lumon Is

Lumon is a self-hosted agent orchestration dashboard. You install it, run it, and use the browser-based Mission Control UI to manage AI coding agents (Claude Code, Codex CLI) through a structured pipeline: intake, research, plan, execution waves, verification, and handoff.

It is **not** a library. It is a runnable application — an Express server that serves a React dashboard and bridges to agent orchestration via n8n webhooks and SSE.

---

## Current Architecture (pre-publish)

```
Browser (React SPA)
    |
    |  HTTP + SSE
    v
Express Bridge Server (port 3001)
    |
    |  REST webhooks + callbacks
    v
n8n (orchestration layer)
    |
    |  spawns / manages
    v
AI Agents (Claude Code, Codex CLI)
```

### What the server does today

- **SSE streaming** — pushes real-time stage updates, artifact events, and pipeline status to the dashboard
- **Pipeline orchestration** — triggers n8n webhooks per stage, receives callbacks with results, auto-chains sequential sub-stages (research, plan, verification)
- **Artifact storage** — persists artifacts as JSON files to `server/data/` on disk
- **Approval gates** — operator approve/reject flow with n8n resume URL support
- **Webhook registry** — per-stage env var routing (`N8N_WEBHOOK_URL_RESEARCH`, etc.) with global fallback

### What the server does NOT do today

- **Pipeline state** — in-memory only (`pipeline.js` uses `Map`). Server restart = execution state lost.
- **Auth** — no login, no API keys, no access control
- **HTTPS** — plain HTTP only
- **Multi-user** — single operator model, no user identity
- **Direct agent control** — all agent management goes through n8n, not direct

---

## Phase 1 — Ship Local (v0.1.0)

**Goal**: `npm install -g lumon && lumon` starts the server, serves the dashboard, connects to your n8n instance. Also works with `npx lumon`.

### 1.1 CLI Entry Point

Create `bin/lumon.js`:

```
#!/usr/bin/env node
```

Responsibilities:
- Parse CLI args: `--port`, `--host`, `--data-dir`
- Resolve the built dashboard path (relative to the installed package)
- Start the Express server
- Add `express.static()` middleware to serve the pre-built React SPA
- Add SPA fallback (serve `index.html` for all non-API routes)
- Print startup banner with URLs

Usage:
```bash
lumon                                    # default: port 3001, localhost
lumon --port 8080                        # custom port
lumon --host 0.0.0.0                     # bind to all interfaces (for LAN/Tailscale)
N8N_WEBHOOK_URL=https://... lumon        # with n8n webhook configured
LUMON_DATA_DIR=~/.lumon/data lumon       # custom artifact storage path
```

### 1.2 Server Changes

Modify `server/index.js` to support both dev mode and installed-package mode:

- Accept a `distPath` option for the pre-built SPA location
- Add `express.static(distPath)` middleware
- Add catch-all `GET *` route that serves `index.html` (SPA routing)
- Export a `createServer(options)` function the CLI can call (instead of auto-listening)
- Keep the current `app.listen()` as a fallback for dev mode (`npm run dev:server`)

Modify `server/artifacts.js`:
- Default `DATA_DIR` to `~/.lumon/data` when running as installed package (not `__dirname/data`)
- Respect `LUMON_DATA_DIR` env var override

### 1.3 package.json Changes

```jsonc
{
  "name": "lumon",
  "version": "0.1.0",
  "private": false,
  "description": "Self-hosted agent orchestration dashboard — manage AI coding agents through a structured pipeline",
  "license": "Apache-2.0",
  "type": "module",
  "bin": {
    "lumon": "./bin/lumon.js"
  },
  "files": [
    "bin/",
    "server/",
    "dist/",          // pre-built React SPA (created by vite build)
    "LICENSE",
    "README.md"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/vahagn-madatyan/lumon.git"
  },
  "homepage": "https://github.com/vahagn-madatyan/lumon",
  "bugs": {
    "url": "https://github.com/vahagn-madatyan/lumon/issues"
  },
  "keywords": [
    "agent",
    "orchestration",
    "dashboard",
    "mission-control",
    "claude",
    "codex",
    "n8n",
    "ai-agents",
    "self-hosted"
  ],
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "prepublishOnly": "npm run build && npm test"
  }
}
```

Key decisions:
- `"files"` whitelist means `src/`, `node_modules/`, test files, dev configs do NOT ship in the package
- `"bin"` makes `lumon` available as a CLI command after global install
- Runtime deps (`express`, `cors`, `uuid`) stay in `"dependencies"`
- Build-time/dev deps (`vite`, `react`, `tailwindcss`, `vitest`, etc.) move to `"devDependencies"` since the SPA is pre-built
- `"prepublishOnly"` ensures tests pass and the SPA is built before every publish

### 1.4 Dependency Split

The published package only needs runtime deps for the server. All React/Vite/Tailwind deps are build-time only since the SPA ships pre-built as static files.

**dependencies** (ship with the package — server runtime):
```
express
cors
uuid
```

**devDependencies** (build-time only — do NOT ship):
```
react, react-dom
vite, @vitejs/plugin-react
tailwindcss, @tailwindcss/vite, tw-animate-css
@xyflow/react
lucide-react
clsx, class-variance-authority, tailwind-merge
shadcn, @base-ui/react, @fontsource-variable/geist
eslint, vitest, jsdom, @testing-library/*
concurrently, supertest
```

### 1.5 Build Pipeline

The Vite build step (`npm run build`) already produces `dist/` with the SPA. No changes needed to the Vite config — it builds the React app as a static site.

The server is plain Node.js (no transpilation needed). It ships as-is.

### 1.6 npm Account & Token Setup

Manual steps (one-time):

1. **Create npm account** at https://www.npmjs.com/signup
2. **Enable 2FA** on the npm account (Settings > Two-Factor Authentication)
3. **Generate an automation token** (Settings > Access Tokens > Generate New Token > Automation)
4. **Add `NPM_TOKEN` as a GitHub repository secret** (repo Settings > Secrets and variables > Actions > New repository secret)

### 1.7 GitHub Actions

Two workflow files:

**`.github/workflows/ci.yml`** — runs on every push and PR:
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

**`.github/workflows/publish.yml`** — runs when a version tag is pushed:
```yaml
name: Publish to npm
on:
  push:
    tags: ['v*']

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Release flow:**
```bash
npm version patch     # 0.1.0 → 0.1.1 (bumps package.json, creates git tag)
git push --follow-tags
# GitHub Actions runs tests, builds, publishes to npm automatically
```

### 1.8 .npmignore

Alternatively to the `"files"` whitelist, create `.npmignore` to exclude dev-only files:

```
src/
*.config.js
vitest.workspace.js
.github/
.gsd/
n8n/
server/__tests__/
server/data/
dist2/ through dist12/
*.mmd
ARCHITECTURE*.md
PUBLISH-ROADMAP.md
compass_*.md
lumon-master-architecture.md
```

The `"files"` field in package.json is preferred (whitelist > blacklist), but both work.

---

## Phase 2 — Persistent Storage (v0.2.0)

**Goal**: Server restart does not lose pipeline state. Artifacts and execution records survive across restarts.

### What changes

| Component | Current | Target |
|-----------|---------|--------|
| Pipeline state (`pipeline.js`) | In-memory `Map` | SQLite via `better-sqlite3` |
| Artifact index | Flat JSON files in `server/data/` | SQLite table + file storage for large content |
| Project state | Client-side only (localStorage via `persistence.js`) | SQLite (server becomes source of truth) |

### Why SQLite

- Zero config — no database server to run
- Single file — easy to back up, move, reset
- Ships with `better-sqlite3` (native, fast, synchronous API)
- Matches the self-hosted ethos — nothing to install besides `lumon`

### Data location

```
~/.lumon/
  lumon.db          # SQLite database (pipeline state, project registry, artifact index)
  artifacts/        # large artifact content files (referenced by DB rows)
  config.json       # optional: saved settings, webhook URLs
```

### Schema sketch

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  data JSON NOT NULL,        -- full createProject() output
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE executions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  stage_key TEXT NOT NULL,
  sub_stage TEXT,
  status TEXT NOT NULL,
  context JSON,
  resume_url TEXT,
  n8n_execution_id TEXT,
  triggered_at TEXT NOT NULL,
  completed_at TEXT,
  failure_reason TEXT
);

CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  stage_key TEXT NOT NULL,
  type TEXT NOT NULL,
  summary TEXT,
  content_path TEXT,          -- path to large content file, or NULL if inline
  content_inline JSON,        -- small content stored inline
  metadata JSON,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_executions_project_stage ON executions(project_id, stage_key);
CREATE INDEX idx_artifacts_project_stage ON artifacts(project_id, stage_key);
```

### Migration from v0.1.0

- On first run after upgrade, if `server/data/*.json` artifact files exist, migrate them into the SQLite DB
- If `localStorage` project state exists in the browser, POST it to a new `/api/projects/import` endpoint to seed the DB

---

## Phase 3 — Authentication (v0.3.0)

**Goal**: Lumon is safe to expose beyond localhost. Basic auth prevents unauthorized access.

### 3.1 API Key Auth (simple, first)

- On first run, Lumon generates a random API key and prints it to the console
- Key is stored in `~/.lumon/config.json`
- All API requests require `Authorization: Bearer <key>` header
- Dashboard login page accepts the key and stores it in a cookie/localStorage
- SSE connections include the key as a query param

```bash
lumon
# [lumon] API key: lmn_k1_a8f3...b2c1
# [lumon] Dashboard: http://localhost:3001
# [lumon] Use the API key above to log in
```

### 3.2 Optional: password auth (later)

- `lumon --set-password` prompts for a password, stores bcrypt hash in config
- Dashboard shows a username/password form instead of API key input
- Still single-user — this is access control, not identity management

### What this unlocks

- Safe to run on a VPS or cloud instance
- Safe to expose via Tailscale Funnel (public URL)
- Safe behind a reverse proxy without additional auth layers

---

## Phase 4 — Cloud-Ready Hosting (v0.4.0)

**Goal**: Lumon runs reliably on cloud infrastructure with proper networking for remote agent management.

### 4.1 Deployment targets

| Target | How |
|--------|-----|
| **Docker** | Publish official `Dockerfile` and `docker-compose.yml`. Single container runs the server + serves the dashboard. Volume mount for `~/.lumon/` data. |
| **Railway / Render / Fly.io** | One-click deploy via `Dockerfile` or buildpack. Env vars for config. |
| **VPS (bare metal)** | `npm i -g lumon && lumon --host 0.0.0.0` behind nginx/Caddy for TLS |
| **Tailscale Funnel** | Zero-config public URL with TLS. `tailscale funnel 3001` |

### 4.2 Docker

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
COPY server/ ./server/
COPY bin/ ./bin/
EXPOSE 3001
ENV LUMON_DATA_DIR=/data
VOLUME /data
CMD ["node", "bin/lumon.js", "--host", "0.0.0.0"]
```

```yaml
# docker-compose.yml
services:
  lumon:
    image: lumon:latest
    build: .
    ports:
      - "3001:3001"
    volumes:
      - lumon-data:/data
    environment:
      - N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/...
      - PORT=3001
volumes:
  lumon-data:
```

### 4.3 Networking model for remote agents

The key question: how does the n8n instance (or agents) call back to Lumon's `/api/pipeline/callback` endpoint?

**Scenario A — Same network (local, LAN, Tailscale)**:
```
Lumon (192.168.1.10:3001) <——> n8n (192.168.1.20:5678)
```
n8n can reach Lumon's callback URL directly. No special config needed.

**Scenario B — Lumon in cloud, n8n in cloud**:
```
Lumon (lumon.fly.dev) <——> n8n (n8n.railway.app)
```
Both have public URLs. Callbacks work out of the box. Auth (Phase 3) prevents unauthorized access.

**Scenario C — Lumon local, n8n in cloud**:
```
Lumon (localhost:3001) <——tailscale——> n8n (n8n.cloud)
```
Lumon needs to be reachable from n8n. Options:
- Tailscale Funnel gives Lumon a public URL
- ngrok/cloudflare tunnel as alternatives
- Lumon could poll n8n instead of receiving callbacks (future: webhook-to-polling adapter)

**New config for callback URL:**
```bash
LUMON_CALLBACK_URL=https://my-lumon.tailscale.ts.net:3001  lumon
```
This URL is sent to n8n in trigger payloads so n8n knows where to POST callbacks.

### 4.4 Health check endpoint

Add `GET /api/health` — returns server version, uptime, connected clients, DB status. Required for container orchestration (Docker, k8s) and monitoring.

---

## Phase 5 — Direct Agent Protocol (v0.5.0+)

**Goal**: Lumon can manage agents directly, without requiring n8n as an intermediary.

### Why

n8n is powerful but adds complexity. For users who just want to run Claude Code or Codex CLI from Lumon without setting up n8n workflows, a direct agent protocol removes that friction.

### What this looks like

- Lumon spawns agent processes directly (via `child_process` or tmux sessions, as described in the original ARCHITECTURE.md)
- Agent stdout/stderr streams back to the dashboard in real-time
- Lumon sends tasks and receives results over the process I/O
- n8n becomes optional — use it for complex multi-step orchestration, skip it for simple agent dispatch

### Agent adapter interface

```javascript
// server/agents/adapter.js
export interface AgentAdapter {
  spawn(config: { type: "claude" | "codex", task: string, workdir: string }): AgentProcess;
  kill(agentId: string): void;
  list(): AgentProcess[];
}

// server/agents/claude-adapter.js  — spawns claude-code CLI
// server/agents/codex-adapter.js   — spawns codex CLI
// server/agents/n8n-adapter.js     — current webhook-based approach (backwards compat)
```

### Config

```bash
lumon --agent-mode direct     # spawn agents directly (no n8n)
lumon --agent-mode n8n        # current behavior (default)
```

---

## Phase 6 — Multi-User & Teams (v0.6.0+)

**Goal**: Multiple operators can log in, each with their own projects and permissions.

### What this adds

- User accounts with email/password or OAuth (GitHub, Google)
- Project ownership — each project belongs to a user
- Role-based access: admin (full control), operator (manage own projects), viewer (read-only dashboard)
- Audit log — who triggered, approved, or rejected what, and when

### Why this is later

Single-operator is the right model for v0.1–v0.5. Multi-user adds auth complexity, session management, and database schema changes that aren't needed until Lumon is used by teams.

---

## Version Summary

| Version | Milestone | Key Features |
|---------|-----------|-------------|
| **v0.1.0** | Ship Local | CLI entry point, `npx lumon`, GitHub Actions CI/publish, npm package |
| **v0.2.0** | Persistence | SQLite for pipeline state + artifacts, survive restarts |
| **v0.3.0** | Auth | API key login, safe to expose beyond localhost |
| **v0.4.0** | Cloud-Ready | Docker, `LUMON_CALLBACK_URL`, health checks, deployment guides |
| **v0.5.0** | Direct Agents | Spawn agents without n8n, agent adapter interface |
| **v0.6.0** | Multi-User | User accounts, project ownership, roles, audit log |

---

## Immediate Next Steps (v0.1.0 Checklist)

- [ ] Create `bin/lumon.js` CLI entry point
- [ ] Modify `server/index.js` to export `createServer()` and serve static SPA
- [ ] Update `server/artifacts.js` default data dir to `~/.lumon/data`
- [ ] Split dependencies (runtime vs dev) in `package.json`
- [ ] Update `package.json` fields (name, version, bin, files, keywords, etc.)
- [ ] Create `.github/workflows/ci.yml`
- [ ] Create `.github/workflows/publish.yml`
- [ ] Clean up stale `dist2/` through `dist12/` directories
- [ ] Test `npm pack` locally — verify package contents are correct
- [ ] Test `npm install -g .` locally — verify `lumon` command works
- [ ] Create npm account, enable 2FA, generate automation token
- [ ] Add `NPM_TOKEN` to GitHub repository secrets
- [ ] Tag v0.1.0 and publish
