# M003: Repo Provisioning & GSD Handoff — Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

## Project Description

M003 converts an approved pre-build dossier into an actionable build workspace. This milestone creates the repository context, packages the approved artifacts, records the execution-engine choice, and hands the project into GSD in a way that later build orchestration can supervise.

The goal is to make the handoff boundary concrete and reproducible.

## Why This Milestone

Without a real repo/workspace and a consistent handoff packet, the discovery pipeline ends in theory. This milestone turns “approved idea” into “build-ready project” and creates the bridge between planning and execution.

## User-Visible Outcome

### When this milestone is complete, the user can:

- review an approved project and explicitly confirm repo provisioning
- see the repository, workspace, and packaged build artifacts attached to the project
- choose or confirm Claude Code vs Codex and hand the project into GSD with traceable context

### Entry point / environment

- Entry point: Lumon project dossier / handoff controls
- Environment: local browser + local git/GSD environment + GitHub integration
- Live dependencies involved: GitHub, git, GSD, execution-engine selection

## Completion Class

- Contract complete means: the handoff packet has a defined structure and includes the approved artifacts needed for GSD.
- Integration complete means: Lumon can create or connect the repo/workspace, upload or write the artifacts, and launch the GSD bootstrap path with the chosen engine.
- Operational complete means: provisioning and handoff are idempotent enough to retry or resume without duplicating or corrupting the project boundary.

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- an approved project can become a real repo/workspace with its dossier artifacts present
- the operator can explicitly confirm the handoff, see the chosen engine recorded, and know exactly what was passed to GSD
- the project transitions from approved discovery into build-ready state without manual file shuffling outside Lumon

## Risks and Unknowns

- Repo creation and artifact upload are irreversible enough that confirmation boundaries must stay explicit.
- A weak handoff packet will create ambiguity or rework for later build orchestration.
- GSD integration details may evolve; the handoff format should preserve fidelity without overcoupling.
- Secrets and credentials for GitHub or runtime providers must be handled safely.

## Existing Codebase / Prior Art

- `ARCHITECTURE.md` — prior direction for git worktrees, agent commands, and orchestration boundaries
- `.gsd/milestones/M002/M002-CONTEXT.md` — source of the approved dossier and stage outputs
- current repo prototype — source of future packaging and project presentation surfaces

> See `.gsd/DECISIONS.md` for all architectural and pattern decisions — it is an append-only register; read it during planning, append to it during execution.

## Relevant Requirements

- R010 — approved architecture/spec/prototype package
- R011 — repo creation and artifact upload
- R012 — execution-engine choice per project
- R013 — GSD bootstrap and autonomous handoff
- R014 — separate repos and workspaces per project
- R018 — explicit confirmation before irreversible actions

## Scope

### In Scope

- repo and workspace provisioning flow
- packaging and writing approved artifacts into a handoff boundary
- engine-selection persistence into real handoff behavior
- GSD bootstrap path for approved projects

### Out of Scope / Non-Goals

- supervising live build execution
- runtime retry/escalation loops
- distributed agent infrastructure

## Technical Constraints

- Keep repo creation and write-side effects behind explicit operator confirmation.
- Preserve the approved dossier at handoff time; do not collapse it to an opaque summary.
- Make the handoff package inspectable so later failures can be debugged.
- Avoid mixing multiple projects into the same working directory semantics.

## Integration Points

- GitHub repository creation and metadata
- local git workspace creation
- GSD bootstrap commands and handoff artifact placement
- Claude Code / Codex engine selection

## Open Questions

- Should Lumon always create new repos or support attaching to pre-existing ones? — Current thinking: support new repo creation first, leave attachment as later enhancement.
- How should the handoff packet be represented on disk? — Current thinking: durable files that match the approved dossier structure and remain human-inspectable.
- What exact GSD bootstrap boundary is safest? — Current thinking: keep the handoff contract explicit and versionable rather than relying on fragile implicit prompts.
