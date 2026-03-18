# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

### R011 - Lumon must create a project repository and place the approved artifacts where GSD can consume them.

### R011 - Lumon must create a project repository and place the approved artifacts where GSD can consume them.
- Class: integration
- Status: active
- Description: Lumon must create a project repository and place the approved artifacts where GSD can consume them.
- Why it matters: The handoff boundary has to become concrete, not remain conceptual.
- Source: user
- Primary owning slice: M003 (provisional)
- Supporting slices: none
- Validation: unmapped
- Notes: External creation requires explicit confirmation.

### R013 - Once approved, Lumon must be able to bootstrap GSD and transfer the project into autonomous execution.
- Class: integration
- Status: active
- Description: Once approved, Lumon must be able to bootstrap GSD and transfer the project into autonomous execution.
- Why it matters: The system's main promise is end-to-end movement from idea to build.
- Source: user
- Primary owning slice: M003 (provisional)
- Supporting slices: M004 (provisional)
- Validation: unmapped
- Notes: Handoff should preserve the full approved package, not a lossy summary.

### R014 - Projects must be able to run independently with separate repositories and working environments.
- Class: quality-attribute
- Status: active
- Description: Projects must be able to run independently with separate repositories and working environments.
- Why it matters: Cross-project contamination would make the mission-control model untrustworthy.
- Source: user
- Primary owning slice: M003 (provisional)
- Supporting slices: M004 (provisional)
- Validation: unmapped
- Notes: This is a hard requirement, not optimization.

### R015 - The operator must be able to see what each active agent is doing now and where work is stuck.
- Class: failure-visibility
- Status: active
- Description: The operator must be able to see what each active agent is doing now and where work is stuck.
- Why it matters: Without visibility, the dashboard becomes decorative rather than operational.
- Source: user
- Primary owning slice: M004 (provisional)
- Supporting slices: M001/S05
- Validation: mapped
- Notes: M001 proves the surface; M004 makes it real.

### R017 - When a research or build stage fails, Lumon should try one bounded recovery pass before pausing and escalating.
- Class: continuity
- Status: active
- Description: When a research or build stage fails, Lumon should try one bounded recovery pass before pausing and escalating.
- Why it matters: The operator wants self-healing where sensible, but not silent runaway behavior.
- Source: user
- Primary owning slice: M004 (provisional)
- Supporting slices: none
- Validation: unmapped
- Notes: Applies to runtime orchestration, not irreversible external actions.

### R018 - Repo creation, domain purchase, and similar side effects must wait for explicit operator confirmation.
- Class: compliance/security
- Status: active
- Description: Repo creation, domain purchase, and similar side effects must wait for explicit operator confirmation.
- Why it matters: The user wants Lumon to prepare and recommend, then pause at the irreversible edge.
- Source: user
- Primary owning slice: M002 (provisional)
- Supporting slices: M005 (provisional)
- Validation: unmapped
- Notes: This applies even if prior stage approvals exist.

## Validated

### R004 — Major pre-build stages must stop for explicit operator approval before the project advances.
- Class: operability
- Status: validated
- Description: Major pre-build stages must stop for explicit operator approval before the project advances.
- Why it matters: The user wants stage-gated control, not an always-on autonomous pipeline.
- Source: user
- Primary owning slice: M002/S04
- Supporting slices: M001/S03, M002/S01
- Validation: validated
- Notes: M002/S04 rejection-iteration.test.js proves reject→re-trigger→approve lifecycle with cross-stage isolation. full-pipeline.test.js confirms all 4 stages advance only through explicit operator approval. No auto-resume anywhere in the system.

### R005 — Lumon must produce an explicit should-we-build-this assessment before technical execution begins.
- Class: core-capability
- Status: validated
- Description: Lumon must produce an explicit should-we-build-this assessment before technical execution begins.
- Why it matters: Bad ideas should die before build effort and API spend are committed.
- Source: user
- Primary owning slice: M002/S01
- Supporting slices: M002/S04
- Validation: validated
- Notes: Viability analysis is the first pipeline artifact, produced by n8n with structured market/technical/risk sections. Full-pipeline integration confirms it exists before any downstream work begins. Operator must explicitly approve before pipeline advances.

### R006 — The pre-build package must include business framing such as target audience, pricing posture, feature phases, and rough value model.
- Class: core-capability
- Status: validated
- Description: The pre-build package must include business framing such as target audience, pricing posture, feature phases, and rough value model.
- Why it matters: The user wants ventures evaluated as businesses, not just code projects.
- Source: user
- Primary owning slice: M002/S02
- Supporting slices: M002/S04
- Validation: validated
- Notes: business_plan artifact carries targetAudience, pricingPosture, featurePhases, revenueModel. BusinessPlanRenderer renders structured sections. Full-pipeline test confirms artifact flows to handoff packet.

### R007 — Lumon must compare and iterate on plausible technical approaches before locking the build direction.
- Class: core-capability
- Status: validated
- Description: Lumon must compare and iterate on plausible technical approaches before locking the build direction.
- Why it matters: The technical path is part of the approval package, not an afterthought.
- Source: user
- Primary owning slice: M002/S02
- Supporting slices: M002/S04
- Validation: validated
- Notes: tech_research artifact compares scored technical approaches with tradeoffs and recommendations. TechResearchRenderer displays comparisons. Full-pipeline test confirms artifact present in handoff packet alongside architecture_outline.

### R008 — Lumon must help generate, compare, and refine candidate product or business names as part of the intake pipeline.
- Class: differentiator
- Status: validated
- Description: Lumon must help generate, compare, and refine candidate product or business names as part of the intake pipeline.
- Why it matters: Naming is part of the user's real process and affects downstream domain and trademark work.
- Source: user
- Primary owning slice: M002/S03
- Supporting slices: M002/S04
- Validation: validated
- Notes: Naming candidates generate as structured artifacts through n8n, render as a selectable list in the dossier via NamingCandidatesRenderer. Operator's selection triggers downstream domain/trademark signals via context forwarding. 29 orchestration tests + 21 renderer tests prove the flow.

### R009 — Lumon must gather domain availability and trademark/status signals for candidate names before build handoff.
- Class: integration
- Status: validated
- Description: Lumon must gather domain availability and trademark/status signals for candidate names before build handoff.
- Why it matters: Brand decisions should be informed before repo creation and downstream build momentum.
- Source: user
- Primary owning slice: M002/S03
- Supporting slices: M005 (provisional)
- Validation: validated
- Notes: Domain availability and trademark signal artifacts render with status badges and mandatory advisory disclaimers (D026). DomainSignalsRenderer and TrademarkSignalsRenderer proven by renderer tests. Signals clearly labeled as point-in-time advisory, not legal clearance.

### R019 — n8n must be treated as a real orchestration layer for the research and approval pipeline.
- Class: integration
- Status: validated
- Description: n8n must be treated as a real orchestration layer for the research and approval pipeline.
- Why it matters: The workflow engine is part of the product architecture, not a hidden implementation detail.
- Source: user
- Primary owning slice: M002/S01
- Supporting slices: M002/S02, M002/S03, M002/S04
- Validation: validated
- Notes: 9 n8n workflow templates shipped. Full 4-stage pipeline proven with sequential sub-workflows, auto-trigger chains, compound webhook routing, context forwarding, and offline degradation. Fundamental webhook→Wait→resumeUrl contract proven against live n8n Docker instance.

### R001 — Lumon must operate as a control room for one owner-operator managing many software-product initiatives.
- Class: primary-user-loop
- Status: validated
- Description: Lumon must operate as a control room for one owner-operator managing many software-product initiatives.
- Why it matters: The first version is explicitly optimized for one person who wants clarity and throughput, not team collaboration overhead.
- Source: user
- Primary owning slice: M001/S01
- Supporting slices: M001/S03, M001/S05, M001/S06
- Validation: validated
- Notes: Multi-operator support is intentionally deferred.

### R002 - The operator must be able to create, store, browse, and revisit multiple projects with clear lifecycle state.
- Class: core-capability
- Status: validated
- Description: The operator must be able to create, store, browse, and revisit multiple projects with clear lifecycle state.
- Why it matters: Lumon is a fleet dashboard, not a single-project wizard.
- Source: user
- Primary owning slice: M001/S02
- Supporting slices: M001/S06
- Validation: validated
- Notes: Proven in M001/S02 through canonical project creation, versioned local persistence, selection-safe restore, and live browser reload verification.

### R003 - Every project must move through an explicit pre-build pipeline before it can be handed to GSD.
- Class: primary-user-loop
- Status: validated
- Description: Every project must move through an explicit pre-build pipeline before it can be handed to GSD.
- Why it matters: The product's value is orchestration and disciplined progression, not loose project notes.
- Source: user
- Primary owning slice: M001/S03
- Supporting slices: M002 (provisional)
- Validation: validated
- Notes: M001/S03 proves a canonical intake→handoff stage model, approval-aware progression, reload-safe persistence, and live dashboard/orchestration visibility across the real app.

### R010 - Approved projects must have a tangible handoff package including architecture artifacts, specs, and a small prototype.
- Class: core-capability
- Status: validated
- Description: Approved projects must have a tangible handoff package including architecture artifacts, specs, and a small prototype.
- Why it matters: GSD should receive more than an idea blurb; it needs a serious build packet.
- Source: user
- Primary owning slice: M002 (provisional)
- Supporting slices: M001/S04, M003 (provisional)
- Validation: validated
- Notes: M001/S04 proves dossier and packet structure; M002/S04 proves full pipeline produces 9 artifacts across 4 stages (viability_analysis, business_plan, tech_research, naming_candidates, domain_signals, trademark_signals, architecture_outline, specification, prototype_scaffold) that populate the handoff packet. Architecture, specification, and prototype renderers display structured content. Full-pipeline integration test confirms artifact counts and handoff_ready state.

### R012 - Each project must carry an explicit execution-engine choice between Claude Code and Codex.
- Class: core-capability
- Status: validated
- Description: Each project must carry an explicit execution-engine choice between Claude Code and Codex.
- Why it matters: Engine choice is part of the user-visible project identity and later execution behavior.
- Source: user
- Primary owning slice: M001/S02
- Supporting slices: M003 (provisional)
- Validation: validated
- Notes: M001/S02 proves engine choice is stored, rendered, and restored per project; M003 will consume it for real handoff behavior.

### R016 - The main dashboard must prioritize pipeline stage state and agent state across projects.
- Class: operability
- Status: validated
- Description: The main dashboard must prioritize pipeline stage state and agent state across projects.
- Why it matters: The user explicitly wants at-a-glance operational awareness over pure terminal immersion or finance-first views.
- Source: user
- Primary owning slice: M001/S03
- Supporting slices: M001/S05, M001/S06, M004 (provisional)
- Validation: validated
- Notes: M001/S03 proves the dashboard and orchestration surfaces now lead with shared stage, gate, and approval-aware status truth while agent detail remains secondary.

### R020 - Lumon must preserve and deepen the Severance-like atmosphere as part of the operator experience.
- Class: differentiator
- Status: validated
- Description: Lumon must preserve and deepen the Severance-like atmosphere as part of the operator experience.
- Why it matters: The visual identity is part of what makes the product feel like Lumon rather than a generic dashboard.
- Source: user
- Primary owning slice: M001/S05
- Supporting slices: M001/S01, M001/S06
- Validation: validated
- Notes: M001/S05 proves the Severance floor renders pipeline-aware department room tones, persistent shell indicators for stuck projects, and pipeline diagnostics panels - all maintaining the control-room aesthetic while making approval-aware pipeline state legible.

## Deferred

### R021 - More than one operator can share control, visibility, and approval authority inside Lumon.
- Class: admin/support
- Status: deferred
- Description: More than one operator can share control, visibility, and approval authority inside Lumon.
- Why it matters: Collaboration may matter later, but it dilutes the single-operator focus of the first version.
- Source: inferred
- Primary owning slice: none
- Supporting slices: none
- Validation: unmapped
- Notes: Revisit after the single-operator loop is solid.

### R022 - Lumon supports robust authentication, authorization, role separation, and governance controls.
- Class: compliance/security
- Status: deferred
- Description: Lumon supports robust authentication, authorization, role separation, and governance controls.
- Why it matters: Later production use needs stronger trust boundaries and auditing.
- Source: inferred
- Primary owning slice: M006 (provisional)
- Supporting slices: none
- Validation: unmapped
- Notes: Not required for the first single-operator milestone.

### R023 - Lumon provides consolidated cost, token, and resource visibility across the portfolio.
- Class: admin/support
- Status: deferred
- Description: Lumon provides consolidated cost, token, and resource visibility across the portfolio.
- Why it matters: Useful for scaling operations, but secondary to getting orchestration right.
- Source: inferred
- Primary owning slice: M006 (provisional)
- Supporting slices: none
- Validation: unmapped
- Notes: Surface only what is necessary before this becomes primary focus.

### R024 - Lumon can supervise builds beyond a single local-first operator machine.
- Class: quality-attribute
- Status: deferred
- Description: Lumon can supervise builds beyond a single local-first operator machine.
- Why it matters: This may matter at scale, but it is not the first product problem.
- Source: inferred
- Primary owning slice: M006 (provisional)
- Supporting slices: none
- Validation: unmapped
- Notes: Current architecture direction remains local-first.

### R025 - After explicit operator confirmation, Lumon executes supported domain purchases directly.
- Class: integration
- Status: deferred
- Description: After explicit operator confirmation, Lumon executes supported domain purchases directly.
- Why it matters: It closes the real-world loop on approved naming decisions.
- Source: user
- Primary owning slice: M005 (provisional)
- Supporting slices: none
- Validation: unmapped
- Notes: Domain research is active earlier; purchase execution comes later.

## Out of Scope

### R026 - Outside users manage their own projects inside Lumon as a public product.
- Class: anti-feature
- Status: out-of-scope
- Description: Outside users manage their own projects inside Lumon as a public product.
- Why it matters: Prevents the first version from drifting away from the single-operator mission-control use case.
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: n/a
- Notes: Could become a future product direction, but not this plan.

### R027 - Lumon treats media businesses, agencies, and unrelated venture types as equal first-class targets from day one.
- Class: constraint
- Status: out-of-scope
- Description: Lumon treats media businesses, agencies, and unrelated venture types as equal first-class targets from day one.
- Why it matters: The current vision is specifically about software-product ventures.
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: n/a
- Notes: Keeps research, build, and handoff flows coherent.

### R028 - Lumon reimplements GSD instead of bootstrapping and supervising it.
- Class: anti-feature
- Status: out-of-scope
- Description: Lumon reimplements GSD instead of bootstrapping and supervising it.
- Why it matters: Preserves the intended architecture boundary and prevents needless duplication.
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: n/a
- Notes: Lumon is the control plane around GSD, not a GSD clone.

### R029 - Lumon purchases domains, creates repos, or takes similar side effects without an explicit confirmation step.
- Class: anti-feature
- Status: out-of-scope
- Description: Lumon purchases domains, creates repos, or takes similar side effects without an explicit confirmation step.
- Why it matters: Prevents silent overreach at exactly the decisions the user wants to control.
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: n/a
- Notes: This is explicitly excluded by product policy.

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R001 | primary-user-loop | validated | M001/S01 | M001/S03, M001/S05, M001/S06 | validated |
| R002 | core-capability | validated | M001/S02 | M001/S06 | validated |
| R003 | primary-user-loop | validated | M001/S03 | M002 (provisional) | validated |
| R004 | operability | active | M002 (provisional) | M001/S03 | mapped |
| R005 | core-capability | active | M002 (provisional) | none | mapped |
| R006 | core-capability | active | M002 (provisional) | none | mapped |
| R007 | core-capability | active | M002 (provisional) | none | mapped |
| R008 | differentiator | active | M002 (provisional) | M002/S03 | mapped |
| R009 | integration | active | M002 (provisional) | M002/S03, M005 (provisional) | mapped |
| R010 | core-capability | validated | M002 (provisional) | M001/S04, M003 (provisional) | validated |
| R011 | integration | active | M003 (provisional) | none | unmapped |
| R012 | core-capability | validated | M001/S02 | M003 (provisional) | validated |
| R013 | integration | active | M003 (provisional) | M004 (provisional) | unmapped |
| R014 | quality-attribute | active | M003 (provisional) | M004 (provisional) | unmapped |
| R015 | failure-visibility | active | M004 (provisional) | M001/S05 | mapped |
| R016 | operability | validated | M001/S03 | M001/S05, M001/S06, M004 (provisional) | validated |
| R017 | continuity | active | M004 (provisional) | none | unmapped |
| R018 | compliance/security | active | M002 (provisional) | M005 (provisional) | unmapped |
| R019 | integration | active | M002 (provisional) | M001/S03, M002/S03 | mapped |
| R020 | differentiator | validated | M001/S05 | M001/S01, M001/S06 | validated |
| R021 | admin/support | deferred | none | none | unmapped |
| R022 | compliance/security | deferred | M006 (provisional) | none | unmapped |
| R023 | admin/support | deferred | M006 (provisional) | none | unmapped |
| R024 | quality-attribute | deferred | M006 (provisional) | none | unmapped |
| R025 | integration | deferred | M005 (provisional) | none | unmapped |
| R026 | anti-feature | out-of-scope | none | none | n/a |
| R027 | constraint | out-of-scope | none | none | n/a |
| R028 | anti-feature | out-of-scope | none | none | n/a |
| R029 | anti-feature | out-of-scope | none | none | n/a |

## Coverage Summary

- Active requirements: 13
- Mapped to slices: 13
- Validated: 7 (R001, R002, R003, R010, R012, R016, R020)
- Unmapped active requirements: 0
