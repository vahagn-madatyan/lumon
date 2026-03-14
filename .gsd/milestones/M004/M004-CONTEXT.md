# M004: Autonomous Build Orchestrator — Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

## Project Description

M004 turns Lumon into a real runtime supervisor for autonomous builds. It should be able to monitor multiple approved projects, keep their repos and workspaces isolated, surface what each agent is doing, retry once on failure when appropriate, and escalate clearly when human intervention is required.

This is where the “mission control” promise becomes operational rather than purely preparatory.

## Why This Milestone

The earlier milestones establish the project shell, discovery workflow, and handoff boundary. M004 is the point where Lumon stops being a planning console and becomes an active build-control system.

## User-Visible Outcome

### When this milestone is complete, the user can:

- watch multiple projects build independently with live agent and stage visibility
- understand what each agent is doing, where work is blocked, and why a project paused
- let Lumon handle one bounded retry before escalating a failure for attention

### Entry point / environment

- Entry point: Lumon dashboard and project runtime views
- Environment: local browser + local runtime supervisor + agent CLIs / GSD / workspaces
- Live dependencies involved: GSD, Claude Code, Codex, local runtime orchestration layer

## Completion Class

- Contract complete means: Lumon has stable runtime state shapes for project execution, agent activity, retries, failures, and escalation.
- Integration complete means: real build execution can be launched, observed, retried once, and paused across more than one project.
- Operational complete means: independent project runtimes remain isolated and observable under real lifecycle transitions.

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- two or more projects can be supervised independently without workspace or status contamination
- the operator can see live agent activity and understand which project or stage is active, queued, retried, failed, or waiting
- a failure path actually exercises the one-retry-then-escalate contract in a real environment

## Risks and Unknowns

- Runtime visibility can become noisy or misleading unless Claude and Codex execution signals are normalized.
- Project isolation is non-negotiable; one leaking workspace or status channel breaks trust quickly.
- Retry behavior can hide genuine problems if it is too aggressive or too opaque.
- Real-time surfaces can diverge unless the floor, dashboard, and detail views all share the same runtime truth.

## Existing Codebase / Prior Art

- `ARCHITECTURE.md` — prior direction for tmux control mode, WebSocket streaming, SQLite, and worktree isolation
- `src/severance-floor.jsx` — prior art for representing project and agent presence visually
- `.gsd/milestones/M003/M003-CONTEXT.md` — source of provisioned repo/workspace and GSD handoff state

> See `.gsd/DECISIONS.md` for all architectural and pattern decisions — it is an append-only register; read it during planning, append to it during execution.

## Relevant Requirements

- R013 — GSD bootstrap and autonomous handoff
- R014 — independent repos and workspaces
- R015 — live visibility into agent activity
- R016 — dashboard-first stage and agent state visibility
- R017 — one auto-retry then pause and escalate
- R020 — preserve the control-room feel under real runtime conditions

## Scope

### In Scope

- project runtime state model and supervision loops
- live agent activity and failure visibility
- bounded retry and escalation behavior
- synchronized dashboard, project detail, and floor runtime presentation

### Out of Scope / Non-Goals

- public multi-tenant operation
- full governance and role system
- broad cloud distribution beyond the local-first target

## Technical Constraints

- Preserve project isolation at the repo, workspace, and state-model level.
- Failure visibility must be explicit; do not swallow the reason a project paused.
- Observe-by-default is the intended operator stance; avoid requiring constant steering.
- Runtime state should remain durable enough to explain what happened after the fact.

## Integration Points

- GSD runtime and handoff state
- Claude Code and Codex execution surfaces
- local workspaces / repos / isolation layer
- live dashboard and Severance floor views

## Open Questions

- How should agent telemetry be normalized between Claude Code and Codex? — Current thinking: normalize to Lumon-owned status/event models and preserve raw logs as secondary evidence.
- What exact retry boundary is safe? — Current thinking: one bounded retry for reversible workflow/runtime failures, never for irreversible actions.
- How much terminal detail belongs on the main dashboard versus detail views? — Current thinking: main dashboard stays stage-and-agent-first, with deeper logs in project detail.
