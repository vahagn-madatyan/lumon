---
estimated_steps: 4
estimated_files: 3
---

# T02: Render approval-aware floor presence and prove shell synchronization

**Slice:** S05 — Severed floor live-state integration
**Milestone:** M001

## Description

Render the new floor contract through `src/severance-floor.jsx` without moving derivation logic into the component, then prove the dashboard and Severed Floor stay synchronized for approval-aware project states in the real mission-control shell.

## Steps

1. Update `src/severance-floor.jsx` to render department shell tones, selected-project diagnostics, and any summary-strip indicators from selector-owned floor metadata rather than coarse project status inference.
2. Add stable floor `data-testid` surfaces for selected-project pipeline status, current stage, current gate, approval summary, and any new summary counts needed for waiting/blocked/handoff-ready verification.
3. Add rendered mission-control coverage in `src/features/mission-control/__tests__/severance-floor-live-state.test.jsx` and/or the existing shell integration test so dashboard selection, floor selection, and approval-aware project states stay synchronized through the shared `floor` prop seam.
4. Finish with local preview/browser verification that selects proof projects, checks the same floor diagnostics before and after reload, confirms console/network health, and does a visual pass on the Lumon-specific department-state presentation.

## Must-Haves

- [ ] `SeveranceFloor` remains a presentational shell: it consumes selector-owned floor metadata and does not re-derive pipeline, gate, or approval truth internally.
- [ ] The rendered floor visibly distinguishes waiting, blocked, handoff-ready, and running/complete states through Lumon-specific presentation and stable test surfaces, and the shell tests prove dashboard ↔ floor synchronization.

## Verification

- `npm run test -- --run src/features/mission-control/__tests__/severance-floor-live-state.test.jsx`
- Preview/browser verification confirms the selected-project floor diagnostics and department presentation match dashboard truth before and after reload, with no console errors or failed requests.

## Observability Impact

- Signals added/changed: the floor UI exposes stable diagnostics for selected-project pipeline state, current stage/gate, approval summary, and summary-strip counts needed for sync verification.
- How a future agent inspects this: use the floor `data-testid` surfaces in rendered tests/browser assertions and compare them against dashboard diagnostics for the same selected project.
- Failure state exposed: if the floor drifts from dashboard truth, the mismatch becomes visible in one place instead of being buried in visual-only atmosphere cues.

## Inputs

- `src/severance-floor.jsx` — current presentational shell that needs to stay presentation-only while becoming pipeline-aware.
- `src/features/mission-control/__tests__/mission-control-shell.test.jsx` — existing cross-surface sync proof that should be extended or complemented, not replaced.
- T01 output — selector-owned floor diagnostics and presence metadata that the component and tests should consume directly.

## Expected Output

- `src/severance-floor.jsx` — approval-aware floor presentation with stable diagnostics and Lumon-specific department-state rendering.
- `src/features/mission-control/__tests__/severance-floor-live-state.test.jsx` / `src/features/mission-control/__tests__/mission-control-shell.test.jsx` — rendered proof that dashboard and floor remain synchronized for waiting, blocked, handoff-ready, and running states.
