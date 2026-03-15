# S05: Severed floor live-state integration — UAT

**Milestone:** M001
**Written:** 2026-03-15

## UAT Type

- UAT mode: mixed
- Why this mode is sufficient: S05 requires both artifact verification (selector contracts, rendered tests) and live-runtime visual confirmation that the Severance floor atmosphere is preserved while pipeline state is legible

## Preconditions

- `npm run build` succeeds with no errors
- Dev server running via `npm run dev` on `http://localhost:5173`
- Seed data includes projects in running, blocked, waiting, handoff-ready, queued, and complete pipeline states (the default 14-project seed satisfies this)

## Smoke Test

Open `http://localhost:5173`, click the "Severed Floor" tab. Verify the floor renders department rooms with visible project names, colored room borders/backgrounds, and a summary strip at the bottom showing run/blocked/break room/idle counts.

## Test Cases

### 1. Dashboard-to-floor selected project synchronization

1. On the Dashboard tab, select "Policy Engine" from the project list (a blocked project)
2. Note the pipeline status, current stage, current gate, and approval shown in the dashboard detail panel
3. Switch to the Severed Floor tab
4. **Expected:** The selected-project panel on the floor shows the same pipeline status (BLOCKED), current stage, current gate, and approval summary as the dashboard detail panel

### 2. Floor-to-dashboard selected project synchronization

1. On the Severed Floor, click a different department room (e.g., "Wheely")
2. Switch back to the Dashboard tab
3. **Expected:** The dashboard project list and detail panel show "Wheely" as the selected project with matching pipeline status (RUNNING)

### 3. Pipeline-aware room tone presentation

1. On the Severed Floor, observe the department room borders and backgrounds
2. **Expected:** Blocked projects (Policy Engine, PixelForge) show red-tinted room borders; running projects show green-tinted borders; the overhead fluorescent strip color matches the pipeline status tone

### 4. Persistent shell indicator for stuck projects

1. On the Severed Floor, find a department with a blocked or waiting pipeline state and no active desk agents (e.g., Policy Engine with 0 running agents)
2. **Expected:** The room shows a pulsing status dot with a pipeline summary label instead of appearing empty/invisible

### 5. Summary strip pipeline counts

1. On the Severed Floor, observe the summary strip at the bottom
2. **Expected:** The strip shows counts for running, blocked, break room, and idle departments that match the seed data's pipeline distribution

### 6. Reload persistence

1. On the Severed Floor, select a specific project
2. Reload the browser (F5 / Cmd+R)
3. Navigate back to the Severed Floor tab
4. **Expected:** The same project remains selected and the floor diagnostics panel shows the same pipeline status, stage, gate, and approval as before reload

## Edge Cases

### Empty registry floor

1. Clear localStorage (`localStorage.clear()` in console) and reload
2. Switch to the Severed Floor tab
3. **Expected:** The floor renders with seeded projects (seed data restores on empty registry); no crash or blank screen

### Project with zero agents

1. Find a department whose project is queued or blocked with no running agents
2. **Expected:** The department room is still visible with a persistent shell indicator; it does not disappear from the floor layout

## Failure Signals

- Floor shows department rooms with no colored borders or all-identical gray borders (diagnostics tone mapping broken)
- Selected-project panel on the floor shows different pipeline status than the dashboard (synchronization broken)
- Departments with blocked/waiting projects but no agents appear invisible or collapsed (persistent shell indicator missing)
- Summary strip shows all zeros or nonsensical counts (summary aggregation broken)
- Console errors related to undefined `.diagnostics` properties (selector contract broken)
- Floor crashes or shows a blank page when switching tabs (rendering error in SeveranceFloor component)

## Requirements Proved By This UAT

- R020 — Severance-inspired control-room presentation: the floor maintains Lumon atmosphere with pipeline-aware room tones, fluorescent strip coloring, and persistent shell indicators
- R015 — Live visibility into agent/project activity: the floor surfaces pipeline status, stage, gate, and approval diagnostics per department, matching dashboard truth

## Not Proven By This UAT

- Real-time agent telemetry — the floor shows seeded pipeline state, not live agent runtime data (deferred to M004)
- End-to-end operator loop — S06 proves the full create → inspect → advance → observe cycle
- Tab switching via automated browser tooling — Base UI composite tabs require real user interaction events; Playwright automation may not trigger the tab switch correctly

## Notes for Tester

- The Base UI tab component has a known compatibility issue with Playwright-style automated clicks. Use real mouse clicks in the browser to switch tabs.
- The `csstree-match` warnings in the console during test runs are harmless CSS parsing noise from styled-components, not errors.
- The summary strip format uses Lumon-style abbreviated labels (e.g., "14 RUN · 2 BLOCKED · 2 BREAK ROOM · 17 IDLE") rather than verbose pipeline terminology.
