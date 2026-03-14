---
estimated_steps: 5
estimated_files: 8
---

# T01: Add Lumon domain spine and slice test harness

**Slice:** S01 — Core control-shell refactor
**Milestone:** M001

## Description

Create the canonical state contract before moving UI code. This task adds the lightweight JS test harness the repo is missing, extracts the initial Lumon model/seed/reducer/selectors from the monolith, and gives later tasks a stable API to wire against.

## Steps

1. Add Vitest, jsdom, and Testing Library support in the existing Vite app so S01 can verify reducer/selector and component behavior in code instead of by manual inspection.
2. Create `src/lumon/model.js`, `src/lumon/seed.js`, `src/lumon/reducer.js`, and `src/lumon/selectors.js` with flexible shapes for `Project`, `ExecutionEngine`, `PipelineStage`, `ApprovalState`, and `AgentSummary` derived from the current demo data.
3. Implement reducer actions and selectors for fleet metrics, selected project/agent, dashboard cards, floor agents, and orchestration input while keeping stage/approval identifiers open-ended for S03.
4. Add `src/lumon/__tests__/lumon-state.test.js` to assert state creation, selection/update transitions, and the shared view models consumed by dashboard, floor, and orchestration surfaces.
5. Run the focused state-contract test and confirm the surface inputs needed by T02/T03 are covered by executable assertions.

## Must-Haves

- [ ] The repo can run a focused JS/JSX test command for S01 without introducing TypeScript.
- [ ] Canonical state modules exist and tests prove they can project shared dashboard, floor, and orchestration inputs from one source of truth.

## Verification

- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js`
- Confirm the test covers reducer transitions plus selector outputs for fleet metrics, selected project detail, floor agents, and orchestration pipeline input.

## Observability Impact

- Signals added/changed: named state-contract tests for reducer actions and selector projections.
- How a future agent inspects this: run the focused Vitest command and inspect the failing assertion tied to a broken transition or view-model projection.
- Failure state exposed: mismatch between canonical state and surface inputs becomes explicit instead of hiding in view-local mock data.

## Inputs

- `package.json` — current Vite React app with no test runner configured.
- `src/mission-control.jsx` — current monolith source of demo project, pipeline, and agent data to extract into canonical state modules.

## Expected Output

- `package.json`, `package-lock.json`, `vite.config.js`, `src/test/setup.js` — working Vitest + jsdom + Testing Library setup for S01.
- `src/lumon/model.js`, `src/lumon/seed.js`, `src/lumon/reducer.js`, `src/lumon/selectors.js`, `src/lumon/__tests__/lumon-state.test.js` — canonical state spine with executable contract proof.
