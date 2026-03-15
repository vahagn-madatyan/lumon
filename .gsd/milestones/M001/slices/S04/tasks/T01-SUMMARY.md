---
id: T01
parent: S04
milestone: M001
provides:
  - Canonical selected-project dossier and handoff packet contracts with stable section IDs and honest readiness reasons
  - Selector-level proof for thin brief projection, missing-output visibility, and handoff packet state transitions
key_files:
  - src/lumon/model.js
  - src/lumon/selectors.js
  - src/lumon/__tests__/lumon-state.test.js
  - src/features/mission-control/__tests__/project-dossier.test.jsx
  - .gsd/milestones/M001/slices/S04/S04-PLAN.md
  - .gsd/STATE.md
key_decisions:
  - D020: Keep the M001 dossier and handoff packet thin, derived from canonical project/stage/approval truth, and free of persisted placeholder artifact blobs.
patterns_established:
  - Add dossier and packet taxonomy in `src/lumon/model.js`, then project it only through `selectSelectedProjectDetail()` so list views do not carry a second detail-only interpretation layer.
  - Build packet readiness from dossier stage sections and current approval truth, which keeps missing/blocked/waiting reasons inspectable before UI rendering starts.
observability_surfaces:
  - `selectSelectedProjectDetail(state).dossier`
  - `selectSelectedProjectDetail(state).handoffPacket`
  - `selectSelectedProjectDetail(state).currentApprovalSummary`
  - `src/lumon/__tests__/lumon-state.test.js`
  - `src/features/mission-control/__tests__/project-dossier.test.jsx`
duration: 1.5h
verification_result: passed
completed_at: 2026-03-14T20:05:31-07:00
blocker_discovered: false
---

# T01: Define the canonical dossier and handoff packet contract

**Added one selector-owned dossier/handoff contract over canonical project state, with stable section IDs, thin brief fields, and explicit waiting/blocked/missing reasons.**

## What Happened

Added canonical dossier and handoff packet section definitions to `src/lumon/model.js` so S04 has one stable taxonomy for:
- the thin working brief
- the current approval summary
- per-stage dossier entries
- future handoff packet sections for architecture, specs, prototype, and approval state

Extended `selectSelectedProjectDetail()` in `src/lumon/selectors.js` without creating a second persisted model. The selector now projects:
- `dossier.brief` from current project metadata plus current stage/gate truth
- `dossier.currentApprovalSummary` from the active gate only, with no implied approval history
- `dossier.stageOutputs[]` with stable IDs and `ready` / `waiting` / `blocked` / `missing` state + reason
- `handoffPacket.sections[]` with explicit readiness reasons derived from dossier stage sections and current handoff approval truth
- `handoffPacket.status`, readiness counts, and `pipelineReady` / `readyForBuild` flags

The packet contract stays honest about current M001 data. Architecture/spec/prototype sections do not invent stored artifacts; once prerequisites resolve, they surface as `missing` with concrete reasons instead of pretending content exists.

Expanded `src/lumon/__tests__/lumon-state.test.js` to prove:
- stable dossier section IDs
- stable packet section IDs
- missing stage-output behavior
- handoff-ready projection turning packet approval `ready` while unresolved packet content remains `missing`
- blocked handoff approval projection

Because this is the first task in S04 and the slice verification already names `src/features/mission-control/__tests__/project-dossier.test.jsx`, I also created that file as the expected red test for T02. It currently fails because the selected-project pane still lacks the local `Overview` / `Dossier` / `Handoff` subviews.

## Verification

Passed task verification:
- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js`

Passed slice checks already satisfied by T01:
- `npx eslint src/lumon src/features/mission-control`
- `npm run build`

Slice checks still red for T02:
- `npm run test -- --run src/features/mission-control/__tests__/project-dossier.test.jsx src/features/mission-control/__tests__/project-registry.test.jsx`
  - `project-registry.test.jsx` still passes in the combined run
  - `project-dossier.test.jsx` fails as intended because the local selected-project subviews are not wired yet

## Diagnostics

Inspect later with:
- `selectSelectedProjectDetail(state).dossier.sections` for stable IDs and per-section readiness reasons
- `selectSelectedProjectDetail(state).dossier.stageOutputs` for missing or blocked stage-output visibility
- `selectSelectedProjectDetail(state).currentApprovalSummary` for the current gate-only summary
- `selectSelectedProjectDetail(state).handoffPacket.status` and `.sections` for packet readiness vs missing content
- `src/lumon/__tests__/lumon-state.test.js` for concrete selector assertions

## Deviations

- Created `src/features/mission-control/__tests__/project-dossier.test.jsx` during T01 even though the task plan was selector-only, because the slice verification contract already named that file and this is the first task in the slice.

## Known Issues

- `src/features/mission-control/__tests__/project-dossier.test.jsx` is intentionally red until T02 adds the local `Overview` / `Dossier` / `Handoff` selected-project subviews.
- `npm run build` still emits the pre-existing Vite chunk-size warning for the main bundle. The build passes.

## Files Created/Modified

- `src/lumon/model.js` — added canonical dossier and handoff packet section definitions plus the stable dossier stage-section ID builder.
- `src/lumon/selectors.js` — projected dossier brief/current approval/stage outputs and handoff packet readiness from canonical selected-project state.
- `src/lumon/__tests__/lumon-state.test.js` — added selector-level proof for stable IDs, missing-output behavior, and handoff packet transitions.
- `src/features/mission-control/__tests__/project-dossier.test.jsx` — added the red T02 UI verification target for local Overview/Dossier/Handoff subviews.
- `.gsd/milestones/M001/slices/S04/S04-PLAN.md` — marked T01 complete.
- `.gsd/STATE.md` — advanced the slice next action to T02.
