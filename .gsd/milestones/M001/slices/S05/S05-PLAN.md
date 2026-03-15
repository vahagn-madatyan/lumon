# S05: Severed floor live-state integration

**Goal:** Make the Severed Floor consume the same canonical project pipeline and agent-summary truth as the dashboard so approval-aware waiting, blocked, and handoff-ready work is visible without breaking the Lumon atmosphere.
**Demo:** In the real app, a persisted proof registry containing waiting, blocked, handoff-ready, and running projects renders matching department presence, selected-project diagnostics, and agent placement on the Severed Floor; selecting a project from the dashboard or floor shows the same pipeline status, current stage, current gate, and approval summary before and after reload.

## Must-Haves

- `src/lumon/*` projects the floor from canonical project view models instead of raw project/agent inference, exposing floor-specific pipeline status, current stage, current gate, approval summary, and presence counts from the same selector truth the dashboard already uses. (R015, R020)
- `src/severance-floor.jsx` remains a presentational shell, but it visibly distinguishes waiting, blocked, handoff-ready, running, queued, and complete departments through Lumon-specific presentation rather than coarse agent-only status. (R020)
- Projects that are approval-waiting, blocked, or handoff-ready remain visibly present on the floor even when no agents are actively at desks, without mutating agent status or reshuffling deterministic department anchors. (R015, R020)
- Dashboard and Severed Floor synchronization is proven for selected project/agent state plus waiting, blocked, and handoff-ready pipeline truth through selector tests, rendered mission-control tests, and live browser verification over persisted state. (R015, R020)

## Proof Level

- This slice proves: integration
- Real runtime required: yes
- Human/UAT required: yes

## Verification

- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js`
- `npm run test -- --run src/features/mission-control/__tests__/severance-floor-live-state.test.jsx`
- `npx eslint src/lumon/selectors.js src/severance-floor.jsx src/features/mission-control/__tests__/severance-floor-live-state.test.jsx`
- `npm run build`
- Preview/browser assertions on the local preview URL for dashboard ↔ floor synchronization across waiting, blocked, handoff-ready, and running projects; selected-project floor diagnostics for pipeline status, current stage, current gate, and approval summary; reload-safe persisted proof state; and clean console/network signals plus a visual pass that the department-state presentation still reads as Lumon rather than generic admin badges

## Observability / Diagnostics

- Runtime signals: `selectFloorViewModel()` exposes project-layer pipeline diagnostics, floor presence metadata, and summary counts for waiting/blocked/handoff-ready states instead of burying floor truth inside component heuristics
- Inspection surfaces: `selectFloorViewModel(state)`, stable `data-testid` surfaces in the Severed Floor selected-project panel and summary strip, and `window.localStorage['lumon.registry.v1']` for persisted proof state
- Failure visibility: blocked/waiting/handoff-ready departments remain visibly present and the selected-project panel surfaces the same stage/gate/approval reason the dashboard uses instead of collapsing to generic queued/complete copy
- Redaction constraints: floor diagnostics may expose project names, stage labels, and approval notes already present in canonical state, but must not introduce new secret-bearing payloads or fabricate runtime telemetry

## Integration Closure

- Upstream surfaces consumed: `src/lumon/model.js`, `src/lumon/selectors.js`, `src/lumon/seed.js`, `src/features/mission-control/MissionControlShell.jsx`, and persisted selection/project state from `src/lumon/context.jsx`
- New wiring introduced in this slice: a pipeline-aware floor projection rendered through `SeveranceFloor` department shells, selected-project diagnostics, and stable floor verification surfaces
- What remains before the milestone is truly usable end-to-end: S06 end-to-end operator-loop proof and later M004 runtime telemetry behind the same floor contract

## Tasks

- [x] **T01: Canonicalize the floor selector around project pipeline truth** `est:1.5h`
  - Why: S05 fails at the selector seam if the floor keeps rebuilding departments from raw project/agent state instead of the approval-aware project view models the dashboard already trusts.
  - Files: `src/lumon/model.js`, `src/lumon/selectors.js`, `src/lumon/__tests__/lumon-state.test.js`
  - Do: Reuse or extract the canonical project view-model path so `selectFloorViewModel()` builds departments and selected-project diagnostics from project pipeline truth; add floor-specific status/presence metadata and summary counts for waiting, blocked, and handoff-ready states; keep agent status canonical and separate from project approval state; and preserve deterministic floor ordering and anchors while making non-running but active projects remain visibly present.
  - Verify: `npm run test -- --run src/lumon/__tests__/lumon-state.test.js`
  - Done when: the floor selector exposes approval-aware department and selected-project contracts that match dashboard/orchestration pipeline truth without mutating agent status or reordering the floor.
- [x] **T02: Render approval-aware floor presence and prove shell synchronization** `est:1.5h`
  - Why: The slice is not real until the Severed Floor visibly reflects the new contract and the mission-control shell proves dashboard ↔ floor agreement for waiting, blocked, and handoff-ready states.
  - Files: `src/severance-floor.jsx`, `src/features/mission-control/__tests__/severance-floor-live-state.test.jsx`, `src/features/mission-control/__tests__/mission-control-shell.test.jsx`
  - Do: Update `SeveranceFloor` to render department shell tones, selected-project diagnostics, and stable test surfaces from selector-owned floor metadata without re-deriving pipeline logic; keep the Lumon atmosphere intact while making stuck/handoff states legible; add rendered integration coverage for waiting/blocked/handoff-ready synchronization; and finish with browser proof over persisted state and clean diagnostics.
  - Verify: `npm run test -- --run src/features/mission-control/__tests__/severance-floor-live-state.test.jsx`
  - Done when: the floor component stays presentation-only, visibly differentiates approval-aware project states, and rendered/browser checks confirm it stays synchronized with the dashboard before and after reload.

## Files Likely Touched

- `src/lumon/model.js`
- `src/lumon/selectors.js`
- `src/lumon/__tests__/lumon-state.test.js`
- `src/severance-floor.jsx`
- `src/features/mission-control/__tests__/severance-floor-live-state.test.jsx`
- `src/features/mission-control/__tests__/mission-control-shell.test.jsx`
- `src/features/mission-control/MissionControlShell.jsx`
