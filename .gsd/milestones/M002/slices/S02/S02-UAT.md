# S02: Research & Business Planning Stages — UAT

**Milestone:** M002
**Written:** 2026-03-16

## UAT Type

- UAT mode: mixed (artifact-driven for contract verification, live-runtime for integration)
- Why this mode is sufficient: Contract tests prove all server and client wiring. Full live integration with n8n is deferred to S04 UAT where the complete pipeline is exercised end-to-end.

## Preconditions

- `npm run dev` starts both Vite dev server (port 5173) and Express API server (port 3001)
- For live integration tests: n8n Docker instance running with research workflow templates imported from `n8n/workflows/`
- For contract-only verification: no n8n needed — just `npx vitest run`
- At least one project created in the dashboard

## Smoke Test

Run `npx vitest run` — all 121 tests pass including research-pipeline (22), artifact-output (29), and artifact-renderer (19) test suites.

## Test Cases

### 1. Webhook registry resolves per-stage URLs

1. Set `N8N_WEBHOOK_URL_RESEARCH=http://localhost:5678/webhook/research` and `N8N_WEBHOOK_URL=http://localhost:5678/webhook/default` in `.env`
2. Restart the server
3. Trigger a research stage via `POST /api/pipeline/trigger` with `stageKey: "research"`
4. Check server logs for `[bridge] webhook-registry stageKey=research source=stage-specific`
5. **Expected:** The research-specific URL is used, not the global fallback

### 2. Sequential sub-workflow orchestration

1. Trigger research stage for a project
2. Send callback for `business_plan` sub-stage via `POST /api/pipeline/callback`
3. **Expected:** Server logs `[bridge] sequential-next subStage=tech_stack` and auto-fires the tech stack webhook. Callback response includes `nextTriggered: true`.

### 3. Auto-trigger research after intake approval

1. Trigger intake stage for a project — let it complete via callback
2. Approve intake via `POST /api/pipeline/approve`
3. **Expected:** Server logs `[bridge] auto-trigger research after intake approval`. Research stage starts without operator action.

### 4. Multi-artifact accumulation in stage output

1. Send first `artifact-ready` SSE event for research stage (business_plan artifact)
2. Send second `artifact-ready` SSE event for research stage (tech_stack artifact)
3. **Expected:** `stage.output.artifactIds` contains both artifact IDs. Primary `artifactId` is the most recent (tech_stack). Neither overwrites the other.

### 5. Rich artifact rendering in dossier

1. Navigate to a project with completed research stage artifacts
2. Open the Dossier subview
3. **Expected:** Research stage section shows structured artifact content — BusinessPlanRenderer shows targetAudience, pricingPosture, featurePhases, revenueModel, recommendation sections. TechResearchRenderer shows scored approaches, tradeoffs, recommendation.

### 6. Artifact list endpoint returns filtered results

1. Store multiple artifacts for one project across different stages
2. Call `GET /api/artifacts/project/:projectId/stage/research`
3. **Expected:** Only research-stage artifacts returned, not intake or other stages

## Edge Cases

### Single-artifact backward compatibility

1. Stage has only one artifact (e.g., intake viability_analysis)
2. **Expected:** `artifactIds` is null; primary `artifactId` works as before. DossierStageOutputCard renders single artifact without multi-artifact panel logic.

### Unknown artifact type

1. Store an artifact with `type: "unknown_type"` and render it in the dossier
2. **Expected:** GenericRenderer displays formatted JSON content — no crash, no blank space.

### Artifact fetch failure

1. Reference an artifact ID that doesn't exist on the server
2. **Expected:** `useArtifact` returns `{ artifact: null, loading: false, error: "..." }`. DossierStageOutputCard shows the summary from selector data, not a blank card.

### Duplicate artifact-ready events

1. Send the same artifact ID twice via SSE `artifact-ready`
2. **Expected:** `artifactIds` array deduplicates — only one entry for that ID.

## Failure Signals

- `npx vitest run` reports any failing tests (currently 121 passing)
- `npx vite build` fails — production build regression
- Server logs show `[bridge] webhook-registry stageKey=X source=none` — webhook not configured
- Dashboard shows raw JSON instead of structured artifact content — renderer dispatch failed
- Dossier shows "Loading..." permanently — useArtifact fetch stuck or endpoint broken
- Second artifact-ready event overwrites first — append-artifact reducer not deduplicating

## Requirements Proved By This UAT

- R006 (Business planning output) — artifact schema and renderer prove structured business framing content renders in the dossier (contract-level; live proof in S04)
- R007 (Tech-stack research) — artifact schema and renderer prove structured tech research content renders in the dossier (contract-level; live proof in S04)
- R019 (n8n as orchestrator) — sequential sub-workflow orchestration and auto-trigger prove n8n integration extends beyond single-stage (contract-level; live proof in S04)

## Not Proven By This UAT

- Live n8n execution of research sub-workflows — deferred to S04 full pipeline integration
- Rejection and re-trigger of research stages — deferred to S04
- Offline/disconnected mode for cached artifact rendering — deferred to S04
- Real latency measurement of sequential vs parallel orchestration — deferred to S04
- Full pipeline end-to-end from intake through approved build dossier — S04

## Notes for Tester

- The contract tests (`npx vitest run`) are the primary verification. Live n8n integration is proven conceptually through the S01 intake stage and extended here only at the contract level.
- The n8n workflow templates in `n8n/workflows/` are importable but not required for contract verification. Import them if you want to test the full SSE→artifact→render loop.
- Route ordering in `server/index.js` is important — if the artifact list endpoint stops working, check that the multi-segment route is mounted before the `:id` param route.
