---
id: S04
parent: M001
milestone: M001
provides:
  - Selector-owned dossier and handoff packet contracts rendered inside the selected-project dashboard seam with stable section IDs and honest readiness reasons
  - Reload-safe project detail views for Overview, Dossier, and Handoff backed by canonical project, stage, and approval truth
requires:
  - slice: S02
    provides: Persistent project registry, stable project identity, and restore-safe selected-project state
  - slice: S03
    provides: Canonical pre-build stage taxonomy, approval gates, and selector-owned pipeline summaries
affects:
  - S06
key_files:
  - src/lumon/model.js
  - src/lumon/selectors.js
  - src/features/mission-control/DashboardTab.jsx
  - src/features/mission-control/__tests__/project-dossier.test.jsx
  - src/features/mission-control/__tests__/project-registry.test.jsx
key_decisions:
  - D019: Keep dossier and handoff views as local Overview / Dossier / Handoff subviews inside the dashboard selected-project pane.
  - D020: Keep the M001 dossier and handoff packet thin, derived from canonical project/stage/approval truth, and free of persisted placeholder artifact blobs.
patterns_established:
  - Add dossier and handoff taxonomy in `src/lumon/model.js`, then project it only through `selectSelectedProjectDetail()` so detail surfaces read one canonical contract.
  - Render dashboard detail diagnostics directly from stable selector IDs and `data-testid` seams instead of inventing UI-local dossier or packet state.
observability_surfaces:
  - `selectSelectedProjectDetail(state).dossier`
  - `selectSelectedProjectDetail(state).handoffPacket`
  - `selectSelectedProjectDetail(state).currentApprovalSummary`
  - `selected-project-dossier-*`
  - `selected-project-handoff-*`
  - `window.localStorage['lumon.registry.v1']`
drill_down_paths:
  - .gsd/milestones/M001/slices/S04/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S04/tasks/T02-SUMMARY.md
duration: 1h42m
verification_result: passed
completed_at: 2026-03-14T20:25:36-0700
---

# S04: Project dossier and handoff packet views

**Shipped a real selected-project detail seam with canonical Overview, Dossier, and Handoff views, reload-safe continuity, and honest packet readiness diagnostics.**

## What Happened

S04 turned the selected-project pane from a single overview column into one selector-owned detail seam.

T01 established the canonical dossier and handoff packet contract in `src/lumon/model.js` and `src/lumon/selectors.js`. The selected-project selector now projects a thin working brief, the current approval summary, per-stage dossier entries, and packet sections for architecture, specification, prototype, and approval readiness. Those sections use stable IDs and explicit `ready` / `waiting` / `blocked` / `missing` states derived from canonical project, stage, and approval truth instead of persisted placeholder artifacts or UI copy.

T02 wired that contract into `src/features/mission-control/DashboardTab.jsx` as nested `Overview`, `Dossier`, and `Handoff` tabs. Overview preserves the existing header, pipeline snapshot, and agent roster. Dossier renders the brief, current approval, and stage-output ledger. Handoff renders packet readiness counts plus the future build-packet sections with the selector-provided reasons shown directly when something is waiting, blocked, or missing.

The slice also hardened the detail seam around restore and empty-state behavior. Reload-safe selected-project continuity now reaches into the dossier and handoff views, and intentionally empty registries continue to show explicit `dashboard-empty-registry` and `dashboard-no-selected-project` fallbacks instead of leaving dead detail chrome behind.

## Verification

Passed slice verification exactly as planned:

- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js`
- `npm run test -- --run src/features/mission-control/__tests__/project-dossier.test.jsx src/features/mission-control/__tests__/project-registry.test.jsx`
- `npx eslint src/lumon src/features/mission-control`
- `npm run build`

Live browser verification passed on a local preview server:

- created projects in the real app and confirmed the selected-project pane exposes `Overview`, `Dossier`, and `Handoff`
- verified dossier brief and stage-output visibility from selector-owned data
- verified handoff packet readiness and section-level waiting / missing reasons
- created a second project, reloaded, and confirmed selected-project restore came back to the same project before reopening Dossier and Handoff
- forced `window.localStorage['lumon.registry.v1']` to a valid empty registry envelope, reloaded, and confirmed explicit empty/no-selection fallback surfaces
- final browser assertions passed with no console errors and no failed network requests during the empty-registry fallback proof

## Requirements Advanced

- R010 — M001 now proves the dossier and handoff packet structure exists as a live, selector-owned inspection seam with honest readiness and missing-state diagnostics, while later milestones still need to populate it with real artifacts.

## Requirements Validated

- none

## New Requirements Surfaced

- none

## Requirements Invalidated or Re-scoped

- none

## Deviations

T01 created `src/features/mission-control/__tests__/project-dossier.test.jsx` early as the red UI target for T02 because the slice verification contract already depended on that file.

## Known Limitations

The packet remains intentionally thin in M001. Architecture, specification, and prototype sections expose readiness and missing reasons, but they do not yet carry real generated artifacts or stored handoff payloads.

## Follow-ups

- S05 should wire the Severed Floor to the same canonical project and agent-summary truth now used by the dashboard detail seam.
- S06 should prove the full create → inspect → advance → observe loop across dashboard, dossier, handoff, and floor synchronization.

## Files Created/Modified

- `src/lumon/model.js` — added stable dossier and handoff packet section definitions.
- `src/lumon/selectors.js` — projected brief, approval, stage-output, and packet-readiness view models from canonical selected-project state.
- `src/lumon/__tests__/lumon-state.test.js` — proved selector-level dossier and handoff behavior, including missing-state transitions.
- `src/features/mission-control/DashboardTab.jsx` — added the nested Overview / Dossier / Handoff detail pane and selector-backed diagnostic seams.
- `src/features/mission-control/__tests__/project-dossier.test.jsx` — added rendered proof for tab switching, honest missing-state rendering, and empty fallback handling.
- `src/features/mission-control/__tests__/project-registry.test.jsx` — extended reload continuity proof into the dossier and handoff views.
- `.gsd/REQUIREMENTS.md` — clarified what S04 proved for R010 without over-claiming full artifact generation.
- `.gsd/PROJECT.md` — refreshed current state to reflect the shipped dossier and handoff surfaces.
- `.gsd/STATE.md` — advanced the quick-glance status to S05.
- `.gsd/milestones/M001/M001-ROADMAP.md` — marked S04 complete.

## Forward Intelligence

### What the next slice should know
- The selected-project pane is now the authoritative inspection seam for project detail. Reuse its selector contracts instead of introducing a second floor-specific interpretation of project readiness.
- Browser automation against the new-project modal needs real input/change events; direct DOM value assignment can leave the submit button disabled.

### What's fragile
- Packet content is still intentionally synthetic at the contract layer — if later slices start storing real artifacts, they should extend the canonical selector/model contract instead of bypassing it with UI-local packet rows.

### Authoritative diagnostics
- `selectSelectedProjectDetail(state)` — this is the canonical truth for brief, stage outputs, approval summary, and packet readiness.
- `selected-project-dossier-*` / `selected-project-handoff-*` — these test IDs cleanly separate selector truth from tab wiring failures in the real UI.
- `window.localStorage['lumon.registry.v1']` — this is the fastest source for proving restore-safe selection and intentionally empty registry behavior.

### What assumptions changed
- The slice started as a pure detail-view task — in practice it also needed explicit empty-registry and reload continuity proof at the nested tab level, otherwise the new seam could pass render tests while breaking restore behavior.
