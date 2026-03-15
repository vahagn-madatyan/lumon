---
id: T01
parent: S06
milestone: M001
provides:
  - comprehensive integration test proving the full operator loop (create → dashboard → dossier → handoff → orchestration → floor → persistence)
  - cross-surface selection propagation proof (dashboard ↔ floor)
  - persistence round-trip proof through unmount/remount
key_files:
  - src/features/mission-control/__tests__/operator-loop.test.jsx
key_decisions:
  - Used lean 1–2 project fixtures instead of 14-project seed to stay well under 5s timeout (679ms / 656ms / 358ms per test)
  - Split into three focused it() blocks — full loop, cross-surface selection, persistence — rather than one massive test
patterns_established:
  - Factory helpers createWaitingProject / createHandoffReadyProject with override support for flexible fixture composition
observability_surfaces:
  - Test assertion messages identify which surface drifted on failure
duration: 15m
verification_result: passed
completed_at: 2026-03-15
blocker_discovered: false
---

# T01: Full operator loop integration test

**Comprehensive Vitest+RTL test proving the complete operator loop across all five surfaces, superseding the broken 14-project shell test.**

## What Happened

Wrote `operator-loop.test.jsx` with three test cases:

1. **Full loop** — creates a project from empty state via `NewProjectModal`, confirms it appears on dashboard with correct pipeline state (waiting/intake/intake approval/pending), switches through dossier (brief + stage output), handoff (packet readiness), orchestration (pipeline agreement), and Severed Floor (diagnostics + summary-strip counts). All assertions pass in 679ms.

2. **Cross-surface selection** — seeds two projects (waiting + handoff-ready), selects on dashboard → confirms floor agrees, selects different project on floor → confirms dashboard agrees, selects back on dashboard → confirms floor follows. Summary-strip counts verified for both pipeline states.

3. **Persistence round-trip** — creates project from empty state, confirms localStorage envelope, unmounts, remounts without `initialState` (falls through to localStorage), confirms dashboard/pipeline/dossier/floor diagnostics all survive.

Deleted the old `mission-control-shell.test.jsx` which rendered the 14-project seed and timed out at 5s.

## Verification

- `npx vitest run src/features/mission-control/__tests__/operator-loop.test.jsx` — 3 tests pass (1719ms total, well under 5s)
- `npx vitest run` — full suite 32 tests pass, 0 failures (no regressions from shell test removal)
- `npx eslint src/features/mission-control/__tests__/operator-loop.test.jsx` — clean

### Slice-level verification status

- ✅ `operator-loop.test.jsx` — all assertions pass within 5s
- ✅ Old `mission-control-shell.test.jsx` removed, full test suite passes
- ⬜ Live browser verification — deferred to T02
- ✅ ESLint clean

## Diagnostics

Test failure messages identify the specific surface and `data-testid` that drifted. Factory helpers accept overrides for targeted fixture variations.

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/features/mission-control/__tests__/operator-loop.test.jsx` — created: comprehensive integration test (3 test cases, ~200 lines)
- `src/features/mission-control/__tests__/mission-control-shell.test.jsx` — deleted: superseded by operator-loop test
