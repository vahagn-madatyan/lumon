---
id: T02
parent: S05
milestone: M001
provides:
  - Pipeline-aware department room tones (border and background colors keyed by diagnostics status)
  - Persistent shell indicator for inspectable departments with no desk agents
  - Browser-verified dashboard↔floor synchronization for waiting, blocked, handoff-ready, and running projects
  - All 7 rendered live-state integration tests passing
  - Clean eslint and build across all slice files
key_files:
  - src/severance-floor.jsx
  - src/features/mission-control/__tests__/severance-floor-live-state.test.jsx
key_decisions:
  - Department room borders and backgrounds are derived from DIAGNOSTICS_TONE_COLORS/ROOM_TONE_BORDERS/ROOM_TONE_BACKGROUNDS keyed by pipeline status rather than coarse agent status, keeping the Dept component reading diagnostics instead of deriving pipeline truth
  - PersistentShellIndicator renders a pulsing status dot with pipeline summary for inspectable departments that have no desk agents, maintaining floor visibility for stuck projects
patterns_established:
  - Department rooms visually encode pipeline state through border/background tone and the overhead fluorescent strip inherits the diagnostics color, keeping the Lumon atmosphere while exposing pipeline truth
  - Persistent shell indicators appear when a department has presence.persistentShell=true and zero desk agents, preventing invisible stuck projects
observability_surfaces:
  - data-testid="dept-persistent-shell" — rendered indicator for inspectable departments with no desk agents
  - data-testid="dept-pipeline-status-{id}" — per-department pipeline status label
  - data-testid="severance-floor-selected-project-status" — selected project pipeline status
  - data-testid="severance-floor-selected-project-stage" — selected project current stage label
  - data-testid="severance-floor-selected-project-gate" — selected project current gate label
  - data-testid="severance-floor-selected-project-approval" — selected project approval summary
  - data-testid="severance-floor-selected-project-approval-note" — selected project approval note (when present)
  - data-testid="severance-floor-waiting-count" — summary strip waiting department count
  - data-testid="severance-floor-blocked-count" — summary strip blocked department count
  - data-testid="severance-floor-handoff-ready-count" — summary strip handoff-ready department count
duration: 12m
verification_result: passed
completed_at: 2026-03-15
blocker_discovered: false
---

# T02: Render approval-aware floor presence and prove shell synchronization

**Added pipeline-aware department room tones, persistent shell indicators for no-agent departments, and browser-verified dashboard↔floor synchronization with all 7 rendered live-state tests passing.**

## What Happened

T01 had already wired the diagnostics surface from selectors through to the component, including the SelectedProjectPanel with stage/gate/approval data-testids, per-department pipeline status labels, and summary strip counts for waiting/blocked/handoff-ready. The live-state test file was already authored and passing (7/7).

The remaining T02 work was visual: department rooms still used coarse selected/unselected colors regardless of pipeline state, and inspectable departments with no desk agents had no visual indicator of their pipeline presence. Added:

1. **Pipeline-aware room tones** — `ROOM_TONE_BACKGROUNDS` and `ROOM_TONE_BORDERS` maps keyed by pipeline status. Department rooms now show red-tinted borders for blocked, amber for waiting, blue for handoff-ready, and green for running/complete. The overhead fluorescent strip also inherits the diagnostics color instead of the previous hardcoded cyan.

2. **PersistentShellIndicator** — When a department has `presence.persistentShell=true` and zero desk agents, a pulsing status dot with pipeline label and summary text appears inside the room, maintaining floor visibility for stuck projects. Uses `data-testid="dept-persistent-shell"` for test targeting.

3. **Fixed unused import** — Removed unused `within` import from the test file to clear the eslint error.

## Verification

- `npx vitest run src/features/mission-control/__tests__/severance-floor-live-state.test.jsx` — 7/7 tests pass
- `npx vitest run src/lumon/__tests__/lumon-state.test.js` — 10/10 tests pass
- `npx eslint src/lumon/selectors.js src/severance-floor.jsx src/features/mission-control/__tests__/severance-floor-live-state.test.jsx` — clean
- `npm run build` — clean
- Browser verification:
  - Dashboard shows "Wheely" selected → switch to floor → diagnostics panel shows RUNNING with Stage/Gate/Approval
  - Select "Policy Engine" from floor → shows BLOCKED status with stage/gate diagnostics → switch to dashboard → "Policy Engine" heading confirmed
  - Reload → Policy Engine persists as selected project on both surfaces
  - Department rooms show red border/background for blocked (Policy Engine, PixelForge), green for running departments
  - Summary strip shows "14 RUN · 2 BLOCKED · 2 BREAK ROOM · 17 IDLE"
  - No console errors, no failed network requests

## Diagnostics

- Rendered tests query `data-testid` surfaces for selected-project pipeline status, stage, gate, approval, and summary counts — same surfaces available in browser dev tools
- Department room tones derived from `DIAGNOSTICS_TONE_COLORS` map — visual mismatch between department room color and status label indicates a diagnostics derivation bug upstream
- Persistent shell indicator appears with `data-testid="dept-persistent-shell"` — testable in rendered or browser contexts

## Deviations

None. T01 had already shipped the diagnostic rendering, test file, and data-testid surfaces. T02 focused on the remaining visual tone and persistent-shell work.

## Known Issues

- `mission-control-shell.test.jsx` times out (pre-existing — the 14-project seed render is too heavy for the default 5s test timeout). Not a regression from this work.

## Files Created/Modified

- `src/severance-floor.jsx` — Added pipeline-aware room tone maps (ROOM_TONE_BACKGROUNDS, ROOM_TONE_BORDERS), PersistentShellIndicator component, pipeline-tinted fluorescent strip, and diagnostic-driven department border/background colors
- `src/features/mission-control/__tests__/severance-floor-live-state.test.jsx` — Fixed unused `within` import
