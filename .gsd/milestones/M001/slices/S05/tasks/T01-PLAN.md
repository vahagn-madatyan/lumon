---
estimated_steps: 4
estimated_files: 3
---

# T01: Canonicalize the floor selector around project pipeline truth

**Slice:** S05 — Severed floor live-state integration
**Milestone:** M001

## Description

Retire the real S05 drift seam in `src/lumon/*` by rebuilding the floor projection from canonical project pipeline view models, not raw project/agent inference, so the floor can share dashboard truth while keeping deterministic layout behavior intact.

## Steps

1. Reuse or extract the canonical project view-model path so `selectFloorViewModel()` and related floor helpers derive departments from the same pipeline, stage, gate, and approval truth already used by dashboard and orchestration selectors.
2. Add floor-specific project presence metadata for each department and the selected project: pipeline status/label, summary, current stage, current gate, current approval state, and any summary counts needed to make waiting, blocked, and handoff-ready work inspectable at the floor seam.
3. Adjust room sizing and presence rules so approval-waiting, blocked, or handoff-ready projects remain visibly present even when no agents are currently at desks, without mutating canonical agent statuses or changing deterministic department ordering.
4. Expand `src/lumon/__tests__/lumon-state.test.js` to prove the floor selector contract for waiting, blocked, handoff-ready, and running projects, including selected-project diagnostics and presence/count behavior.

## Must-Haves

- [ ] `selectFloorViewModel()` exposes project-layer pipeline diagnostics and presence metadata derived from canonical project view models rather than raw project/agent status inference.
- [ ] Agent status remains canonical and separate from project approval state, and the floor selector preserves deterministic department order/anchors while keeping non-running active projects visible.

## Verification

- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js`
- The tests assert floor pipeline status, current stage, current gate, approval summary, and presence/count behavior for waiting, blocked, handoff-ready, and running projects rather than only broad object snapshots.

## Observability Impact

- Signals added/changed: the floor selector now emits approval-aware project diagnostics, presence metadata, and summary counts as inspectable state.
- How a future agent inspects this: inspect `selectFloorViewModel(state)` directly and use the selector/state tests to verify floor truth before looking at rendered UI.
- Failure state exposed: waiting, blocked, and handoff-ready projects stay visible with explicit current-stage/current-gate context instead of collapsing into generic queued/complete floor states.

## Inputs

- `src/lumon/model.js` — canonical stage, approval, and project contracts that S05 must reuse instead of forking.
- `src/lumon/selectors.js` — existing project view-model and floor projection seam where the current drift lives.
- S05 research and S03 forward intelligence — the floor must inherit canonical pipeline truth and keep agent status separate from project approval state.

## Expected Output

- `src/lumon/model.js` / `src/lumon/selectors.js` — a pipeline-aware floor selector contract with stable project diagnostics and presence metadata.
- `src/lumon/__tests__/lumon-state.test.js` — contract proof that the floor selector matches shared dashboard/orchestration truth for approval-aware project states.
