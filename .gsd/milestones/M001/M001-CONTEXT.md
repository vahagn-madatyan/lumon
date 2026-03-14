# M001: Lumon Control Surface — Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

## Project Description

M001 turns the current Lumon prototype into a real operator shell. It establishes the canonical project model, persistent registry, stage model, dossier surfaces, and synced multi-surface presentation that later milestones will connect to n8n, GitHub, GSD, and live agent runtimes.

This milestone does **not** attempt to finish the whole product. It creates the real operating surface the rest of the product depends on.

## Why This Milestone

The repository already contains a strong visual direction and a large amount of prototype UI, but the behavior is still mock-driven and view-local. If later milestones attach orchestration logic to that unstable foundation, the project will accumulate avoidable rework.

This milestone exists to make Lumon real enough that future workflow and runtime integrations have a trustworthy home.

## User-Visible Outcome

### When this milestone is complete, the user can:

- create multiple Lumon projects, choose Claude Code or Codex for each, and recover them after reload
- see the same project state reflected across the main dashboard, detailed project dossier, and Severance floor
- inspect an explicit pre-build stage journey and handoff packet structure before deeper automation lands

### Entry point / environment

- Entry point: local browser app served from this repo
- Environment: local dev browser
- Live dependencies involved: none required for milestone completion

## Completion Class

- Contract complete means: Lumon has a canonical project, stage, approval, and agent-summary model that is persisted and consumed by multiple surfaces without mock-only drift.
- Integration complete means: project creation, persistence, project detail, stage board, and Severance floor all stay in sync through real browser interactions.
- Operational complete means: the operator can reload the app and recover the current project fleet and stage state without manual reconstruction.

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- the operator can create a project, choose an execution engine, reload the app, and still see the same project in the fleet view
- the operator can open a project, inspect its dossier and stage state, and see matching changes reflected on the Severance floor
- the milestone is exercised as a real browser flow, not just via isolated component rendering or file artifacts

## Risks and Unknowns

- Current UI state is heavily mocked and duplicated across views — this can create false progress unless a single source of truth is established early.
- `src/mission-control.jsx` is large and prototype-oriented — refactoring risk is real, especially if visual regressions creep in.
- The Severance floor is already a major differentiator — it must be preserved while being tied to real application state.
- Later milestones depend on a stable stage and dossier contract — weak modeling here will ripple forward.

## Existing Codebase / Prior Art

- `src/mission-control.jsx` — current dashboard prototype, mock data model, and multiple surface concepts
- `src/severance-floor.jsx` — strong visual prior art for live project/agent presence
- `ARCHITECTURE.md` — prior architecture direction for local-first orchestration, tmux, SQLite, and worktrees
- `ARCHITECTURE 2.md` — duplicate/variant architecture write-up that should be reconciled during later work
- `src/components/ui/*` — reusable UI primitives already present in the repo

> See `.gsd/DECISIONS.md` for all architectural and pattern decisions — it is an append-only register; read it during planning, append to it during execution.

## Relevant Requirements

- R001 — establish Lumon as a single-operator control room
- R002 — create a real multi-project registry and lifecycle surface
- R003 — model the stage-based intake pipeline in the product shell
- R010 — define the dossier and handoff packet structure the later pipeline will populate
- R012 — persist and display execution-engine choice per project
- R016 — prioritize stage state and agent state on the main dashboard
- R020 — preserve the Severance-inspired presentation as product value

## Scope

### In Scope

- canonical Lumon project and stage model
- project creation flow and persistent local registry
- dashboard, project detail, and dossier/handoff packet structure
- Severance floor integration with real shared app state
- explicit M001 control loop proving the operator experience is coherent

### Out of Scope / Non-Goals

- real n8n workflow execution
- real repo creation or GSD handoff
- live tmux, WebSocket, or agent runtime integration
- multi-operator auth and governance

## Technical Constraints

- Work with the existing React 19 + Vite frontend stack already present in the repo.
- Preserve the distinctive visual language; do not replace Lumon with a generic admin UI.
- Avoid baking later backend assumptions so tightly into M001 that persistence and orchestration cannot evolve.
- Prefer a canonical domain model and selectors over additional one-off mock structures.

## Integration Points

- existing dashboard prototype — source of current interaction and information-density ideas
- Severance floor scene — must consume derived state from the same source as the dashboard
- future n8n pipeline — M001 stage and approval model should be stable enough for M002 to attach to
- future repo/GSD handoff — M001 dossier surface should preview the packet structure later milestones will populate

## Open Questions

- What is the cleanest M001 persistence mechanism: browser-local first or an early local server adapter? — Current thinking: browser-local persistence is acceptable if modeled behind a replaceable adapter.
- What exact stage taxonomy should M001 use? — Current thinking: choose stable stage names that can map directly to M002’s research/approval workflow.
- How much agent activity should M001 simulate? — Current thinking: model agent-summary state and surface it cleanly, but keep live runtime integration for later milestones.
