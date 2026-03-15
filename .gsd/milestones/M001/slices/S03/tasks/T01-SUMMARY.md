---
id: T01
parent: S03
milestone: M001
provides:
  - Canonical intake-to-handoff stage/gate factories for seeded, spawned, and rehydrated Lumon projects
  - Approval-aware current-stage reconciliation and reload-safe stage ID normalization
key_files:
  - src/lumon/model.js
  - src/lumon/reducer.js
  - src/lumon/seed.js
  - src/features/mission-control/MissionControlShell.jsx
  - src/lumon/__tests__/lumon-state.test.js
  - src/lumon/__tests__/lumon-persistence.test.js
  - src/features/mission-control/__tests__/pipeline-board.test.jsx
key_decisions:
  - D017: Canonical stage IDs now use `<projectId>:<stageKey>` with alias-based reconciliation for older persisted stage IDs.
patterns_established:
  - Rehydrate project/stage changes through `createProject()` so reducer updates inherit canonical stage, gate, and current-stage derivation.
  - Build seeded and operator-created pre-build pipelines through `createCanonicalPrebuildStages()` / `createProjectSpawnInput()` instead of UI-local arrays.
observability_surfaces:
  - `state.projects[*].execution.{currentStageId,currentGateId,currentApprovalState,pipelineStatus,handoffReady,progressPercent}`
  - `window.localStorage['lumon.registry.v1']`
  - src/lumon/__tests__/lumon-state.test.js
  - src/lumon/__tests__/lumon-persistence.test.js
  - src/features/mission-control/__tests__/pipeline-board.test.jsx
duration: 2h
verification_result: passed
completed_at: 2026-03-13T20:57:00-07:00
blocker_discovered: false
---

# T01: Canonicalize the intake pipeline and approval contract

**Shipped one canonical Lumon pre-build pipeline model with stable stage/gate IDs, approval-aware current-stage reconciliation, and reload-safe normalization for spawned + seeded projects.**

## What Happened

Moved the pre-build contract into `src/lumon/model.js` and made it the only place that knows how to build or normalize Lumon stages, approvals, and execution progression.

The new model now:
- defines the canonical intake → research → plan → wave(s) → verification → handoff taxonomy
- assigns stable stage IDs in `<projectId>:<stageKey>` form and stable gate IDs like `gate:intake-review`
- normalizes approval state to `pending`, `approved`, `rejected`, `needs_iteration`, or `not_required`
- derives `currentStageId`, `currentGateId`, `currentApprovalState`, `pipelineStatus`, `handoffReady`, and progress from stage truth instead of trusting stale execution fields
- preserves reload compatibility by carrying legacy stage IDs as aliases and reconciling selection against them during hydration

`src/lumon/seed.js` now builds both detailed demo pipelines and fallback/generated pipelines through the same canonical factory. `src/features/mission-control/MissionControlShell.jsx` now spawns new projects with `createProjectSpawnInput()` instead of building stage arrays in the shell.

`src/lumon/reducer.js` was simplified so project, agent, and stage updates flow back through `createProject()`; that means stage/approval edits automatically recompute current stage, gate, pipeline status, and wave progression.

I also added the missing `pipeline-board.test.jsx` file now rather than leaving the slice verifier with a hole.

## Verification

Passed task-level verification:
- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js src/lumon/__tests__/lumon-persistence.test.js`

Passed slice-level checks already exercised during T01:
- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js src/lumon/__tests__/lumon-persistence.test.js`
- `npm run test -- --run src/features/mission-control/__tests__/pipeline-board.test.jsx src/features/mission-control/__tests__/project-registry.test.jsx`
- `npx eslint src/lumon src/features/mission-control`
- `npm run build`

Preview/browser verification on `http://127.0.0.1:4173/`:
- spawned a real project (`Canonical Intake Proof`) through the modal
- inspected `window.localStorage['lumon.registry.v1']` and confirmed canonical stage IDs, gate IDs, `currentStageId`, `currentGateId`, `currentApprovalState`, and `pipelineStatus: "waiting"`
- reloaded the app and confirmed the spawned project remained selected
- switched to Orchestration and confirmed the persisted project surfaced `Intake` as the current stage and `Intake approval` as the current approval label
- browser diagnostics clean: no console errors and no failed requests

## Diagnostics

Inspect later with:
- reducer state: `state.projects[*].execution`
- persisted envelope: `window.localStorage['lumon.registry.v1']`
- selector-backed orchestration surface for `currentStage` / selected-stage approval details
- lumon contract tests for alias reconciliation, gate-aware progression, and reload compatibility

## Deviations

- Added `src/features/mission-control/__tests__/pipeline-board.test.jsx` during T01 even though the slice plan centers that surface more heavily in T02. This was intentional so the slice verification set exists and already exercises the shared pipeline contract.

## Known Issues

- Dashboard cards and project list are still agent-first; T02 still needs to make the dashboard/orchestration surfaces lead with selector-owned stage/gate state rather than treating it as secondary detail.

## Files Created/Modified

- `src/lumon/model.js` — added canonical stage/gate factories, approval normalization, alias-aware stage reconciliation, and spawn helpers.
- `src/lumon/reducer.js` — routed stage/agent/project mutations back through canonical project rehydration and removed stale `currentStageId` patching.
- `src/lumon/seed.js` — rebuilt seeded and fallback pipelines through the shared canonical stage factory.
- `src/features/mission-control/MissionControlShell.jsx` — replaced shell-local project/stage construction with `createProjectSpawnInput()`.
- `src/lumon/__tests__/lumon-state.test.js` — added contract proof for canonical taxonomy, approval-aware transitions, and execution observability.
- `src/lumon/__tests__/lumon-persistence.test.js` — added reload/persistence proof for canonical stage IDs and approval-aware execution state.
- `src/features/mission-control/__tests__/pipeline-board.test.jsx` — added a UI contract test for current stage and approval details in orchestration.
- `.gsd/DECISIONS.md` — recorded the canonical stage ID + alias reconciliation decision.
- `.gsd/milestones/M001/slices/S03/S03-PLAN.md` — marked T01 complete.
- `.gsd/STATE.md` — advanced next action to T02.
