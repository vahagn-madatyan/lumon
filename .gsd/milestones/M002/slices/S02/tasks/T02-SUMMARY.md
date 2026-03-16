---
id: T02
parent: S02
milestone: M002
provides:
  - lumon/append-artifact reducer action for multi-artifact accumulation per stage
  - artifactIds array projection through selectors and handoff packet evidence
  - useArtifact hook with module-level cache for artifact content fetching
  - ArtifactRenderer with type-dispatched sub-renderers (viability_analysis, business_plan, tech_research)
  - DossierStageOutputCard wired to render rich artifact content with progressive loading
key_files:
  - src/lumon/sync.js
  - src/lumon/reducer.js
  - src/lumon/selectors.js
  - src/lumon/useArtifact.js
  - src/features/mission-control/ArtifactRenderer.jsx
  - src/features/mission-control/DashboardTab.jsx
  - src/lumon/__tests__/artifact-output.test.js
  - src/lumon/__tests__/artifact-renderer.test.jsx
key_decisions:
  - New lumon/append-artifact reducer action instead of extending lumon/update-stage — cleaner separation of concerns; artifact accumulation logic lives in one reducer case rather than requiring callers to manually merge output arrays
  - Module-level Map cache in useArtifact rather than React context or reducer state — avoids serialization overhead in persistence, keeps artifact content out of the main state tree, and provides cross-component deduplication
  - All collapsible sections default open in renderers — artifact content is the payoff of the research stage, hiding it behind collapsed sections adds friction without value at this stage
patterns_established:
  - Artifact accumulation pattern — append-artifact action reads existing output.artifactIds array (or infers from single artifactId), deduplicates, and always sets latest as primary artifactId
  - Type-dispatched rendering — ArtifactRenderer dispatches on artifact.type to sub-renderers via a lookup table; unknown types fall back to GenericRenderer with formatted JSON
observability_surfaces:
  - "[sync] artifact-ready" log line with stageId, artifactId, and type on each SSE artifact event
  - useArtifact fetch failures logged with artifactId context
duration: 15m
verification_result: passed
completed_at: 2026-03-15
blocker_discovered: false
---

# T02: Multi-artifact client sync and rich artifact rendering in dossier

**Built multi-artifact accumulation in sync/reducer, selector projection of artifactIds arrays, useArtifact fetch hook, type-dispatched ArtifactRenderer with structured sub-renderers, and progressive artifact loading in DossierStageOutputCard — 28 new tests, zero regressions.**

## What Happened

Updated the SSE `artifact-ready` handler in sync.js to dispatch a new `lumon/append-artifact` action instead of `lumon/update-stage`. The new reducer case reads existing output to build an `artifactIds` array, deduplicates, and always keeps the latest artifact as the primary `artifactId`. This means the second artifact-ready event for a stage accumulates rather than clobbering.

Extended `buildDossierStageSection` and `buildPacketEvidence` in selectors.js to project the `artifactIds` array alongside the existing `artifactId` field. Single-artifact stages get `artifactIds: null` (backward compatible).

Created `useArtifact(artifactId)` hook with module-level Map cache — fetches `GET /api/artifacts/:id`, returns `{ artifact, loading, error }`, handles null/undefined artifactId gracefully.

Built `ArtifactRenderer` with type-dispatched sub-renderers: `ViabilityRenderer` (marketAssessment, technicalFeasibility, riskFactors, recommendation), `BusinessPlanRenderer` (targetAudience, pricingPosture, featurePhases, revenueModel, recommendation), `TechResearchRenderer` (scored approaches list, tradeoffs, recommendation). Unknown types fall back to `GenericRenderer` with formatted JSON. All sections use a `CollapsibleSection` primitive with data-testid attributes.

Wired `ArtifactDetailPanel` into `DossierStageOutputCard`: when `hasArtifact` is true, summary renders immediately from selector data while full artifact content loads progressively via `useArtifact`. Multi-artifact stages render each artifact in its own panel.

## Verification

- `npx vitest run` — 121 tests pass (up from 93 baseline)
  - `src/lumon/__tests__/artifact-renderer.test.jsx` — 19 tests: dispatcher routing, all three sub-renderers, generic fallback, null handling
  - `src/lumon/__tests__/artifact-output.test.js` — 29 tests (was 20): multi-artifact artifactIds projection, backward compatibility, append-artifact reducer action with accumulation, deduplication, and edge cases
  - `src/lumon/__tests__/server-sync.test.js` — updated to expect `lumon/append-artifact` dispatch
- `npx vite build` — production build succeeds
- Zero regressions in M001 tests (32), S01 server tests (15), existing client tests

### Slice-level verification status (S02, final task):

- ✅ `server/__tests__/research-pipeline.test.js` — webhook registry, sequential orchestration, auto-trigger, artifact list (T01)
- ✅ `src/lumon/__tests__/artifact-output.test.js` — multi-artifact selector projections
- ✅ `src/lumon/__tests__/artifact-renderer.test.jsx` — dispatches by type, renders structured sections
- ✅ Zero regressions in M001 (32) and M002/S01 (43) tests → confirmed via full 121-test run
- ✅ `npx vite build` — production build succeeds

## Diagnostics

- **Artifact accumulation**: grep logs for `[sync] artifact-ready` to see each artifact SSE event with stageId/artifactId/type
- **Fetch failures**: `[useArtifact]` console errors include the artifactId that failed
- **Artifact cache**: module-level Map in useArtifact.js — `clearArtifactCache()` exported for test cleanup
- **Multi-artifact rendering**: `data-testid="selected-project-dossier-stage-{stageKey}-artifact-{index}"` for each artifact panel

## Deviations

- Server route: discovered `GET /api/artifacts/:id` already existed in `server/index.js` from T01 — no need to add it in the pipeline router. Restored the pipeline router's `/artifacts/:projectId/:stageKey` route that was briefly changed during implementation.
- `server-sync.test.js`: updated existing test to expect `lumon/append-artifact` instead of `lumon/update-stage` — this is a behavioral contract change, not just a new test.

## Known Issues

None.

## Files Created/Modified

- `src/lumon/sync.js` — artifact-ready handler dispatches `lumon/append-artifact` instead of `lumon/update-stage`
- `src/lumon/reducer.js` — new `appendArtifact` action type and reducer case with accumulation/dedup logic
- `src/lumon/selectors.js` — `buildDossierStageSection` and `buildPacketEvidence` project `artifactIds` array; stage view model includes `artifactIds`
- `src/lumon/useArtifact.js` (new) — fetch + cache hook for single artifact content
- `src/features/mission-control/ArtifactRenderer.jsx` (new) — type-dispatched renderer with ViabilityRenderer, BusinessPlanRenderer, TechResearchRenderer, GenericRenderer
- `src/features/mission-control/DashboardTab.jsx` — ArtifactDetailPanel + DossierStageOutputCard wired for rich artifact rendering
- `server/routes/pipeline.js` — restored pipeline-scoped artifacts route path
- `src/lumon/__tests__/artifact-output.test.js` — 9 new tests for multi-artifact projection and append-artifact reducer
- `src/lumon/__tests__/artifact-renderer.test.jsx` (new) — 19 tests for renderer dispatch and content rendering
- `src/lumon/__tests__/server-sync.test.js` — updated artifact-ready dispatch expectation
