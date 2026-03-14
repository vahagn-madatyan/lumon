# M005: External Action Layer — Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

## Project Description

M005 adds the controlled external-action layer around the core Lumon system. This milestone should cover integrations that gather external signals or perform real-world side effects, especially around naming, domain availability, trademark/status lookup, and later domain purchase or related account-space acquisition.

The core product rule remains: Lumon can prepare and recommend, but irreversible external actions pause at an explicit confirmation boundary.

## Why This Milestone

The user’s real process extends beyond internal planning and coding. Naming, domain availability, trademark/status checks, and related decisions are part of whether a project is viable or ready to formalize. M005 adds those real-world edges without violating operator control.

## User-Visible Outcome

### When this milestone is complete, the user can:

- review external name-availability and status signals inside Lumon
- see which external actions are ready, blocked, or awaiting confirmation
- explicitly confirm supported side effects and record their outcomes back into the project dossier

### Entry point / environment

- Entry point: Lumon naming / readiness / approval surfaces
- Environment: local browser + external provider APIs
- Live dependencies involved: registrar APIs, trademark/status data sources, explicit-confirmation action runners

## Completion Class

- Contract complete means: external checks and side-effect requests have clear request/response records and confirmation boundaries.
- Integration complete means: Lumon can perform supported external checks and, where enabled, confirmed side effects against real providers.
- Operational complete means: the operator can understand what was checked, what was acted on, what failed, and what remains pending.

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- Lumon can gather and persist domain-availability and trademark/status signals for candidate names
- supported external actions pause for explicit confirmation and record outcomes back into the project record
- irreversible operations are never executed silently as a side effect of broader pipeline progress

## Risks and Unknowns

- Trademark/status signals are advisory and nuanced; the product must avoid implying legal certainty it cannot provide.
- Provider APIs for registrar actions vary in capability, sandboxing, and purchase semantics.
- Side-effect failures are materially different from research failures and need distinct visibility.
- Over-automation here would directly violate a core user instruction.

## Existing Codebase / Prior Art

- `.gsd/milestones/M002/M002-CONTEXT.md` — source of naming and approval pipeline outputs
- external research notes gathered during bootstrap — registrar APIs and official trademark/status sources exist but vary in depth and certainty
- no existing runtime implementation in this repo yet; this milestone will likely introduce the first real outward side-effect surfaces beyond GitHub

> See `.gsd/DECISIONS.md` for all architectural and pattern decisions — it is an append-only register; read it during planning, append to it during execution.

## Relevant Requirements

- R009 — domain availability and trademark/status workflow
- R018 — explicit confirmation before irreversible external actions
- R025 — automated domain purchase execution after confirmation

## Scope

### In Scope

- external signal gathering for naming readiness
- confirmation-gated external action model
- persistent records of checks, recommendations, confirmations, and outcomes
- domain and related naming readiness integrations

### Out of Scope / Non-Goals

- blind legal clearance claims
- silent autonomous purchases or registrations
- broad public multi-tenant outward automation

## Technical Constraints

- Every irreversible action must sit behind an explicit confirmation step.
- External results should be durable and inspectable after the fact.
- Distinguish advisory data from confirmed actions in both state and UI.
- Avoid tying the product to a single provider abstraction too early if provider capability is still uncertain.

## Integration Points

- registrar APIs for availability and purchase flows
- official or semi-official trademark/status data sources
- Lumon dossier and approval records
- prior naming research outputs from M002

## Open Questions

- Which registrar should be the first supported provider? — Current thinking: choose a provider with both availability checks and a usable automation surface.
- How should Lumon represent legal uncertainty? — Current thinking: clearly label signals as advisory, with source attribution and explicit non-legal framing.
- Should purchase execution ship in the same slice as availability checks? — Current thinking: no; gather and confirm the action model first, then add purchase execution when the boundary is safe.
