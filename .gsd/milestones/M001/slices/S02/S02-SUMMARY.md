---
id: S02
parent: M001
milestone: M001
provides:
  - Durable canonical project registry persistence with reload-safe selection restore and per-project engine identity
requires:
  - slice: S01
    provides: Canonical Lumon project/agent/stage state, shared actions, and selector contracts
affects:
  - S03
  - S04
  - S05
  - S06
key_files:
  - src/lumon/persistence.js
  - src/lumon/context.jsx
  - src/lumon/reducer.js
  - src/lumon/model.js
  - src/lumon/selectors.js
  - src/features/mission-control/MissionControlShell.jsx
  - src/features/mission-control/NewProjectModal.jsx
  - src/features/mission-control/DashboardTab.jsx
  - src/features/mission-control/OrchestrationTab.jsx
  - src/features/mission-control/__tests__/project-registry.test.jsx
key_decisions:
  - Persist canonical Lumon state through a versioned provider-bound localStorage envelope, with explicit initialState precedence over persisted data.
  - Precompute spawned project IDs in the shell so new project, agent, and stage records share stable canonical prefixes before dispatch.
patterns_established:
  - Initialization precedence is now explicit: initialState -> persisted registry -> seeded demo state.
  - Persisted empty registries are valid canonical state and render safe create-first surfaces instead of reseeding demo projects.
  - Mission Control creates canonical queued projects via addProject rather than maintaining a separate pending-intake draft queue.
observability_surfaces:
  - Browser localStorage key `lumon.registry.v1`
  - src/lumon/__tests__/lumon-persistence.test.js
  - src/features/mission-control/__tests__/project-registry.test.jsx
  - Rendered engine badges and selected-project detail in the dashboard/orchestration surfaces
  - window.localStorage inspection during live browser verification
drill_down_paths:
  - .gsd/milestones/M001/slices/S02/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S02/tasks/T02-SUMMARY.md
duration: 2.6h
verification_result: passed
completed_at: 2026-03-14T09:54:00-07:00
---

# S02: Project registry and persistence

**Lumon now creates canonical projects with explicit engine choice, persists the registry through a versioned local envelope, and restores fleet plus selection cleanly after reload.**

## What Happened

S02 closed the persistence gap between the shared Lumon state spine and the visible mission-control shell.

On the state boundary, the slice hardened canonical project records with stable IDs, timestamps, and project-level `engineChoice`, then added reducer-backed `addProject`, `updateProject`, `removeProject`, and hydration flows that reconcile selection tuples against real project/agent/stage ownership. Persistence lives at the provider boundary instead of inside reducer logic, so the app now restores from a versioned `lumon.registry.v1` envelope when no explicit `initialState` is supplied, while still letting tests and controlled renders override browser storage deterministically.

On the UI side, the old local pending-intake queue was retired. The real shell now submits modal data directly into canonical project creation, immediately selects the spawned project, and surfaces engine identity on stable dashboard and orchestration views. New projects are appended in canonical order for downstream floor stability, and empty persisted registries now render safe create-first states instead of assuming a seeded project will always exist.

The slice also proved the operational runtime path: a project created through the live browser shell remained selected after reload, kept its `Codex CLI` engine badge and description, and round-tripped through the versioned localStorage envelope without console or network failures.

## Verification

Passed all slice-level checks from the plan:

- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js src/lumon/__tests__/lumon-persistence.test.js`
- `npm run test -- --run src/features/mission-control/__tests__/project-registry.test.jsx`
- `npx eslint src/mission-control.jsx src/lumon src/features/mission-control`
- `npm run build`

Live browser verification passed on the preview server at `http://127.0.0.1:4175/` after Vite auto-shifted from busy port `4174`:

- created project `Persistence Sentinel`
- chose `Codex CLI`
- confirmed the selected-project surface showed the chosen engine and description
- reloaded the app and confirmed the same project remained selected
- inspected `window.localStorage['lumon.registry.v1']` and confirmed `selection.projectId === 'persistence-sentinel'` plus `project.engineChoice === 'codex'`
- confirmed no browser console errors and no failed network requests during the verification window

Observability/diagnostic surfaces were confirmed:

- the versioned localStorage envelope is directly inspectable in the browser
- named persistence/state tests prove round-trip behavior, empty-registry restore, corrupt-storage fallback, and `initialState` precedence
- rendered selected-project and engine surfaces expose restore correctness without having to infer state indirectly

## Requirements Advanced

- R002 — S02 delivered canonical multi-project creation, local persistence, reload-safe revisit behavior, and coherent empty-registry handling.
- R012 — S02 made engine choice part of canonical project identity and surfaced it consistently in persisted UI state.

## Requirements Validated

- R002 — Validated by reducer/persistence tests, rendered registry integration coverage, and live browser create-plus-reload verification.
- R012 — Validated by canonical project creation, persisted engine badges, localStorage inspection, and reload restore of the chosen engine.

## New Requirements Surfaced

- none

## Requirements Invalidated or Re-scoped

- none

## Deviations

- The written preview verification target was `http://127.0.0.1:4174/`, but local port `4174` was already occupied, so Vite served the verified preview on `http://127.0.0.1:4175/`.

## Known Limitations

- The canonical update/remove flows exist in state and persistence, but S02 only exposed project creation through the mission-control UI; richer registry management can be layered on later surfaces.
- The pipeline stage taxonomy, approval gates, dossier views, and live Severance floor integration are still deferred to later M001 slices.
- Existing rendered tests may still emit noisy styling-stack stderr warnings (`[csstree-match] BREAK after 15000 iterations`) even when the functional assertions pass.

## Follow-ups

- S03 should attach an explicit pre-build stage taxonomy and approval model to the now-stable persisted project IDs and selected-project contract.
- S04 can now rely on durable project metadata and selection-safe detail loading for dossier and handoff packet surfaces.

## Files Created/Modified

- `src/lumon/persistence.js` — stores and restores the versioned local registry envelope with safe storage checks and fallback behavior.
- `src/lumon/context.jsx` — applies initialization precedence and effect-driven persistence writes.
- `src/lumon/model.js` — defines canonical project timestamps, engine identity, and selection reconciliation helpers.
- `src/lumon/reducer.js` — exposes canonical project CRUD and safe hydration transitions.
- `src/lumon/selectors.js` — projects engine identity and empty-state-safe view models into shell surfaces.
- `src/mission-control.jsx` — passes a configurable persistence boundary into the mission-control wrapper.
- `src/features/mission-control/MissionControlShell.jsx` — replaces local intake drafts with canonical project spawning and immediate selection.
- `src/features/mission-control/NewProjectModal.jsx` — submits canonical project fields, including engine choice and seeded agent count.
- `src/features/mission-control/DashboardTab.jsx` — renders engine identity and empty-registry-safe selected-project states.
- `src/features/mission-control/OrchestrationTab.jsx` — guards empty registry state and reflects persisted engine/project identity.
- `src/features/mission-control/ArchitectureTab.jsx` — updates copy to reflect canonical registry creation rather than the retired intake queue.
- `src/lumon/__tests__/lumon-state.test.js` — covers canonical CRUD and selection reconciliation.
- `src/lumon/__tests__/lumon-persistence.test.js` — covers persistence round-trip, empty restore, fallback behavior, and `initialState` precedence.
- `src/features/mission-control/__tests__/project-registry.test.jsx` — proves rendered create/remount persistence and empty-registry UI behavior.
- `src/test/setup.js` — adds deterministic storage cleanup and test-environment shims needed by rendered mission-control surfaces.
- `.gsd/REQUIREMENTS.md` — moves R002 and R012 to validated based on slice proof.
- `.gsd/milestones/M001/M001-ROADMAP.md` — marks S02 complete.
- `.gsd/PROJECT.md` — refreshes project status to reflect shipped registry persistence.
- `.gsd/STATE.md` — advances active work toward S03.

## Forward Intelligence

### What the next slice should know
- Persisted project identity is now trustworthy enough to attach stage contracts, approvals, and dossier views without inventing a second registry path.
- Empty persisted state is intentional and must stay first-class; later slices should not quietly reseed demo data when the registry is empty.
- Project ordering is append-only today to avoid floor-anchor churn, so downstream views should avoid hidden resorting unless they deliberately own that behavior.

### What's fragile
- Browser/tooling text assertions over the full page can be noisy because the dashboard is text-dense; selector- or state-based verification is more reliable than broad body-text matching.
- The styling/test stack can emit non-fatal `csstree-match` warnings during rendered tests; functional assertions remain the trustworthy signal.

### Authoritative diagnostics
- `src/lumon/__tests__/lumon-persistence.test.js` — best source for persistence precedence, corrupt-envelope fallback, and empty-registry restore behavior.
- `src/features/mission-control/__tests__/project-registry.test.jsx` — best source for create/remount UI proof and empty-registry rendering behavior.
- `window.localStorage.getItem('lumon.registry.v1')` — fastest runtime truth source for project roster, engine choice, and selection restore.

### What assumptions changed
- The shell no longer needs a separate pending-intake draft registry — canonical project creation can happen immediately at modal submit time.
- Reload continuity did not require a backend or router change — the provider-bound versioned local registry was sufficient for this slice’s operational proof.
