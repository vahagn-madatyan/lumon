---
estimated_steps: 5
estimated_files: 6
---

# T03: Extend client state to track provisioning lifecycle

**Slice:** S01 — Provisioning Service & Handoff Controls
**Milestone:** M003

## Description

Extend the Lumon client state spine (`src/lumon/*`) to track provisioning lifecycle per project. This requires changes to 5 existing modules — model, reducer, selectors, sync, and context — following the established patterns for project state management. The provisioning state must persist through the localStorage envelope so it survives page reload.

The provisioning state shape tracks the full lifecycle: `idle → previewing → confirming → provisioning → complete|failed`. Each state transition is driven by reducer dispatch, either from explicit UI actions or from SSE events received through the sync hook.

**Key patterns to follow:**
- `src/lumon/model.js` — `createProject()` pattern for adding and normalizing new fields
- `src/lumon/reducer.js` — `lumonActionTypes`, `lumonActions`, and `lumonReducer` switch-case pattern
- `src/lumon/selectors.js` — `buildHandoffPacket`, `buildProjectDetailContract` patterns
- `src/lumon/sync.js` — `useServerSync` SSE event listener pattern
- `src/lumon/context.jsx` — `useLumonActions` action helper pattern

## Steps

1. **Extend `model.js` with provisioning state.** Add a `provisioning` field to `createProject()` that initializes from input or defaults to `{ status: 'idle', repoUrl: null, workspacePath: null, error: null, steps: [], previewPlan: null }`. The `status` field uses values: `'idle'`, `'previewing'`, `'confirming'`, `'provisioning'`, `'complete'`, `'failed'`. Ensure provisioning state round-trips through `createProject()` (input → normalized → output) so it persists through the localStorage envelope. Add `normalizeProvisioningState(input)` helper that coerces invalid/missing values to the default shape.

2. **Extend `reducer.js` with provisioning actions.** Add `updateProvisioning: 'lumon/update-provisioning'` to `lumonActionTypes`. Add `updateProvisioning(projectId, changes)` to `lumonActions`. Handle `lumon/update-provisioning` in the reducer switch-case: find the project by projectId, merge `changes` into `project.provisioning` (shallow merge, preserving unset fields), touch the project `updatedAt`, and rebuild state. The `changes` object can include any subset of the provisioning shape: `{ status, repoUrl, workspacePath, error, steps, previewPlan }`.

3. **Extend `selectors.js` to surface provisioning state.** In `buildProjectViewModel`, include `provisioning` from the project model directly on the view model. In `buildHandoffPacket`, add a `provisioning` field that exposes `{ status, repoUrl, workspacePath, error, provisioningReady }` where `provisioningReady` is `true` when `pipeline.readyForHandoff && provisioning.status === 'idle'`. In `buildProjectDetailContract`, include the provisioning state alongside the existing dossier and handoff packet.

4. **Extend `sync.js` with provisioning SSE event handlers.** In the `useServerSync` hook, add listeners for three new SSE event types: `provisioning-progress` (dispatches `lumon/update-provisioning` with step-level updates), `provisioning-complete` (dispatches with `status: 'complete'`, `repoUrl`, `workspacePath`), `provisioning-error` (dispatches with `status: 'failed'`, `error`). Follow the exact pattern of the existing `stage-update` and `artifact-ready` listeners. In `context.jsx`, add `previewProvisioning(projectId)` and `executeProvisioning(projectId, options)` action helpers that call the REST endpoints (`/api/provisioning/preview` and `/api/provisioning/execute`) and dispatch state updates. Also add `updateProvisioning(projectId, changes)` as a direct dispatch helper.

5. **Write tests.** Create `src/lumon/__tests__/provisioning-state.test.js` testing:
   - `createProject()` initializes provisioning with default idle state
   - `createProject()` with explicit provisioning input preserves the values
   - Reducer handles `lumon/update-provisioning` and merges changes correctly
   - Reducer `lumon/update-provisioning` with unknown projectId is a no-op
   - `buildProjectViewModel` includes provisioning state
   - `buildHandoffPacket` includes `provisioningReady` derived from pipeline + provisioning status
   - Provisioning state survives full `createLumonState()` round-trip (proves persistence)
   - SSE dispatches can be simulated through direct reducer calls

## Must-Haves

- [ ] `createProject()` initializes provisioning default state
- [ ] `lumon/update-provisioning` reducer action merges provisioning changes on the correct project
- [ ] Selectors surface provisioning state in handoff packet with `provisioningReady` boolean
- [ ] SSE sync hook handles `provisioning-progress`, `provisioning-complete`, `provisioning-error` events
- [ ] `previewProvisioning()` and `executeProvisioning()` action helpers call REST endpoints
- [ ] Provisioning state persists through localStorage envelope (round-trips through `createProject`)
- [ ] All tests pass

## Verification

- `npx vitest run src/lumon/__tests__/provisioning-state.test.js` — all provisioning state tests pass
- `npx vitest run` — all existing client tests still pass (model/reducer/selector changes don't break anything)
- Provisioning state flows: model → reducer → selectors → view models
- `provisioningReady` is `true` only when `handoff_ready` AND `provisioning.status === 'idle'`

## Inputs

- `src/lumon/model.js` — `createProject()`, `createLumonState()` patterns
- `src/lumon/reducer.js` — `lumonActionTypes`, `lumonActions`, `lumonReducer` patterns
- `src/lumon/selectors.js` — `buildProjectViewModel`, `buildHandoffPacket`, `buildProjectDetailContract` patterns
- `src/lumon/sync.js` — `useServerSync` SSE event listener patterns
- `src/lumon/context.jsx` — `useLumonActions` action helper patterns
- T01/T02 REST endpoints: `POST /api/provisioning/preview`, `POST /api/provisioning/execute`

## Expected Output

- `src/lumon/model.js` — updated with provisioning state in `createProject()` (~15 lines added)
- `src/lumon/reducer.js` — updated with `lumon/update-provisioning` action (~20 lines added)
- `src/lumon/selectors.js` — updated with provisioning in view models and handoff packet (~15 lines added)
- `src/lumon/sync.js` — updated with 3 SSE event listeners (~30 lines added)
- `src/lumon/context.jsx` — updated with provisioning action helpers (~20 lines added)
- `src/lumon/__tests__/provisioning-state.test.js` — new test file (~150-200 lines)
