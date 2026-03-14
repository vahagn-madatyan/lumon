# S02: Project registry and persistence

**Goal:** Let Lumon create and persist canonical projects with explicit engine choice so the fleet survives reload without cross-surface drift.
**Demo:** From the real mission-control UI, the operator can spawn a project, choose Claude Code or Codex, reload the app, and recover the same project registry and selected project from local persistence.

## Requirement Focus

- Owns/directly advances: `R002` — multi-project registry and lifecycle tracking.
- Supports: `R012` — execution-engine selection per project.

## Decomposition Notes

- The first risk to retire is restore drift, not JSX polish. If persistence is bolted on after UI work, S02 can easily reintroduce split-brain state or restore an invalid `projectId`/`agentId`/`stageId` tuple.
- The work is therefore grouped into two tasks: first harden the canonical state/persistence boundary, then replace the intake-draft UI with real project creation and prove reload continuity in the rendered shell.
- Verification leans on focused Vitest/RTL coverage plus a real browser reload check because this slice is only true when local persistence survives the actual app entrypoint, not just reducer fixtures.

## Must-Haves

- Canonical Lumon state supports durable `addProject`, `updateProject`, `removeProject`, and `hydrate` flows with stable IDs/timestamps, a project-level `engineChoice`, and selection reconciliation that prevents mismatched project/agent/stage restore.
- The provider loads from a versioned browser-local registry envelope when no explicit `initialState` is supplied, persists canonical state changes after mutations, and treats an intentionally empty persisted registry as valid instead of reseeding demo projects.
- Mission Control retires the local pending-intake queue: modal submit creates a canonical project, selects it immediately, surfaces engine choice in stable project UI, and reload restores the same fleet/selection without console or network errors.

## Proof Level

- This slice proves: operational
- Real runtime required: yes
- Human/UAT required: no

## Verification

- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js src/lumon/__tests__/lumon-persistence.test.js`
- `npm run test -- --run src/features/mission-control/__tests__/project-registry.test.jsx`
- `npx eslint src/mission-control.jsx src/lumon src/features/mission-control`
- `npm run build`
- Preview/browser verification on `http://127.0.0.1:4174/`: create a project with a chosen engine, assert the dashboard/detail surface shows that engine, reload the page, assert the same project still exists and remains selected, then confirm no console errors or failed requests.

## Observability / Diagnostics

- Runtime signals: a versioned localStorage envelope plus selector-driven engine/project identity in rendered UI make restore state inspectable without guessing.
- Inspection surfaces: `src/lumon/__tests__/lumon-persistence.test.js`, `src/features/mission-control/__tests__/project-registry.test.jsx`, rendered selected-project UI, and `window.localStorage` inspection in the browser.
- Failure visibility: stale or corrupt persisted selection should reconcile to a valid project/agent/stage tuple, and an intentionally empty registry should render an empty state instead of silently reseeding or crashing.
- Redaction constraints: persisted data is local project metadata only; no secrets should enter the storage envelope.

## Integration Closure

- Upstream surfaces consumed: `src/lumon/model.js`, `src/lumon/reducer.js`, `src/lumon/context.jsx`, `src/lumon/selectors.js`, `src/features/mission-control/*`, and the S01 seed/demo fleet.
- New wiring introduced in this slice: provider init/save persistence boundary, canonical project CRUD actions, modal submit → `addProject`, and selector/UI wiring for persisted engine identity and empty-state-safe restore.
- What remains before the milestone is truly usable end-to-end: explicit pre-build stage taxonomy/approvals, dossier/handoff views, Severance floor live-state integration, and final operator-loop assembly.

## Tasks

- [x] **T01: Add versioned Lumon registry persistence and selection-safe project CRUD** `est:1.5h`
  - Why: S02’s hardest bug class is invisible restore drift; the canonical state boundary has to own persistence, engine identity, and selection reconciliation before UI wiring changes.
  - Files: `src/lumon/model.js`, `src/lumon/seed.js`, `src/lumon/reducer.js`, `src/lumon/context.jsx`, `src/lumon/persistence.js`, `src/lumon/__tests__/lumon-state.test.js`, `src/lumon/__tests__/lumon-persistence.test.js`, `src/test/setup.js`
  - Do: Extend the canonical project constructor with `engineChoice`, `createdAt`, and `updatedAt`; backfill seed projects; add shared selection reconciliation plus reducer-backed `addProject`/`updateProject`/`removeProject`; add a versioned localStorage adapter with storage-availability checks and empty-registry-safe restore; and wire provider init/save behavior so explicit `initialState` still wins while persisted state is written from effects, not reducer code.
  - Verify: `npm run test -- --run src/lumon/__tests__/lumon-state.test.js src/lumon/__tests__/lumon-persistence.test.js`
  - Done when: canonical state round-trips through storage, invalid persisted selection tuples reconcile safely, empty persisted registries do not reseed demo projects, and tests prove explicit `initialState` overrides local persistence.
- [x] **T02: Replace intake drafts with canonical project creation and reload-proof UI** `est:1.5h`
  - Why: The slice is only real once the operator can create a project from the shell, see the chosen engine as project identity, and watch it survive a remount/reload.
  - Files: `src/mission-control.jsx`, `src/features/mission-control/MissionControlShell.jsx`, `src/features/mission-control/NewProjectModal.jsx`, `src/features/mission-control/DashboardTab.jsx`, `src/features/mission-control/OrchestrationTab.jsx`, `src/lumon/selectors.js`, `src/features/mission-control/__tests__/project-registry.test.jsx`
  - Do: Retire `pendingIntakes`, submit modal data through `addProject`, immediately select the new project, keep canonical project order append-only for floor stability, surface engine identity on stable dashboard/detail selectors, and add graceful empty-registry copy/guards so restored-empty state stays coherent instead of assuming a selected seeded project always exists.
  - Verify: `npm run test -- --run src/features/mission-control/__tests__/project-registry.test.jsx && npx eslint src/mission-control.jsx src/lumon src/features/mission-control && npm run build`
  - Done when: the shell creates a canonical project from the modal, the chosen engine is visible on stable project surfaces, empty registry renders safely, and the rendered integration test proves a remount without `initialState` restores the same registry from storage.

## Files Likely Touched

- `src/mission-control.jsx`
- `src/lumon/model.js`
- `src/lumon/seed.js`
- `src/lumon/reducer.js`
- `src/lumon/context.jsx`
- `src/lumon/persistence.js`
- `src/lumon/selectors.js`
- `src/lumon/__tests__/lumon-state.test.js`
- `src/lumon/__tests__/lumon-persistence.test.js`
- `src/test/setup.js`
- `src/features/mission-control/MissionControlShell.jsx`
- `src/features/mission-control/NewProjectModal.jsx`
- `src/features/mission-control/DashboardTab.jsx`
- `src/features/mission-control/OrchestrationTab.jsx`
- `src/features/mission-control/__tests__/project-registry.test.jsx`
