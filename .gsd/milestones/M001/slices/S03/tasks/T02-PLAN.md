---
estimated_steps: 4
estimated_files: 5
---

# T02: Make dashboard and orchestration stage-first over the shared contract

**Slice:** S03 — Pipeline board and approval model
**Milestone:** M001

## Description

Project the canonical pipeline contract into the main dashboard and orchestration surface so the operator can see each project’s stage journey, approval gate, and blocked/waiting/handoff-ready state without drilling into agent-only detail.

## Steps

1. Extend `src/lumon/selectors.js` with dashboard-first pipeline view models that expose per-project stage timeline, current gate, approval summary, and handoff readiness from canonical state.
2. Rework `src/features/mission-control/DashboardTab.jsx` so the pipeline board and approval state become the primary project summary, with agent cards kept as secondary detail.
3. Update `src/features/mission-control/OrchestrationTab.jsx` to render approval-aware stage detail from selectors while keeping React Flow nodes/edges as local presentation state.
4. Add rendered integration coverage and real-browser checks for stage visibility, approval gating, reload continuity, and clean diagnostics.

## Must-Haves

- [ ] The main dashboard clearly prioritizes per-project stage/gate status and approval-aware summaries over pure agent metrics.
- [ ] Dashboard and orchestration read the same selector-owned current stage and approval truth, including waiting, blocked, and handoff-ready states.

## Verification

- `npm run test -- --run src/features/mission-control/__tests__/pipeline-board.test.jsx src/features/mission-control/__tests__/project-registry.test.jsx`
- Preview/browser assertions confirm stage board visibility, approval-state rendering, reload continuity, and no console or failed-network regressions.

## Observability Impact

- Signals added/changed: rendered pipeline board, current gate labels, and handoff readiness become stable inspection surfaces in the main dashboard.
- How a future agent inspects this: dashboard/orchestration test ids and selector outputs make it obvious whether a project is running, waiting for approval, blocked for iteration, or ready for handoff.
- Failure state exposed: mismatches between dashboard and orchestration stage truth are caught by rendered/browser assertions instead of hiding behind canvas visuals.

## Inputs

- `src/lumon/selectors.js` — current dashboard/orchestration projections that still prioritize agent-derived status.
- `src/features/mission-control/DashboardTab.jsx` — current main-screen hierarchy that must be rebalanced to satisfy R016.
- `src/features/mission-control/OrchestrationTab.jsx` — existing React Flow adapter that should stay presentation-only while consuming richer selector data.
- `src/features/mission-control/__tests__/project-registry.test.jsx` — existing reload-safe UI proof that should expand to cover stage/approval continuity.
- T01 output: canonical stage taxonomy, approval model, and current-stage rules.

## Expected Output

- `src/lumon/selectors.js` — gate-aware dashboard and orchestration view models.
- `src/features/mission-control/DashboardTab.jsx` / `src/features/mission-control/OrchestrationTab.jsx` — stage-first UI wired to shared selector state.
- `src/features/mission-control/__tests__/pipeline-board.test.jsx` — rendered proof for project stage board and approval visibility.
- `src/features/mission-control/__tests__/project-registry.test.jsx` — reload continuity proof extended to persisted pipeline state.
