---
id: T01
parent: S02
milestone: M002
provides:
  - webhook registry with stage-specific URL lookup and global fallback
  - per-stage execution tracking (two-level projectIndex)
  - sequential research sub-stage orchestration (business_plan → tech_stack)
  - auto-trigger research after intake approval
  - artifact list endpoint filtered by project + stage
  - two n8n workflow templates (business plan, tech stack)
key_files:
  - server/config.js
  - server/pipeline.js
  - server/routes/pipeline.js
  - server/artifacts.js
  - server/__tests__/research-pipeline.test.js
  - n8n/workflows/research-business-plan.json
  - n8n/workflows/research-tech-stack.json
key_decisions:
  - getStatus() returns per-stage map instead of single record — breaking change for status endpoint response shape, existing tests updated
  - artifact storage isolation via setDataDir() for parallel test file safety
  - fireWebhook() extracted as internal helper to share between trigger/approve/sequential handlers
  - research sub-stage order defined in config.js RESEARCH_SUB_STAGES constant
patterns_established:
  - webhook registry pattern — stage-specific env var → global fallback → null (graceful degradation)
  - sequential sub-stage orchestration — callback handler checks RESEARCH_SUB_STAGES order and auto-fires next
  - auto-trigger chain — approve handler fires next stage when webhook configured
  - per-test-file data directories to prevent artifact storage races in parallel vitest runs
observability_surfaces:
  - "[bridge] webhook-registry stageKey=${stageKey} source=${source}" log on every webhook lookup
  - "[bridge] auto-trigger research after intake approval" log on auto-trigger
  - "[bridge] sequential-next subStage=${next}" log on sub-stage progression
  - GET /api/pipeline/status/:projectId returns per-stage execution records
  - GET /api/artifacts/project/:projectId/stage/:stageKey returns filtered artifact list
  - GET /api/pipeline/artifacts/:projectId/:stageKey (pipeline router mount)
duration: 25m
verification_result: passed
completed_at: 2026-03-15
blocker_discovered: false
---

# T01: Webhook registry, sequential research orchestration, and n8n workflow templates

**Built per-stage webhook routing, sequential sub-workflow orchestration, auto-trigger after intake approval, artifact list endpoint, and two n8n research workflow templates — all proven by 22 new contract tests with zero regressions.**

## What Happened

Extended the S01 bridge server across all planned dimensions:

1. **Webhook registry** (`server/config.js`) — `getWebhookUrl(stageKey)` checks stage-specific env vars (e.g. `N8N_WEBHOOK_URL_RESEARCH`) first, falls back to `N8N_WEBHOOK_URL`, logs lookup source without exposing URLs.

2. **Per-stage execution tracking** (`server/pipeline.js`) — Refactored `projectIndex` from `Map<projectId, executionId>` to `Map<projectId, Map<stageKey, executionId>>`. Added `getStageExecution(projectId, stageKey)` for targeted lookups. `getStatus()` now returns all stage executions for a project.

3. **Updated route handlers** (`server/routes/pipeline.js`) — Extracted `fireWebhook()` helper shared by trigger, sequential orchestration, and auto-trigger. Trigger handler uses webhook registry. Callback handler stores artifacts with sub-stage type differentiation.

4. **Sequential orchestration** — When callback arrives for `stageKey=research` with a `subStage`, the handler checks `RESEARCH_SUB_STAGES` order and auto-fires the next sub-stage. Response includes `nextTriggered` field.

5. **Auto-trigger** — Approve handler, after approving intake, checks for research webhook and fires `business_plan` sub-stage automatically. Response includes `autoTriggered` field.

6. **Artifact list endpoint** — `getByProjectAndStage()` added to artifacts.js. Mounted at both `GET /api/artifacts/project/:projectId/stage/:stageKey` (top-level, ordered before `:id` param) and `GET /api/pipeline/artifacts/:projectId/:stageKey` (router).

7. **n8n templates** — Two workflow JSONs following proven Webhook→Code→Callback pattern. No Wait node (research gate is `required: false`). Business plan produces: targetAudience, pricingPosture, featurePhases, revenueModel, recommendation. Tech stack produces: approaches (scored), tradeoffs, recommendation.

## Verification

- `npx vitest run` — **93 tests pass** (22 new in research-pipeline.test.js, 71 existing)
- Zero regressions in existing pipeline-api.test.js (S01 tests updated for new status response shape)
- Zero regressions in all 9 other test files (M001 + M002/S01 frontend tests)
- `npx vite build` — production build succeeds
- Webhook registry fallback verified: test confirms global URL used when only `N8N_WEBHOOK_URL` set

**Slice-level verification status (T01 of 2):**
- ✅ `server/__tests__/research-pipeline.test.js` — all 22 tests pass
- ⬜ `src/lumon/__tests__/artifact-output.test.js` — T02 scope (not yet created)
- ⬜ `src/lumon/__tests__/artifact-renderer.test.jsx` — T02 scope (not yet created)
- ✅ Zero regressions in existing tests
- ✅ `npx vite build` succeeds

## Diagnostics

- **Webhook lookup**: grep logs for `[bridge] webhook-registry` to see which source was used per stage
- **Sequential progression**: grep for `[bridge] sequential-next` to trace sub-stage chain
- **Auto-trigger**: grep for `[bridge] auto-trigger research` to confirm post-approval automation
- **Per-stage status**: `GET /api/pipeline/status/:projectId` returns `{ projectId, stages: { intake: {...}, research: {...} } }`
- **Stage artifacts**: `GET /api/artifacts/project/:projectId/stage/research` returns all research artifacts (business_plan + tech_stack)

## Deviations

- Added `setDataDir()` to artifacts.js for test isolation — both server test files share the same module instance but need independent data dirs to avoid race conditions in parallel vitest runs.
- Mounted artifact list at both top-level (`/api/artifacts/project/:projectId/stage/:stageKey`) and pipeline router (`/api/pipeline/artifacts/:projectId/:stageKey`) for flexibility. Route ordering in index.js ensures the multi-segment path matches before the single `:id` param.

## Known Issues

None.

## Files Created/Modified

- `server/config.js` — **new** — webhook registry with `getWebhookUrl(stageKey)` and `RESEARCH_SUB_STAGES` constant
- `server/pipeline.js` — **modified** — two-level projectIndex, `getStageExecution()`, subStage tracking in records
- `server/routes/pipeline.js` — **modified** — `fireWebhook()` helper, webhook registry integration, sequential orchestration, auto-trigger, artifact list route
- `server/artifacts.js` — **modified** — `getByProjectAndStage()`, `setDataDir()` for test isolation, tolerant `clear()`
- `server/index.js` — **modified** — artifact list endpoint at top-level, route ordering fix
- `server/__tests__/pipeline-api.test.js` — **modified** — updated for per-stage status response shape, isolated data dir
- `server/__tests__/research-pipeline.test.js` — **new** — 22 contract tests covering webhook registry, per-stage tracking, sequential orchestration, auto-trigger, artifact list, backward compatibility
- `n8n/workflows/research-business-plan.json` — **new** — Webhook→Code→Callback template for business plan analysis
- `n8n/workflows/research-tech-stack.json` — **new** — Webhook→Code→Callback template for tech stack analysis
