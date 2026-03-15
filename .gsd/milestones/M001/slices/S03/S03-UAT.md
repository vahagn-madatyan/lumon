# S03: Pipeline board and approval model — UAT

**Milestone:** M001
**Written:** 2026-03-14

## UAT Type

- UAT mode: live-runtime
- Why this mode is sufficient: S03 is about shared stage truth, approval-gated state, and reload continuity across real surfaces. Those claims need the running app, persisted registry state, and browser diagnostics, not artifact review alone.

## Preconditions

- The app is running locally via preview or dev server (`http://127.0.0.1:4173/` was used for slice verification).
- Local storage contains either the seeded demo projects or the deterministic S03 proof registry with waiting, blocked, and handoff-ready projects.
- Browser console and network logs are clear before starting the pass.

## Smoke Test

Open the dashboard and confirm at least one project card shows a visible pipeline board with current stage, current gate, and approval state instead of only agent summaries.

## Test Cases

### 1. Dashboard shows stage-first project state

1. Open the Dashboard tab.
2. Inspect at least two project cards.
3. Confirm each card leads with pipeline information: current stage, current gate, approval state, and stage tiles.
4. **Expected:** Stage/gate/approval state is more prominent than agent detail, and status labels such as waiting, blocked, or handoff ready are visible on the project cards.

### 2. Orchestration matches the selected project's pipeline truth

1. Select a project from the dashboard list or project switcher.
2. Open the Orchestration tab.
3. Compare the selected project's current stage, current gate, and approval label between dashboard context and orchestration header/detail.
4. **Expected:** Both surfaces agree on the same current stage, gate, and approval state for the same selected project.

### 3. Reload preserves selection and approval-aware pipeline state

1. Choose a project that is visibly not in the default waiting state if available (for example blocked or handoff ready).
2. Refresh the page.
3. Re-open Orchestration if needed.
4. **Expected:** The same project remains selected after reload, and its current stage, gate, and approval-aware pipeline state are unchanged.

## Edge Cases

### Needs-iteration / blocked approval

1. Select a project with a blocked or needs-iteration approval state.
2. Check both the dashboard card and orchestration detail.
3. **Expected:** The project remains visibly blocked, the gate label stays stable, and the approval state does not collapse into a generic queued/running label.

## Failure Signals

- A project card has agent detail but no explicit current stage/current gate/approval state.
- Dashboard and orchestration disagree on the same selected project's stage or gate.
- Reload changes the selected project unexpectedly or resets approval-aware status.
- Console errors appear during navigation or refresh.
- Failed network requests appear during a pure local UI pass.
- Persisted registry data lacks stable stage IDs (`<projectId>:<stageKey>`) or stable gate IDs (`gate:*`).

## Requirements Proved By This UAT

- R003 — Projects move through an explicit intake-to-handoff pipeline that remains visible across the real app.
- R016 — The main operational surfaces prioritize stage state and approval-aware status over agent-only summaries.

## Not Proven By This UAT

- Live n8n-driven approval waiting/resume behavior.
- Dossier and handoff packet artifact rendering.
- Severed Floor live pipeline-state integration.
- Repo creation, GSD bootstrap, or other external handoff behavior.

## Notes for Tester

If the proof registry is already loaded, you may see deterministic projects such as `Browser Waiting`, `Browser Blocked`, and `Browser Handoff Ready`. That is fine and was the slice verification fixture. When diagnosing odd state, inspect `window.localStorage['lumon.registry.v1']` first so you know whether you are looking at the seeded demo state or the persisted proof registry.
