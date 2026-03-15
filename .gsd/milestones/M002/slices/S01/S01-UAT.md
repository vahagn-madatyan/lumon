# S01: Bridge Server & Intake Stage — UAT

**Milestone:** M002
**Written:** 2026-03-15

## UAT Type

- UAT mode: mixed
- Why this mode is sufficient: The server API and n8n integration require live runtime proof. The schema migration and selector chain are proven by automated tests. Dashboard wiring is confirmed by test + partial browser verification.

## Preconditions

- n8n Docker container running on port 5678: `docker run -it --rm -p 5678:5678 n8nio/n8n`
- Intake/viability workflow imported and activated in n8n (see `n8n/README.md`)
- Bridge server running with `N8N_WEBHOOK_URL=http://localhost:5678/webhook/lumon-intake npm run dev`
- Vite dev server accessible (typically port 5173/5174)

## Smoke Test

`curl http://localhost:3001/api/pipeline/status/any-project` returns `{ "projectId": "any-project", "status": "idle", "message": "No pipeline execution found" }`.

## Test Cases

### 1. Trigger → n8n execution → callback → artifact storage

1. POST `/api/pipeline/trigger` with `{ "projectId": "test-1", "stageKey": "intake" }`
2. n8n webhook fires, viability analysis runs, n8n posts callback to bridge
3. **Expected:** Status at `/api/pipeline/status/test-1` shows `awaiting_approval` with a `resumeUrl`. Artifact retrievable via `/api/artifacts/:id` with structured viability content (marketAssessment, technicalFeasibility, riskFactors, recommendation).

**Result:** ✅ PASS — Artifact stored with all 4 sections, scores, and key findings. resumeUrl populated from n8n Wait node.

### 2. Approve gate → n8n resume → execution completes

1. With test-1 in `awaiting_approval` state from test 1
2. POST `/api/pipeline/approve` with `{ "projectId": "test-1", "stageKey": "intake", "decision": "approved" }`
3. **Expected:** Bridge calls resumeUrl, status becomes `approved` with `completedAt`. n8n execution shows `status: success`.

**Result:** ✅ PASS — resumeUrl called, n8n execution completed, bridge status → approved.

### 3. Reject gate → execution stops without resume

1. Trigger a new execution for a different project
2. Wait for callback (status → `awaiting_approval`)
3. POST `/api/pipeline/approve` with `{ "decision": "rejected" }`
4. **Expected:** Status becomes `rejected` with `completedAt`. resumeUrl NOT called. n8n execution remains in `waiting` state.

**Result:** ✅ PASS — Status → rejected, n8n execution left waiting (not resumed).

### 4. SSE events stream to connected clients

1. Open SSE connection: `curl -N http://localhost:3001/api/pipeline/events/test-sse`
2. Trigger a pipeline for project `test-sse`
3. **Expected:** SSE stream receives `pipeline-status` event on trigger, `stage-update` and `artifact-ready` on callback, `pipeline-status` on approve.

**Result:** ✅ PASS — All event types confirmed via curl SSE connection.

### 5. Dashboard connection indicator

1. Open the Lumon dashboard in a browser
2. **Expected:** Connection status indicator shows "Connected" with a wifi icon in the dashboard header.

**Result:** ✅ PASS — `data-testid='sync-connection-status'` confirmed via browser assertion.

### 6. Backward-compatible schema migration

1. Run `npx vitest run` — all 75 tests across 10 files
2. **Expected:** All 32 original M001 tests pass without modification. 43 new S01 tests pass.

**Result:** ✅ PASS — 75/75 tests pass in <4s.

### 7. n8n workflow import

1. Import `n8n/workflows/intake-viability.json` via n8n REST API or UI
2. Activate the workflow
3. **Expected:** Workflow creates with 6 nodes (Webhook Trigger, Respond, Viability Analysis, Callback to Bridge, Wait for Approval, Post Approval). Activates without errors.

**Result:** ✅ PASS — Imported and activated via REST API.

## Edge Cases

### Trigger with n8n unreachable

1. Stop n8n. POST `/api/pipeline/trigger`
2. **Expected:** Returns HTTP 502 with `{ "error": "n8n unreachable", "reason": "<message>" }`. Execution marked as failed via `pipeline.recordFailure()`.

**Result:** ✅ PASS — Structured error returned, execution recorded with failureReason.

### Callback for unknown executionId

1. POST `/api/pipeline/callback` with a nonexistent `executionId`
2. **Expected:** Returns HTTP 404 with `{ "error": "...", "reason": "..." }`.

**Result:** ✅ PASS — Covered by contract tests.

### Approve for project with no execution

1. POST `/api/pipeline/approve` with a `projectId` that has no execution
2. **Expected:** Returns HTTP 404.

**Result:** ✅ PASS — Covered by contract tests.

### Bridge server without N8N_WEBHOOK_URL

1. Start server without setting `N8N_WEBHOOK_URL`
2. POST `/api/pipeline/trigger`
3. **Expected:** Server logs warning, records intent only, returns execution with `triggered` status but doesn't call any webhook.

**Result:** ✅ PASS — Graceful degradation confirmed.

## Failure Signals

- `npx vitest run` reports fewer than 75 passing tests
- `GET /api/pipeline/status/:projectId` returns non-JSON or missing fields
- SSE connection drops without `[bridge] SSE disconnect` log on server
- Dashboard shows no connection status indicator
- Artifacts not found on disk under `server/data/`
- n8n execution stays in `running` indefinitely after callback (means callback failed)

## Requirements Proved By This UAT

- R004 — Intake stage stops for explicit operator approval before pipeline advances (approve and reject both proven)
- R005 — n8n executes a viability analysis that produces structured advisory output (market, technical, risk, recommendation)
- R018 — Approve/reject requires explicit operator action; resume never auto-fires
- R019 — n8n is a real execution layer; the webhook→Wait→resumeUrl contract works end-to-end

## Not Proven By This UAT

- Full browser UI flow (clicking Trigger Discovery button in rendered dashboard with live n8n) — proven at API level, not through rendered UI clicks
- Multi-stage pipeline progression (S02, S03 scope)
- Concurrent execution handling and rejection→iteration flows (S04 scope)
- Offline/disconnected mode for cached artifact access (S04 scope)
- Content quality of viability analysis output (beyond structural completeness)

## Notes for Tester

- The n8n workflow template uses `host.docker.internal:3001` as the callback URL. This works when n8n runs in Docker on the same host. Change this URL in the workflow if your setup differs.
- n8n blocks `$env` access by default — don't try to use environment variables in the workflow without enabling them in n8n settings.
- Old test artifacts accumulate in `server/data/`. Delete them manually if they get noisy: `rm server/data/*.json` (keep `.gitkeep`).
- Pipeline execution state is in-memory — restarting the bridge server clears active executions but artifacts survive on disk.
