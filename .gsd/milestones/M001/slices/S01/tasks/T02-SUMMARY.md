---
id: T02
parent: S01
milestone: M001
provides:
  - Provider-backed mission-control shell modules that render dashboard, orchestration, architecture, terminal, and modal surfaces from the canonical Lumon state
key_files:
  - src/lumon/context.jsx
  - src/features/mission-control/MissionControlShell.jsx
  - src/features/mission-control/DashboardTab.jsx
  - src/features/mission-control/OrchestrationTab.jsx
  - src/features/mission-control/TerminalPanel.jsx
  - src/features/mission-control/__tests__/mission-control-shell.test.jsx
key_decisions:
  - D012: Keep modal intake drafts, terminal playback, and React Flow canvas state local to extracted surfaces while the provider owns only canonical project/agent/stage state and shared mutations.
patterns_established:
  - Provider-backed shell surfaces consume selector output, while local-only interaction state stays inside the surface module that owns the interaction.
observability_surfaces:
  - npm run test -- --run src/features/mission-control/__tests__/mission-control-shell.test.jsx
  - npm run test -- --run src/lumon/__tests__/lumon-state.test.js
  - browser assertion on http://localhost:5173/ for shell render + console/network health
  - npx eslint src/App.jsx src/main.jsx src/lumon src/features/mission-control
duration: 1.5h
verification_result: passed
completed_at: 2026-03-13T22:11:44-07:00
blocker_discovered: false
---

# T02: Split mission control into provider-backed surface modules

**Replaced the monolithic mission-control shell with provider-backed surface modules that read canonical Lumon state, keep local interaction state local, and prove dashboard/orchestration synchronization through a rendered integration test.**

## What Happened

I added `src/lumon/context.jsx` as the provider boundary over the T01 reducer/seed contract, with hooks for reading selector state and dispatching project, agent, stage, and status mutations.

I then rewrote `src/mission-control.jsx` into a thin provider wrapper and extracted the shell into `src/features/mission-control/MissionControlShell.jsx` plus the major surface modules: `DashboardTab.jsx`, `OrchestrationTab.jsx`, `ArchitectureTab.jsx`, `TerminalPanel.jsx`, and `NewProjectModal.jsx`.

The dashboard now renders project and agent cards from `src/lumon/selectors.js` instead of inline mock arrays. The terminal panel reads the selected agent from shared state and can mutate agent status through the provider, which makes status changes observable across surfaces. The orchestration tab now builds its React Flow nodes and edges from `selectOrchestrationInput`, but keeps the canvas graph state local so the flow surface stays an adapter over canonical state rather than becoming the stage contract.

I kept intentionally local interaction state out of the provider: the new-project modal now queues local intake drafts inside the shell, terminal playback remains local to the terminal surface, and the React Flow canvas selection/layout state remains local to orchestration.

Finally, I replaced the expected-fail shell placeholder test with a real RTL integration proof that clicks a project and agent in the rendered dashboard, verifies the orchestration detail follows the shared selection, retries a failed agent through the dashboard terminal controls, and confirms the orchestration stage status updates from `failed` to `running`.

## Verification

Passed:
- `npm run test -- --run src/features/mission-control/__tests__/mission-control-shell.test.jsx`
  - Verified the rendered shell mounts from seed state.
  - Verified dashboard → orchestration shared selection sync for `Policy Engine`.
  - Verified a rendered `Retry agent` action updates orchestration stage status from `failed` to `running`.
- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js`
- `npx eslint src/App.jsx src/main.jsx src/lumon src/features/mission-control`
- `npm run build`
- Browser verification on `http://localhost:5173/`
  - Explicit assert passed for visible shell render (`MISSION CONTROL`, `Spawn new project`).
  - Explicit browser diagnostics passed: no console errors and no failed requests since load.

Slice-level partial result:
- `npx eslint src/App.jsx src/main.jsx src/lumon src/features/mission-control src/severance-floor.jsx` still fails on the existing `src/severance-floor.jsx` unused-var/purity issues already queued for T03.

## Diagnostics

To inspect this task later:
- Run `npm run test -- --run src/features/mission-control/__tests__/mission-control-shell.test.jsx` for the rendered shared-state proof.
- Run `npm run test -- --run src/lumon/__tests__/lumon-state.test.js` to confirm the underlying selector/reducer contract still matches the shell.
- Open `src/features/mission-control/MissionControlShell.jsx` to see the extracted shell wiring and local-vs-provider state boundary.
- Open `src/features/mission-control/OrchestrationTab.jsx` to inspect the selector-driven React Flow adapter.

## Deviations

- `NewProjectModal` now queues local intake drafts in shell-local state instead of mutating the canonical project store, because T01 did not define add-project reducer actions and widening the domain contract here would have violated the task’s “keep purely local interaction state local” constraint.

## Known Issues

- The slice-wide lint command is still red because `src/severance-floor.jsx` has pre-existing unused-variable and purity violations; that cleanup remains the planned focus of T03.
- Browser automation against the Base UI tab controls was less reliable than the RTL integration path, so the strongest shared-selection/status proof for T02 remains the passing rendered test rather than the browser harness.

## Files Created/Modified

- `src/lumon/context.jsx` — added the Lumon provider and hooks over the canonical reducer/seed state.
- `src/features/mission-control/MissionControlShell.jsx` — added the extracted provider-backed top-level shell and kept modal intake drafts local.
- `src/features/mission-control/DashboardTab.jsx` — moved dashboard project/agent rendering to selector-backed cards and wired agent selection.
- `src/features/mission-control/TerminalPanel.jsx` — moved terminal/detail rendering to shared selected-agent state with status mutation controls.
- `src/features/mission-control/OrchestrationTab.jsx` — added the selector-driven React Flow orchestration adapter with local canvas state.
- `src/features/mission-control/ArchitectureTab.jsx` — added the architecture surface with selected-project and fleet context.
- `src/features/mission-control/NewProjectModal.jsx` — extracted the modal into a standalone surface module with local intake draft behavior.
- `src/mission-control.jsx` — replaced the monolith export with a thin provider wrapper.
- `src/App.jsx` — updated the app entrypoint to pass through the provider-backed mission-control shell contract.
- `src/features/mission-control/__tests__/mission-control-shell.test.jsx` — replaced the placeholder with the rendered selection/status synchronization proof.
- `.gsd/DECISIONS.md` — appended D012 for the provider-vs-local interaction state boundary.
- `.gsd/milestones/M001/slices/S01/S01-PLAN.md` — marked T02 done.
- `.gsd/STATE.md` — advanced the next action to T03.
