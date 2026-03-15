---
estimated_steps: 4
estimated_files: 6
---

# T01: Canonicalize the intake pipeline and approval contract

**Slice:** S03 — Pipeline board and approval model
**Milestone:** M001

## Description

Move Lumon’s pre-build pipeline contract fully into `src/lumon/*` so seeded projects, persisted projects, and operator-created projects all share the same explicit intake-to-handoff stages, approval states, and current-stage reconciliation rules.

## Steps

1. Add canonical pre-build stage and approval helpers in `src/lumon/model.js` (or the closest shared lumon seam) with stable identifiers, gate metadata, and approval-state normalization for pending, approved, rejected, and needs-iteration flows.
2. Replace shell-local default stage construction in `src/features/mission-control/MissionControlShell.jsx` with canonical project-spawn helpers, and align seeded/fallback pipeline creation in `src/lumon/seed.js` to the same taxonomy.
3. Extend reducer updates in `src/lumon/reducer.js` so stage and approval changes keep `currentStageId`, project phase/progression, and persisted selection coherent instead of trusting stale execution status.
4. Expand lumon contract tests to prove canonical stage creation, approval-aware transitions, and persistence round-trip compatibility for the shared pipeline model.

## Must-Haves

- [ ] Seeded projects and newly created projects use the same explicit intake-to-handoff taxonomy with stable stage/gate IDs.
- [ ] Reducer and persistence behavior preserve approval state and current-stage truth across updates and reload.

## Verification

- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js src/lumon/__tests__/lumon-persistence.test.js`
- The tests assert gate-aware progression, rejected/needs-iteration behavior, and reload-safe persistence rather than only raw object creation.

## Observability Impact

- Signals added/changed: canonical current-stage/current-gate derivation and approval-aware project status become explicit selector/reducer-visible state instead of implicit agent-only inference.
- How a future agent inspects this: reducer/selector tests plus `window.localStorage['lumon.registry.v1']` reveal stage IDs, approval state, and reconciliation after reload.
- Failure state exposed: stuck pending approvals, rejected stages, and mismatched `currentStageId` become inspectable without opening React Flow.

## Inputs

- `src/lumon/model.js` — canonical constructors from S01/S02 that already own project, execution, stage, and approval shapes.
- `src/lumon/reducer.js` — existing `updateStage` seam and selection reconciliation boundary that S03 must extend instead of bypassing.
- `src/lumon/seed.js` — current mixed demo/generated pipeline definitions that need one stable taxonomy.
- `src/features/mission-control/MissionControlShell.jsx` — current drift point where new projects still invent stages in the UI layer.
- S02 forward intelligence: persisted project identity and empty-registry behavior are stable; later stage work must attach to that path, not create a second registry contract.

## Expected Output

- `src/lumon/model.js` / `src/lumon/reducer.js` / `src/lumon/seed.js` — one canonical, approval-aware pre-build pipeline contract with stable IDs and progression rules.
- `src/features/mission-control/MissionControlShell.jsx` — new projects spawned from the shared pipeline factory instead of shell-local stage arrays.
- `src/lumon/__tests__/lumon-state.test.js` / `src/lumon/__tests__/lumon-persistence.test.js` — proof that the contract survives updates and reload.
