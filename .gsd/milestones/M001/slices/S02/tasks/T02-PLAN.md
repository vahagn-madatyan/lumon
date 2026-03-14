---
estimated_steps: 5
estimated_files: 7
---

# T02: Replace intake drafts with canonical project creation and reload-proof UI

**Slice:** S02 — Project registry and persistence
**Milestone:** M001

## Description

Connect the real mission-control shell to the new registry so project creation happens once, engine choice is visible as project identity, and reload continuity is proven at the rendered surface level. This task retires the temporary intake queue and closes the operator-facing loop for S02.

## Steps

1. Replace `pendingIntakes` in `MissionControlShell` with `addProject`-backed creation, immediate selection of the new project, and updated modal/header copy that reflects a real registry instead of a local draft queue.
2. Update `NewProjectModal` so it submits canonical creation fields (`name`, `description`, `engineChoice`, `agentCount`), resets cleanly after success, and keeps the engine choice explicit in the form language.
3. Extend dashboard/detail selectors and UI so project engine choice is shown on stable surfaces, while keeping canonical project order append-only for Severance-floor layout stability.
4. Add graceful empty-registry states/guards in dashboard and orchestration surfaces so a restored-empty registry remains usable and does not assume seeded data or a permanently selected project.
5. Add a rendered integration test that creates a project, verifies engine identity is shown, remounts the shell without `initialState`, and confirms the same project/selection restore from localStorage.

## Must-Haves

- [ ] Clicking “Spawn new project” creates a canonical project and selects it immediately instead of adding a local intake draft.
- [ ] The chosen Claude/Codex engine is visible on at least one dashboard-level surface and the selected-project detail after reload.
- [ ] An intentionally empty persisted registry renders a safe create-first shell state instead of broken orchestration/detail assumptions.

## Verification

- `npm run test -- --run src/features/mission-control/__tests__/project-registry.test.jsx`
- Browser preview check: create a project, reload, confirm the project card/detail and engine label survive, and verify browser diagnostics remain clean.

## Observability Impact

- Signals added/changed: rendered engine labels and empty-state copy make create/restore results visible immediately in the shell.
- How a future agent inspects this: run the rendered integration test, inspect the selected-project UI after reload, and compare it with the persisted localStorage envelope.
- Failure state exposed: missing persistence shows the project disappearing on remount; invalid restore shows the shell falling back to empty-state/selection-safe behavior instead of cross-project mismatch.

## Inputs

- `src/lumon/persistence.js`, `src/lumon/context.jsx` — registry load/save and action boundary from T01.
- `src/features/mission-control/MissionControlShell.jsx` — current local pending-intake flow to retire.
- `src/features/mission-control/NewProjectModal.jsx` — current draft-only project form to repurpose for canonical creation.
- `src/lumon/selectors.js` — existing dashboard/detail projections that need engine identity and empty-state-safe behavior.

## Expected Output

- `src/mission-control.jsx`, `src/features/mission-control/MissionControlShell.jsx`, `src/features/mission-control/NewProjectModal.jsx`, `src/features/mission-control/DashboardTab.jsx`, `src/features/mission-control/OrchestrationTab.jsx`, `src/lumon/selectors.js` — UI surfaces wired to the canonical project registry and restore-safe empty states.
- `src/features/mission-control/__tests__/project-registry.test.jsx` — rendered proof of project creation and remount/reload persistence.
