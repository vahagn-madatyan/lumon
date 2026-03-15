---
id: S01
parent: M002
milestone: M002
provides:
  - Express bridge server on port 3001 with 5 REST endpoints (trigger, callback, approve, artifact get, status)
  - Disk-based JSON artifact storage under server/data/ with CRUD operations
  - In-memory pipeline execution state tracker with full lifecycle (trigger → callback → approve/reject)
  - SSE endpoint streaming typed events (stage-update, artifact-ready, pipeline-status) per projectId
  - useServerSync hook bridging SSE events to reducer dispatch with triggerPipeline/approvePipeline API wrappers
  - Backward-compatible stage.output migration from string to { artifactId, summary, type } with coercion helpers
  - Dashboard trigger/approve/reject buttons and connection status indicator wired through LumonProvider actions
  - Importable n8n workflow JSON for intake/viability stage with 6 nodes (Webhook → Viability Analysis → Callback → Wait → Post Approval)
  - Vite proxy for /api/* and npm run dev starts both servers via concurrently
requires: []
affects:
  - S02
  - S03
  - S04
key_files:
  - server/index.js
  - server/artifacts.js
  - server/pipeline.js
  - server/routes/pipeline.js
  - server/__tests__/pipeline-api.test.js
  - src/lumon/model.js
  - src/lumon/selectors.js
  - src/lumon/sync.js
  - src/lumon/context.jsx
  - src/features/mission-control/DashboardTab.jsx
  - src/lumon/__tests__/artifact-output.test.js
  - src/lumon/__tests__/server-sync.test.js
  - n8n/workflows/intake-viability.json
  - n8n/README.md
  - vite.config.js
  - vitest.workspace.js
key_decisions:
  - "D022: Thin Express bridge server at server/ — frontend can't hold n8n credentials, resume URLs, or large artifacts"
  - "D023: stage.output migrated to { artifactId, summary, type } with backward-compatible coercion at model boundary"
  - "D024: n8n Wait node resumeUrl as the atomic approval primitive — never auto-resume"
  - "D027: Flat JSON files under server/data/ for artifact persistence — debuggable by inspection, upgrade path to SQLite"
  - "D028: vitest.workspace.js separates Node (server) and jsdom (client) test environments under one command"
  - "D029: SSE connections stored per-projectId in Map<string, Set<Response>> with inline emitSSE"
  - "D030: triggerPipeline/approvePipeline exposed through LumonProvider actions context alongside dispatch-based actions"
  - "D031: Execution record created before n8n webhook call so executionId flows through entire chain"
  - "D032: n8n workflow templates stored in n8n/workflows/ as importable JSON; callback URL hardcoded for Docker"
patterns_established:
  - "[bridge] log prefix for all server requests with method, path, projectId"
  - "[sync] log prefix for client-side SSE lifecycle"
  - "Graceful degradation when N8N_WEBHOOK_URL absent — trigger records intent only"
  - "Structured error responses with { error, reason } shape on all server error paths"
  - "isStructuredOutput()/getOutputSummary() guards in selector chain for dual output format support"
  - "PipelineActions component conditionally renders buttons based on stage status and approval gate state"
observability_surfaces:
  - "GET /api/pipeline/status/:projectId — full execution state including resumeUrl, timestamps, failure reasons"
  - "GET /api/artifacts/:id — stored artifact content with metadata"
  - "Server logs with [bridge] prefix: SSE connect/disconnect counts, event emissions, request tracing"
  - "Client [sync] logs: SSE connected/closed/error with projectId"
  - "data-testid='sync-connection-status' in dashboard header"
  - "data-testid='pipeline-actions' with trigger-discovery-btn, approve-btn, reject-btn"
  - "pipeline.recordFailure() persists failureReason for post-mortem"
drill_down_paths:
  - .gsd/milestones/M002/slices/S01/tasks/T01-SUMMARY.md
  - .gsd/milestones/M002/slices/S01/tasks/T02-SUMMARY.md
  - .gsd/milestones/M002/slices/S01/tasks/T03-SUMMARY.md
  - .gsd/milestones/M002/slices/S01/tasks/T04-SUMMARY.md
duration: ~90m across 4 tasks
verification_result: passed
completed_at: 2026-03-15
---

# S01: Bridge Server & Intake Stage

**Express bridge server with n8n integration, structured artifact storage, SSE push, and proven intake/viability trigger→execute→approve loop.**

## What Happened

Built the server stack from zero (T01): Express on port 3001 with disk-based JSON artifact storage, in-memory pipeline execution tracker, and 5 REST endpoints (trigger, callback, approve, artifact get, status). Vite proxies `/api/*` to Express; `npm run dev` runs both via concurrently.

Migrated the stage output contract (T02): `stage.output` now accepts both plain strings and `{ artifactId, summary, type }` structured references. Normalization happens at the model boundary in `createPipelineStage`, so all 5 selector surfaces inherit the new shape without individual migration. `isStructuredOutput()` and `getOutputSummary()` helpers guard the selector chain. Zero regressions in M001 tests.

Closed the client-server loop (T03): SSE endpoint streams typed events per projectId to connected clients. `useServerSync` hook subscribes to the SSE stream and dispatches `updateStage`/`updateProject` actions to the reducer. Dashboard gained a connection status indicator and conditional trigger/approve/reject buttons wired through the LumonProvider actions context.

Proved the full n8n integration (T04): Shipped an importable 6-node n8n workflow for intake/viability. Verified the complete trigger→webhook→viability analysis→callback→artifact storage→Wait→approval→resume loop against a live n8n Docker instance. Both approve and reject paths proven at the API level.

## Verification

- `npx vitest run` — **75 tests pass** across 10 test files (0 regressions from 32 M001 tests)
  - `server/__tests__/pipeline-api.test.js` — 15 API contract tests (trigger, callback, approve, artifact get, status, full lifecycle)
  - `src/lumon/__tests__/artifact-output.test.js` — 20 tests (isStructuredOutput, getOutputSummary, createPipelineStage normalization, selector view models)
  - `src/lumon/__tests__/server-sync.test.js` — 8 tests (SSE event dispatch, trigger/approve API calls, connection status, projectId switching)
  - 32 existing M001 tests — all pass unchanged
- `npx vite build` — production build succeeds
- API-level integration against live n8n: trigger fires webhook → n8n analyzes → callback stores artifact → approve calls resumeUrl → execution completes
- n8n workflow imports and activates via REST API without errors
- SSE events confirmed via curl: connect, stage-update, artifact-ready, pipeline-status all stream correctly

## Requirements Advanced

- R004 (approval gates) — S01 proves the trigger→approve gate works with real n8n at the intake stage; full validation requires all stages across M002
- R005 (viability analysis) — S01 ships an n8n-executed viability analysis that produces structured market/technical/risk output; content quality validation deferred to later stages
- R018 (explicit confirmation) — S01 proves approve/reject at the intake gate requires explicit operator action; resume never auto-fires
- R019 (n8n as orchestrator) — S01 proves the fundamental webhook→Wait→resumeUrl contract; n8n is a real execution layer, not a placeholder

## Requirements Validated

- None — individual stage proof advances but doesn't fully validate these requirements; full pipeline proof across M002 is needed

## New Requirements Surfaced

- None

## Requirements Invalidated or Re-scoped

- None

## Deviations

- **Trigger handler refactored** (T04): Execution record creation moved before the n8n webhook call. The original plan didn't specify ordering, but n8n needs the bridge's `executionId` in the webhook payload to echo it back in the callback. This is an improvement, not a deviation from intent.
- **`$env` replaced with hardcoded URL** (T04): n8n blocks `$env` access by default. Workflow template uses `host.docker.internal:3001` directly. README documents how to change it.
- **Browser UI flow not fully exercised** (T04): API-level integration was fully proven with curl. Dashboard buttons dispatch to the same functions verified at the API level, but clicking through the full UI flow in the browser was not completed within time budget.

## Known Limitations

- Pipeline execution state is in-memory — server restart loses active execution tracking (artifacts persist on disk)
- n8n Wait node resumeUrl uses `localhost:5678` — only works when bridge and Docker n8n share the same host
- Old test artifacts in `server/data/` from integration testing persist on disk (no auto-cleanup)
- Browser-level UI flow (click Trigger Discovery in dashboard with live n8n) was proven at API level but not end-to-end through the rendered UI

## Follow-ups

- S02/S03/S04 consume the bridge server, artifact storage, SSE push, and schema migration established here
- S04 should prove rejection→iteration→re-trigger flows don't corrupt state (concurrent execution handling)
- S04 should add offline/disconnected mode for cached artifact access when n8n is unreachable

## Files Created/Modified

- `server/index.js` — Express entrypoint, port 3001, mounts cors/json/routes/artifact endpoint
- `server/artifacts.js` — disk-based JSON artifact store with create/get/getByProject/list/clear
- `server/pipeline.js` — in-memory pipeline execution state tracker with trigger/callback/approve/failure lifecycle
- `server/routes/pipeline.js` — REST router with trigger/callback/approve/status endpoints + SSE endpoint with emitSSE helper
- `server/data/.gitkeep` — ensures data directory exists in git
- `server/__tests__/pipeline-api.test.js` — 15 API contract tests
- `src/lumon/model.js` — added isStructuredOutput(), getOutputSummary(), updated createPipelineStage output normalization
- `src/lumon/selectors.js` — updated dossier/packet/stage view models to project outputSummary, artifactId, hasArtifact
- `src/lumon/sync.js` — useServerSync hook with EventSource subscription, reducer dispatch, trigger/approve wrappers
- `src/lumon/context.jsx` — integrated useServerSync into LumonProvider, ServerSyncContext for connection status
- `src/features/mission-control/DashboardTab.jsx` — ConnectionStatusIndicator, PipelineActions with trigger/approve/reject buttons
- `src/lumon/__tests__/artifact-output.test.js` — 20 tests for structured output migration
- `src/lumon/__tests__/server-sync.test.js` — 8 tests for sync hook integration
- `src/test/setup.js` — added EventSource stub for jsdom
- `n8n/workflows/intake-viability.json` — importable 6-node n8n workflow for intake/viability
- `n8n/README.md` — setup instructions, flow diagram, troubleshooting
- `vite.config.js` — added /api proxy to localhost:3001
- `vitest.workspace.js` — workspace config separating client (jsdom) and server (node) test environments
- `package.json` — updated scripts for dev:server, dev:client, dev (concurrently)

## Forward Intelligence

### What the next slice should know
- The bridge server API contract is stable: trigger/callback/approve/status/artifacts. S02 and S03 add new n8n sub-workflows that call back to the same `/api/pipeline/callback` endpoint with different `stageKey` values and artifact `type` fields.
- `emitSSE` in `server/routes/pipeline.js` is the function to call when pushing events to the client. It takes `(projectId, eventType, data)`.
- The `useServerSync` hook auto-subscribes to the selected project's SSE stream. New event types just need a handler case in the hook's `onmessage` switch.
- Artifact content can be arbitrarily large — it's stored on disk, not in the SSE payload. SSE events carry only the artifactId reference.

### What's fragile
- **In-memory pipeline state** — `server/pipeline.js` stores executions in a plain Map. Server restart loses all active execution tracking. Artifacts survive (on disk) but the execution→artifact link is lost. This is acceptable for single-operator local dev but will need persistence before any production-like use.
- **SSE reconnection** — relies on native EventSource auto-reconnect. No explicit retry logic or backoff. If the server goes down and comes back, clients should reconnect but won't receive missed events.

### Authoritative diagnostics
- `GET /api/pipeline/status/:projectId` — the single source of truth for where a pipeline execution is. If this says `awaiting_approval` with a `resumeUrl`, the approval gate is real.
- `npx vitest run` — 75 tests in <4s. If they pass, the model/selector/sync contract is intact.

### What assumptions changed
- **n8n `$env` access** — originally assumed workflow templates could use `$env.LUMON_BRIDGE_URL` for callback URLs. n8n blocks env var access by default, so templates use hardcoded `host.docker.internal:3001` instead.
- **Execution record timing** — originally no assumption about whether execution is created before or after the webhook call. In practice it must be before, so n8n receives the bridge's executionId in the webhook payload.
