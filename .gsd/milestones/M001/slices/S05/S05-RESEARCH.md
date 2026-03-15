# S05 — Research

**Date:** 2026-03-14

## Summary

S05 directly owns active **R020** (Severance-inspired control-room presentation) and materially supports active **R015** (live visibility into each agent’s current activity and where work is stuck). It also depends on already-validated **R002 / R003 / R012 / R016** because the floor has to reflect the same persisted project identity, execution-engine choice, and stage-first pipeline truth that the dashboard and orchestration surfaces already use.

The good news is that the architectural seam is already mostly correct. `MissionControlShell.jsx` still passes a single selector-owned `floor` prop into `src/severance-floor.jsx`, and the floor component itself remains a presentational/interaction shell. The problem is one layer higher: `selectFloorViewModel()` still rebuilds department state straight from raw `state.projects` and `project.agents`, using the coarse `selectProjectStatus()` helper. That means the floor still ignores the richer canonical pipeline truth already projected elsewhere — `pipeline.status`, current stage, current gate, approval state, handoff readiness, and the selected-project detail contract introduced in S04.

That mismatch is now the main S05 risk. The dashboard and dossier can say “Waiting”, “Blocked”, or “Handoff ready” while the floor still shows the same project as generic `queued`, `complete`, or simply empty desks with agents wandering to amenities. The safest S05 move is to keep the floor shell intact and extend the selector contract instead: feed the floor from canonical project view models, add floor-specific pipeline presentation fields, and prove the selected-project panel plus department presence stay synchronized with dashboard truth without flattening the Severance feel.

## Recommendation

Take a **selector-first floor integration** approach:

1. **Keep `SeveranceFloor` presentational.**
   Do not move stage, gate, approval, or summary logic into `src/severance-floor.jsx`. Extend `selectFloorViewModel()` so the floor still receives one selector-owned contract.

2. **Build floor departments from canonical project view models, not raw projects.**
   Reuse `buildProjectViewModel()` indirectly via `selectDashboardProjects()` or extract a shared helper for S05. The floor should inherit the same `pipeline.status`, current stage/gate labels, approval summary, and handoff readiness the dashboard already trusts.

3. **Add a floor-specific project-presence layer over canonical pipeline status.**
   The floor needs its own visual language, but not its own status vocabulary. Map canonical pipeline states like `running`, `waiting`, `blocked`, `handoff_ready`, `complete`, and `queued` into department lights, shell tones, copy, and selected-project diagnostics.

4. **Keep agent status and project pipeline status separate.**
   Agent `status` should stay canonical (`running`, `queued`, `complete`, `failed`). S05 should not fake approval or handoff states by mutating agents. If a project is approval-blocked while agents are complete, represent that at the department/project layer.

5. **Extend verification at the floor seam.**
   Add stable floor diagnostics for selected-project pipeline status, current stage, current gate, and approval summary. Then prove dashboard → floor synchronization for at least `waiting`, `blocked`, and `handoff_ready`, not just running/failed agent motion.

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| Project pipeline truth for the floor | `buildProjectViewModel()` / `selectDashboardProjects()` in `src/lumon/selectors.js` | Already reconciles pipeline status, stage, gate, approval, selection, and handoff readiness from canonical state |
| Floor layout identity and motion | `lumonFloorLayoutSeed` plus the existing `selectFloorViewModel()` room-anchor contract | Preserves deterministic Severance presentation without inventing a new authored layout system |
| Floor shell and visual atmosphere | Existing `SeveranceFloor` composition (`Dept`, `BreakRoom`, `AmenityRoom`, boss orbit, wandering agents) | The atmosphere already exists; S05 should feed it better truth, not replace it |
| Local presentation state for node/graph surfaces | `useNodesState()` / `useEdgesState()` pattern already used in `OrchestrationTab.jsx` | Confirms the app’s current architecture: presentation state stays local while selector-owned domain truth stays canonical |

## Existing Code and Patterns

- `src/lumon/selectors.js` — `buildProjectViewModel()` is the authoritative project-level pipeline projection. It already exposes `pipeline.status`, `pipeline.label`, `pipeline.summary`, current stage/gate labels, approval state, selected stage, and handoff readiness.
- `src/lumon/selectors.js` — `selectFloorViewModel()` is the current S05 drift seam. It still rebuilds departments from raw `state.projects`, uses `selectProjectStatus(project)`, and summarizes metrics from raw agents.
- `src/lumon/selectors.js` — `selectProjectStatus()` is agent-driven and only returns `running`, `failed`, `complete`, or `queued`. That is too coarse for S05’s `waiting` / `blocked` / `handoff_ready` floor states.
- `src/severance-floor.jsx` — the selected-project panel currently shows only `name`, `phaseLabel`, `waveLabel`, and a coarse project status; the department shell colors also only understand `running`, `complete`, `failed`, or fallback gray.
- `src/severance-floor.jsx` — desk occupancy is driven only by `agent.status === "running"`; away agents are grouped into amenity wanderers, and failed agents go to the Break Room.
- `src/features/mission-control/DashboardTab.jsx` — already exposes stable pipeline surfaces such as `selected-project-pipeline-status`, `selected-project-current-stage`, `selected-project-current-gate`, and `selected-project-current-approval`.
- `src/features/mission-control/OrchestrationTab.jsx` — follows the intended pattern: React Flow stays local while stage/gate/approval truth comes from selectors.
- `src/features/mission-control/MissionControlShell.jsx` — still passes exactly one `floor` contract into the floor shell, which matches D013 and should remain true after S05.
- `src/lumon/context.jsx` + `src/lumon/persistence.js` — if the floor continues to derive from canonical selectors, reload-safe persistence is already solved; S05 does not need a second storage path.
- `src/features/mission-control/__tests__/mission-control-shell.test.jsx` and `src/lumon/__tests__/lumon-state.test.js` — existing proof already covers coarse dashboard/floor/orchestration synchronization and is the natural place to extend S05 verification.

## Constraints

- **Direct requirement coverage:** S05 is the primary M001 slice for **R020** and a supporting slice for **R015**.
- **Milestone contract constraint:** the floor now has to reflect the same underlying project and stage truth as the dashboard and dossier, not just shared agent selection.
- **Selector boundary constraint:** D013 still applies. The floor should remain a presentational shell over `selectFloorViewModel()`, not a second state system.
- **Status-vocabulary constraint:** pipeline status is richer than agent status. `waiting`, `blocked`, and `handoff_ready` currently exist only at the project pipeline layer.
- **Layout stability constraint:** department anchors come from `lumonFloorLayoutSeed` and project order. Hidden sorting or filtering in S05 can unintentionally reshuffle the floor.
- **Room-sizing constraint:** `buildFloorRoomSize()` sizes departments from running desk agents only. Projects that are approval-waiting or handoff-ready can end up visually sparse unless S05 deliberately adjusts the room/presence rules.
- **Persistence constraint:** `lumon.registry.v1` already persists canonical project and execution state. S05 should derive from that truth, not add persisted floor-only state.
- **Verification constraint:** previous slices already found selector assertions and stable `data-testid` surfaces more reliable than broad full-page text checks.

## Common Pitfalls

- **Re-deriving pipeline truth inside `src/severance-floor.jsx`** — that would reintroduce the exact surface drift S05 is supposed to retire.
- **Using agent status to fake project approval state** — approval/waiting/handoff truth belongs at the project pipeline layer, not in per-agent status hacks.
- **Fixing only the selected-project panel** — if department lamps, summary counts, and room presence still use coarse agent-driven status, the floor will still disagree with the dashboard.
- **Breaking deterministic layout behavior** — sorting departments by new status fields may look attractive, but it would churn anchors and weaken one of the floor’s current strengths.
- **Flattening the floor into generic admin UI** — R020 is not satisfied by simply adding dashboard badges. Any new signals need to read as Lumon, not as a copy-pasted KPI panel.

## Open Risks

- S05 needs a clear visual contract for `waiting`, `blocked`, and `handoff_ready` that remains legible without making the floor feel less like Lumon.
- Composing `selectDashboardProjects()` into `selectFloorViewModel()` may duplicate some selector work; if that becomes awkward, extracting a shared project-view-model helper is safer than forking logic.
- M001 still has only simulated agent activity. S05 can prove visibility and stuck-state surfacing from canonical summaries, but it cannot make R015 “live runtime telemetry” real yet.
- Browser verification can be misleading if old proof registries remain in localStorage. S05 execution should verify whether the runtime state came from seeded demo data or a deterministic saved envelope before asserting floor behavior.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| React | `vercel-react-best-practices` | installed |
| Lumon UI / floor presentation | `frontend-design` | installed |
| Tailwind CSS | `josiahsiegel/claude-plugin-marketplace@tailwindcss-advanced-layouts` | installed |
| React Testing Library | `itechmeat/llm-code@react-testing-library` | installed |
| React Testing Library | `jezweb/claude-skills@testing-library` | available via search, install name mismatch / not installed |

## Sources

- The floor selector still derives department status from raw projects and agent metrics instead of canonical pipeline view models (source: `src/lumon/selectors.js`).
- The floor shell currently exposes only coarse project status in the selected-project panel and department lighting, with desk occupancy driven solely by running agents (source: `src/severance-floor.jsx`).
- The dashboard already has stable selector-backed diagnostics for pipeline status, current stage, current gate, approval, dossier, and handoff readiness (source: `src/lumon/selectors.js`, `src/features/mission-control/DashboardTab.jsx`).
- The shell continues to pass one selector-owned `floor` prop into the floor component, which is the right architectural seam to preserve (source: `src/features/mission-control/MissionControlShell.jsx`).
- Current floor synchronization tests only prove coarse shared selection and agent-status updates, not approval-aware pipeline truth such as waiting, blocked, or handoff-ready (source: `src/features/mission-control/__tests__/mission-control-shell.test.jsx`, `src/lumon/__tests__/lumon-state.test.js`).
- React recommends deriving synchronized UI values during render instead of storing redundant derived state, which supports extending selector-owned floor view models rather than adding effect-driven floor state (source: https://react.dev/learn/you-might-not-need-an-effect).
- React Flow’s state hooks are intended for locally controlled node/edge state, which reinforces the existing architecture decision to keep presentation state local and canonical truth selector-owned (source: https://reactflow.dev/api-reference/hooks).
