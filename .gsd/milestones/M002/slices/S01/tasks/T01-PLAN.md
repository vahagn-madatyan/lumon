---
estimated_steps: 7
estimated_files: 8
---

# T01: Express bridge server with artifact storage and API endpoints

**Slice:** S01 — Bridge Server & Intake Stage
**Milestone:** M002

## Description

Stand up the Express bridge server that manages n8n communication, persists structured artifacts to disk, and exposes REST endpoints for trigger, callback, approve, artifact retrieval, and pipeline status. Configure Vite to proxy `/api/*` to Express and update `npm run dev` to start both processes.

## Steps

1. Install Express, cors, concurrently, and uuid as dependencies. Configure vitest for server test files (Node environment, not jsdom).
2. Create `server/artifacts.js` — disk-based JSON artifact store under `server/data/` with `create`, `get`, `getByProject`, and `list` operations. Each artifact record: `{ id, projectId, stageKey, type, content, metadata, createdAt }`.
3. Create `server/pipeline.js` — in-memory pipeline execution state tracker. Tracks per-project pipeline runs: `{ projectId, executionId, status, stageKey, n8nExecutionId, resumeUrl, triggeredAt, completedAt }`. Provides `trigger`, `recordCallback`, `recordApproval`, `getStatus` operations.
4. Create `server/routes/pipeline.js` — Express router with 5 endpoints:
   - `POST /api/pipeline/trigger` — accepts `{ projectId, stageKey }`, calls n8n webhook (or records the intent if n8n is unreachable), stores execution state, returns `{ executionId, status }`
   - `POST /api/pipeline/callback` — accepts `{ executionId, projectId, stageKey, result, resumeUrl }` from n8n callback, stores artifact via artifacts module, records resumeUrl, returns `{ ok: true }`
   - `POST /api/pipeline/approve` — accepts `{ projectId, stageKey, decision }`, calls n8n resumeUrl if approved, updates execution state, returns `{ ok: true, decision }`
   - `GET /api/artifacts/:id` — returns the stored artifact by ID
   - `GET /api/pipeline/status/:projectId` — returns current pipeline execution state for the project
5. Create `server/index.js` — Express app entrypoint. Mounts cors, json body parser, pipeline routes. Starts on port 3001. Reads `N8N_WEBHOOK_URL` from environment (optional — graceful degradation when absent).
6. Update `vite.config.js` to add a proxy: `/api` → `http://localhost:3001`. Update `package.json` scripts: `"dev:server": "node server/index.js"`, `"dev:client": "vite"`, `"dev": "concurrently \"npm:dev:server\" \"npm:dev:client\""`.
7. Write `server/__tests__/pipeline-api.test.js` — API contract tests using supertest (or direct fetch against the running server). Test each endpoint: trigger returns execution record, callback stores artifact, approve updates state, artifact retrieval returns content, status returns current execution state. Include edge cases: callback for unknown execution, approve for non-existent project, artifact 404.

## Must-Haves

- [ ] All 5 REST endpoints respond correctly with proper status codes and JSON bodies
- [ ] Artifact storage persists JSON files to `server/data/` with correct record shape
- [ ] Pipeline execution state tracks trigger→callback→approve lifecycle
- [ ] n8n webhook URL is configurable via environment variable; server starts cleanly without it
- [ ] Vite proxy forwards `/api/*` requests to Express server
- [ ] `npm run dev` starts both Vite and Express as a single command
- [ ] Contract tests pass for all endpoints including error cases

## Verification

- `npx vitest run server/__tests__/pipeline-api.test.js` — all API contract tests pass
- `npm run dev` starts both servers without errors
- `curl -s http://localhost:3001/api/pipeline/status/test-project | jq .` returns valid JSON

## Observability Impact

- Signals added/changed: server logs each request with `[bridge]` prefix including method, path, and projectId where applicable
- How a future agent inspects this: `GET /api/pipeline/status/:projectId` returns full execution state; `ls server/data/` shows persisted artifacts
- Failure state exposed: trigger failure returns `{ error, reason }` with HTTP 502 when n8n is unreachable; callback/approve for unknown IDs return 404

## Inputs

- Existing `package.json` with Vite dev scripts
- Existing `vite.config.js` with React + Tailwind plugins
- D022 decision: thin bridge server at `server/`, Vite proxies during dev
- D024 decision: n8n Wait node resumeUrl as the approval primitive

## Expected Output

- `server/index.js` — Express entrypoint on port 3001
- `server/artifacts.js` — disk-based artifact storage module
- `server/pipeline.js` — in-memory pipeline execution state tracker
- `server/routes/pipeline.js` — REST router with 5 endpoints
- `server/__tests__/pipeline-api.test.js` — API contract tests
- `vite.config.js` — updated with `/api` proxy
- `package.json` — updated with server dependencies, dev scripts, and concurrently
