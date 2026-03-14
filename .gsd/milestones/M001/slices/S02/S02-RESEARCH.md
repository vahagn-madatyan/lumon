# M001/S02 — Research

**Date:** 2026-03-13

## Summary

S02 directly serves **R002** (multi-project registry and lifecycle tracking) and supports **R012** (execution-engine selection per project). S01 left the repo in a good place for this: `src/lumon/*` already provides a canonical reducer/context/selector spine, and dashboard, orchestration, and Severance floor projections all already derive from `state.projects`. The safest S02 move is therefore to extend that spine with project CRUD and persistence rather than introduce a second registry path.

The obvious gap is that there is no persistence yet, but the more important surprises are structural. First, the current “new project” flow in `src/features/mission-control/MissionControlShell.jsx` is still a local `pendingIntakes` array; it never touches canonical state, so reload continuity is impossible. Second, **R012 is not actually modeled yet**: `project.execution` already means pipeline/stage state, while Claude/Codex identity only exists today as `agent.type`. S02 therefore needs a true project-level engine field in addition to a persistence adapter.

There is also a subtle restore hazard: `createLumonState()` only validates `selection.projectId`, not whether `selection.agentId` or `selection.stageId` still belong to that project. That means a persisted restore can hydrate a selected project from one project and a selected agent from another. The recommended S02 approach is: add a versioned browser-local registry adapter, extend the canonical project model with explicit `engineChoice` plus timestamps, add reducer-backed project CRUD, and centralize selection reconciliation so restore/delete/create keep all surfaces coherent.

## Recommendation

Implement S02 as a local-first registry layer around the existing Lumon provider boundary:

1. **Add a replaceable persistence adapter** (for example `src/lumon/persistence.js` or `src/lumon/registry.js`) that:
   - uses a versioned localStorage key and JSON envelope
   - safely detects whether localStorage is actually writable
   - loads persisted canonical state when `initialState` is not supplied
   - falls back to `createSeedLumonState()` only when no valid persisted state exists

2. **Extend the canonical `Project` shape** in `src/lumon/model.js` with fields S02 actually needs:
   - `engineChoice: "claude" | "codex"` as a project-level identity field
   - `createdAt` / `updatedAt` as ISO strings
   - optional `meta` values for persistence/version provenance if needed

   Do **not** rename the existing `project.execution` object during S02; Orchestration selectors and components already depend on it for pipeline rendering.

3. **Add reducer-backed project registry actions** in `src/lumon/reducer.js`:
   - `addProject`
   - `updateProject`
   - `removeProject`
   - keep `hydrate` as the restore path

   These actions should use canonical constructors (`createProject`, `createLumonState`) and a shared **selection reconciliation** helper so that create/delete/restore cannot leave invalid `projectId`/`agentId`/`stageId` combinations behind.

4. **Promote the modal from intake-draft UI to real canonical project creation**:
   - retire `pendingIntakes` as the source of truth
   - convert modal submit into `addProject`
   - select the newly created project immediately
   - persist the updated registry after creation

5. **Surface engine choice in selectors/UI**, not just storage:
   - add engine label/value to dashboard/detail selectors
   - show it in at least one stable project surface so reload visibly proves the choice survived

6. **Preserve floor stability deliberately**:
   - prefer appending new projects to canonical order so existing department anchors stay stable
   - if the dashboard should show newest first, sort in the dashboard selector instead of reordering the canonical array that the floor uses for layout

7. **Keep tests deterministic**:
   - explicit `initialState` props used by tests should still win over persisted state
   - clear or stub localStorage in test setup so new persistence behavior does not leak across tests

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| Canonical project normalization | `createProject()` / `createLumonState()` in `src/lumon/model.js` | They already normalize agents, waves, execution state, and meta; extending them avoids selector drift. |
| Full-state restore path | `hydrate` in `src/lumon/reducer.js` | The reducer already has a whole-state replacement action; reuse it instead of introducing side-channel state setters. |
| Storage availability detection | MDN’s `storageAvailable()` pattern for Web Storage | Checking only `window.localStorage` is not enough; browsers can expose the API but deny writes. |
| Local persistence transport | Web Storage API (`getItem` / `setItem`) + `JSON.stringify` / `JSON.parse` | The slice is local-browser only, and Web Storage already matches the required durability scope without adding a dependency. |

## Existing Code and Patterns

- `src/lumon/model.js` — already contains the canonical constructors. `createProject()` is the right place to add `engineChoice`, `createdAt`, and `updatedAt` rather than constructing ad hoc project objects in UI code.
- `src/lumon/reducer.js` — current single mutation boundary. It already owns selection and stage/agent updates, but it has no project CRUD yet.
- `src/lumon/context.jsx` — best insertion point for persistence load/save. The existing `useReducer(..., init)` setup can become `initialState → persisted state → seed` without changing callers.
- `src/lumon/selectors.js` — all major surfaces already derive from `state.projects`. This is the safest place to add project-engine display fields and any dashboard-only sorting.
- `src/lumon/seed.js` — current demo fleet is the default fallback, but it also reveals a modeling wrinkle: many projects mix Claude and Codex agents, so project-level engine choice must be modeled separately from per-agent `type`.
- `src/features/mission-control/MissionControlShell.jsx` — `pendingIntakes` is the placeholder S02 should retire. Keeping it alongside canonical project creation would immediately reintroduce split-brain state.
- `src/features/mission-control/NewProjectModal.jsx` — current form already captures name, description, engine-like choice, and agent count. It is the natural source payload for `addProject`, but the copy and submit behavior still describe a draft queue.
- `src/features/mission-control/DashboardTab.jsx` — currently renders pending intake cards and project cards separately. S02 should convert the project list into the operator’s real durable registry and remove the temporary intake queue concept.
- `src/features/mission-control/OrchestrationTab.jsx` — currently assumes a selected project exists and renders `projectName`/`phaseLabel` directly. If delete/empty-state flows become user-visible in S02, this surface needs a graceful empty state.
- `src/lumon/__tests__/lumon-state.test.js` and `src/features/mission-control/__tests__/mission-control-shell.test.jsx` — current proof harness is already in place, but persistence will require storage cleanup/isolation and new restore-roundtrip coverage.

## Constraints

- **Slice ownership:** S02 must actually deliver durable project creation/revisit behavior for **R002** and visible project-bound engine identity for **R012**.
- **No persistence library is present in `package.json`.** The project is already on React 19 + Vite + Vitest; browser APIs are the intended path here.
- **`main.jsx` uses `StrictMode`.** React documents that reducer initializers and reducers are invoked twice in development to catch impurities, so storage reads must be pure and writes should happen in effects, not in reducer code.
- **`project.execution` is already spoken for.** It currently represents pipeline/stage execution state, not Claude/Codex choice, so S02 needs a separate project-level engine field.
- **Selection is only partially normalized today.** `createLumonState()` validates project selection but not project/agent/stage coherence, which matters the moment persisted restore enters the picture.
- **Project array order affects the Severance floor layout.** `selectFloorViewModel()` assigns department anchors by project index, so registry ordering decisions become visual-layout decisions.
- **Current tests pass `initialState` directly.** Persistence must not silently override those fixtures or the S01 proof harness will become nondeterministic.
- **Current UI assumes a non-empty registry in a few places.** If delete semantics are exposed in S02, empty-state copy/guards will be needed.
- **Persist only canonical state.** S01 intentionally kept modal open state, tab state, terminal playback, and React Flow interaction state out of the domain contract; S02 should keep that boundary intact.

## Common Pitfalls

- **Mistaking `agent.type` for project engine choice** — existing agents already mix Claude and Codex within one project, so this does not satisfy R012 by itself.
- **Letting localStorage override explicit `initialState`** — this would break tests, preview fixtures, and any deterministic harness that mounts `MissionControl` with a supplied state.
- **Hydrating stale selection tuples** — restoring `projectId`, `agentId`, and `stageId` without reconciling them can leave dashboard, terminal, orchestration, and floor selections out of sync.
- **Prepending new projects into `state.projects`** — that will shift floor department anchors for every existing project. Append canonically and sort only in view selectors if needed.
- **Treating “no persisted projects” as “load the seed again”** — once persistence exists, an intentionally empty registry must remain possible. Use “storage key missing/invalid” as the fallback condition, not “projects.length === 0`”.
- **Hard-coding a rich new-project pipeline in S02** — S03 owns the stable pre-build taxonomy. S02 should create enough pipeline/default metadata to render safely without locking in the wrong stage contract.

## Open Risks

- Seed backfill for project-level engine choice needs an explicit rule; otherwise legacy demo data will remain ambiguous.
- If S02 exposes delete UI immediately, the current empty-state behavior in orchestration/detail surfaces will feel unfinished.
- Floor room placement will still drift on deletion unless S02 introduces a stable per-project layout slot or accepts that temporary limitation.
- S03/S04 will extend the persisted project shape with richer stage and dossier data, so S02 should version its storage envelope from day one.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| React | `vercel-react-best-practices` | installed |
| Vite | `antfu/skills@vite` | available — `npx skills add antfu/skills@vite` |
| Vitest | `onmax/nuxt-skills@vitest` | available — `npx skills add onmax/nuxt-skills@vitest` |
| Web Storage / localStorage | none found | none found |

## Sources

- Canonical project/state constructors and current lack of project timestamps or engine-choice field (source: `src/lumon/model.js`)
- Current reducer action surface and missing project CRUD actions (source: `src/lumon/reducer.js`)
- Provider initialization pattern and action wiring (source: `src/lumon/context.jsx`)
- Current selector projections, floor anchor ordering, and cross-surface dependency on `state.projects` (source: `src/lumon/selectors.js`)
- Seed-project construction and mixed per-project agent types (source: `src/lumon/seed.js`)
- Local-only intake draft flow that bypasses canonical state (source: `src/features/mission-control/MissionControlShell.jsx`, `src/features/mission-control/NewProjectModal.jsx`, `src/features/mission-control/DashboardTab.jsx`)
- Existing test harness and deterministic `initialState` usage (source: `src/lumon/__tests__/lumon-state.test.js`, `src/features/mission-control/__tests__/mission-control-shell.test.jsx`, `vite.config.js`, `src/test/setup.js`)
- Reducer initializer behavior, purity expectations, and Strict Mode caveat (source: [React `useReducer`](https://react.dev/reference/react/useReducer))
- Effects as the right place to synchronize React state with external systems (source: [React — Lifecycle of Reactive Effects](https://react.dev/learn/lifecycle-of-reactive-effects))
- `localStorage` persistence characteristics and `SecurityError` caveats (source: [MDN — Window: localStorage property](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage))
- Feature-detecting storage availability, string-only storage, and `storage` event semantics (source: [MDN — Using the Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API))
