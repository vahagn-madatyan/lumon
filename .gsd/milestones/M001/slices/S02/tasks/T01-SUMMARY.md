---
id: T01
parent: S02
milestone: M001
provides:
  - Versioned Lumon registry persistence and selection-safe canonical project CRUD
key_files:
  - src/lumon/persistence.js
  - src/lumon/model.js
  - src/lumon/reducer.js
  - src/lumon/context.jsx
  - src/lumon/__tests__/lumon-state.test.js
  - src/lumon/__tests__/lumon-persistence.test.js
key_decisions:
  - Persist canonical Lumon state at the provider boundary via an effect instead of reducer side effects.
  - Reconcile selection tuples against project, agent, and stage ownership on hydration and every CRUD transition.
patterns_established:
  - Initialization precedence is explicit: initialState -> persisted registry -> seeded demo state.
  - Persisted empty registries are treated as valid canonical state, not a signal to reseed demo projects.
observability_surfaces:
  - Browser localStorage key `lumon.registry.v1`
  - `src/lumon/__tests__/lumon-persistence.test.js`
  - `src/lumon/__tests__/lumon-state.test.js`
duration: 0.9h
verification_result: passed
completed_at: 2026-03-14T09:30:04-07:00
blocker_discovered: false
---

# T01: Add versioned Lumon registry persistence and selection-safe project CRUD

**Confirmed the Lumon spine now owns versioned registry persistence, canonical project timestamps/engine identity, and selection-safe project CRUD, then advanced slice bookkeeping after focused and runtime verification.**

## What Happened

I inspected the canonical Lumon model, reducer, provider, seed state, persistence adapter, and tests against the T01 plan. The runtime code already satisfied the task contract: `src/lumon/persistence.js` stores a versioned `lumon.registry.v1` envelope with safe storage detection and corrupt-envelope fallback; `src/lumon/model.js` and `src/lumon/seed.js` carry canonical `engineChoice`, `createdAt`, and `updatedAt` fields plus shared selection reconciliation; `src/lumon/reducer.js` exposes canonical `addProject`, `updateProject`, and `removeProject` flows; and `src/lumon/context.jsx` restores in `initialState -> persisted registry -> seed` order while persisting from an effect.

Because the implementation was already present, this unit’s work was verification-led rather than code-authoring-led: I ran the focused reducer/persistence tests, checked lint/build status, verified the versioned localStorage envelope and selected-project restore surface in the browser, then marked T01 complete in the slice records.

## Verification

- Passed: `npm run test -- --run src/lumon/__tests__/lumon-state.test.js src/lumon/__tests__/lumon-persistence.test.js`
- Passed: `npx eslint src/lumon src/test/setup.js`
- Passed: `npm run test -- --run src/features/mission-control/__tests__/project-registry.test.jsx` (current status is a single `it.todo`, so no failing assertions yet)
- Passed: `npx eslint src/mission-control.jsx src/lumon src/features/mission-control`
- Passed: `npm run build`
- Runtime/browser check passed on preview (port `4175`, because `4174` was already occupied):
  - selected seed project `Wheely` rendered from canonical state
  - `window.localStorage['lumon.registry.v1']` contained `{ kind: 'lumon-registry', version: 1, projectCount: 14, selection: { projectId: 'wheely', agentId: null, stageId: null } }`
  - `browser_assert` passed for rendered text, zero console errors, and zero failed requests
- Observability contract confirmed directly:
  - named persistence/state tests cover selection reconciliation, storage round-trip, empty-registry restore, storage-unavailable fallback, and `initialState` precedence
  - the versioned browser storage envelope is inspectable at `lumon.registry.v1`

## Diagnostics

- Run `npm run test -- --run src/lumon/__tests__/lumon-state.test.js src/lumon/__tests__/lumon-persistence.test.js` to inspect the named restore/selection diagnostics.
- Inspect `window.localStorage.getItem('lumon.registry.v1')` in the browser to confirm the persisted envelope shape and selected tuple.
- Use the persisted envelope plus the focused tests to diagnose corrupt storage, write-denied storage, or stale selection tuples.

## Deviations

- No runtime-plan deviations. The only difference from the written verification URL was using preview port `4175` because `4174` was already in use locally.

## Known Issues

- T02 remains outstanding: `src/features/mission-control/__tests__/project-registry.test.jsx` is still a placeholder `it.todo`, and the slice’s end-to-end create-project/reload UI proof has not been completed yet.

## Files Created/Modified

- `src/lumon/persistence.js` — versioned local registry adapter with safe availability/load/save behavior.
- `src/lumon/model.js` — canonical project engine/timestamp fields and shared selection reconciliation.
- `src/lumon/seed.js` — seed projects stamped with canonical engine/timestamp metadata.
- `src/lumon/reducer.js` — reducer-backed canonical project CRUD and timestamp-safe mutations.
- `src/lumon/context.jsx` — provider initialization precedence and effect-driven persistence writes.
- `src/lumon/__tests__/lumon-state.test.js` — CRUD and selection reconciliation coverage.
- `src/lumon/__tests__/lumon-persistence.test.js` — persistence round-trip and fallback coverage.
- `src/test/setup.js` — deterministic test-local storage cleanup.
- `.gsd/milestones/M001/slices/S02/tasks/T01-SUMMARY.md` — task execution summary.
- `.gsd/milestones/M001/slices/S02/S02-PLAN.md` — T01 marked complete.
- `.gsd/STATE.md` — next action advanced to T02.
