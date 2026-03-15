---
id: T01
parent: S05
milestone: M001
provides:
  - Floor selector diagnostics derived from canonical project pipeline view models
  - Per-department diagnostics object with pipeline status, stage, gate, approval, and boolean flags
  - Selected project diagnostics exposed at floor root level
  - Pipeline-category summary counts (runningPipelineCount, completePipelineCount, queuedPipelineCount)
  - Expanded test coverage for floor presence, room sizing, and diagnostics contract
key_files:
  - src/lumon/selectors.js
  - src/lumon/__tests__/lumon-state.test.js
key_decisions:
  - Added buildFloorDiagnostics() as a canonical extraction point for per-department pipeline truth rather than scattering pipeline fields across the floor view model
  - Exposed selectedProjectDiagnostics at the selectFloorViewModel root for direct inspection without navigating into selectedProject
  - Added pipeline-category summary counts (runningPipelineCount, completePipelineCount, queuedPipelineCount) alongside existing waitingCount/blockedCount/handoffReadyCount
patterns_established:
  - Floor departments carry a .diagnostics object that mirrors canonical dashboard pipeline truth — downstream presentational code reads diagnostics instead of re-deriving pipeline state
observability_surfaces:
  - selectFloorViewModel(state).selectedProjectDiagnostics — direct inspection of selected project pipeline diagnostics
  - selectFloorViewModel(state).departments[n].diagnostics — per-department pipeline status, stage, gate, approval, and boolean flags
  - selectFloorViewModel(state).summary.{runningPipelineCount,completePipelineCount,queuedPipelineCount} — pipeline-category counts
duration: 15m
verification_result: passed
completed_at: 2026-03-15
blocker_discovered: false
---

# T01: Canonicalize the floor selector around project pipeline truth

**Added `buildFloorDiagnostics()` and per-department/selected-project diagnostics derived from canonical project pipeline view models, with expanded test coverage proving waiting/blocked/handoff-ready/running floor contracts match dashboard truth.**

## What Happened

The floor selector already derived departments from `buildProjectListViewModels()` — the same canonical path the dashboard uses. The drift seam was that the floor lacked a consolidated diagnostics surface, forcing downstream code to reconstruct pipeline truth from scattered fields or raw project/agent inference.

Added `buildFloorDiagnostics(project)` which extracts a structured diagnostics object per department containing: pipelineStatus, pipelineLabel, pipelineSummary, pipelineTone, currentStageKey/Label/Status/Tone, currentGateId/Label, currentApprovalState/Label/Summary/Note, progressPercent, completedCount, totalCount, handoffReady, and boolean flags (waiting, blocked, running, complete). This object is attached to each floor department and surfaced as `selectedProjectDiagnostics` at the floor view model root.

Also added `runningPipelineCount`, `completePipelineCount`, and `queuedPipelineCount` to the floor summary for pipeline-category counting alongside the existing waiting/blocked/handoffReady counts.

Expanded tests with two new cases: one proving per-department diagnostics match dashboard pipeline truth across all four pipeline states, and one proving floor presence metadata and room sizing for approval-waiting, blocked, and handoff-ready projects remain visible even with no desk agents.

## Verification

- `npx vitest run src/lumon/__tests__/lumon-state.test.js` — 10/10 tests pass (8 existing + 2 new)
- `npx eslint src/lumon/selectors.js src/severance-floor.jsx src/features/mission-control/__tests__/severance-floor-live-state.test.jsx` — clean
- `npm run build` — clean
- `npx vitest run src/features/mission-control/__tests__/severance-floor-live-state.test.jsx` — fails (expected, T02 rendering work needed)

## Diagnostics

- `selectFloorViewModel(state)` exposes `.selectedProjectDiagnostics` and `.departments[n].diagnostics` for direct inspection
- Each diagnostics object includes boolean flags (`waiting`, `blocked`, `running`, `complete`) for quick conditional checks
- Summary counts at `.summary.{waitingCount,blockedCount,handoffReadyCount,runningPipelineCount,completePipelineCount,queuedPipelineCount}` provide aggregate pipeline-state visibility

## Deviations

None. The floor selector was already deriving from canonical project view models — the work was adding the structured diagnostics surface and expanding test coverage rather than rebuilding the derivation path.

## Known Issues

- `severance-floor-live-state.test.jsx` fails because the `SeveranceFloor` component doesn't yet read pipeline diagnostics from the selector. This is T02 work.

## Files Created/Modified

- `src/lumon/selectors.js` — Added `buildFloorDiagnostics()`, attached `.diagnostics` to each floor department, added `selectedProjectDiagnostics` to floor view model root, added pipeline-category summary counts
- `src/lumon/__tests__/lumon-state.test.js` — Added two tests: per-department diagnostics contract proof and floor presence/room sizing for non-running active projects
