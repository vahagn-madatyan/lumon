---
id: S02
parent: M002
milestone: M002
provides:
  - webhook registry with per-stage URL lookup and global fallback
  - per-stage execution tracking (two-level projectIndex)
  - sequential research sub-stage orchestration (business_plan → tech_stack)
  - auto-trigger research after intake approval
  - artifact list endpoint filtered by project + stage
  - two n8n research workflow templates (business plan, tech stack)
  - lumon/append-artifact reducer action for multi-artifact accumulation per stage
  - artifactIds array projection through selectors and handoff packet evidence
  - useArtifact hook with module-level cache for artifact content fetching
  - ArtifactRenderer with type-dispatched sub-renderers (viability_analysis, business_plan, tech_research)
  - DossierStageOutputCard wired to render rich artifact content with progressive loading
requires:
  - slice: S01
    provides: bridge server API (trigger, callback, approve, artifacts), SSE push (emitSSE), sync hook (useServerSync), schema-migrated stage.output contract
affects:
  - S04
key_files:
  - server/config.js
  - server/pipeline.js
  - server/routes/pipeline.js
  - server/artifacts.js
  - server/__tests__/research-pipeline.test.js
  - n8n/workflows/research-business-plan.json
  - n8n/workflows/research-tech-stack.json
  - src/lumon/sync.js
  - src/lumon/reducer.js
  - src/lumon/selectors.js
  - src/lumon/useArtifact.js
  - src/features/mission-control/ArtifactRenderer.jsx
  - src/features/mission-control/DashboardTab.jsx
  - src/lumon/__tests__/artifact-output.test.js
  - src/lumon/__tests__/artifact-renderer.test.jsx
key_decisions:
  - D033: Webhook registry with per-stage env var lookup and global fallback
  - D034: Per-stage execution tracking in pipeline.js
  - D035: Sequential sub-workflow orchestration — no parallel triggers
  - D036: Auto-trigger research after intake approval
  - D037: Dedicated append-artifact reducer action for multi-artifact accumulation
  - D038: Module-level Map cache for useArtifact hook
patterns_established:
  - Webhook registry pattern — stage-specific env var → global fallback → null (graceful degradation)
  - Sequential sub-stage orchestration — callback handler checks RESEARCH_SUB_STAGES order and auto-fires next
  - Auto-trigger chain — approve handler fires next stage when webhook configured
  - Artifact accumulation pattern — append-artifact reads existing artifactIds, deduplicates, sets latest as primary
  - Type-dispatched rendering — ArtifactRenderer dispatches on artifact.type via lookup table; unknown types get GenericRenderer
observability_surfaces:
  - "[bridge] webhook-registry stageKey=${stageKey} source=${source}" log on webhook lookup
  - "[bridge] auto-trigger research after intake approval" log on auto-trigger
  - "[bridge] sequential-next subStage=${next}" log on sub-stage progression
  - "[sync] artifact-ready" log with stageId, artifactId, and type on each SSE event
  - GET /api/pipeline/status/:projectId returns per-stage execution records
  - GET /api/artifacts/project/:projectId/stage/:stageKey returns filtered artifact list
drill_down_paths:
  - .gsd/milestones/M002/slices/S02/tasks/T01-SUMMARY.md
  - .gsd/milestones/M002/slices/S02/tasks/T02-SUMMARY.md
duration: 40m
verification_result: passed
completed_at: 2026-03-16
---

# S02: Research & Business Planning Stages

**Per-stage webhook routing, sequential research orchestration with auto-trigger, multi-artifact accumulation through the reducer/selector chain, and type-dispatched rich artifact rendering in the dashboard dossier — 28 new tests across server and client, 121 total passing.**

## What Happened

Extended the S01 bridge server with per-stage webhook routing and sequential research orchestration (T01), then wired multi-artifact accumulation and rich rendering through the full client stack (T02).

**Server-side (T01):** Created a webhook registry (`server/config.js`) that checks stage-specific env vars before falling back to the global `N8N_WEBHOOK_URL`. Refactored pipeline execution tracking from single-execution-per-project to per-stage execution maps. Added sequential sub-stage orchestration — when the research stage's `business_plan` callback arrives, the handler auto-fires `tech_stack`. The approve handler auto-triggers research after intake approval since the research gate is `required: false`. An artifact list endpoint (`GET /api/artifacts/project/:projectId/stage/:stageKey`) returns all artifacts for a given stage. Two n8n workflow templates follow the proven Webhook→Code→Callback pattern.

**Client-side (T02):** The SSE `artifact-ready` handler now dispatches a new `lumon/append-artifact` action that accumulates artifact references into an `artifactIds` array without overwriting. Selectors project `artifactIds` alongside the primary `artifactId`. A `useArtifact` hook fetches artifact content from the server with module-level caching. `ArtifactRenderer` dispatches on `artifact.type` to type-specific sub-renderers: `ViabilityRenderer`, `BusinessPlanRenderer`, `TechResearchRenderer`, with a `GenericRenderer` fallback. `DossierStageOutputCard` renders rich artifact content progressively — summary from selector data immediately, full content as it loads.

## Verification

- `npx vitest run` — **121 tests pass** (12 files)
  - `server/__tests__/research-pipeline.test.js` — 22 tests: webhook registry, per-stage tracking, sequential orchestration, auto-trigger, artifact list
  - `src/lumon/__tests__/artifact-output.test.js` — 29 tests: multi-artifact selector projections, append-artifact reducer
  - `src/lumon/__tests__/artifact-renderer.test.jsx` — 19 tests: dispatcher routing, three sub-renderers, generic fallback
  - `src/lumon/__tests__/server-sync.test.js` — updated for `lumon/append-artifact` dispatch
- Zero regressions in M001 tests (32) and S01 server tests (15)
- `npx vite build` — production build succeeds

## Requirements Advanced

- R006 (Business planning output) — business_plan artifact type defined with targetAudience, pricingPosture, featurePhases, revenueModel, recommendation schema; BusinessPlanRenderer renders structured sections in the dossier
- R007 (Tech-stack research) — tech_research artifact type defined with scored approaches, tradeoffs, recommendation schema; TechResearchRenderer renders structured sections in the dossier
- R019 (n8n as orchestrator) — sequential sub-workflow orchestration, auto-trigger chain, and per-stage webhook routing extend n8n integration beyond the single-stage S01 proof

## Requirements Validated

- None — R006, R007, and R019 require live n8n integration proof (S04) before validation

## New Requirements Surfaced

- None

## Requirements Invalidated or Re-scoped

- None

## Deviations

- `setDataDir()` added to artifacts.js for test isolation — both server test files share the same module and need independent data directories for parallel vitest runs. Not in original plan but required for correctness.
- Artifact list endpoint mounted at both top-level and pipeline router for flexibility — original plan specified one mount point.
- `server-sync.test.js` updated to expect `lumon/append-artifact` instead of `lumon/update-stage` — behavioral contract change driven by the new reducer action.

## Known Limitations

- Sequential research orchestration adds latency (business_plan must complete before tech_stack fires). Parallel triggering deferred to S04 if needed.
- `useArtifact` module-level cache has no invalidation or TTL — acceptable at single-operator scale; revisit if artifact content becomes mutable.
- Collapsible sections in renderers default open — intentional friction reduction but may not scale when artifact content is large.

## Follow-ups

- S04: prove sequential orchestration with live n8n instance
- S04: prove rejection → iteration → re-approval doesn't corrupt multi-artifact state
- S04: evaluate whether parallel sub-workflow triggering is needed based on real latency

## Files Created/Modified

- `server/config.js` — **new** — webhook registry and RESEARCH_SUB_STAGES constant
- `server/pipeline.js` — **modified** — two-level projectIndex, per-stage execution tracking
- `server/routes/pipeline.js` — **modified** — fireWebhook helper, webhook registry integration, sequential orchestration, auto-trigger, artifact list route
- `server/artifacts.js` — **modified** — getByProjectAndStage(), setDataDir() for test isolation
- `server/index.js` — **modified** — artifact list endpoint, route ordering
- `server/__tests__/pipeline-api.test.js` — **modified** — updated for per-stage status response
- `server/__tests__/research-pipeline.test.js` — **new** — 22 contract tests
- `n8n/workflows/research-business-plan.json` — **new** — Webhook→Code→Callback template
- `n8n/workflows/research-tech-stack.json` — **new** — Webhook→Code→Callback template
- `src/lumon/sync.js` — **modified** — artifact-ready dispatches lumon/append-artifact
- `src/lumon/reducer.js` — **modified** — appendArtifact action with accumulation/dedup
- `src/lumon/selectors.js` — **modified** — artifactIds projection in dossier and packet evidence
- `src/lumon/useArtifact.js` — **new** — fetch + cache hook for artifact content
- `src/features/mission-control/ArtifactRenderer.jsx` — **new** — type-dispatched renderer with sub-renderers
- `src/features/mission-control/DashboardTab.jsx` — **modified** — ArtifactDetailPanel wired into dossier
- `src/lumon/__tests__/artifact-output.test.js` — **modified** — 9 new multi-artifact tests
- `src/lumon/__tests__/artifact-renderer.test.jsx` — **new** — 19 renderer tests
- `src/lumon/__tests__/server-sync.test.js` — **modified** — updated dispatch expectation

## Forward Intelligence

### What the next slice should know
- The webhook registry pattern in `server/config.js` is the standard for adding new stage webhooks — S03 naming/brand stages just need new env var entries and `getWebhookUrl()` calls.
- `ArtifactRenderer` dispatch table in `ArtifactRenderer.jsx` is the extension point for new artifact types — S03 adds `naming_candidates`, `domain_signals`, `trademark_signals` renderers to the same table.
- The `lumon/append-artifact` action handles multi-artifact stages generically — S03 doesn't need new reducer logic if naming stages produce multiple artifacts.

### What's fragile
- Sequential orchestration in `server/routes/pipeline.js` callback handler uses a linear `RESEARCH_SUB_STAGES` array scan — adding more stages or branching logic will need a more structured orchestration model.
- Route ordering in `server/index.js` matters — the multi-segment `/api/artifacts/project/:projectId/stage/:stageKey` must be mounted before the single-param `/api/artifacts/:id` or it won't match.

### Authoritative diagnostics
- `GET /api/pipeline/status/:projectId` — returns per-stage execution records with status, stageKey, timestamps
- `GET /api/artifacts/project/:projectId/stage/:stageKey` — returns all artifacts for a stage, useful for debugging multi-artifact accumulation
- `[bridge] sequential-next` log lines — trace the exact sub-stage progression chain

### What assumptions changed
- Original plan assumed `lumon/update-stage` would handle artifact accumulation — instead a dedicated `lumon/append-artifact` action was cleaner and avoids requiring callers to pre-merge arrays.
- Original plan assumed a single artifact list endpoint — we mounted at both top-level and pipeline router for flexibility.
