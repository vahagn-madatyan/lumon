---
estimated_steps: 5
estimated_files: 9
---

# T02: Split mission control into provider-backed surface modules

**Slice:** S01 — Core control-shell refactor
**Milestone:** M001

## Description

Replace the monolith’s ownership of app state with a provider-backed shell organized by major surface. This task makes the dashboard, orchestration, architecture, terminal, and modal/detail views consume the canonical Lumon state from T01 while keeping purely local interaction state out of the global store.

## Steps

1. Add `src/lumon/context.jsx` with provider/hooks backed by the reducer and seed state from T01.
2. Extract `MissionControlShell`, `DashboardTab`, `OrchestrationTab`, `ArchitectureTab`, `TerminalPanel`, and `NewProjectModal` from `src/mission-control.jsx`, making them consume context/selectors instead of inline mock structures.
3. Keep React Flow nodes/edges, tab-local animations, and other purely presentational interaction state inside the surface modules so the orchestration canvas remains an adapter over canonical state rather than the source of the product stage contract.
4. Update `src/App.jsx` and `src/mission-control.jsx` to mount the provider-backed shell while preserving the current entrypoint contract.
5. Add or expand `src/features/mission-control/__tests__/mission-control-shell.test.jsx` to verify the shell renders from seed state and shared selection changes update dashboard/orchestration detail panels.

## Must-Haves

- [ ] Mission-control surface modules render from context/selectors rather than owning their own project/pipeline mock arrays.
- [ ] The orchestration surface remains a view-model adapter over canonical state instead of freezing the current demo stage labels into the domain contract.

## Verification

- `npm run test -- --run src/features/mission-control/__tests__/mission-control-shell.test.jsx`
- Confirm the test exercises rendered shell behavior, including a shared selection/status update, rather than calling selectors in isolation.

## Inputs

- `src/lumon/model.js`, `src/lumon/reducer.js`, `src/lumon/selectors.js`, `src/lumon/seed.js` — canonical state contract from T01.
- `src/App.jsx` and `src/mission-control.jsx` — current entrypoint and monolith to split without breaking the app shell.

## Expected Output

- `src/lumon/context.jsx` — provider and hooks for the Lumon app state.
- `src/features/mission-control/MissionControlShell.jsx`, `src/features/mission-control/DashboardTab.jsx`, `src/features/mission-control/OrchestrationTab.jsx`, `src/features/mission-control/ArchitectureTab.jsx`, `src/features/mission-control/TerminalPanel.jsx`, `src/features/mission-control/NewProjectModal.jsx`, `src/App.jsx`, `src/mission-control.jsx`, `src/features/mission-control/__tests__/mission-control-shell.test.jsx` — provider-backed shell modules with executable rendering proof.
