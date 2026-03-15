# S06: End-to-end operator loop integration

**Goal:** Prove the full operator loop — create a project, inspect it across dashboard/dossier/handoff, observe pipeline state, and watch the Severance floor stay synchronized — works in both jsdom and the real browser entrypoint.
**Demo:** Create a project from empty state, confirm it renders across all five surfaces (dashboard, dossier, handoff, orchestration, Severance floor), switch selection across surfaces, reload, and confirm everything reconnects.

## Must-Haves

- One comprehensive integration test exercises the full create → inspect → cross-surface → reload loop with a lean fixture (≤3 projects, well under 5s timeout)
- The broken `mission-control-shell.test.jsx` is superseded by the new test
- Live browser acceptance covers the same loop scenarios in the real running app
- All M001 milestone success criteria are re-verified against live browser behavior

## Proof Level

- This slice proves: final-assembly
- Real runtime required: yes
- Human/UAT required: no (browser automation produces the evidence)

## Verification

- `npm run test -- --run src/features/mission-control/__tests__/operator-loop.test.jsx` — all assertions pass within 5s
- The old `mission-control-shell.test.jsx` is removed and the full test suite still passes: `npm run test -- --run`
- Live browser verification: create project → inspect all detail tabs → check orchestration → check floor → reload persistence
- `npx eslint src/features/mission-control/__tests__/operator-loop.test.jsx` — clean

## Observability / Diagnostics

- Runtime signals: selector-backed `data-testid` surfaces across all five tabs (dashboard, dossier, handoff, orchestration, floor)
- Inspection surfaces: `window.localStorage['lumon.registry.v1']`, `selectDashboardProjects`, `selectSelectedProjectDetail`, `selectFloorViewModel`
- Failure visibility: test assertion messages identify which surface drifted; browser `evaluate` can inspect selector output directly

## Integration Closure

- Upstream surfaces consumed: S03 pipeline/approval selectors, S04 dossier/handoff selector contract, S05 floor diagnostics and department presence
- New wiring introduced in this slice: none — S06 proves existing connections, it doesn't add new ones
- What remains before the milestone is truly usable end-to-end: nothing — S06 is the final slice

## Tasks

- [x] **T01: Full operator loop integration test** `est:45m`
  - Why: Proves the complete create → inspect → cross-surface → reload loop through one rendered test with a lean fixture, superseding the broken 14-project shell test that times out
  - Files: `src/features/mission-control/__tests__/operator-loop.test.jsx`, `src/features/mission-control/__tests__/mission-control-shell.test.jsx` (delete)
  - Do: Write a comprehensive Vitest + RTL test that creates a project from empty state, confirms dashboard/pipeline/dossier/handoff/orchestration surfaces, switches to floor and confirms diagnostics synchronization, tests cross-surface selection propagation, unmounts and remounts to confirm persistence. Use `createLumonState({ projects: [], selection: {} })` for the lean fixture. Delete the old shell test. Run full test suite to confirm no regressions.
  - Verify: `npm run test -- --run src/features/mission-control/__tests__/operator-loop.test.jsx` passes, `npm run test -- --run` (full suite) passes, `npx eslint src/features/mission-control/__tests__/operator-loop.test.jsx` clean
  - Done when: all operator-loop assertions pass within 5s, old shell test removed, full suite green

- [x] **T02: Live browser acceptance and M001 milestone closure** `est:45m`
  - Why: Proves the same operator loop in the real browser entrypoint — the M001 milestone definition of done requires "the real browser entrypoint supports a coherent operator loop" verified against live behavior, not just jsdom
  - Files: none created — this task produces browser evidence and milestone closure artifacts (`.gsd/milestones/M001/slices/S06/S06-SUMMARY.md`, `.gsd/STATE.md`, `.gsd/PROJECT.md`, `.gsd/milestones/M001/M001-ROADMAP.md`)
  - Do: Start preview server, create a project through the real modal, verify all detail tabs render selector-owned content, verify orchestration agreement, switch to Severance Floor and verify diagnostics match dashboard, reload and verify persistence. Use `browser_evaluate` to inspect selector output and localStorage when Base UI tab switching is unreliable in Playwright. Produce the S06 summary, mark the slice and milestone complete, and update state files.
  - Verify: Browser assertions pass for project creation, detail inspection, floor synchronization, and reload persistence. All M001 success criteria confirmed against live behavior.
  - Done when: S06 summary written with verification evidence, M001 roadmap shows all slices complete, STATE.md reflects milestone completion

## Files Likely Touched

- `src/features/mission-control/__tests__/operator-loop.test.jsx`
- `src/features/mission-control/__tests__/mission-control-shell.test.jsx` (delete)
- `.gsd/milestones/M001/slices/S06/S06-SUMMARY.md`
- `.gsd/milestones/M001/M001-ROADMAP.md`
- `.gsd/STATE.md`
- `.gsd/PROJECT.md`
- `.gsd/REQUIREMENTS.md`
