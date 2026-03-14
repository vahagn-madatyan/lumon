# M006: Reliability, Governance, and Launch Readiness — Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

## Project Description

M006 hardens Lumon into a trustworthy long-running system. This milestone focuses on authentication, access boundaries, auditability, resumability, cost and activity visibility, safety rails, and the operational behavior needed to use Lumon confidently over time.

The point is not to add enterprise ceremony. The point is to make the real system resilient enough that the operator trusts it with meaningful work.

## Why This Milestone

Earlier milestones prioritize product truth and workflow usefulness. Once those are real, Lumon will need the reliability and governance layer that explains what happened, protects sensitive actions, and survives restarts or interruptions without losing the plot.

## User-Visible Outcome

### When this milestone is complete, the user can:

- trust Lumon to recover its state, explain failures, and maintain an auditable history of meaningful actions
- control access and sensitive operations with clearer safety boundaries
- understand long-running project activity, cost, and operational health without digging through raw runtime noise

### Entry point / environment

- Entry point: Lumon operational settings, runtime dashboard, and audit/history views
- Environment: local-first runtime with real integrations active
- Live dependencies involved: all prior milestone integrations and the production-like runtime surface

## Completion Class

- Contract complete means: Lumon has explicit models for auth, audit events, resumability, and operator safeguards.
- Integration complete means: the running system can restart or recover and preserve enough truth for the operator to continue safely.
- Operational complete means: the product can be used for real work over time without feeling brittle, opaque, or unsafe.

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- the system can recover from interruption or restart without losing essential project truth
- the operator can inspect who or what performed meaningful actions and why a project is in its current state
- sensitive or destructive actions are protected by clear safety boundaries appropriate to the system’s real power

## Risks and Unknowns

- Adding governance too early can slow core product discovery; adding it too late can expose deep model gaps.
- Audit trails become useless if they are noisy, incomplete, or inconsistent across subsystems.
- Resumability is hard if prior milestones do not store enough durable state.
- Security and trust boundaries may change once the product grows beyond a single operator.

## Existing Codebase / Prior Art

- `ARCHITECTURE.md` — early local-first assumptions around runtime, persistence, and remote access
- `.gsd/milestones/M001` through `.gsd/milestones/M005` — source of the behavior that M006 must harden rather than redesign
- no dedicated governance implementation exists yet in the current repo

> See `.gsd/DECISIONS.md` for all architectural and pattern decisions — it is an append-only register; read it during planning, append to it during execution.

## Relevant Requirements

- R021 — multi-operator collaboration and shared control
- R022 — production-grade auth, roles, and governance
- R023 — cost and usage telemetry
- R024 — distributed or beyond-local runtime considerations
- R018 — confirmation boundaries remain intact under production-like conditions

## Scope

### In Scope

- access boundaries and sensitive-operation safeguards
- audit/history and operational event surfaces
- restart/recovery and resumability behavior
- cost, activity, and health visibility appropriate for real use

### Out of Scope / Non-Goals

- replacing the product’s single-operator-first design center with a generic enterprise platform
- rebuilding earlier milestone contracts from scratch

## Technical Constraints

- Preserve the local-first character of the system unless later requirements explicitly change it.
- Audit and recovery behavior should be durable, inspectable, and understandable by a future operator.
- Safety rails must not hide context; they should explain why an action is blocked or paused.
- Cost and health visibility should be additive to the main mission-control experience, not its entire identity.

## Integration Points

- authentication and settings surfaces
- runtime orchestration and activity logs
- external action history
- project dossier and milestone history

## Open Questions

- When should Lumon graduate from single-operator assumptions? — Current thinking: only after the single-operator loop is trustworthy and demand is real.
- What level of audit detail is enough? — Current thinking: capture meaningful decisions, state transitions, and side effects first; avoid noise by default.
- How much distributed runtime support belongs here? — Current thinking: only what is necessary once the local-first system hits real limits.
