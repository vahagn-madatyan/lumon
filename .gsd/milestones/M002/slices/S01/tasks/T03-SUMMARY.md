---
id: T03
parent: S01
milestone: M002
provides:
  - "SSE endpoint at GET /api/pipeline/events/:projectId streams typed events (stage-update, artifact-ready, pipeline-status) to connected clients"
  - "useServerSync hook bridges server SSE events to client reducer dispatch with triggerPipeline and approvePipeline API wrappers"
  - "Dashboard exposes trigger and approve/reject buttons wired through LumonProvider actions context"
  - "Connection status indicator (connected/disconnected) visible in dashboard header"
key_files:
  - server/routes/pipeline.js
  - src/lumon/sync.js
  - src/lumon/context.jsx
  - src/features/mission-control/DashboardTab.jsx
  - src/lumon/__tests__/server-sync.test.js
  - src/test/setup.js
key_decisions:
  - "SSE connections stored per-projectId in a Map<string, Set<Response>> — simple, no external deps, cleaned up on client disconnect"
  - "emitSSE called inline in trigger/callback/approve handlers rather than through an event bus — direct and auditable for this scale"
  - "useServerSync constructs stageId from projectId:stageKey to match the canonical stage ID convention in the reducer"
  - "Trigger/approve functions exposed through LumonProvider actions context (not a separate sync context) so existing action consumers get them for free"
  - "EventSource stub added to test setup.js for jsdom since EventSource is not available in jsdom — tests that need real behavior mock it themselves"
patterns_established:
  - "[sync] log prefix for client-side SSE connection lifecycle (connect, disconnect, close, error)"
  - "PipelineActions component conditionally renders trigger/approve/reject buttons based on current stage status and approval gate state"
  - "ConnectionStatusIndicator reads from ServerSyncContext to show live connection state"
observability_surfaces:
  - "Server logs SSE connect/disconnect with projectId and client count: [bridge] SSE connect/disconnect projectId=X clients=N"
  - "Server logs SSE event emissions: [bridge] SSE emit event=TYPE projectId=X clients=N"
  - "Client hook exposes { connected, lastEvent, error } for UI feedback and debugging"
  - "data-testid='sync-connection-status' element shows live SSE state in dashboard"
  - "data-testid='pipeline-actions' container with trigger-discovery-btn, approve-btn, reject-btn"
duration: 30m
verification_result: passed
completed_at: 2026-03-15
blocker_discovered: false
---

# T03: SSE push, client sync hook, and dashboard trigger/approve wiring

**Closed the client-server loop with SSE event streaming, a useServerSync hook dispatching reducer actions from server events, and dashboard trigger/approve buttons wired to the bridge API.**

## What Happened

Added SSE endpoint to the pipeline router that streams typed events (`stage-update`, `artifact-ready`, `pipeline-status`) to connected clients per projectId with 15s keepalive pings. The `emitSSE` helper is called inline in the trigger, callback, and approve handlers so events fire immediately when pipeline state changes.

Created `useServerSync` hook that opens an EventSource to the SSE endpoint for the selected project, dispatches `updateStage` and `updateProject` actions from server events, handles reconnection (EventSource native), and exposes `{ connected, lastEvent, error }` state. The hook also provides `triggerPipeline` and `approvePipeline` async functions that call the REST API via fetch.

Integrated the hook into LumonProvider — it auto-connects to the selected project's SSE stream. Trigger and approve functions are exposed through the existing actions context so they're available to all surfaces without a new provider.

Dashboard now shows: a ConnectionStatusIndicator in the header (wifi icon + "Connected"/"Disconnected"), and a PipelineActions component that conditionally renders "Trigger Discovery" (when intake is queued), "Approve", and "Reject" buttons (when the current stage has a pending required approval gate). Buttons show loading spinners during API calls.

Added a no-op EventSource stub to the jsdom test setup since EventSource doesn't exist in jsdom — the sync hook tests mock it with a full MockEventSource class.

## Verification

- `npx vitest run src/lumon/__tests__/server-sync.test.js` — 8 tests pass (stage-update dispatch, artifact-ready dispatch, pipeline-status dispatch, triggerPipeline API call, approvePipeline API call, connection status transitions, projectId change closes old/opens new EventSource, null projectId skips connection)
- `npx vitest run` — all 75 tests pass (0 regressions)
- `npx vite build` — production build succeeds
- Manual SSE verification: curl confirmed `connected` event on stream open, `pipeline-status` on trigger, `stage-update` + `artifact-ready` on callback, `pipeline-status` on approve
- Browser verification: dashboard renders with "Connected" indicator visible, connection status element confirmed via `browser_assert`

### Slice-level verification status

- `npx vitest run` — ✅ all 75 tests pass
- `server/__tests__/pipeline-api.test.js` — ✅ passes (T01)
- `src/lumon/__tests__/artifact-output.test.js` — ✅ passes (T02)
- `src/lumon/__tests__/server-sync.test.js` — ✅ passes (T03)
- Manual UAT: trigger→n8n→artifact→approve — ⏳ pending T04 (requires live n8n instance)

## Diagnostics

- SSE connection state: `data-testid='sync-connection-status'` in dashboard header shows "Connected" or "Disconnected"
- Server-side SSE tracking: `[bridge] SSE connect projectId=X clients=N` / `[bridge] SSE disconnect projectId=X remaining=N` in server logs
- SSE event emission: `[bridge] SSE emit event=stage-update projectId=X clients=N` logged on every emission
- Client-side: `[sync] SSE connected/closed/error projectId=X` in browser console
- Pipeline actions: `data-testid='trigger-discovery-btn'`, `data-testid='approve-btn'`, `data-testid='reject-btn'` — conditionally rendered based on stage state

## Deviations

None. Implementation follows the task plan.

## Known Issues

None.

## Files Created/Modified

- `server/routes/pipeline.js` — Added SSE endpoint, `sseClients` registry, `emitSSE` helper, and SSE emissions in trigger/callback/approve handlers
- `src/lumon/sync.js` — New `useServerSync` hook with EventSource subscription, reducer dispatch, and trigger/approve API wrappers
- `src/lumon/context.jsx` — Integrated `useServerSync` into LumonProvider, exposed trigger/approve through actions context, added `ServerSyncContext` and `useServerSyncStatus` hook
- `src/features/mission-control/DashboardTab.jsx` — Added `ConnectionStatusIndicator`, `PipelineActions` components with trigger/approve/reject buttons and loading states
- `src/lumon/__tests__/server-sync.test.js` — New test file with 8 integration tests for the sync hook
- `src/test/setup.js` — Added no-op EventSource stub for jsdom test environment
