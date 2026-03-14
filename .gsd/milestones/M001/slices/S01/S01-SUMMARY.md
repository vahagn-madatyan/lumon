---
id: S01
parent: M001
milestone: M001
provides:
  - Canonical Lumon reducer/context/selector state spine that drives dashboard, orchestration, architecture, terminal, and floor surfaces
  - Provider-backed mission-control shell modules plus deterministic Severance-floor view models and shared-state proof harnesses
requires: []
affects:
  - S02
  - S03
  - S04
  - S05
  - S06
key_files:
  - src/lumon/model.js
  - src/lumon/seed.js
  - src/lumon/reducer.js
  - src/lumon/context.jsx
  - src/lumon/selectors.js
  - src/features/mission-control/MissionControlShell.jsx
  - src/features/mission-control/DashboardTab.jsx
  - src/features/mission-control/OrchestrationTab.jsx
  - src/features/mission-control/TerminalPanel.jsx
  - src/severance-floor.jsx
  - src/lumon/__tests__/lumon-state.test.js
  - src/features/mission-control/__tests__/mission-control-shell.test.jsx
key_decisions:
  - D011: Keep agents project-owned while execution stages reference agent IDs and synthesize generic stages when the demo only provides partial orchestration detail.
  - D012: Keep modal intake drafts, terminal playback, and React Flow canvas state inside extracted surfaces while the provider owns canonical project/agent/stage state and shared mutations.
  - D013: Project the Severance floor through `selectFloorViewModel` plus `lumonFloorLayoutSeed` so layout/motion variation is deterministic and selector-owned.
patterns_established:
  - Dashboard, orchestration, and floor surfaces consume selector-owned view models over one canonical Lumon state tree.
  - Distinctive UI layout and motion variation comes from deterministic seeded helpers instead of render-path randomness.
observability_surfaces:
  - npm run test -- --run src/lumon/__tests__/lumon-state.test.js
  - npm run test -- --run src/features/mission-control/__tests__/mission-control-shell.test.jsx
  - npx eslint src/App.jsx src/main.jsx src/lumon src/features/mission-control src/severance-floor.jsx
  - npm run build
  - Preview/browser assertions on http://127.0.0.1:4174/ for dashboard/floor/orchestration synchronization and console/network health
drill_down_paths:
  - .gsd/milestones/M001/slices/S01/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S01/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S01/tasks/T03-SUMMARY.md
duration: ~5h
verification_result: passed
completed_at: 2026-03-13T22:51:43-07:00
---

# S01: Core control-shell refactor

**Rebuilt Lumon’s prototype shell on a canonical app-state spine, split the mission-control monolith into provider-backed surfaces, and bound the Severance floor to the same deterministic shared state.**

## What Happened

S01 retired the biggest architectural risk in M001: disconnected mock/view state across the main shell.

First, the slice added a real Vitest + jsdom + React Testing Library harness and extracted the canonical Lumon domain into `src/lumon/*`. That spine now defines the project, engine, stage, approval, and agent shapes; seeds the demo fleet; and exposes reducer actions/selectors for fleet metrics, selected project/agent detail, floor agents, and orchestration input.

Second, the old mission-control monolith was split into provider-backed surface modules. `MissionControlShell`, `DashboardTab`, `OrchestrationTab`, `ArchitectureTab`, `TerminalPanel`, and `NewProjectModal` now read shared selector output from the Lumon provider instead of owning duplicated inline arrays. The provider owns only canonical project/agent/stage truth; local-only interaction state such as modal drafts, terminal playback, and React Flow canvas state stayed local.

Third, the Severance floor was refactored from an isolated effect-heavy presentation into a presentational shell over canonical selector output. `selectFloorViewModel` now projects the grouped floor data, selected summaries, stable status metadata, and deterministic room/layout hints. `lumonFloorLayoutSeed` replaced render-path randomness so the floor keeps its distinct atmosphere while staying reproducible and synchronized with dashboard + orchestration state.

The slice finished by proving the shared-state contract three ways: reducer/selector tests, rendered RTL shell synchronization tests, and preview-browser assertions that selected project/agent/status changes propagate from dashboard controls to orchestration and the floor without console or network failures.

## Verification

Passed:
- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js`
- `npm run test -- --run src/features/mission-control/__tests__/mission-control-shell.test.jsx`
- `npx eslint src/App.jsx src/main.jsx src/lumon src/features/mission-control src/severance-floor.jsx`
- `npm run build`
- Preview/browser verification on `http://127.0.0.1:4174/`
  - Selected `Policy Engine` and `Agent-06` from the dashboard.
  - Triggered `Retry agent`, then verified orchestration + Severed Floor reflected the same `running` status.
  - Read back floor diagnostics from stable test ids:
    - `project: Policy Engine`
    - `agent: Agent-06`
    - `agentStatus: running`
    - `breakRoomCount: 1`
  - Explicit browser assertions passed for no console errors and no failed requests after the interaction.

## Requirements Advanced

- R002 — Established stable canonical project/agent identity and centralized selectors so S02 can add persistence without another shell-wide state rewrite.
- R003 — Preserved execution-stage and approval-state hooks in the canonical model/selectors so S03 can introduce an explicit staged pipeline on top of a shared contract.
- R012 — Canonical project data now carries execution-engine identity through shared selectors, ready for durable project-bound engine choice in S02.
- R016 — Dashboard and floor now prioritize shared project/agent status visibility instead of disconnected mock summaries.
- R020 — Preserved the Severance-inspired control-room presentation while binding the floor to deterministic shared state instead of ad hoc randomness.

## Requirements Validated

- R001 — Passing reducer, rendered-shell, and preview-browser checks prove Lumon now functions as a single-operator mission-control shell over multiple projects and synchronized surfaces.

## New Requirements Surfaced

- none

## Requirements Invalidated or Re-scoped

- none

## Deviations

- Removed the invalid top-level `@rollup/rollup-linux-arm64-gnu` dependency during T01 because it blocked local install/verification on macOS.

## Known Limitations

- Projects are still seeded demo state; S01 does not yet persist projects, create canonical projects from the modal, or restore fleet state after reload.
- Stage progression and approval gates are still flexible placeholders, not the explicit pre-build taxonomy planned for S03.
- Agent activity is still demo-driven selector state, not real runtime telemetry.
- Production build still emits a large-chunk warning; it does not block M001/S01 verification but should be revisited if bundle growth continues.

## Follow-ups

- S02 should add canonical create/update/delete/restore actions and local persistence around the existing Lumon reducer/context boundary.
- S02 should move project creation from shell-local modal drafts into the canonical registry while preserving the current provider/local state boundary discipline.

## Files Created/Modified

- `package.json` — added the test script and removed the invalid Linux-only Rollup dependency.
- `vite.config.js` — wired Vitest/jsdom setup for the new slice proof harness.
- `src/test/setup.js` — added RTL/jest-dom test setup and DOM helpers.
- `src/lumon/model.js` — added canonical constructors for projects, engines, stages, approvals, and agents.
- `src/lumon/seed.js` — extracted demo fleet seed data and added `lumonFloorLayoutSeed` for deterministic floor layout.
- `src/lumon/reducer.js` — added Lumon reducer actions for selection and shared status updates.
- `src/lumon/context.jsx` — added the provider/hooks boundary over the canonical reducer.
- `src/lumon/selectors.js` — added fleet, detail, orchestration, and floor selector projections including `selectFloorViewModel`.
- `src/mission-control.jsx` — reduced the old shell entrypoint to a thin provider wrapper.
- `src/features/mission-control/MissionControlShell.jsx` — added the extracted top-level provider-backed shell.
- `src/features/mission-control/DashboardTab.jsx` — moved dashboard cards and selection handling to selector-backed rendering.
- `src/features/mission-control/OrchestrationTab.jsx` — adapted React Flow rendering to canonical orchestration selector input.
- `src/features/mission-control/ArchitectureTab.jsx` — extracted architecture surface rendering around selected-project context.
- `src/features/mission-control/TerminalPanel.jsx` — bound terminal/detail state to the selected canonical agent and shared mutations.
- `src/features/mission-control/NewProjectModal.jsx` — extracted the modal and kept intake drafts local pending S02 persistence work.
- `src/severance-floor.jsx` — rewired the floor to canonical selector output and removed render-path randomness.
- `src/lumon/__tests__/lumon-state.test.js` — added canonical reducer/selector contract proof.
- `src/features/mission-control/__tests__/mission-control-shell.test.jsx` — added rendered dashboard/floor/orchestration synchronization proof.

## Forward Intelligence

### What the next slice should know
- The safest S02 path is to extend the existing reducer/context/selectors rather than bypassing them. Dashboard, orchestration, and floor synchronization already depend on shared selected-project and selected-agent semantics.

### What's fragile
- `NewProjectModal` is intentionally local-only today — if S02 adds persistence by mutating ad hoc local arrays, mock drift will return immediately.

### Authoritative diagnostics
- `src/lumon/__tests__/lumon-state.test.js` — best proof that reducer and selector contracts still support dashboard, floor, and orchestration projections.
- `src/features/mission-control/__tests__/mission-control-shell.test.jsx` — best proof that rendered surfaces stay synchronized when project/agent/status state changes.

### What assumptions changed
- “The Severance floor needs bespoke internal grouping/randomness to preserve the feel” — a selector-owned floor view model plus seeded layout data preserved the presentation while making cross-surface behavior deterministic and testable.
