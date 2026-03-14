---
id: T01
parent: S01
milestone: M001
provides:
  - Canonical Lumon state modules, seed data, reducer/selectors, and the first working JS/JSX test harness for S01
key_files:
  - package.json
  - vite.config.js
  - src/test/setup.js
  - src/lumon/model.js
  - src/lumon/seed.js
  - src/lumon/reducer.js
  - src/lumon/selectors.js
  - src/lumon/__tests__/lumon-state.test.js
  - src/features/mission-control/__tests__/mission-control-shell.test.jsx
key_decisions:
  - D011: Keep agents project-owned while orchestration stages reference agent IDs and synthesize generic stages when detailed pipeline data is missing.
patterns_established:
  - Vitest + jsdom + RTL contract tests as the required proof surface for Lumon shared-state changes.
  - Dashboard, floor, and orchestration view models are all selector projections over one canonical seed/reducer shape.
observability_surfaces:
  - npm run test -- --run src/lumon/__tests__/lumon-state.test.js
  - src/lumon/__tests__/lumon-state.test.js
  - src/features/mission-control/__tests__/mission-control-shell.test.jsx
duration: 1h
verification_result: passed
completed_at: 2026-03-13T21:50:00-07:00
blocker_discovered: false
---

# T01: Add Lumon domain spine and slice test harness

**Added a working Vitest/jsdom harness plus a canonical `src/lumon/*` state spine that proves dashboard, floor, and orchestration inputs can all be projected from one reducer-backed seed.**

## What Happened

I added a real test command to the Vite app, removed an invalid Linux-only Rollup binary dependency that blocked local installs on macOS, and configured Vitest/jsdom/RTL in `vite.config.js` plus `src/test/setup.js`.

I then extracted a canonical Lumon state contract into `src/lumon/model.js`, `src/lumon/seed.js`, `src/lumon/reducer.js`, and `src/lumon/selectors.js`. The seed is derived from `src/mission-control.jsx` demo data, preserves the three detailed orchestration pipelines already in the monolith, and synthesizes generic execution stages for the remaining projects so every project now has orchestration input.

The reducer now supports project/agent/stage selection plus agent/stage updates. Selectors now expose fleet metrics, dashboard cards, selected project detail, selected agent detail, floor agents, and orchestration input from the same state tree.

Finally, I added `src/lumon/__tests__/lumon-state.test.js` with named contract assertions for seed creation, reducer transitions, and shared selector projections, and I created `src/features/mission-control/__tests__/mission-control-shell.test.jsx` as the slice’s future shell verification surface with an expected-fail placeholder for T02.

## Verification

Passed:
- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js`
  - 3 named tests passed.
  - Verified seeded state creation and metrics (`14` running, `33` total, `$64.75`, `3980k`).
  - Verified reducer transitions for selected project/agent.
  - Verified selector outputs for floor agents and orchestration pipeline input, including open-ended approval state updates.
- `npm run test -- --run src/features/mission-control/__tests__/mission-control-shell.test.jsx`
  - The file exists and currently reports an expected failure placeholder for T02.
- `npx eslint src/lumon src/features/mission-control/__tests__/mission-control-shell.test.jsx src/test/setup.js vite.config.js`
- `npm run build`

Slice-level partial result:
- `npx eslint src/App.jsx src/main.jsx src/lumon src/features/mission-control src/severance-floor.jsx` still fails on pre-existing `src/severance-floor.jsx` unused-var/purity issues that align with planned T03 cleanup.

## Diagnostics

To inspect this task later:
- Run `npm run test -- --run src/lumon/__tests__/lumon-state.test.js` to validate the canonical reducer/selector contract.
- Read `src/lumon/__tests__/lumon-state.test.js` for the named assertions tied to fleet metrics, selected project/agent detail, floor projection, and orchestration projection.
- Read `src/features/mission-control/__tests__/mission-control-shell.test.jsx` to see the next integration surface queued for T02.

## Deviations

- Removed the direct `@rollup/rollup-linux-arm64-gnu` dependency from `package.json` because it was a platform-invalid top-level dependency that prevented `npm install` from completing on the local macOS environment.
- Added the T02 shell test file early as an expected-fail placeholder to satisfy the slice verification surface requirement for the first task.

## Known Issues

- `src/severance-floor.jsx` still has existing lint/purity issues (`no-unused-vars`, `react-hooks/purity`, and a hook dependency warning). This did not block T01 state-contract delivery, but it keeps the full slice lint command red until later slice work lands.

## Files Created/Modified

- `package.json` — added the `test` script and removed the invalid Linux-only Rollup dependency.
- `package-lock.json` — updated lockfile after installing Vitest, jsdom, and Testing Library dependencies.
- `vite.config.js` — switched to Vitest-aware config and added jsdom/setup file wiring.
- `eslint.config.js` — added test-file globals so Vitest/RTL files lint cleanly.
- `src/test/setup.js` — added jest-dom, cleanup, and DOM/polyfill helpers for S01 tests.
- `src/lumon/model.js` — added canonical constructors for `Project`, `ExecutionEngine`, `PipelineStage`, `ApprovalState`, and `AgentSummary`.
- `src/lumon/seed.js` — extracted canonical seed data from the monolith and generated execution stages for all projects.
- `src/lumon/reducer.js` — added selection/update actions and the Lumon reducer.
- `src/lumon/selectors.js` — added dashboard, floor, orchestration, fleet, project, and agent selector surfaces.
- `src/lumon/__tests__/lumon-state.test.js` — added the executable state contract proof.
- `src/features/mission-control/__tests__/mission-control-shell.test.jsx` — added the expected-fail T02 integration test placeholder.
- `.gsd/DECISIONS.md` — appended D011 for the canonical state-shape choice.
- `.gsd/milestones/M001/slices/S01/S01-PLAN.md` — marked T01 done.
- `.gsd/STATE.md` — advanced the next action to T02.
