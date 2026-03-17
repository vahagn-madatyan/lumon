---
id: T03
parent: S03
milestone: M002
provides:
  - NamingCandidatesRenderer with interactive Select buttons and onAction callback
  - DomainSignalsRenderer with per-TLD status badges and advisory disclaimer (D026)
  - TrademarkSignalsRenderer with status/class display and advisory disclaimer (D026)
  - triggerPipeline extended with optional extra body data for subStage/context forwarding
  - onAction prop chain from DossierStageOutputCard → ArtifactDetailPanel → ArtifactRenderer → sub-renderer
key_files:
  - src/features/mission-control/ArtifactRenderer.jsx
  - src/lumon/sync.js
  - src/features/mission-control/DashboardTab.jsx
  - src/lumon/__tests__/artifact-renderer.test.jsx
key_decisions:
  - onAction callback prop-drilled through component chain rather than context provider — keeps renderers testable without wrapping
  - Generic onAction({ type, ...payload }) pattern instead of named onSelectName — renderers receive the same interface, only NamingCandidatesRenderer uses it currently
patterns_established:
  - Interactive artifact renderers receive optional onAction callback via ArtifactRenderer forwarding — future interactive renderers follow the same pattern
  - Advisory disclaimer banners use amber border/text with data-testid suffixed with -advisory-disclaimer for D026 compliance
observability_surfaces:
  - DOM: data-testid="naming-candidate-{i}-select" for selection buttons, data-testid="domain-advisory-disclaimer" and data-testid="trademark-advisory-disclaimer" for D026 disclaimers
  - Network: POST /api/pipeline/trigger with subStage and context fields in body when naming selection fires
  - Console: triggerPipeline errors surface through { error, reason } return shape
duration: 12m
verification_result: passed
completed_at: 2026-03-16
blocker_discovered: false
---

# T03: Add naming, domain, and trademark renderers with interactive selection

**Added three plan sub-stage renderers (naming candidates with interactive selection, domain signals, trademark signals) to ArtifactRenderer dispatch table and wired naming selection through triggerPipeline with context forwarding.**

## What Happened

1. Extended `triggerPipeline` in `src/lumon/sync.js` to accept optional third argument `extra = {}` that spreads into the POST body. Backward-compatible — existing two-arg calls unchanged.

2. Added `NamingCandidatesRenderer` to ArtifactRenderer.jsx: renders candidate list from `content.candidates` with name, rationale, domainHint, and style tag badges. Each candidate has a Select button that calls `onAction({ type: "select-name", selectedName })`. Buttons are disabled when onAction is not provided. Optional methodology section renders in a CollapsibleSection.

3. Added `DomainSignalsRenderer`: advisory disclaimer banner at top (amber border, D026), selected name header, per-TLD signal rows with status badges (available=emerald, taken=red, premium=amber) and optional price.

4. Added `TrademarkSignalsRenderer`: advisory disclaimer banner (D026), selected name header, trademark signal rows with mark, class, optional registrationNumber/owner, and status badges (live=red, dead=zinc, pending=amber).

5. Registered all three in `TYPE_RENDERERS` map. Updated `ArtifactRenderer` to accept and forward `onAction` prop to sub-renderers.

6. Wired naming selection through DashboardTab.jsx: `ArtifactDetailPanel` now accepts/forwards `onAction`; `DossierStageOutputCard` accepts `projectId` prop, creates `onAction` handler that calls `triggerPipeline(projectId, "plan", { subStage: "domain_signals", context: { selectedName } })` on select-name actions; `DossierPanel` passes `project.id` as `projectId` to each `DossierStageOutputCard`.

7. Added 21 new tests across 4 describe blocks: NamingCandidatesRenderer (6 tests), DomainSignalsRenderer (5 tests), TrademarkSignalsRenderer (6 tests), ArtifactRenderer dispatch for new types (4 tests).

## Verification

- `npx vitest run` — **171 tests pass** (150 existing + 21 new), 13 test files, zero failures
- `npx vite build` — production build succeeds (701KB JS, 115KB CSS)
- New tests verify: candidate rendering + selection callback, style tag badges, disabled buttons without onAction, domain signal status badge colors (emerald/red/amber), trademark status badge colors (red/zinc/amber), advisory disclaimers on both domain and trademark, registration number/owner display, ArtifactRenderer dispatch for all three new types, onAction forwarding

## Diagnostics

- **DOM inspection:** `data-testid="naming-candidates-renderer"`, `data-testid="naming-candidate-{i}"`, `data-testid="naming-candidate-{i}-select"` for naming flow; `data-testid="domain-advisory-disclaimer"` and `data-testid="trademark-advisory-disclaimer"` for D026 compliance checks
- **Network:** Naming selection produces POST `/api/pipeline/trigger` with `{ projectId, stageKey: "plan", subStage: "domain_signals", context: { selectedName } }` body — visible in browser devtools Network tab
- **Failure shapes:** If triggerPipeline fails, returns `{ error, reason }` object. If onAction not provided, Select buttons render disabled (not clickable). Both are tested.

## Deviations

None. All 6 plan steps executed as specified.

## Known Issues

None.

## Files Created/Modified

- `src/lumon/sync.js` — Extended triggerPipeline signature with optional `extra` third arg, spread into POST body
- `src/features/mission-control/ArtifactRenderer.jsx` — Added NamingCandidatesRenderer, DomainSignalsRenderer, TrademarkSignalsRenderer; registered in TYPE_RENDERERS; ArtifactRenderer accepts/forwards onAction prop
- `src/features/mission-control/DashboardTab.jsx` — ArtifactDetailPanel accepts/forwards onAction; DossierStageOutputCard accepts projectId, creates onAction handler wiring triggerPipeline; DossierPanel passes project.id to DossierStageOutputCard
- `src/lumon/__tests__/artifact-renderer.test.jsx` — Added 21 new tests for three renderers + dispatch + onAction forwarding
- `.gsd/milestones/M002/slices/S03/tasks/T03-PLAN.md` — Added Observability Impact section (pre-flight fix)
