---
id: T02
parent: S02
milestone: M001
provides:
  - Canonical mission-control project creation with reload-proof engine/selection restore and empty-registry-safe UI surfaces
key_files:
  - src/features/mission-control/MissionControlShell.jsx
  - src/features/mission-control/NewProjectModal.jsx
  - src/features/mission-control/DashboardTab.jsx
  - src/features/mission-control/OrchestrationTab.jsx
  - src/lumon/selectors.js
  - src/features/mission-control/__tests__/project-registry.test.jsx
  - src/test/setup.js
key_decisions:
  - Precompute spawned project IDs in the shell so new agents/stages share the same stable prefix as the persisted project record.
patterns_established:
  - Mission Control now creates canonical queued projects with seeded agents/stages via `addProject`, while selectors surface engine identity on stable dashboard/orchestration/detail projections.
  - Empty persisted registries render create-first dashboard/orchestration states instead of assuming seeded projects or a permanent selection.
observability_surfaces:
  - Rendered engine badges and empty-state copy in dashboard/orchestration, `window.localStorage['lumon.registry.v1']`, and `src/features/mission-control/__tests__/project-registry.test.jsx`
duration: 1h 40m
verification_result: passed
completed_at: 2026-03-14T16:48:38Z
blocker_discovered: false
---

# T02: Replace intake drafts with canonical project creation and reload-proof UI

**Replaced the local intake-draft queue with canonical project creation, surfaced engine identity on stable shell surfaces, and proved reload restore through rendered tests plus the live browser preview.**

## What Happened

I retired `pendingIntakes` from `MissionControlShell` and wired the modal submit path directly to `addProject`, with the shell precomputing a stable project ID plus queued agents/execution stages so the new project is immediately usable by dashboard and orchestration selectors on first render. I updated `NewProjectModal` to submit canonical creation fields (`name`, `description`, `engineChoice`, `agentCount`), added explicit engine language/preview copy, and reset the form cleanly on success.

On the rendered surfaces, `DashboardTab` now shows create-first empty-registry states, stable engine badges on project cards and selected-project detail, and a selection-safe placeholder detail panel when no project exists. `OrchestrationTab` now guards the empty-registry case with a create-first state instead of assuming a selected project/canvas. In `src/lumon/selectors.js`, dashboard/orchestration/detail projections now expose `engineChoice`/`engineLabel` while keeping project order append-only. I also updated the mission-control provider wrapper to accept a custom persistence boundary and added a jsdom `getAnimations()` shim so the new rendered tests stay clean.

## Verification

Passed all slice checks and the live runtime check:

- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js src/lumon/__tests__/lumon-persistence.test.js src/features/mission-control/__tests__/mission-control-shell.test.jsx src/features/mission-control/__tests__/project-registry.test.jsx`
- `npx eslint src/mission-control.jsx src/lumon src/features/mission-control`
- `npm run build`
- Browser preview verification on the Vite preview server:
  - Created `Registry Orbit` from the real shell with `Codex CLI` and 3 agents.
  - Confirmed the selected-project detail showed the `Codex CLI` engine badge and retained the project description.
  - Reloaded the page and confirmed `Registry Orbit` remained selected with `Codex CLI` still visible.
  - Inspected `window.localStorage['lumon.registry.v1']` to confirm `selection.projectId === 'registry-orbit'` and `project.engineChoice === 'codex'` after reload.
  - Confirmed browser diagnostics stayed clean: no console errors and no failed network requests.

## Diagnostics

- Run `npm run test -- --run src/features/mission-control/__tests__/project-registry.test.jsx` for the rendered create/remount proof and empty-registry shell guard.
- Inspect `data-testid="selected-project-engine"` and `data-testid="dashboard-empty-registry"` in the dashboard for quick UI-state confirmation.
- Inspect `window.localStorage.getItem('lumon.registry.v1')` and verify the persisted `projects[]` entry plus `selection.projectId`.
- Use the orchestration empty-state copy plus `data-testid="orchestration-empty-registry"` to distinguish an intentionally empty restore from a broken selection restore.

## Deviations

- Browser preview verification ran on `http://127.0.0.1:4175/` instead of `:4174` because port `4174` was already occupied and Vite auto-shifted to the next available port.

## Known Issues

- `src/features/mission-control/__tests__/mission-control-shell.test.jsx` still emits noisy `[csstree-match] BREAK after 15000 iterations` stderr warnings from the existing styling/tooling stack, but the test passes and no functional regressions were observed in this task.

## Files Created/Modified

- `src/mission-control.jsx` — passed a custom persistence boundary through the provider wrapper for render/integration flexibility.
- `src/features/mission-control/MissionControlShell.jsx` — replaced local intake drafts with canonical project creation and registry-aware header copy.
- `src/features/mission-control/NewProjectModal.jsx` — submitted canonical creation fields, clarified engine selection copy, and reset cleanly after success.
- `src/features/mission-control/DashboardTab.jsx` — surfaced engine identity, added empty-registry/create-first states, and kept selected-project detail safe when no project exists.
- `src/features/mission-control/OrchestrationTab.jsx` — added empty-registry guards and surfaced project engine identity on orchestration detail.
- `src/features/mission-control/ArchitectureTab.jsx` — updated architecture copy to reflect canonical registry creation instead of the retired intake queue.
- `src/lumon/selectors.js` — exposed engine labels on dashboard/detail/orchestration projections and hardened empty-stage orchestration status.
- `src/features/mission-control/__tests__/project-registry.test.jsx` — added the rendered create/remount persistence proof plus empty-registry UI coverage.
- `src/test/setup.js` — added a jsdom `getAnimations()` shim required by the scroll-area stack during rendered mission-control tests.
