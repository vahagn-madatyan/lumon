# M002: Discovery & Approval Pipeline — Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

## Project Description

M002 builds the multi-stage pre-build workflow that turns an idea into an approved build dossier. The pipeline should cover viability analysis, business planning, feature and phase framing, pricing posture, technical research, naming exploration, domain and trademark/status checks, architecture outputs, specs, and a small prototype.

n8n is the intended orchestration layer for this milestone. Lumon remains the operator surface where runs are launched, inspected, approved, rejected, or iterated.

## Why This Milestone

The product vision is not “idea goes straight to build.” The point is disciplined front-loaded thinking before GSD and agent runtime costs are committed. M001 establishes the shell; M002 makes the shell useful by giving it a real discovery pipeline.

## User-Visible Outcome

### When this milestone is complete, the user can:

- launch a staged discovery run for a project and watch it progress through named approval gates
- review per-stage outputs inside Lumon, approve or reject them, and pause the project intentionally
- arrive at an approved pre-build dossier that is ready for repo provisioning and handoff

### Entry point / environment

- Entry point: Lumon project detail / pipeline controls
- Environment: local browser + local or self-hosted n8n
- Live dependencies involved: n8n, research/search providers, domain/trademark/status sources

## Completion Class

- Contract complete means: each stage has a durable output contract, approval state, and retry/iteration behavior visible inside Lumon.
- Integration complete means: Lumon can trigger n8n workflows, receive stage results, and keep project state synchronized through real approvals and rejections.
- Operational complete means: paused or rejected stage runs can be resumed or rerun without corrupting project state.

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- a project can run through at least one full discovery pipeline from intake to approved pre-build dossier
- the operator can approve one stage, reject another, iterate, and see state advance only through explicit gates
- stage outputs land in Lumon as real artifacts rather than transient chat text or console-only output

## Risks and Unknowns

- n8n/Lumon synchronization can get brittle if stage identifiers and payloads are not treated as contracts.
- Research outputs can become shallow or generic unless the workflow is structured carefully.
- Domain and trademark/status data are advisory and variable; the UI must not overstate certainty.
- Too much autonomy here would violate the user’s explicit desire for operator-controlled stage gates.

## Existing Codebase / Prior Art

- `.gsd/milestones/M001/M001-CONTEXT.md` — defines the control surface that M002 plugs into
- `src/mission-control.jsx` — existing workflow visual ideas and project overview patterns
- `ARCHITECTURE.md` — prior high-level orchestration direction

> See `.gsd/DECISIONS.md` for all architectural and pattern decisions — it is an append-only register; read it during planning, append to it during execution.

## Relevant Requirements

- R003 — stage-based intake pipeline
- R004 — explicit approval gates
- R005 — viability analysis before build
- R006 — business planning output
- R007 — tech-stack research and iteration
- R008 — naming workflow
- R009 — domain and trademark/status checks
- R010 — architecture/spec/prototype package
- R018 — explicit confirmation before irreversible external actions
- R019 — n8n as first-class orchestrator

## Scope

### In Scope

- staged discovery workflow design and contracts
- n8n-triggered execution and Lumon synchronization
- durable stage artifacts and approval controls
- advisory research outputs for business, product, technical, and naming decisions

### Out of Scope / Non-Goals

- repo creation
- GSD build handoff
- live autonomous build orchestration
- irreversible external actions without explicit confirmation

## Technical Constraints

- n8n should orchestrate workflow progression, but Lumon should remain the source of operator-facing truth.
- Research findings must be inspectable and attributable; do not silently transform research into binding scope.
- Stage outputs should land as durable artifacts that downstream milestones can package.
- Keep the approval model explicit and auditable.

## Integration Points

- n8n webhooks / sub-workflows / approval pauses
- Lumon project dossier and stage board
- research/search and data-provider integrations
- domain availability and trademark/status sources

## Open Questions

- Which providers should back business and technical research by default? — Current thinking: choose providers later, but model the stage contracts now.
- Where should large stage artifacts live? — Current thinking: durable project-linked artifacts inside Lumon with references to external execution metadata.
- How should prototype generation fit the pipeline? — Current thinking: prototype belongs near the end of discovery, after scope and technical direction are approved.
