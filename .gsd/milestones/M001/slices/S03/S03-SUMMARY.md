---
id: S03
parent: M001
milestone: M001
provides:
  - Canonical intake-to-handoff stage taxonomy, approval gates, and execution reconciliation for seeded, spawned, and persisted projects
  - One selector-owned stage-first pipeline view model shared by dashboard and orchestration, with reload-safe approval-aware status surfaces
requires:
  - slice: S01
    provides: Canonical Lumon domain model, reducer/provider spine, and shared selectors for project and stage state
  - slice: S02
    provides: Persisted project registry, stable project IDs/timestamps, engine choice storage, and selected-project restore
affects:
  - S04
  - S05
  - S06
key_files:
  - src/lumon/model.js
  - src/lumon/reducer.js
  - src/lumon/selectors.js
  - src/lumon/seed.js
  - src/features/mission-control/MissionControlShell.jsx
  - src/features/mission-control/DashboardTab.jsx
  - src/features/mission-control/OrchestrationTab.jsx
  - src/lumon/__tests__/lumon-state.test.js
  - src/lumon/__tests__/lumon-persistence.test.js
  - src/features/mission-control/__tests__/pipeline-board.test.jsx
  - src/features/mission-control/__tests__/project-registry.test.jsx
key_decisions:
  - D017: Canonical stage IDs use `<projectId>:<stageKey>` plus alias-based reconciliation for legacy persisted stage IDs.
  - D018: Dashboard and orchestration consume one selector-owned project pipeline view model while React Flow remains presentation-only.
patterns_established:
  - Rehydrate project and stage mutations through `createProject()` so execution truth is recomputed from canonical stage and approval state.
  - Build dashboard and orchestration pipeline summaries through shared selector view models rather than surface-local status inference.
observability_surfaces:
  - `state.projects[*].execution.{currentStageId,currentGateId,currentApprovalState,pipelineStatus,handoffReady,progressPercent}`
  - `selectDashboardProjects`, `selectSelectedProjectDetail`, and `selectOrchestrationInput`
  - Dashboard/orchestration `data-testid` surfaces for current stage, current gate, pipeline status, and selected-stage summary
  - `window.localStorage['lumon.registry.v1']`
  - `src/lumon/__tests__/lumon-state.test.js`
  - `src/lumon/__tests__/lumon-persistence.test.js`
  - `src/features/mission-control/__tests__/pipeline-board.test.jsx`
  - `src/features/mission-control/__tests__/project-registry.test.jsx`
drill_down_paths:
  - .gsd/milestones/M001/slices/S03/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S03/tasks/T02-SUMMARY.md
duration: 3.5h
verification_result: passed
completed_at: 2026-03-14T11:17:34-0700
---

# S03: Pipeline board and approval model

**Shipped a canonical pre-build pipeline with stable stage and gate IDs, then made dashboard and orchestration render the same approval-aware stage truth from one shared selector contract.**

## What Happened

S03 pulled the intake-to-handoff workflow out of UI-local assumptions and put it into the Lumon domain model.

`src/lumon/model.js` now owns the canonical taxonomy for intake, research, plan, wave execution, verification, and handoff. It generates stable stage IDs in `<projectId>:<stageKey>` form, stable approval gate IDs such as `gate:intake-review` and `gate:handoff-approval`, and normalized approval states (`pending`, `approved`, `rejected`, `needs_iteration`, `not_required`). `createProject()` and related helpers now reconcile `currentStageId`, `currentGateId`, `currentApprovalState`, `pipelineStatus`, handoff readiness, and progress from stage truth instead of trusting stale execution fields.

That canonical contract now feeds every project path. Seed data was rebuilt through shared stage factories, new projects now spawn through `createProjectSpawnInput()` instead of shell-local arrays, and reducer mutations route back through canonical project rehydration so persisted and in-memory projects stay on the same model. Legacy persisted stage IDs remain reload-safe through alias-based reconciliation.

On the UI side, `src/lumon/selectors.js` now exposes one stage-first project pipeline view model consumed by both the dashboard and orchestration surfaces. `DashboardTab.jsx` was rebalanced so current stage, current gate, approval state, and stage timeline lead each project card; agent detail is still present but clearly secondary. `OrchestrationTab.jsx` now reads the same selector-owned pipeline status, stage label, gate label, and selected-stage summary, while React Flow stays presentation-only.

By the end of the slice, the real app could show waiting, blocked, and handoff-ready projects from the same canonical state contract, preserve that state through reload, and expose stable diagnostics in selectors, rendered test IDs, and persisted registry data.

## Verification

Passed slice verification exactly as planned:

- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js src/lumon/__tests__/lumon-persistence.test.js`
- `npm run test -- --run src/features/mission-control/__tests__/pipeline-board.test.jsx src/features/mission-control/__tests__/project-registry.test.jsx`
- `npx eslint src/lumon src/features/mission-control`
- `npm run build`

Passed live runtime verification on `http://127.0.0.1:4173/`:

- confirmed the dashboard rendered explicit waiting, blocked, and handoff-ready projects from persisted state
- confirmed orchestration matched the dashboard on current stage (`Handoff`), current gate (`Handoff approval`), and approval state (`Pending approval`) for the selected project
- reloaded the app and confirmed selected-project continuity plus preserved stage/gate/approval state
- inspected `window.localStorage['lumon.registry.v1']` and confirmed persisted execution truth for proof projects, including stable stage IDs, gate IDs, `pipelineStatus`, and `handoffReady`
- confirmed selector-backed and rendered diagnostics via `data-testid` surfaces such as `orchestration-pipeline-status`, `orchestration-current-stage-label`, `orchestration-current-gate-label`, `orchestration-current-approval-state`, `orchestration-selected-stage-summary`, `selected-project-pipeline-status`, `selected-project-current-stage`, and `selected-project-current-gate`
- confirmed clean browser diagnostics with no console errors and no failed network requests

## Requirements Advanced

- R004 — S03 now gives major pre-build transitions stable approval-gate identifiers, approval owners, and persisted pending/rejected/needs-iteration semantics that later runtime orchestration can stop on cleanly.
- R019 — S03 shaped the pipeline contract around stable gate IDs, pending-owner metadata, and reload-safe stage reconciliation so n8n can attach wait/resume behavior without changing the UI-facing model.

## Requirements Validated

- R003 — Validated by canonical intake-to-handoff stage factories, reducer reconciliation, persistence round-trip tests, and real preview/browser proof that projects expose the same staged journey across dashboard and orchestration.
- R016 — Validated by the shared stage-first selector contract and live dashboard/orchestration verification proving pipeline stage state and approval-aware status now lead the main operational surfaces.

## New Requirements Surfaced

- none

## Requirements Invalidated or Re-scoped

- none

## Deviations

Browser verification used a deterministic persisted proof registry containing waiting, blocked, and handoff-ready projects after the real shell path was already proven. That was deliberate: it gave one stable browser pass for all approval states without relying on ad hoc manual stage mutation in the UI.

## Known Limitations

- S03 models and renders the pre-build pipeline, but it does not yet populate dossier or handoff packet artifacts; that is S04.
- Approval gates are explicit and persisted, but no live n8n wait/resume execution is attached yet; S03 only preserves the contract for that integration.
- The Severed Floor still does not consume this richer pipeline state live; that remains S05.
- The build still emits Vite's existing chunk-size warning for the main bundle.

## Follow-ups

- S04 should consume the new stage and approval selectors rather than inventing dossier-local status summaries.
- S05 should map pipeline status (`waiting`, `blocked`, `handoff_ready`, `running`, `queued`, `complete`) into floor-level project and agent presence without duplicating derivation logic.

## Files Created/Modified

- `src/lumon/model.js` — added canonical stage/gate factories, approval normalization, execution reconciliation, and spawn helpers.
- `src/lumon/reducer.js` — routed project and stage updates back through canonical project rehydration.
- `src/lumon/selectors.js` — added the shared stage-first project pipeline view model used by dashboard and orchestration.
- `src/lumon/seed.js` — rebuilt seeded/fallback pipelines through the canonical stage factory.
- `src/features/mission-control/MissionControlShell.jsx` — replaced shell-local stage construction with canonical project spawn input.
- `src/features/mission-control/DashboardTab.jsx` — moved pipeline stage, gate, and approval state ahead of agent detail.
- `src/features/mission-control/OrchestrationTab.jsx` — rewired orchestration surfaces to the same selector-owned stage/gate/approval contract.
- `src/lumon/__tests__/lumon-state.test.js` — proved taxonomy, approval-aware progression, and execution observability.
- `src/lumon/__tests__/lumon-persistence.test.js` — proved persistence/reload continuity for canonical stage and approval state.
- `src/features/mission-control/__tests__/pipeline-board.test.jsx` — proved waiting, blocked, and handoff-ready rendered pipeline states.
- `src/features/mission-control/__tests__/project-registry.test.jsx` — proved reload-safe stage/gate/approval continuity for spawned projects.
- `.gsd/REQUIREMENTS.md` — moved R003 and R016 to validated and recorded what S03 actually proved.
- `.gsd/PROJECT.md` — refreshed current-state description to reflect canonical staged pipeline truth.
- `.gsd/STATE.md` — advanced the working state beyond S03.
- `.gsd/milestones/M001/M001-ROADMAP.md` — marked S03 complete.

## Forward Intelligence

### What the next slice should know
- The dossier work already has authoritative stage truth available. Use selector outputs and persisted execution metadata instead of introducing a second project-detail interpretation layer.

### What's fragile
- The proof registry in localStorage can mask whether a browser pass is using seeded demo data or deterministic S03 verification data — check `window.localStorage['lumon.registry.v1']` before assuming which state you are looking at.

### Authoritative diagnostics
- `window.localStorage['lumon.registry.v1']` plus the `selectDashboardProjects` / `selectSelectedProjectDetail` / `selectOrchestrationInput` projections are the fastest trustworthy signals because they show the canonical stage/gate/approval contract before presentation concerns distort it.

### What assumptions changed
- The earlier assumption was that pipeline truth could live partly in shell defaults and partly in surface presentation. In practice that drifted immediately; the slice only stabilized once stage, approval, and current-status derivation moved fully into `src/lumon/*` and shared selectors.
