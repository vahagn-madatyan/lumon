---
id: T02
parent: S04
milestone: M001
provides:
  - Selected-project detail pane with local Overview, Dossier, and Handoff subviews backed by the existing selector contract
  - Rendered and browser proof for dossier/handoff visibility, missing-state honesty, and reload-safe selected-project continuity
key_files:
  - src/features/mission-control/DashboardTab.jsx
  - src/features/mission-control/__tests__/project-dossier.test.jsx
  - src/features/mission-control/__tests__/project-registry.test.jsx
key_decisions:
  - Keep the new project-detail navigation nested inside DashboardTab so the selected project remains the single source of detail context
patterns_established:
  - Project dossier and handoff panels derive stable data-testid surfaces directly from selector-owned section IDs and stage keys instead of inventing UI-local detail state
observability_surfaces:
  - selected-project-tab-*
  - selected-project-dossier-*
  - selected-project-handoff-*
  - window.localStorage['lumon.registry.v1']
duration: 12m
verification_result: passed
completed_at: 2026-03-14T20:19:06-0700
blocker_discovered: false
---

# T02: Wire Overview, Dossier, and Handoff into the selected-project pane

**Added a nested Overview / Dossier / Handoff tabset to the dashboard detail pane and rendered selector-owned dossier and packet sections with reload-safe proof.**

## What Happened

`src/features/mission-control/DashboardTab.jsx` now treats the selected-project pane as a local tabset rather than a single always-on detail column. Overview keeps the existing header, pipeline snapshot, and agent roster intact. Dossier renders the selector-owned working brief, current approval summary, and per-stage outputs. Handoff renders packet readiness plus architecture/spec/prototype/approval sections with the selector-provided waiting, blocked, and missing reasons shown explicitly instead of collapsing absent content.

I added stable `data-testid` surfaces across the new detail seam so later agents can tell whether a failure is in selector data, tab wiring, or empty-state handling. The rendered integration proof was expanded in `project-dossier.test.jsx` to cover tab switching, selector-driven content, missing-output honesty, and explicit no-selection fallback. `project-registry.test.jsx` now reopens the local Dossier and Handoff views before and after remount to prove selected-project restore still lights the same detail contract.

## Verification

Passed commands:

- `npm run test -- --run src/features/mission-control/__tests__/project-dossier.test.jsx src/features/mission-control/__tests__/project-registry.test.jsx`
- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js`
- `npx eslint src/lumon src/features/mission-control`
- `npm run build`

Browser verification passed against a local server:

- Asserted the real dashboard shows Overview by default, then switches into Dossier and Handoff via the nested tabs
- Confirmed dossier brief/stage-output surfaces render selector-owned content for the selected project
- Selected a different project, reloaded, and confirmed the restored selection still drives Dossier and Handoff
- Forced `window.localStorage['lumon.registry.v1']` to an empty registry envelope and confirmed the explicit empty-registry / no-selected-project fallback appears
- Final browser assertions passed for the empty fallback with `no_console_errors` and `no_failed_requests`

## Diagnostics

Inspect later with:

- `src/features/mission-control/DashboardTab.jsx` for the nested selected-project tabset and the data-testid naming pattern
- `selectSelectedProjectDetail(state)` for the canonical dossier and handoff packet contract
- `selected-project-dossier-*` test ids for brief, approval, and per-stage output visibility
- `selected-project-handoff-*` test ids for packet readiness, per-section reasons, and evidence rows
- `window.localStorage['lumon.registry.v1']` to verify reload-safe project selection and intentionally empty-registry behavior

## Deviations

- The initial browser pass used `vite preview`, but that process was SIGTERM'd by the harness during a reload. Final empty-state browser assertions were completed on a local Vite dev server using the same app state and localStorage contract.

## Known Issues

- None.

## Files Created/Modified

- `src/features/mission-control/DashboardTab.jsx` — added the nested selected-project tabset plus selector-backed dossier and handoff panels with stable test surfaces
- `src/features/mission-control/__tests__/project-dossier.test.jsx` — added rendered proof for tab switching, selector content, missing-state honesty, and empty fallback handling
- `src/features/mission-control/__tests__/project-registry.test.jsx` — extended reload continuity proof to cover dossier and handoff views after remount
- `.gsd/milestones/M001/slices/S04/S04-PLAN.md` — marked T02 complete
- `.gsd/STATE.md` — updated slice execution status and next action after S04 completion
- `.gsd/milestones/M001/slices/S04/tasks/T02-SUMMARY.md` — recorded execution, verification, and diagnostics for this task
