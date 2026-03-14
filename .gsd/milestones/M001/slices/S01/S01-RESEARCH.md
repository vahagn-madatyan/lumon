# M001/S01 — Research

**Date:** 2026-03-12

## Summary

S01 directly serves **R001** and supports **R020**. It is also the foundation slice for later **R002 / R003 / R012 / R016** work because the current prototype has no canonical Lumon state at all — it has one 1,556-line `src/mission-control.jsx` module with independent mock structures for projects, orchestration pipelines, terminal output, architecture content, and local UI state. The dashboard and Severance floor already share one useful seam (`allAgents` is derived from `MOCK_PROJECTS` and passed into `SeveranceFloor`), but the orchestration tab is powered by a separate `WORKFLOW_PIPELINES` array that only covers 3 of 14 projects and encodes a different, GSD-execution-oriented stage model.

The right move for S01 is not a library migration or a full routing/persistence pass. It is a state-model refactor in plain React/JS: extract a canonical Lumon domain module, move mock seeds out of view files, add reducer-driven app state + selector hooks, and make at least the dashboard and Severance floor consume the same project/agent truth. React Flow node/edge state should stay local to the orchestration surface and be rebuilt from domain data, not stored globally. That keeps the distinct UI intact while retiring the biggest risk: view-local mock drift.

The current prototype still builds (`npm run build` passes), but it ships as a single ~605 kB JS bundle and the lint surface is rough: `npm run lint` crashes because tracked `dist2`–`dist12` folders are not ignored, and `npx eslint src` shows real hook/purity issues in `mission-control.jsx` and `severance-floor.jsx`. S01 should expect to touch some of that as part of the split, but it should not turn into a repo-wide cleanup campaign.

## Recommendation

Implement S01 around a small `src/lumon/` state spine and keep the visual surfaces mostly presentational:

```text
src/lumon/
  model.js         // JSDoc shapes + factories for Project, PipelineStage, ApprovalState, ExecutionEngine
  seed.js          // current demo fleet + demo pipeline/activity data
  reducer.js       // app-state transitions
  context.jsx      // provider + useLumonState/useLumonDispatch
  selectors.js     // fleet stats, selected project, selected agent, floor agents, pipeline view models
```

Then split the current monolith by surface instead of by tiny widget:

```text
src/features/mission-control/
  MissionControlShell.jsx
  DashboardTab.jsx
  OrchestrationTab.jsx
  ArchitectureTab.jsx
  TerminalPanel.jsx
  NewProjectModal.jsx
```

Model the canonical state in plain JS, not TypeScript, to stay aligned with the repo. Recommended app state shape:

- `projectsById` / `projectOrder`
- `selectedProjectId`
- `selectedAgentId`
- `activeSurface`
- `ui` (modal/tab state only where it must be shared)
- derived selectors for:
  - fleet metrics
  - dashboard project cards
  - floor agent feed
  - selected project detail stub
  - orchestration pipeline input

Important modeling point: S01 should define the **shape** of `PipelineStage` and `ApprovalState`, but it should **not** canonize the current `GSD Init → Research → Plan → Wave 1 → Test → Merge` demo sequence as the M001 product stage taxonomy. That sequence is execution-oriented and only appears in the prototype orchestration view. S03 owns the real intake-pipeline taxonomy. For S01, make the stage model flexible enough for S03 to swap in stable stage IDs later.

Also: keep a lightweight canonical per-agent record (embedded on project or normalized separately) even though the milestone boundary map only calls out `AgentSummary`. The dashboard cards, terminal selection, and Severance hover states need more than summary counts.

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| Shared cross-surface app state | React context + `useReducer` | React already recommends this pattern for complex screens; it is enough for the current SPA and avoids adding Zustand/Redux during a slice that is mainly structural. |
| Dialog/tab control | Base UI controlled props (`open` / `onOpenChange`, `value` / `onValueChange`) | The repo already wraps Base UI primitives, so state can be lifted without replacing accessible primitives. |
| Workflow canvas interaction state | React Flow `useNodesState` / `useEdgesState` | React Flow already supports keeping graph interaction local while the canonical store holds only domain data and selectors. |
| Surface styling and primitives | Existing `src/components/ui/*` wrappers + `src/index.css` tokens | Reusing these preserves the Lumon aesthetic and avoids churn in a slice whose job is state coherence, not a visual rewrite. |

## Existing Code and Patterns

- `src/mission-control.jsx` — current monolith. It combines mock domain data (`MOCK_PROJECTS`, `WORKFLOW_PIPELINES`, `MOCK_TERMINAL_LINES`, architecture ADR/demo content), top-level tabs, dashboard stats, project cards, terminal panel, orchestration canvas, and modal state. This is the main refactor target.
- `src/mission-control.jsx` — `allAgents = MOCK_PROJECTS.flatMap(...)` is the one real shared-data seam already present. Use it as the starting point for canonical selectors instead of inventing a new projection style.
- `src/mission-control.jsx` — the only top-level shared selection state is `selectedAgent`; there is no canonical `selectedProjectId`, and `NewProjectModal` currently collects `agentType` + `agentCount`, which is closer to spawn config than the later per-project execution-engine contract.
- `src/severance-floor.jsx` — strong visual prior art that already accepts `agents[]` and groups them by `agent.project`. That means it can be preserved as a presentation surface fed by selector output rather than rewritten.
- `src/index.css` — global tone and identity live here: dark palette, mono typography, Tailwind theme variables, and overall surface feel. Preserve it.
- `src/components/ui/tabs.jsx` / `src/components/ui/dialog.jsx` / `src/components/ui/scroll-area.jsx` — existing Base UI wrappers; follow these instead of introducing new primitive stacks.
- `ARCHITECTURE.md` — describes a future local server / tmux / WebSocket / SQLite product architecture. Useful as future intent, but much of it is not implemented in the current repo and should not be mistaken for current behavior.

## Constraints

- The repo is JS/JSX only. There is no TypeScript setup, no schema library, and no test harness. S01 should not expand into a type-system migration.
- S01 directly targets R001 and supports R020. It also must not block downstream R002, R003, R012, and R016 work, so the state model has to accommodate project identity, engine choice, stages, and shared status selectors even before persistence lands.
- `src/mission-control.jsx` is 1,556 lines and `src/severance-floor.jsx` is 883 lines. Refactor safety depends on extracting data contracts first, not scattering one-off component moves.
- `npm run build` passes, but Vite warns about a single 604.96 kB JS chunk. Heavy surfaces are currently bundled together.
- `npm run lint` fails before source linting because tracked `dist2`–`dist12` folders are outside the existing ignore pattern. `npx eslint src` still reports real source issues afterward, including React purity violations (`Math.random()` during render in `src/severance-floor.jsx`) and effect/set-state issues in `src/mission-control.jsx`.
- The current orchestration tab only models 3 projects and its stage labels are GSD execution steps, not the M001 intake workflow. That data cannot become the canonical product stage contract unchanged.

## Common Pitfalls

- **Canonizing the wrong stages** — `WORKFLOW_PIPELINES` is execution-demo data. Keep it as an adapter/view model until S03 defines the real pre-build pipeline taxonomy.
- **Putting view-state into the domain store** — React Flow nodes/edges, hover state, and pan/zoom are surface-local. Store project/pipeline facts globally and let surfaces derive their own view state.
- **Flattening the Severance floor into generic dashboard data** — the floor is already differentiated product value. Change its input contract, not its personality.
- **Letting randomness live in render paths** — the floor currently uses `Math.random()` in render-derived logic, which already trips lint. Move random placement/seed generation into stable initializers or memoized seed data.
- **Turning S01 into S02** — do not take on persistence, storage adapters, or reload continuity here. S01 ends when canonical state + selectors drive multiple surfaces cleanly.
- **Assuming `AgentSummary` is enough** — current surfaces need per-agent IDs, status, task, progress, and project affiliation. Summary selectors are necessary, but not sufficient.

## Open Risks

- The slice boundary map asks S01 to define `PipelineStage` and `ApprovalState`, while S03 still owns the stable taxonomy. The wrong enum choices here will ripple forward.
- The dashboard and Severance floor can share canonical project/agent state immediately, but the orchestration tab likely needs an interim adapter because its current data model is separate and partial.
- The repo contains duplicate/stale artifacts (`ARCHITECTURE 2.md`, multiple tracked `dist*` folders) that make search and lint noisier than the actual source warrants.
- There is no automated regression harness yet. Verification for the implementation slice will rely on build + focused lint + browser assertions, so selectors and state transitions need to stay very observable.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| Frontend UI / design system preservation | `frontend-design` | installed |
| React | `vercel-react-best-practices` | installed |
| React Flow | `existential-birds/beagle@react-flow` | available — `npx skills add existential-birds/beagle@react-flow` |
| Tailwind CSS | `hairyf/skills@tailwindcss` | available — `npx skills add hairyf/skills@tailwindcss` |
| Vite | `antfu/skills@vite` | available — `npx skills add antfu/skills@vite` |
| Base UI React | `jackspace/claudeskillz@base-ui-react` | available — `npx skills add jackspace/claudeskillz@base-ui-react` |

## Sources

- Prototype state split, monolith size, and current shared-data seam identified in `src/mission-control.jsx`.
- Floor input contract, project grouping behavior, and render-time randomness identified in `src/severance-floor.jsx`.
- Existing primitive/wrapper pattern identified in `src/components/ui/tabs.jsx`, `src/components/ui/dialog.jsx`, and `src/components/ui/scroll-area.jsx`.
- Current bundle output and chunk-size warning identified from `npm run build`.
- Current source lint issues identified from `npx eslint src`; repo-level lint failure identified from `npm run lint`.
- React recommends reducer + context for complex shared screen state (source: [Scaling Up with Reducer and Context](https://react.dev/learn/scaling-up-with-reducer-and-context)).
- React Flow supports keeping graph interaction local and only moving to external state when application complexity truly needs it (source: [Xyflow / React Flow docs](https://context7.com/xyflow/xyflow/llms.txt)).
- Base UI supports controlled dialog and tab state via `onOpenChange` / `onValueChange` patterns (source: [Dialog](https://base-ui.com/react/components/dialog), [Tabs](https://base-ui.com/react/components/tabs)).
