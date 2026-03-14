# S01: Core control-shell refactor

**Goal:** Replace the prototype’s scattered mock/view state with a canonical Lumon app state and shared selectors that can drive multiple major surfaces.
**Demo:** The dashboard, orchestration shell, and Severance floor render from the same provider-backed project/agent state, with automated tests proving shared state changes stay synchronized.

## Requirement Focus

- Owns/directly advances: `R001` — single-operator mission control dashboard.
- Supports this slice boundary and downstream work: `R020`, `R002`, `R003`, `R012`, `R016`.

## Decomposition Notes

- The order retires the biggest risk first: create the domain/test spine before moving JSX so the refactor has a stable contract.
- The shell split comes second because the monolith is the main source of mock drift, but React Flow interaction stays local so S01 does not accidentally become a global-canvas rewrite.
- The Severance floor gets a dedicated final task because it is both a differentiator and a current purity/lint risk; the slice is only done once the floor and dashboard demonstrably share the same truth.
- Verification starts with Vitest + React Testing Library because the repo currently has no test harness and this slice needs repeatable proof of shared state wiring, not just a manual browser glance.

## Must-Haves

- Canonical Lumon domain modules define `Project`, `ExecutionEngine`, `PipelineStage`, `ApprovalState`, and `AgentSummary`, plus seed data, reducer actions, and selectors flexible enough for later persistence and stage-taxonomy work.
- The mission-control shell stops owning scattered mock data and instead renders dashboard, orchestration, architecture, and modal/detail surfaces from shared provider-backed state and selectors.
- The Severance floor consumes the same project/agent truth as the dashboard, with stable render inputs and no render-path randomness, so cross-surface status stays coherent without flattening the presentation.

## Proof Level

- This slice proves: integration
- Real runtime required: no
- Human/UAT required: no

## Verification

- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js`
- `npm run test -- --run src/features/mission-control/__tests__/mission-control-shell.test.jsx`
- `npx eslint src/App.jsx src/main.jsx src/lumon src/features/mission-control src/severance-floor.jsx`
- `npm run build`

## Observability / Diagnostics

- Runtime signals: reducer/action contract tests and shared-surface rendering assertions expose selector/view-model regressions immediately.
- Inspection surfaces: `src/lumon/__tests__/lumon-state.test.js`, `src/features/mission-control/__tests__/mission-control-shell.test.jsx`, and the rendered selected-project/agent shell state.
- Failure visibility: broken project/agent projections, surface desynchronization, and unstable floor rendering fail in named tests instead of hiding inside the monolith.
- Redaction constraints: none

## Integration Closure

- Upstream surfaces consumed: `src/App.jsx`, `src/main.jsx`, `src/mission-control.jsx`, `src/severance-floor.jsx`, existing UI wrappers in `src/components/ui/*`.
- New wiring introduced in this slice: `src/lumon/*` provider + selectors feeding extracted mission-control surface modules and the Severance floor.
- What remains before the milestone is truly usable end-to-end: persistence, explicit intake-stage taxonomy/approvals, dossier views, and final browser-loop verification.

## Tasks

- [x] **T01: Add Lumon domain spine and slice test harness** `est:1h`
  - Why: S01 needs a stable contract and repeatable proof before the monolith is split; otherwise the refactor can move code around without actually retiring mock drift.
  - Files: `package.json`, `vite.config.js`, `src/lumon/model.js`, `src/lumon/seed.js`, `src/lumon/reducer.js`, `src/lumon/selectors.js`, `src/lumon/__tests__/lumon-state.test.js`, `src/test/setup.js`
  - Do: Add Vitest + jsdom + Testing Library support, extract canonical domain shapes and demo seed data into `src/lumon/*`, and implement reducer actions/selectors for fleet metrics, selected project/agent detail, floor agents, and orchestration input while keeping stage/approval modeling flexible for S03.
  - Verify: `npm run test -- --run src/lumon/__tests__/lumon-state.test.js`
  - Done when: named state-contract tests pass and prove dashboard, floor, and orchestration inputs can all be projected from one canonical Lumon state.
- [x] **T02: Split mission control into provider-backed surface modules** `est:1.5h`
  - Why: The current 1,500+ line shell is the main source of duplicated view data; extracting it behind a provider is the core structural change that makes later slices safe.
  - Files: `src/App.jsx`, `src/mission-control.jsx`, `src/lumon/context.jsx`, `src/features/mission-control/MissionControlShell.jsx`, `src/features/mission-control/DashboardTab.jsx`, `src/features/mission-control/OrchestrationTab.jsx`, `src/features/mission-control/ArchitectureTab.jsx`, `src/features/mission-control/TerminalPanel.jsx`, `src/features/mission-control/NewProjectModal.jsx`
  - Do: Add the Lumon provider/hooks, extract the mission-control shell into surface modules, move shared shell state to reducer/context where appropriate, and keep React Flow nodes/edges and other purely local interaction state local so the orchestration surface stays an adapter over canonical state instead of becoming the canonical stage model.
  - Verify: `npm run test -- --run src/features/mission-control/__tests__/mission-control-shell.test.jsx`
  - Done when: `App` mounts a provider-backed shell, the extracted surfaces render from selectors instead of inline mock arrays, and the shell integration test proves shared selection/status state updates rendered UI.
- [x] **T03: Bind Severance floor to canonical agent selectors and stable layout seeds** `est:1h`
  - Why: S01 is only complete once the product’s most distinctive surface shares the same truth as the dashboard and stops depending on render-time randomness.
  - Files: `src/severance-floor.jsx`, `src/features/mission-control/MissionControlShell.jsx`, `src/features/mission-control/__tests__/mission-control-shell.test.jsx`, `src/lumon/selectors.js`, `src/lumon/seed.js`
  - Do: Adapt the floor input contract to canonical selector output, replace render-path randomness with stable seeded/memoized layout data keyed by project/agent identity, and wire shared dashboard/floor selection and status summaries so a single state change is visible on both surfaces.
  - Verify: `npm run test -- --run src/features/mission-control/__tests__/mission-control-shell.test.jsx && npx eslint src/App.jsx src/main.jsx src/lumon src/features/mission-control src/severance-floor.jsx && npm run build`
  - Done when: floor grouping, selection, and status come from the same state as the dashboard, the shared-surface test passes, and the targeted lint/build checks succeed.

## Files Likely Touched

- `package.json`
- `package-lock.json`
- `vite.config.js`
- `src/App.jsx`
- `src/main.jsx`
- `src/mission-control.jsx`
- `src/severance-floor.jsx`
- `src/lumon/model.js`
- `src/lumon/seed.js`
- `src/lumon/reducer.js`
- `src/lumon/context.jsx`
- `src/lumon/selectors.js`
- `src/lumon/__tests__/lumon-state.test.js`
- `src/test/setup.js`
- `src/features/mission-control/MissionControlShell.jsx`
- `src/features/mission-control/DashboardTab.jsx`
- `src/features/mission-control/OrchestrationTab.jsx`
- `src/features/mission-control/ArchitectureTab.jsx`
- `src/features/mission-control/TerminalPanel.jsx`
- `src/features/mission-control/NewProjectModal.jsx`
- `src/features/mission-control/__tests__/mission-control-shell.test.jsx`
