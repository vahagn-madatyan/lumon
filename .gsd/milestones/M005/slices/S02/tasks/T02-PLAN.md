---
estimated_steps: 5
estimated_files: 6
skills_used:
  - best-practices
  - test
  - react-best-practices
---

# T02: Add client state model, reducer, selectors, SSE sync, and context actions

**Slice:** S02 — Confirmation-Gated Domain Actions
**Milestone:** M005

## Description

Wire the client-side state management for external actions across all layers: model normalizer, reducer action types, selector view models, SSE event listeners, and context action helpers. This follows the exact patterns established by `provisioning` (model + reducer + sync + context) and `buildExecution` (model + reducer + selectors + sync + context). Every layer has an existing, proven pattern to follow — the work is structural, not creative.

## Steps

1. **Add `normalizeExternalActionsState()` to `src/lumon/model.js`** and add `externalActions` to the project shape in `createProject()`.
   
   ```js
   const DEFAULT_EXTERNAL_ACTIONS_STATE = Object.freeze({
     actions: [],
   });
   
   export function normalizeExternalActionsState(input) {
     if (!input || typeof input !== "object") {
       return { ...DEFAULT_EXTERNAL_ACTIONS_STATE };
     }
     return {
       actions: Array.isArray(input.actions) ? [...input.actions] : [],
     };
   }
   ```
   
   Add `externalActions: normalizeExternalActionsState(input.externalActions)` to `createProject()` return object (after `buildExecution` on ~line 978). Export the normalizer for use in tests.

2. **Add 5 reducer action types to `src/lumon/reducer.js`**:
   - `lumon/request-external-action` — adds action to `project.externalActions.actions[]`
   - `lumon/confirm-external-action` — finds action by `actionId`, updates status to `'confirmed'`, sets `confirmedAt`
   - `lumon/complete-external-action` — updates status to `'completed'`, sets result and `completedAt`
   - `lumon/fail-external-action` — updates status to `'failed'`, sets error
   - `lumon/cancel-external-action` — updates status to `'cancelled'`
   
   Each action finds the project by `projectId`, finds the action within `externalActions.actions[]` by `actionId`, applies the status change, and calls `touchProject()` with `externalActions` changes. Follow the `updateProvisioning` pattern — find project, merge changes, rebuild via `touchProject()`. Add action types to `lumonActionTypes` object and action creators to `lumonActions` object.

3. **Add external actions view model to `src/lumon/selectors.js`** — integrate into `buildProjectViewModel()`:
   
   Status metadata map:
   ```js
   const EXTERNAL_ACTION_STATUS_META = {
     pending:    { label: "Pending confirmation", tone: "waiting" },
     confirmed:  { label: "Confirmed",            tone: "running" },
     executing:  { label: "Executing…",           tone: "running" },
     completed:  { label: "Completed",            tone: "complete" },
     failed:     { label: "Failed",               tone: "failed" },
     cancelled:  { label: "Cancelled",            tone: "idle" },
   };
   ```
   
   Per-action view model:
   ```js
   { id, type, params, status, statusLabel, statusTone, domainLabel, requestedAt, confirmedAt, completedAt, result, error, canConfirm, canCancel, canExecute }
   ```
   
   Aggregate view model added to `buildProjectViewModel()` return:
   ```js
   externalActions: {
     actions: [...],
     pendingCount, confirmedCount, completedCount, failedCount,
     hasPending, hasConfirmed, hasActions,
   }
   ```

4. **Add 5 SSE event listeners to `src/lumon/sync.js`** — following the provisioning-progress/complete/error pattern:
   - `external-action-requested` → dispatch `lumon/request-external-action` with `{ projectId, action: { id, type, params, status: 'pending', requestedAt } }`
   - `external-action-confirmed` → dispatch `lumon/confirm-external-action` with `{ projectId, actionId, confirmedAt }`
   - `external-action-completed` → dispatch `lumon/complete-external-action` with `{ projectId, actionId, result, completedAt }`
   - `external-action-failed` → dispatch `lumon/fail-external-action` with `{ projectId, actionId, error }`
   - `external-action-cancelled` → dispatch `lumon/cancel-external-action` with `{ projectId, actionId }`
   
   Add these listeners inside the `useEffect` that sets up the EventSource, after the existing build escalation listeners.

5. **Add 4 REST action helpers to `src/lumon/context.jsx`** — following the `previewProvisioning`/`executeProvisioning` pattern:
   - `requestExternalAction(projectId, type, params)` — POST `/api/external-actions/request`
   - `confirmExternalAction(projectId, actionId)` — POST `/api/external-actions/confirm/${actionId}`
   - `cancelExternalAction(projectId, actionId)` — POST `/api/external-actions/cancel/${actionId}`
   - `executeExternalAction(projectId, actionId)` — POST `/api/external-actions/execute/${actionId}`
   
   Each function follows the fire-and-forget pattern: make the REST call, let SSE events drive state updates. Return the response data or `{ error }` on failure. Add to the `actions` object in the `useMemo` block.

6. **Write contract tests in `src/lumon/__tests__/external-actions-state.test.js`**:
   - `normalizeExternalActionsState(undefined)` returns default empty state
   - `normalizeExternalActionsState(null)` returns default empty state
   - `normalizeExternalActionsState({ actions: [...] })` preserves valid actions
   - `createProject()` with `externalActions` includes normalized state
   - `createProject()` without `externalActions` includes default empty state
   - Reducer: `lumon/request-external-action` adds action to project
   - Reducer: `lumon/confirm-external-action` updates status and sets confirmedAt
   - Reducer: `lumon/complete-external-action` updates status, sets result and completedAt
   - Reducer: `lumon/fail-external-action` updates status and sets error
   - Reducer: `lumon/cancel-external-action` updates status to cancelled
   - Reducer: action for nonexistent projectId returns unchanged state
   - Selector: view model includes correct status labels and tones
   - Selector: boolean helpers (canConfirm, canCancel, canExecute) correct per status
   - Selector: aggregate counts (pendingCount, etc.) correct

## Must-Haves

- [ ] `normalizeExternalActionsState(undefined)` returns `{ actions: [] }` — backward compatibility for existing projects
- [ ] All 5 reducer action types find the correct project and action, apply changes, and call `touchProject()`
- [ ] Selector view model includes `statusLabel`, `statusTone`, `canConfirm`, `canCancel`, `canExecute` per action status
- [ ] SSE event listeners parse payload, extract projectId + action data, dispatch matching reducer action
- [ ] Context helpers POST to the correct REST endpoints from T01
- [ ] No new imports break existing module loading

## Verification

- `npx vitest run src/lumon/__tests__/external-actions-state.test.js` — all contract tests pass
- `npx vitest run` — full suite regression, 706+ passed, 0 failures

## Inputs

- `src/lumon/model.js` — add normalizer alongside existing `normalizeProvisioningState()`, `normalizeBuildExecutionState()`
- `src/lumon/reducer.js` — add action types alongside existing provisioning/build action types
- `src/lumon/selectors.js` — add view model builder alongside existing `buildBuildExecutionViewModel()`
- `src/lumon/sync.js` — add SSE listeners alongside existing provisioning/build listeners
- `src/lumon/context.jsx` — add action helpers alongside existing provisioning/build helpers
- `server/routes/external-actions.js` — the REST API endpoints this task's context helpers call (created in T01)

## Expected Output

- `src/lumon/model.js` — modified with `normalizeExternalActionsState()` and `externalActions` on project shape
- `src/lumon/reducer.js` — modified with 5 new action types for external action lifecycle
- `src/lumon/selectors.js` — modified with external actions view model in `buildProjectViewModel()`
- `src/lumon/sync.js` — modified with 5 SSE event listeners for external action events
- `src/lumon/context.jsx` — modified with 4 REST action helpers for external actions
- `src/lumon/__tests__/external-actions-state.test.js` — new contract test file
