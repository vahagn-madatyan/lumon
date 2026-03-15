---
estimated_steps: 5
estimated_files: 6
---

# T03: SSE push, client sync hook, and dashboard trigger/approve wiring

**Slice:** S01 — Bridge Server & Intake Stage
**Milestone:** M002

## Description

Close the client-server loop by adding SSE event streaming from the bridge server, a `useServerSync` hook that dispatches reducer actions from server events, and dashboard UI wiring for trigger and approve actions. After this task, the dashboard can trigger a pipeline run, receive real-time updates, and send approval decisions — all through the bridge server.

## Steps

1. Add SSE endpoint to `server/routes/pipeline.js`:
   - `GET /api/pipeline/events/:projectId` — opens an SSE stream, sends keepalive pings every 15s
   - Server stores active SSE connections per projectId
   - When pipeline state changes (callback received, approval processed), emit typed events to connected clients: `stage-update` (stage status + output changed), `artifact-ready` (new artifact stored), `pipeline-status` (overall pipeline status changed)
   - Each SSE event carries `{ projectId, stageKey, data }` payload
   - Clean up connections on client disconnect
2. Create `src/lumon/sync.js` — `useServerSync` hook:
   - Takes `{ projectId, dispatch }` (or uses context)
   - Opens EventSource to `/api/pipeline/events/:projectId`
   - On `stage-update`: dispatches `updateStage` with the received stageKey and changes (including structured output)
   - On `artifact-ready`: dispatches `updateStage` to set the artifact reference on the relevant stage
   - On `pipeline-status`: dispatches `updateProject` if overall pipeline status changed
   - Handles reconnection on disconnect (EventSource does this natively, add logging)
   - Returns `{ connected, lastEvent, error }` state for UI feedback
   - Exposes `triggerPipeline(projectId, stageKey)` and `approvePipeline(projectId, stageKey, decision)` functions that call the server REST API via fetch
3. Wire `useServerSync` into `src/lumon/context.jsx`:
   - Integrate the hook within LumonProvider so it's available to all surfaces
   - Expose trigger and approve actions through the existing actions context
4. Update `src/features/mission-control/DashboardTab.jsx`:
   - Add a "Trigger Discovery" button visible when the current stage is intake and status is queued
   - Add "Approve" and "Reject" buttons visible when the current stage has a pending approval gate
   - Buttons call the sync hook's trigger/approve functions
   - Show connection status indicator (connected/disconnected) in the dashboard header
   - Show loading state while trigger/approve API calls are in flight
5. Write `src/lumon/__tests__/server-sync.test.js`:
   - Test that `useServerSync` dispatches `updateStage` when receiving a mocked SSE `stage-update` event
   - Test that `triggerPipeline` calls the correct API endpoint
   - Test that `approvePipeline` calls the correct API endpoint with the decision
   - Test connection status state transitions (connected/disconnected/error)
   - Test that changing projectId closes the old EventSource and opens a new one

## Must-Haves

- [ ] SSE endpoint streams typed events to connected clients when pipeline state changes
- [ ] `useServerSync` dispatches correct reducer actions from SSE events
- [ ] Dashboard trigger button calls `POST /api/pipeline/trigger` for the selected project
- [ ] Dashboard approve/reject buttons call `POST /api/pipeline/approve` with the correct decision
- [ ] Connection status is visible in the dashboard
- [ ] Sync integration tests pass

## Verification

- `npx vitest run src/lumon/__tests__/server-sync.test.js` — sync hook tests pass
- `npx vitest run` — all existing tests still pass (no regressions)
- Manual: trigger button in browser fires API call and returns without error; SSE events update dashboard stage state in real time

## Observability Impact

- Signals added/changed: SSE connection/disconnect events logged server-side with projectId; client-side hook exposes `{ connected, lastEvent, error }` state
- How a future agent inspects this: connection status indicator visible in dashboard header; server logs show active SSE connections per project
- Failure state exposed: SSE disconnect triggers `error` state in hook; failed API calls surface error messages in UI

## Inputs

- `server/routes/pipeline.js` — T01's REST endpoints (trigger, callback, approve)
- `server/pipeline.js` — T01's pipeline execution state tracker
- `src/lumon/model.js` — T02's structured output helpers (`isStructuredOutput`, `getOutputSummary`)
- `src/lumon/reducer.js` — existing `updateStage` and `updateProject` actions
- `src/lumon/context.jsx` — existing LumonProvider and actions context

## Expected Output

- `server/routes/pipeline.js` — updated with SSE endpoint and event emission
- `src/lumon/sync.js` — new useServerSync hook with trigger/approve API wrappers
- `src/lumon/context.jsx` — updated to integrate server sync
- `src/features/mission-control/DashboardTab.jsx` — updated with trigger/approve buttons and connection status
- `src/lumon/__tests__/server-sync.test.js` — new test file for sync hook integration
