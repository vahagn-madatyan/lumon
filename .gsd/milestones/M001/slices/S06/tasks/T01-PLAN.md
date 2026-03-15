---
estimated_steps: 5
estimated_files: 2
---

# T01: Full operator loop integration test

**Slice:** S06 — End-to-end operator loop integration
**Milestone:** M001

## Description

Write a single comprehensive Vitest + RTL test that exercises the full operator loop — create a project from empty state, confirm it appears across all primary surfaces (dashboard, dossier, handoff, orchestration, Severance floor), test cross-surface selection propagation, and verify persistence through unmount/remount. This supersedes the broken `mission-control-shell.test.jsx` which renders the 14-project seed and times out at 5s.

The test uses `createLumonState({ projects: [], selection: {} })` for initial render, creates a project through `NewProjectModal`, then walks every surface the operator would inspect. It also seeds a second project with a different pipeline state to test cross-surface selection and floor summary counts.

## Steps

1. Create `src/features/mission-control/__tests__/operator-loop.test.jsx` with a test that:
   - Renders `MissionControl` with an empty initial state
   - Opens the new-project modal, fills name/description/engine, submits
   - Confirms the new project appears on the dashboard with correct pipeline state (waiting, intake stage, intake approval gate, pending approval)
   - Switches to dossier tab — confirms brief and stage-output content
   - Switches to handoff tab — confirms packet readiness
   - Switches to orchestration shell tab — confirms pipeline status, stage, gate, approval match dashboard
   - Switches to Severed Floor tab — confirms selected-project diagnostics match dashboard
   - Confirms summary-strip counts reflect the single project's pipeline state
2. Add a second `it()` block that tests cross-surface selection with two projects:
   - Renders with a lean fixture using `createLumonState({ projects: [waitingProj, handoffReadyProj] })`
   - Selects project on dashboard → switches to floor → confirms floor agrees
   - Selects different project on floor → switches to dashboard → confirms dashboard agrees
3. Add a third `it()` block for persistence round-trip:
   - Creates a project from empty state
   - Unmounts, remounts without `initialState` (falls through to localStorage)
   - Confirms dashboard, pipeline state, dossier, and floor diagnostics survive the reload
4. Delete `src/features/mission-control/__tests__/mission-control-shell.test.jsx`
5. Run full test suite to confirm no regressions

## Must-Haves

- [ ] Full create → dashboard → dossier → handoff → orchestration → floor loop passes in one test
- [ ] Cross-surface selection propagation (dashboard↔floor) proven with two projects
- [ ] Persistence round-trip proven through unmount/remount
- [ ] Old `mission-control-shell.test.jsx` deleted
- [ ] All tests pass within 5s default timeout
- [ ] Full test suite (`npm run test -- --run`) passes

## Verification

- `npm run test -- --run src/features/mission-control/__tests__/operator-loop.test.jsx` — all assertions pass
- `npm run test -- --run` — full suite passes (no regressions from shell test removal)
- `npx eslint src/features/mission-control/__tests__/operator-loop.test.jsx` — clean

## Inputs

- `src/features/mission-control/__tests__/project-registry.test.jsx` — closest existing pattern: project creation from empty state, modal interaction, pipeline state verification, persistence round-trip
- `src/features/mission-control/__tests__/severance-floor-live-state.test.jsx` — floor diagnostics verification pattern, factory helpers for proof projects with specific pipeline states
- `src/features/mission-control/__tests__/project-dossier.test.jsx` — dossier/handoff tab switching and content assertion pattern
- S06 Research — constraints on test timeout, Base UI tab behavior in jsdom, modal input patterns

## Expected Output

- `src/features/mission-control/__tests__/operator-loop.test.jsx` — comprehensive integration test proving the full operator loop
- `src/features/mission-control/__tests__/mission-control-shell.test.jsx` — deleted
