---
estimated_steps: 4
estimated_files: 3
---

# T01: Define the canonical dossier and handoff packet contract

**Slice:** S04 — Project dossier and handoff packet views
**Milestone:** M001

## Description

Define one canonical project-detail contract in `src/lumon/*` for S04 so the selected-project surface can render a thin working brief, per-stage dossier entries, approval summaries, and future handoff packet readiness without inventing a second interpretation layer.

## Steps

1. Add stable dossier and handoff packet section definitions in `src/lumon/model.js`, keeping the M001 brief intentionally thin and derived from existing project metadata plus stage truth.
2. Extend `selectSelectedProjectDetail()` in `src/lumon/selectors.js` to project dossier sections, current approval summaries, stage outputs, and packet sections with explicit `ready`, `waiting`, `blocked`, or `missing` states and reasons.
3. Keep the selector contract honest about current data: show current approval state only, surface missing packet content explicitly, and avoid persisting decorative placeholder artifacts or implying audit history that does not exist.
4. Expand `src/lumon/__tests__/lumon-state.test.js` to prove stable section IDs, readiness transitions, missing-output behavior, and handoff-ready projection from canonical project state.

## Must-Haves

- [ ] The selected-project selector exposes dossier and handoff packet sections with stable IDs and readiness reasons derived from canonical project, stage, and approval data.
- [ ] The M001 brief and packet contract stay thin and truthful: current-state only, no fake approval history, and no new persisted placeholder artifact blobs.

## Verification

- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js`
- The tests assert dossier section IDs, packet readiness states, and missing-data reasons rather than only broad object snapshots.

## Observability Impact

- Signals added/changed: selected-project selector output now includes dossier sections, packet readiness, and current gate summaries as explicit inspectable state.
- How a future agent inspects this: selector-focused tests and direct inspection of `selectSelectedProjectDetail(state)` reveal whether the contract is ready before UI rendering starts.
- Failure state exposed: blocked gates, missing stage outputs, and packet sections that are not ready become inspectable with concrete reasons instead of disappearing into component conditionals.

## Inputs

- `src/lumon/model.js` — current canonical project, stage, and approval shapes that S04 must extend without creating a second project-detail model.
- `src/lumon/selectors.js` — existing selected-project projection that already owns pipeline, gate, and selected-stage truth.
- S03 forward intelligence: dossier work should consume selector outputs and persisted execution metadata instead of inventing dossier-local status summaries.

## Expected Output

- `src/lumon/model.js` / `src/lumon/selectors.js` — one canonical dossier and handoff packet contract with stable section IDs, thin-brief fields, and honest readiness states.
- `src/lumon/__tests__/lumon-state.test.js` — selector/state proof for dossier structure, approval summaries, and packet readiness behavior.
