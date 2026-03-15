# S03: Pipeline board and approval model

**Goal:** Canonicalize Lumon’s pre-build pipeline and approval semantics so every project moves through the same intake-to-handoff journey and the main dashboard leads with that stage truth.
**Demo:** In the real app, a persisted project shows the same explicit intake → handoff stages in the dashboard and orchestration views, exposes its current approval gate and blocked/waiting/handoff-ready state, and preserves that state across reload.

## Must-Haves

- A canonical intake-to-handoff stage taxonomy and approval-state model live in `src/lumon/*`, and both seeded projects and newly created projects use the same factory instead of UI-local defaults. (R003)
- The main dashboard surfaces per-project stage journey, current gate, and approval-aware status ahead of agent-only summaries, while orchestration consumes the same selector-owned contract. (R016)
- Approval metadata uses stable stage/gate identifiers and pending-owner/context fields that a future n8n wait/resume boundary can target without changing the UI contract. (supports R004, R019)

## Proof Level

- This slice proves: integration
- Real runtime required: yes
- Human/UAT required: no

## Verification

- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js src/lumon/__tests__/lumon-persistence.test.js`
- `npm run test -- --run src/features/mission-control/__tests__/pipeline-board.test.jsx src/features/mission-control/__tests__/project-registry.test.jsx`
- `npx eslint src/lumon src/features/mission-control`
- `npm run build`
- Preview/browser assertions on the local preview URL for: dashboard pipeline board visibility, approval-gated waiting/blocked/handoff-ready states, dashboard↔orchestration stage agreement, reload continuity, and no console or failed-network regressions

## Observability / Diagnostics

- Runtime signals: selector-derived pipeline summaries expose `currentStage`, `currentGate`, approval state, project pipeline status, and handoff readiness rather than forcing status inference from agent cards alone
- Inspection surfaces: `selectDashboardProjects`, `selectSelectedProjectDetail`, `selectOrchestrationInput`, rendered dashboard/orchestration badges, and `window.localStorage['lumon.registry.v1']`
- Failure visibility: current-stage reconciliation, rejected/needs-iteration blockers, and approval-pending waits remain visible after reducer updates and reload
- Redaction constraints: approval notes/meta must stay free of secrets because they persist into the local registry envelope

## Integration Closure

- Upstream surfaces consumed: `src/lumon/model.js`, `src/lumon/reducer.js`, `src/lumon/selectors.js`, `src/lumon/seed.js`, `src/features/mission-control/MissionControlShell.jsx`
- New wiring introduced in this slice: canonical pipeline factories feed seeded + operator-created projects, and the dashboard/orchestration surfaces render selector-owned approval-aware pipeline state from that shared contract
- What remains before the milestone is truly usable end-to-end: S04 dossier/handoff packet views, S05 Severance floor stage-status integration, and S06 final operator-loop proof

## Tasks

- [x] **T01: Canonicalize the intake pipeline and approval contract** `est:1.5h`
  - Why: S03 fails if stage taxonomy and approval semantics still originate in the shell or drift between seeded and newly spawned projects.
  - Files: `src/lumon/model.js`, `src/lumon/reducer.js`, `src/lumon/seed.js`, `src/features/mission-control/MissionControlShell.jsx`, `src/lumon/__tests__/lumon-state.test.js`, `src/lumon/__tests__/lumon-persistence.test.js`
  - Do: Add canonical stage/gate factories and stable stage identifiers in `src/lumon/*`; move new-project stage creation behind those helpers; teach reducer/model helpers to reconcile current stage and approval-aware progression without breaking persisted selection; and cover seeded + spawned projects with reducer/persistence tests that exercise pending, approved, rejected, and needs-iteration states.
  - Verify: `npm run test -- --run src/lumon/__tests__/lumon-state.test.js src/lumon/__tests__/lumon-persistence.test.js`
  - Done when: seeded and newly created projects share the same pre-build taxonomy, approval state survives canonical updates/reload, and reducer tests prove the current gate/current stage contract instead of relying on UI-local defaults.
- [x] **T02: Make dashboard and orchestration stage-first over the shared contract** `est:1.5h`
  - Why: R016 is still open until the main dashboard leads with stage/gate truth and the orchestration canvas consumes the same approval-aware selectors.
  - Files: `src/lumon/selectors.js`, `src/features/mission-control/DashboardTab.jsx`, `src/features/mission-control/OrchestrationTab.jsx`, `src/features/mission-control/__tests__/pipeline-board.test.jsx`, `src/features/mission-control/__tests__/project-registry.test.jsx`
  - Do: Add gate-aware dashboard/orchestration view models for stage timeline, current approval gate, blocked/waiting/handoff-ready summaries, and selector-owned status labels; rebalance the dashboard so the pipeline board is the primary project view while agent detail remains secondary; keep React Flow local but render approval state from selectors; and add rendered/browser proof that progression and approval cues stay consistent after reload.
  - Verify: `npm run test -- --run src/features/mission-control/__tests__/pipeline-board.test.jsx src/features/mission-control/__tests__/project-registry.test.jsx`
  - Done when: the dashboard visibly prioritizes pipeline stages and approval state per project, orchestration reflects the same current stage/gate truth, and runtime/browser checks confirm reload-safe agreement with clean console/network diagnostics.

## Files Likely Touched

- `src/lumon/model.js`
- `src/lumon/reducer.js`
- `src/lumon/selectors.js`
- `src/lumon/seed.js`
- `src/features/mission-control/MissionControlShell.jsx`
- `src/features/mission-control/DashboardTab.jsx`
- `src/features/mission-control/OrchestrationTab.jsx`
- `src/features/mission-control/__tests__/pipeline-board.test.jsx`
- `src/lumon/__tests__/lumon-state.test.js`
