---
estimated_steps: 4
estimated_files: 5
---

# T03: Bind Severance floor to canonical agent selectors and stable layout seeds

**Slice:** S01 — Core control-shell refactor
**Milestone:** M001

## Description

Finish the slice by wiring Lumon’s most distinctive surface to the same state truth as the dashboard. This task preserves the Severance-floor presentation, removes unstable render-path behavior, and adds shared-surface proof that the floor and dashboard stay synchronized.

## Steps

1. Refactor `src/severance-floor.jsx` to accept canonical floor-agent/project selector output from the provider-backed shell instead of depending on ad hoc derived data.
2. Replace render-time randomness with stable seeded or memoized layout data keyed by agent/project identity so floor rendering is reproducible and purity/lint issues stop recurring.
3. Wire shared project/agent selection and status summaries between `MissionControlShell` and the Severance floor, expanding `src/features/mission-control/__tests__/mission-control-shell.test.jsx` to assert both surfaces respond to the same state change.
4. Run the focused integration test, targeted ESLint, and build command to close the slice with shared-surface proof.

## Must-Haves

- [ ] Dashboard and Severance floor are both driven by canonical selectors and react to the same selection/status state.
- [ ] Floor rendering no longer depends on `Math.random()` or other render-path entropy.

## Verification

- `npm run test -- --run src/features/mission-control/__tests__/mission-control-shell.test.jsx`
- `npx eslint src/App.jsx src/main.jsx src/lumon src/features/mission-control src/severance-floor.jsx && npm run build`

## Observability Impact

- Signals added/changed: stable shared-surface assertions and targeted lint coverage for floor render purity.
- How a future agent inspects this: run the shell integration test plus the focused eslint/build commands to pinpoint whether the break is selector wiring, render stability, or compile-time composition.
- Failure state exposed: dashboard/floor desynchronization and unstable floor layout logic become immediate, named failures.

## Inputs

- `src/lumon/context.jsx` and `src/features/mission-control/MissionControlShell.jsx` — provider-backed shell ready to feed canonical selectors into the floor.
- `src/severance-floor.jsx` — existing differentiated floor presentation to preserve while changing its input contract.

## Expected Output

- `src/severance-floor.jsx` — presentation layer powered by canonical floor selectors with stable layout inputs.
- `src/features/mission-control/MissionControlShell.jsx`, `src/features/mission-control/__tests__/mission-control-shell.test.jsx`, `src/lumon/selectors.js`, `src/lumon/seed.js` — updated wiring and proof that dashboard and floor stay synchronized.
