---
id: T02
parent: S03
milestone: M001
provides:
  - Stage-first dashboard and orchestration view models derived from one selector-owned pipeline contract
  - Rendered and browser proof for waiting, blocked, handoff-ready, and reload-safe stage/gate continuity
key_files:
  - src/lumon/selectors.js
  - src/features/mission-control/DashboardTab.jsx
  - src/features/mission-control/OrchestrationTab.jsx
  - src/features/mission-control/__tests__/pipeline-board.test.jsx
  - src/features/mission-control/__tests__/project-registry.test.jsx
key_decisions:
  - D018: Dashboard and orchestration now consume one selector-owned project pipeline view model with stable test surfaces while React Flow remains presentation-only.
patterns_established:
  - Build dashboard and orchestration project summaries through `buildProjectViewModel()` so stage timeline, current gate, approval state, and handoff readiness cannot drift between tabs.
  - Verify pipeline state through rendered `data-testid` surfaces plus `window.localStorage['lumon.registry.v1']` instead of inferring stage truth from canvas styling or agent-card aggregates.
observability_surfaces:
  - `selectDashboardProjects`, `selectSelectedProjectDetail`, and `selectOrchestrationInput`
  - Dashboard/orchestration test ids such as `selected-project-current-stage`, `selected-project-current-gate`, `selected-project-pipeline-status`, `orchestration-pipeline-status`, and `orchestration-selected-stage-summary`
  - `window.localStorage['lumon.registry.v1']`
  - src/features/mission-control/__tests__/pipeline-board.test.jsx
  - src/features/mission-control/__tests__/project-registry.test.jsx
duration: 1.5h
verification_result: passed
completed_at: 2026-03-13T20:13:29-07:00
blocker_discovered: false
---

# T02: Make dashboard and orchestration stage-first over the shared contract

**Shipped one shared selector contract for pipeline state, then rewired dashboard and orchestration to lead with stage/gate/approval truth instead of agent-first summaries.**

## What Happened

Extended `src/lumon/selectors.js` with a single project pipeline projection that now carries:
- per-project stage timeline with derived stage status/progress
- current stage and current gate labels
- approval summaries and approval-state labels
- selector-owned pipeline status labels for `waiting`, `blocked`, `handoff_ready`, `running`, `queued`, and `complete`
- stable handoff readiness and progress counters for both tabs

`src/features/mission-control/DashboardTab.jsx` was rebalanced so each project card now leads with the pipeline board, current stage, current gate, approval state, and stage timeline. Agent detail still exists, but it is explicitly secondary and moved below the stage-first summary.

`src/features/mission-control/OrchestrationTab.jsx` now reads the same selector-owned stage/gate/approval contract as the dashboard. React Flow still owns only node/edge presentation state, but the header, project switcher, node cards, and selected-stage detail now render the same waiting/blocked/handoff-ready truth as the dashboard.

I also expanded the rendered integration tests so they prove:
- dashboard + orchestration agreement on waiting state
- dashboard visibility for blocked and handoff-ready projects
- reload-safe continuity for persisted stage/gate/approval state on spawned projects

## Verification

Passed task-level verification:
- `npm run test -- --run src/features/mission-control/__tests__/pipeline-board.test.jsx src/features/mission-control/__tests__/project-registry.test.jsx`

Passed full slice verification:
- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js src/lumon/__tests__/lumon-persistence.test.js`
- `npm run test -- --run src/features/mission-control/__tests__/pipeline-board.test.jsx src/features/mission-control/__tests__/project-registry.test.jsx`
- `npx eslint src/lumon src/features/mission-control`
- `npm run build`

Preview/browser verification on `http://127.0.0.1:4173/`:
- started a real preview server and forced the app onto an intentionally empty persisted registry
- created one real canonical project through the modal, then rewrote the persisted registry into three canonical browser-proof projects (`browser-waiting`, `browser-blocked`, `browser-handoff-ready`) and reloaded through the real persistence path
- confirmed in the dashboard that the pipeline board rendered waiting, blocked, and handoff-ready projects with explicit stage/gate/approval visibility
- switched to Orchestration and confirmed the waiting project matched the dashboard on current stage (`Intake`), current gate (`Intake approval`), and pending approval state
- switched to the handoff-ready project in Orchestration, reloaded, and confirmed selection continuity plus preserved `Handoff` / `Handoff approval` / handoff-ready state after reload
- inspected `window.localStorage['lumon.registry.v1']` and confirmed persisted execution truth for all three proof projects:
  - `browser-waiting` → `currentStageId: browser-waiting:intake`, `currentGateId: gate:intake-review`, `currentApprovalState: pending`, `pipelineStatus: waiting`
  - `browser-blocked` → `currentStageId: browser-blocked:handoff`, `currentGateId: gate:handoff-approval`, `currentApprovalState: needs_iteration`, `pipelineStatus: blocked`
  - `browser-handoff-ready` → `currentStageId: browser-handoff-ready:handoff`, `currentGateId: gate:handoff-approval`, `currentApprovalState: pending`, `pipelineStatus: handoff_ready`, `handoffReady: true`
- browser diagnostics clean: no console errors and no failed network requests

## Diagnostics

Inspect later with:
- selector outputs: `selectDashboardProjects(state)`, `selectSelectedProjectDetail(state)`, `selectOrchestrationInput(state)`
- dashboard rendered surfaces:
  - `data-testid="dashboard-project-pipeline-<projectId>"`
  - `data-testid="dashboard-project-current-stage-<projectId>"`
  - `data-testid="dashboard-project-current-gate-<projectId>"`
  - `data-testid="dashboard-project-approval-state-<projectId>"`
  - `data-testid="selected-project-pipeline-status"`
  - `data-testid="selected-project-current-stage"`
  - `data-testid="selected-project-current-gate"`
- orchestration rendered surfaces:
  - `data-testid="orchestration-pipeline-status"`
  - `data-testid="orchestration-current-stage-label"`
  - `data-testid="orchestration-current-gate-label"`
  - `data-testid="orchestration-current-approval-state"`
  - `data-testid="orchestration-selected-stage-summary"`
- persisted envelope: `window.localStorage['lumon.registry.v1']`

## Deviations

- Browser verification used a deterministic persisted-registry proof set after creating one real project through the modal, rather than relying only on the seeded demo registry. This was intentional so waiting, blocked, and handoff-ready states could all be proven in one stable browser pass.

## Known Issues

- `npm run build` still emits Vite’s pre-existing chunk-size warning for the main bundle. The build passes and this task did not change the bundling strategy.

## Files Created/Modified

- `src/lumon/selectors.js` — added the shared project pipeline view model and approval-aware dashboard/orchestration projections.
- `src/features/mission-control/DashboardTab.jsx` — rebuilt the dashboard around a stage-first project summary and secondary agent roster.
- `src/features/mission-control/OrchestrationTab.jsx` — rewired orchestration header, project switcher, nodes, and stage detail to the shared selector contract.
- `src/features/mission-control/__tests__/pipeline-board.test.jsx` — added rendered proof for waiting, blocked, and handoff-ready pipeline states plus dashboard/orchestration agreement.
- `src/features/mission-control/__tests__/project-registry.test.jsx` — extended reload continuity proof to persisted stage/gate/approval state.
- `.gsd/DECISIONS.md` — recorded the shared stage-first selector contract decision.
- `.gsd/milestones/M001/slices/S03/S03-PLAN.md` — marked T02 complete.
- `.gsd/STATE.md` — advanced slice status past T02.
