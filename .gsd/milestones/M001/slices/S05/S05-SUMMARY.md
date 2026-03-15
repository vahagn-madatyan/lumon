---
id: S05
parent: M001
milestone: M001
provides:
  - Pipeline-aware floor projection derived from canonical project view models
  - Per-department diagnostics object with pipeline status, stage, gate, approval, and boolean flags
  - Selected-project diagnostics exposed at floor view model root
  - Pipeline-category summary counts (runningPipelineCount, completePipelineCount, queuedPipelineCount)
  - Pipeline-aware department room tones (border/background keyed by diagnostics status)
  - PersistentShellIndicator for inspectable departments with zero desk agents
  - Stable data-testid surfaces for floor diagnostics, summary strip, and selected-project panel
  - 7 rendered live-state integration tests proving dashboard↔floor synchronization
requires:
  - slice: S01
    provides: Canonical Lumon domain model and shared selectors
  - slice: S02
    provides: Persisted project registry and engine identity
  - slice: S03
    provides: Scene-friendly project and agent summary selectors, per-project visual status contract
affects:
  - S06
key_files:
  - src/lumon/selectors.js
  - src/lumon/__tests__/lumon-state.test.js
  - src/severance-floor.jsx
  - src/features/mission-control/__tests__/severance-floor-live-state.test.jsx
key_decisions:
  - D021 — Pipeline-owned floor presence: departments and selected-project diagnostics derive from canonical project pipeline view models, mapping pipeline states to floor presentation at the project layer while leaving agent status unchanged
patterns_established:
  - Floor departments carry a .diagnostics object that mirrors canonical dashboard pipeline truth — downstream presentational code reads diagnostics instead of re-deriving pipeline state
  - Department rooms visually encode pipeline state through border/background tone and the overhead fluorescent strip inherits the diagnostics color, keeping the Lumon atmosphere while exposing pipeline truth
  - Persistent shell indicators appear when a department has presence.persistentShell=true and zero desk agents, preventing invisible stuck projects
observability_surfaces:
  - selectFloorViewModel(state).selectedProjectDiagnostics — direct inspection of selected project pipeline diagnostics
  - selectFloorViewModel(state).departments[n].diagnostics — per-department pipeline status, stage, gate, approval, and boolean flags
  - selectFloorViewModel(state).summary.{waitingCount,blockedCount,handoffReadyCount,runningPipelineCount,completePipelineCount,queuedPipelineCount} — pipeline-category counts
  - data-testid="dept-persistent-shell" — rendered indicator for inspectable departments with no desk agents
  - data-testid="dept-pipeline-status-{id}" — per-department pipeline status label
  - data-testid="severance-floor-selected-project-status" — selected project pipeline status
  - data-testid="severance-floor-selected-project-stage" — selected project current stage label
  - data-testid="severance-floor-selected-project-gate" — selected project current gate label
  - data-testid="severance-floor-selected-project-approval" — selected project approval summary
  - data-testid="severance-floor-waiting-count" — summary strip waiting count
  - data-testid="severance-floor-blocked-count" — summary strip blocked count
  - data-testid="severance-floor-handoff-ready-count" — summary strip handoff-ready count
drill_down_paths:
  - .gsd/milestones/M001/slices/S05/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S05/tasks/T02-SUMMARY.md
duration: 27m
verification_result: passed
completed_at: 2026-03-15
---

# S05: Severed floor live-state integration

**Pipeline-aware floor projection with per-department diagnostics, persistent shell indicators, and browser-verified dashboard↔floor synchronization across waiting, blocked, handoff-ready, and running pipeline states.**

## What Happened

The Severance floor already derived departments from `buildProjectListViewModels()` — the same canonical path the dashboard uses. The integration gap was twofold: the floor lacked a consolidated diagnostics surface (forcing consumers to reconstruct pipeline truth from scattered fields), and the visual presentation used coarse selected/unselected colors with no visibility for stuck projects that had no desk agents.

**T01** added `buildFloorDiagnostics(project)` as a canonical extraction point that produces a structured diagnostics object per department containing pipeline status, stage, gate, approval, progress, and boolean flags (waiting, blocked, running, complete). This object attaches to each floor department and surfaces as `selectedProjectDiagnostics` at the floor view model root. Pipeline-category summary counts were added alongside existing waiting/blocked/handoffReady counts. Two new selector tests prove per-department diagnostics match dashboard pipeline truth across all four pipeline states and that floor presence metadata keeps non-running but active projects visible.

**T02** added pipeline-aware visual rendering: department rooms now show red-tinted borders for blocked, amber for waiting, blue for handoff-ready, and green for running/complete through `ROOM_TONE_BACKGROUNDS` and `ROOM_TONE_BORDERS` maps keyed by pipeline status. The overhead fluorescent strip inherits the diagnostics color. A `PersistentShellIndicator` component renders a pulsing status dot with pipeline summary for inspectable departments with zero desk agents, maintaining floor visibility for stuck projects. Seven rendered integration tests verify dashboard↔floor synchronization for waiting, blocked, handoff-ready, and running projects, plus selected-project diagnostics, summary strip counts, and per-department pipeline status labels.

## Verification

- `npx vitest run src/lumon/__tests__/lumon-state.test.js` — 10/10 tests pass (8 existing + 2 new)
- `npx vitest run src/features/mission-control/__tests__/severance-floor-live-state.test.jsx` — 7/7 tests pass
- `npx eslint src/lumon/selectors.js src/severance-floor.jsx src/features/mission-control/__tests__/severance-floor-live-state.test.jsx` — clean
- `npm run build` — clean
- Browser verification: dashboard shows selected project → switch to floor → diagnostics panel shows matching pipeline status, stage, gate, approval; select different project from floor → dashboard heading updates; reload preserves selection; department rooms show red/amber/green tones matching pipeline state; summary strip shows run/blocked/break room/idle counts; no console errors or failed network requests

## Requirements Advanced

- R015 — The floor now surfaces pipeline-aware project diagnostics (status, stage, gate, approval) per department, establishing the inspection surface that M004 runtime telemetry will later fill with live agent activity

## Requirements Validated

- R020 — The Severance floor renders from canonical pipeline state with Lumon-atmosphere tones (room border/background colors, fluorescent strip coloring, persistent shell indicators) that distinguish waiting, blocked, handoff-ready, running, and complete departments while maintaining the control-room aesthetic

## New Requirements Surfaced

- none

## Requirements Invalidated or Re-scoped

- none

## Deviations

None. The floor selector was already deriving from canonical project view models — the work was adding the structured diagnostics surface, visual tone rendering, persistent shell indicators, and expanding test coverage rather than rebuilding the derivation path.

## Known Limitations

- `mission-control-shell.test.jsx` times out (pre-existing — the 14-project seed render exceeds the default 5s test timeout). Not a regression from this work.
- Base UI tabs have a Playwright automation compatibility issue where programmatic tab switching through the browser automation layer fails (tab click doesn't trigger Base UI's composite state change); manual browser interaction works correctly. This affects automated browser-level tab navigation but not the rendered test or manual verification passes.
- Floor diagnostics reflect seeded/spawned pipeline state only — real-time agent telemetry is deferred to M004.

## Follow-ups

- S06 needs to prove the end-to-end operator loop including floor synchronization as part of the integrated acceptance scenarios.
- M004 will connect real agent runtime telemetry behind the same floor diagnostics contract.

## Files Created/Modified

- `src/lumon/selectors.js` — Added `buildFloorDiagnostics()`, attached `.diagnostics` to each floor department, added `selectedProjectDiagnostics` to floor view model root, added pipeline-category summary counts
- `src/lumon/__tests__/lumon-state.test.js` — Added two tests: per-department diagnostics contract proof and floor presence/room sizing for non-running active projects
- `src/severance-floor.jsx` — Added pipeline-aware room tone maps, PersistentShellIndicator component, pipeline-tinted fluorescent strip, and diagnostic-driven department border/background colors
- `src/features/mission-control/__tests__/severance-floor-live-state.test.jsx` — Fixed unused `within` import

## Forward Intelligence

### What the next slice should know
- The floor view model is fully selector-owned and derives from the same `buildProjectListViewModels()` path as the dashboard. S06 can trust that selecting a project on either surface updates the same `selectedProjectId` in canonical state.
- All floor data-testid surfaces are stable and documented in the task summaries — S06 browser assertions can target them directly.

### What's fragile
- Base UI tab switching requires real user interaction events — Playwright's click/getByRole doesn't reliably trigger Base UI's composite tab state. S06 browser verification may need to test floor content by directly navigating to a floor-visible state or using keyboard navigation from the Dashboard tab focus.
- The `mission-control-shell.test.jsx` timeout issue persists and will need attention if S06 adds more rendered shell integration tests.

### Authoritative diagnostics
- `selectFloorViewModel(state)` is the single source of truth for everything the floor renders — inspect `.departments[n].diagnostics` and `.selectedProjectDiagnostics` to verify any floor behavior.
- `data-testid="severance-floor-selected-project-status"` in the rendered DOM is the fastest way to confirm floor/dashboard synchronization in browser assertions.

### What assumptions changed
- No assumptions changed. The floor was already consuming canonical selectors; S05 added the diagnostics extraction layer and visual rendering on top of that existing path.
