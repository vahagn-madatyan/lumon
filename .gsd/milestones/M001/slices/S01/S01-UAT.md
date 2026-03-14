# S01: Core control-shell refactor — UAT

**Milestone:** M001
**Written:** 2026-03-13

## UAT Type

- UAT mode: mixed
- Why this mode is sufficient: S01 is primarily a shared-state integration slice, so reducer/selector tests plus one live preview-browser synchronization check are enough to prove the refactor without waiting for later persistence or runtime work.

## Preconditions

- Dependencies are installed.
- The preview app can be started with `npm run preview -- --host 127.0.0.1 --port 4174`.
- Seeded Lumon demo data is present through the canonical `src/lumon/*` provider.

## Smoke Test

Open `http://127.0.0.1:4174/` and confirm `MISSION CONTROL` renders with dashboard tabs plus the fleet summary `Twin Coast Labs · 14 projects · 14/33 agents active`.

## Test Cases

### 1. Canonical Lumon selector contract

1. Run `npm run test -- --run src/lumon/__tests__/lumon-state.test.js`.
2. Confirm the suite passes all named tests.
3. **Expected:** seeded metrics, selected project/agent transitions, orchestration input, and floor view-model projections all pass from one reducer-backed state tree.

### 2. Dashboard, orchestration, and floor stay synchronized

1. Run `npm run test -- --run src/features/mission-control/__tests__/mission-control-shell.test.jsx`.
2. In the preview app, select `Policy Engine` and then `Agent-06` from the dashboard.
3. Click `Retry agent`.
4. Open `Orchestration`, then `Severed Floor`.
5. **Expected:** both surfaces still show `Policy Engine`, `Agent-06`, and the updated `running` status.

## Edge Cases

### Deterministic floor diagnostics after a shared-state update

1. On the preview build, perform the `Policy Engine` / `Agent-06` retry flow.
2. Read `[data-testid='severance-floor-selected-project']`, `[data-testid='severance-floor-selected-agent']`, and `[data-testid='severance-floor-selected-agent-status']`.
3. **Expected:** the values match dashboard selection/status state exactly, and floor diagnostics remain stable instead of drifting due to render-time randomness.

## Failure Signals

- The dashboard, floor, and orchestration tabs disagree about the selected project or agent.
- `Retry agent` changes status in one surface but not the others.
- `src/lumon/__tests__/lumon-state.test.js` or `src/features/mission-control/__tests__/mission-control-shell.test.jsx` fails.
- Browser console errors or failed network requests appear during the preview interaction.

## Requirements Proved By This UAT

- R001 — Proves Lumon now behaves as a synchronized single-operator mission-control shell across multiple projects/surfaces.

## Not Proven By This UAT

- R002 — No persistence or reload recovery is exercised here.
- R003 / R004 — No explicit approval-gated pre-build stage progression exists yet.
- R012 — Execution-engine choice is seeded/displayed, not yet operator-created and persisted.
- R015 — Agent activity is not connected to a live runtime.
- R020 — The atmosphere is preserved, but this UAT does not judge later visual/depth enhancements planned for S05.

## Notes for Tester

Use the preview build rather than the HMR dev server for the live check; browser interaction was more stable there. Ignore the fact that `Spawn new project` still leads to a local draft-only modal flow — canonical project creation belongs to S02.
