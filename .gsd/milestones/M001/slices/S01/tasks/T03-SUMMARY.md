---
id: T03
parent: S01
milestone: M001
provides:
  - Canonical Severance-floor selector/view-model wiring with stable seeded layout data and shared dashboard/floor status proof
key_files:
  - src/lumon/seed.js
  - src/lumon/selectors.js
  - src/features/mission-control/MissionControlShell.jsx
  - src/severance-floor.jsx
  - src/features/mission-control/__tests__/mission-control-shell.test.jsx
  - src/lumon/__tests__/lumon-state.test.js
key_decisions:
  - D013: Project the Severance floor through a dedicated selectFloorViewModel selector plus a seeded lumonFloorLayoutSeed, and keep the floor component as a presentational/interaction shell over that contract.
patterns_established:
  - Distinctive multi-surface UIs consume a canonical selector-owned view model, while animation/layout variation comes from deterministic seeded helpers instead of render-time randomness.
observability_surfaces:
  - npm run test -- --run src/features/mission-control/__tests__/mission-control-shell.test.jsx
  - npm run test -- --run src/lumon/__tests__/lumon-state.test.js
  - npx eslint src/App.jsx src/main.jsx src/lumon src/features/mission-control src/severance-floor.jsx
  - npm run build
  - browser verification on http://127.0.0.1:4174/ reading severance-floor-selected-* test ids after a live Retry agent action
duration: 2.5h
verification_result: passed
completed_at: 2026-03-13T22:40:45-07:00
blocker_discovered: false
---

# T03: Bind Severance floor to canonical agent selectors and stable layout seeds

**Wired the Severance floor to canonical Lumon selectors, replaced floor randomness with seeded deterministic layout/motion data, and proved dashboard/floor/orchestration stay synchronized through shared project-agent state.**

## What Happened

I added `lumonFloorLayoutSeed` to `src/lumon/seed.js` as the stable floor-layout contract: department anchors, amenity-room placement, and boss orbit values now live with the demo seed instead of being recreated ad hoc inside the floor component.

I then expanded `src/lumon/selectors.js` with `selectFloorViewModel`, which groups canonical floor agents by project, computes stable room sizing/placement, carries selected project and selected agent summaries, and exposes deterministic floor-specific metadata like amenity assignment and palette indices. `selectFloorAgents` remains the canonical per-agent projection, but the floor shell now consumes the richer selector-owned surface model instead of reshaping raw agent arrays in render.

`src/features/mission-control/MissionControlShell.jsx` now reads `selectFloorViewModel` from the provider and passes shared `selectProject` / `selectAgent` actions into `SeveranceFloor`, so the floor is bound to the same selection/status truth as the dashboard and orchestration surfaces.

I refactored `src/severance-floor.jsx` to accept that canonical floor contract. The component keeps the existing Severance presentation, but no longer uses `Math.random()` anywhere in the render path or animation setup. Wandering amenity agents, the roaming boss, and layout variation now use deterministic seeded motion/orbit helpers. The floor header also exposes selected-project and selected-agent summaries via stable test ids, and department/cubicle controls can feed selection back into shared Lumon state.

Finally, I expanded the rendered shell integration test to cover dashboard ⇄ floor selection sync and dashboard → floor/orchestration status sync, and I extended the reducer/selector contract test so floor layout/status projections are proven before the rendered shell even mounts.

## Verification

Passed:
- `npm run test -- --run src/features/mission-control/__tests__/mission-control-shell.test.jsx`
  - Verified dashboard selection of `Policy Engine` / `Agent-06` is reflected on the Severance floor.
  - Verified floor selection of `Agent-07` flows back to dashboard detail state.
  - Verified `Retry agent` changes `Agent-06` from `failed` to `running`, and both floor + orchestration update accordingly.
- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js`
  - Verified `selectFloorViewModel` projects stable seeded layout/status summaries from the canonical reducer state.
- `npx eslint src/App.jsx src/main.jsx src/lumon src/features/mission-control src/severance-floor.jsx`
- `npm run build`
- Browser verification on `http://127.0.0.1:4174/`
  - Used the real preview app to select `Policy Engine` / `Agent-06` on dashboard, trigger `Retry agent`, then switch back to `Severed Floor`.
  - Explicit browser read-back returned:
    - `selectedTab: "Severed Floor"`
    - `project: "Policy Engine"`
    - `agent: "Agent-06"`
    - `agentStatus: "running"`
    - `breakRoomCount: "1"`
  - Explicit browser assertions passed for floor summary selectors:
    - `[data-testid='severance-floor-selected-project']`
    - `[data-testid='severance-floor-selected-agent']`

Slice-level result:
- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js` ✅
- `npm run test -- --run src/features/mission-control/__tests__/mission-control-shell.test.jsx` ✅
- `npx eslint src/App.jsx src/main.jsx src/lumon src/features/mission-control src/severance-floor.jsx` ✅
- `npm run build` ✅

## Diagnostics

To inspect this task later:
- Run `npm run test -- --run src/features/mission-control/__tests__/mission-control-shell.test.jsx` for the rendered dashboard/floor/orchestration synchronization proof.
- Run `npm run test -- --run src/lumon/__tests__/lumon-state.test.js` for the reducer/selector proof of stable floor layout + status projection.
- Open `src/lumon/selectors.js` and inspect `selectFloorViewModel` to see the canonical floor contract.
- Open `src/lumon/seed.js` and inspect `lumonFloorLayoutSeed` for the stable demo layout seed.
- Open `src/severance-floor.jsx` and inspect the `data-testid="severance-floor-selected-*"` summary surface plus the deterministic motion helpers.
- For browser re-checks, use the preview build (`npm run preview`) rather than the dev server; the browser harness was more stable against `http://127.0.0.1:4174/` than the HMR-driven dev surface.

## Deviations

- None.

## Known Issues

- Browser automation against the Base UI tab strip was more reliable via direct viewport clicks on the preview build than via selector clicks on the dev server, but the product state itself verified correctly once the floor tab was activated.

## Files Created/Modified

- `src/lumon/seed.js` — added the canonical `lumonFloorLayoutSeed` used by floor selectors and deterministic floor rendering.
- `src/lumon/selectors.js` — added `selectFloorViewModel` and stable floor-agent metadata while preserving dashboard/orchestration selectors.
- `src/features/mission-control/MissionControlShell.jsx` — rewired the shell to pass the canonical floor view model plus shared selection actions into `SeveranceFloor`.
- `src/severance-floor.jsx` — refactored the floor to consume canonical selector output, expose shared summaries, and remove render-path randomness.
- `src/features/mission-control/__tests__/mission-control-shell.test.jsx` — expanded the integration proof to cover dashboard ⇄ floor selection sync and dashboard → floor/orchestration status sync.
- `src/lumon/__tests__/lumon-state.test.js` — extended the reducer/selector proof to assert stable floor view-model output.
- `.gsd/DECISIONS.md` — appended D013 for the floor selector/layout-seed contract.
- `.gsd/milestones/M001/slices/S01/S01-PLAN.md` — marked T03 done.
