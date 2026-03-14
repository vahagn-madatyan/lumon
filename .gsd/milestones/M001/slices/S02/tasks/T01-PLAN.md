---
estimated_steps: 5
estimated_files: 8
---

# T01: Add versioned Lumon registry persistence and selection-safe project CRUD

**Slice:** S02 — Project registry and persistence
**Milestone:** M001

## Description

Build the persistence boundary inside the canonical Lumon state spine before rewiring any UI. This task adds the replaceable local registry adapter, makes project engine choice and timestamps part of the canonical model, and hardens create/update/remove/restore so persisted selection cannot drift across projects.

## Steps

1. Add `src/lumon/persistence.js` with a versioned storage key/envelope, storage-availability detection, safe load/save helpers, and corrupt-envelope fallback behavior.
2. Extend `createProject()` / `createLumonState()` and seed data with project-level `engineChoice`, `createdAt`, `updatedAt`, plus a shared selection-reconciliation helper that validates `projectId`, `agentId`, and `stageId` together.
3. Add reducer-backed `addProject`, `updateProject`, and `removeProject` actions that use canonical constructors/timestamp updates instead of ad hoc object merges.
4. Update `LumonProvider` so initialization order is explicit `initialState` → persisted registry → seed state, and persist canonical state changes from an effect so Strict Mode double-invocation does not create impure reducer behavior.
5. Add/expand state tests to cover CRUD transitions, persistence round-trip, empty-registry restore, storage-unavailable fallback, and `initialState` precedence, with test-local storage cleanup in `src/test/setup.js`.

## Must-Haves

- [ ] Project-level `engineChoice` and stable timestamps are canonical project data, not UI-local form state.
- [ ] Restore, create, update, and remove paths cannot leave invalid `projectId`/`agentId`/`stageId` combinations behind.
- [ ] Persisted empty registries remain empty after reload instead of silently reseeding demo projects.

## Verification

- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js src/lumon/__tests__/lumon-persistence.test.js`
- Confirm the focused tests assert `initialState` precedence, storage round-trip, selection reconciliation, and empty-registry persistence.

## Observability Impact

- Signals added/changed: a versioned storage envelope and named persistence/selection tests become the primary restore diagnostics.
- How a future agent inspects this: run the focused Vitest command or inspect the persisted registry key in browser localStorage.
- Failure state exposed: corrupt storage, write-denied storage, or stale selection tuples fall back safely and fail in named tests instead of producing cross-surface mismatch.

## Inputs

- `src/lumon/model.js` — canonical project/state constructors from S01.
- `src/lumon/reducer.js` — current shared mutation boundary that needs project CRUD.
- `src/lumon/context.jsx` — provider initializer where persisted restore/save must be introduced.
- S01 forward intelligence — extend the existing reducer/context/selectors instead of creating a second registry path.

## Expected Output

- `src/lumon/persistence.js` — versioned local registry adapter with safe load/save helpers.
- `src/lumon/model.js`, `src/lumon/seed.js`, `src/lumon/reducer.js`, `src/lumon/context.jsx` — persistence-ready canonical model and actions.
- `src/lumon/__tests__/lumon-state.test.js`, `src/lumon/__tests__/lumon-persistence.test.js`, `src/test/setup.js` — executable proof and deterministic test isolation for persistence behavior.
