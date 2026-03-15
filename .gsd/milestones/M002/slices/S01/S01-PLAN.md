# S01: Bridge Server & Intake Stage

**Goal:** Ship a working bridge server that communicates with n8n, stores structured artifacts, pushes results to the Lumon dashboard via SSE, and proves the full trigger→execute→approve loop for the intake/viability stage.
**Demo:** The operator triggers a discovery run on a project in the Lumon dashboard, n8n executes a viability analysis, the structured result appears in the dashboard as an inspectable artifact, and the operator approves or rejects it — proven in the real browser with a live n8n instance.

## Must-Haves

- Express bridge server at `server/` with REST endpoints: trigger, callback, approve, artifact retrieval, pipeline status
- Vite proxies `/api/*` to Express; `npm run dev` starts both Vite and the API server
- Server-side disk-based artifact storage with record shape `{ id, projectId, stageKey, type, content, metadata, createdAt }`
- SSE endpoint pushes stage results and pipeline status to connected clients in real time
- `stage.output` migrated from string to `{ artifactId, summary, type }` with backward-compatible coercion — all existing M001 tests still pass
- Client-side `useServerSync` hook connects SSE events to reducer dispatch
- Dashboard exposes trigger and approve actions wired to server API
- n8n workflow JSON template for the intake/viability stage (importable)
- Full webhook→Wait→resumeUrl loop proven with a real n8n instance

## Proof Level

- This slice proves: contract + integration
- Real runtime required: yes (Express server + n8n instance)
- Human/UAT required: yes (browser-visible trigger→approve loop)

## Verification

- `npx vitest run` — all existing M001 tests pass (backward-compatible schema migration)
- `server/__tests__/pipeline-api.test.js` — API contract tests for trigger, callback, approve, artifact retrieval, and status endpoints
- `src/lumon/__tests__/artifact-output.test.js` — structured artifact references through createPipelineStage and selector chain
- `src/lumon/__tests__/server-sync.test.js` — SSE event dispatch and useServerSync hook integration
- Manual UAT: trigger discovery → n8n executes → artifact appears in dashboard → approve/reject works in browser

## Observability / Diagnostics

- Runtime signals: server logs each API request with `[bridge]` prefix, pipeline state transitions logged with projectId and stageKey
- Inspection surfaces: `GET /api/pipeline/status/:projectId` returns current pipeline execution state; `GET /api/artifacts/:id` returns stored artifact content
- Failure visibility: n8n trigger failures return structured error with reason; SSE reconnection state visible in useServerSync hook
- Redaction constraints: n8n webhook URLs and credentials never logged or sent to the client

## Integration Closure

- Upstream surfaces consumed: `src/lumon/model.js` (createPipelineStage, stage output contract), `src/lumon/reducer.js` (updateStage action), `src/lumon/selectors.js` (pipeline and dossier view models), `src/lumon/context.jsx` (LumonProvider and actions), `src/lumon/persistence.js` (local persistence envelope)
- New wiring introduced in this slice: Vite proxy to Express, SSE event stream from server to client, useServerSync hook bridging server events to reducer dispatch, dashboard trigger/approve buttons calling server API
- What remains before the milestone is truly usable end-to-end: research/planning content stages (S02), naming/brand stages (S03), full pipeline integration with offline mode (S04)

## Tasks

- [x] **T01: Express bridge server with artifact storage and API endpoints** `est:2h`
  - Why: No server exists — M001 is entirely client-side. Every other task depends on a working bridge server with artifact persistence and pipeline route handlers.
  - Files: `server/index.js`, `server/artifacts.js`, `server/pipeline.js`, `server/routes/pipeline.js`, `vite.config.js`, `package.json`, `server/__tests__/pipeline-api.test.js`
  - Do: Install express and cors. Create Express app at `server/` with disk-based JSON artifact storage under `server/data/`. Implement all REST endpoints (trigger, callback, approve, artifact get, status). Configure Vite to proxy `/api/*` to Express on port 3001. Update package.json scripts so `npm run dev` starts both servers via concurrently. Write API contract tests exercising each endpoint.
  - Verify: `npx vitest run server/__tests__/pipeline-api.test.js` passes; `npm run dev` starts both Vite and Express; `curl localhost:3001/api/pipeline/status/test` returns a valid response
  - Done when: All 5 API endpoints respond correctly, artifact storage persists to disk, Vite proxies to Express, and contract tests pass

- [x] **T02: Migrate stage output to structured artifact references** `est:1h`
  - Why: `stage.output` is currently a plain string. Structured artifacts from n8n will be 50-100KB each — too large for localStorage. The migration must be backward-compatible because all 5 surfaces read output through the selector chain.
  - Files: `src/lumon/model.js`, `src/lumon/selectors.js`, `src/lumon/__tests__/artifact-output.test.js`
  - Do: Update `createPipelineStage` to accept both string and `{ artifactId, summary, type }` object output, coercing strings to the legacy format on read. Update selector view model builders to project `outputSummary` (display text) and `artifactId` (server fetch key) from both formats. Add backward-compatible coercion tests and verify all existing M001 tests still pass.
  - Verify: `npx vitest run` — all 32 existing tests pass plus new artifact-output tests
  - Done when: createPipelineStage handles both output formats, selectors project artifact references correctly, and zero regressions in existing test suite

- [x] **T03: SSE push, client sync hook, and dashboard trigger/approve wiring** `est:2h`
  - Why: The bridge server can store artifacts but the dashboard has no way to receive updates or send trigger/approve actions. This task closes the client-server loop.
  - Files: `server/routes/pipeline.js` (SSE addition), `src/lumon/sync.js`, `src/lumon/context.jsx`, `src/features/mission-control/DashboardTab.jsx`, `src/lumon/__tests__/server-sync.test.js`
  - Do: Add SSE endpoint `GET /api/pipeline/events/:projectId` to the server that streams `stage-update`, `artifact-ready`, and `pipeline-status` events. Create `useServerSync` hook that subscribes to SSE for the selected project and dispatches `updateStage` actions to the reducer. Wire trigger and approve buttons in the dashboard that call the server API. Write integration tests for the sync hook.
  - Verify: `npx vitest run src/lumon/__tests__/server-sync.test.js` passes; trigger button in browser calls the server; SSE events update the dashboard in real time
  - Done when: Dashboard trigger fires server API call, SSE pushes stage updates to the client, approve button calls the resume endpoint, and sync integration tests pass

- [x] **T04: n8n workflow template and end-to-end integration proof** `est:1.5h`
  - Why: The sync loop is wired but untested with real n8n. This task ships the importable workflow template and proves the full trigger→execute→callback→display→approve loop in the real browser.
  - Files: `n8n/workflows/intake-viability.json`, `n8n/README.md`, `.gsd/milestones/M002/slices/S01/S01-UAT.md`
  - Do: Create n8n workflow JSON template with Webhook trigger → viability analysis logic → HTTP callback to bridge server → Wait node for operator approval. Write setup instructions in n8n/README.md. Run the full loop in the browser: create project → trigger discovery → n8n executes → artifact appears in dashboard → approve → pipeline advances. Document results in S01-UAT.md.
  - Verify: n8n workflow imports cleanly; full trigger→approve loop works in browser with live n8n; artifact is visible and inspectable in dashboard dossier
  - Done when: Operator triggers discovery on a project, sees viability result in dashboard, approves it, and pipeline advances — all observed in a real browser session with live n8n

## Files Likely Touched

- `server/index.js`
- `server/artifacts.js`
- `server/pipeline.js`
- `server/routes/pipeline.js`
- `server/__tests__/pipeline-api.test.js`
- `src/lumon/model.js`
- `src/lumon/selectors.js`
- `src/lumon/sync.js`
- `src/lumon/context.jsx`
- `src/lumon/__tests__/artifact-output.test.js`
- `src/lumon/__tests__/server-sync.test.js`
- `src/features/mission-control/DashboardTab.jsx`
- `n8n/workflows/intake-viability.json`
- `n8n/README.md`
- `vite.config.js`
- `package.json`
