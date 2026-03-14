# Requirements

This file is the explicit capability and coverage contract for the project.

Use it to track what is actively in scope, what has been validated by completed work, what is intentionally deferred, and what is explicitly out of scope.

Guidelines:
- Keep requirements capability-oriented, not a giant feature wishlist.
- Requirements should be atomic, testable, and stated in plain language.
- Every **Active** requirement should be mapped to a slice, deferred, blocked with reason, or moved out of scope.
- Each requirement should have one accountable primary owner and may have supporting slices.
- Research may suggest requirements, but research does not silently make them binding.
- Validation means the requirement was actually proven by completed work and verification, not just discussed.

## Active

### R002 — Multi-project registry and lifecycle tracking
- Class: core-capability
- Status: active
- Description: The operator must be able to create, store, browse, and revisit multiple projects with clear lifecycle state.
- Why it matters: Lumon is a fleet dashboard, not a single-project wizard.
- Source: user
- Primary owning slice: M001/S02
- Supporting slices: M001/S06
- Validation: mapped
- Notes: M001 needs durable local persistence, even if later milestones replace the backing store.

### R003 — Stage-based intake pipeline from idea to build handoff
- Class: primary-user-loop
- Status: active
- Description: Every project must move through an explicit pre-build pipeline before it can be handed to GSD.
- Why it matters: The product’s value is orchestration and disciplined progression, not loose project notes.
- Source: user
- Primary owning slice: M001/S03
- Supporting slices: M002 (provisional)
- Validation: mapped
- Notes: M001 establishes the product model; M002 automates it.

### R004 — Explicit approval gates between major pre-build stages
- Class: operability
- Status: active
- Description: Major pre-build stages must stop for explicit operator approval before the project advances.
- Why it matters: The user wants stage-gated control, not an always-on autonomous pipeline.
- Source: user
- Primary owning slice: M002 (provisional)
- Supporting slices: M001/S03
- Validation: mapped
- Notes: Applies especially to transitions that affect scope, brand, or build-readiness.

### R005 — Viability analysis before build decision
- Class: core-capability
- Status: active
- Description: Lumon must produce an explicit should-we-build-this assessment before technical execution begins.
- Why it matters: Bad ideas should die before build effort and API spend are committed.
- Source: user
- Primary owning slice: M002 (provisional)
- Supporting slices: none
- Validation: unmapped
- Notes: Output should be advisory and reviewable, not silent auto-scope.

### R006 — Business planning output
- Class: core-capability
- Status: active
- Description: The pre-build package must include business framing such as target audience, pricing posture, feature phases, and rough value model.
- Why it matters: The user wants ventures evaluated as businesses, not just code projects.
- Source: user
- Primary owning slice: M002 (provisional)
- Supporting slices: none
- Validation: unmapped
- Notes: ARR/MRR reasoning should be transparent and clearly labeled as estimate.

### R007 — Tech-stack research and iteration workflow
- Class: core-capability
- Status: active
- Description: Lumon must compare and iterate on plausible technical approaches before locking the build direction.
- Why it matters: The technical path is part of the approval package, not an afterthought.
- Source: user
- Primary owning slice: M002 (provisional)
- Supporting slices: none
- Validation: unmapped
- Notes: Research should inform the user, not silently hard-bind stack choices.

### R008 — Naming workflow with project and business naming exploration
- Class: differentiator
- Status: active
- Description: Lumon must help generate, compare, and refine candidate product or business names as part of the intake pipeline.
- Why it matters: Naming is part of the user’s real process and affects downstream domain and trademark work.
- Source: user
- Primary owning slice: M002 (provisional)
- Supporting slices: none
- Validation: unmapped
- Notes: Final choice remains operator-approved.

### R009 — Domain availability and trademark check workflow
- Class: integration
- Status: active
- Description: Lumon must gather domain availability and trademark/status signals for candidate names before build handoff.
- Why it matters: Brand decisions should be informed before repo creation and downstream build momentum.
- Source: user
- Primary owning slice: M002 (provisional)
- Supporting slices: M005 (provisional)
- Validation: unmapped
- Notes: Research signals are advisory; legal clearance should not be overstated.

### R010 — Architecture diagrams, spec files, and prototype package before build
- Class: core-capability
- Status: active
- Description: Approved projects must have a tangible handoff package including architecture artifacts, specs, and a small prototype.
- Why it matters: GSD should receive more than an idea blurb; it needs a serious build packet.
- Source: user
- Primary owning slice: M002 (provisional)
- Supporting slices: M001/S04, M003 (provisional)
- Validation: mapped
- Notes: M001 defines the dossier and packet structure; M002 fills it with real outputs.

### R011 — Repo creation and artifact upload for approved projects
- Class: integration
- Status: active
- Description: Lumon must create a project repository and place the approved artifacts where GSD can consume them.
- Why it matters: The handoff boundary has to become concrete, not remain conceptual.
- Source: user
- Primary owning slice: M003 (provisional)
- Supporting slices: none
- Validation: unmapped
- Notes: External creation requires explicit confirmation.

### R012 — Execution-engine selection per project
- Class: core-capability
- Status: active
- Description: Each project must carry an explicit execution-engine choice between Claude Code and Codex.
- Why it matters: Engine choice is part of the user-visible project identity and later execution behavior.
- Source: user
- Primary owning slice: M003 (provisional)
- Supporting slices: M001/S02
- Validation: mapped
- Notes: M001 stores and displays the choice; M003 uses it for real handoff.

### R013 — GSD bootstrap and autonomous handoff
- Class: integration
- Status: active
- Description: Once approved, Lumon must be able to bootstrap GSD and transfer the project into autonomous execution.
- Why it matters: The system’s main promise is end-to-end movement from idea to build.
- Source: user
- Primary owning slice: M003 (provisional)
- Supporting slices: M004 (provisional)
- Validation: unmapped
- Notes: Handoff should preserve the full approved package, not a lossy summary.

### R014 — Independent project isolation with separate repos and workspaces
- Class: quality-attribute
- Status: active
- Description: Projects must be able to run independently with separate repositories and working environments.
- Why it matters: Cross-project contamination would make the mission-control model untrustworthy.
- Source: user
- Primary owning slice: M003 (provisional)
- Supporting slices: M004 (provisional)
- Validation: unmapped
- Notes: This is a hard requirement, not optimization.

### R015 — Live visibility into each agent’s current activity
- Class: failure-visibility
- Status: active
- Description: The operator must be able to see what each active agent is doing now and where work is stuck.
- Why it matters: Without visibility, the dashboard becomes decorative rather than operational.
- Source: user
- Primary owning slice: M004 (provisional)
- Supporting slices: M001/S05
- Validation: mapped
- Notes: M001 proves the surface; M004 makes it real.

### R016 — Dashboard-first stage and agent status visibility
- Class: operability
- Status: active
- Description: The main dashboard must prioritize pipeline stage state and agent state across projects.
- Why it matters: The user explicitly wants at-a-glance operational awareness over pure terminal immersion or finance-first views.
- Source: user
- Primary owning slice: M001/S03
- Supporting slices: M001/S05, M001/S06, M004 (provisional)
- Validation: mapped
- Notes: This is the primary information hierarchy for the product.

### R017 — One auto-retry on failure, then pause and escalate
- Class: continuity
- Status: active
- Description: When a research or build stage fails, Lumon should try one bounded recovery pass before pausing and escalating.
- Why it matters: The operator wants self-healing where sensible, but not silent runaway behavior.
- Source: user
- Primary owning slice: M004 (provisional)
- Supporting slices: none
- Validation: unmapped
- Notes: Applies to runtime orchestration, not irreversible external actions.

### R018 — Explicit confirmation before irreversible external actions
- Class: compliance/security
- Status: active
- Description: Repo creation, domain purchase, and similar side effects must wait for explicit operator confirmation.
- Why it matters: The user wants Lumon to prepare and recommend, then pause at the irreversible edge.
- Source: user
- Primary owning slice: M002 (provisional)
- Supporting slices: M005 (provisional)
- Validation: unmapped
- Notes: This applies even if prior stage approvals exist.

### R019 — n8n as first-class workflow orchestrator
- Class: integration
- Status: active
- Description: n8n must be treated as a real orchestration layer for the research and approval pipeline.
- Why it matters: The workflow engine is part of the product architecture, not a hidden implementation detail.
- Source: user
- Primary owning slice: M002 (provisional)
- Supporting slices: M001/S03
- Validation: unmapped
- Notes: M001 should shape stage contracts so n8n can attach cleanly later.

### R020 — Severance-inspired control-room presentation
- Class: differentiator
- Status: active
- Description: Lumon must preserve and deepen the Severance-like atmosphere as part of the operator experience.
- Why it matters: The visual identity is part of what makes the product feel like Lumon rather than a generic dashboard.
- Source: user
- Primary owning slice: M001/S05
- Supporting slices: M001/S01, M001/S06
- Validation: mapped
- Notes: Style should serve clarity, not obscure state.

## Validated

### R001 — Single-operator mission control dashboard
- Class: primary-user-loop
- Status: validated
- Description: Lumon must operate as a control room for one owner-operator managing many software-product initiatives.
- Why it matters: The first version is explicitly optimized for one person who wants clarity and throughput, not team collaboration overhead.
- Source: user
- Primary owning slice: M001/S01
- Supporting slices: M001/S03, M001/S05, M001/S06
- Validation: validated
- Notes: Multi-operator support is intentionally deferred.


## Deferred

### R021 — Multi-operator collaboration and shared control
- Class: admin/support
- Status: deferred
- Description: More than one operator can share control, visibility, and approval authority inside Lumon.
- Why it matters: Collaboration may matter later, but it dilutes the single-operator focus of the first version.
- Source: inferred
- Primary owning slice: none
- Supporting slices: none
- Validation: unmapped
- Notes: Revisit after the single-operator loop is solid.

### R022 — Production-grade auth, roles, and governance
- Class: compliance/security
- Status: deferred
- Description: Lumon supports robust authentication, authorization, role separation, and governance controls.
- Why it matters: Later production use needs stronger trust boundaries and auditing.
- Source: inferred
- Primary owning slice: M006 (provisional)
- Supporting slices: none
- Validation: unmapped
- Notes: Not required for the first single-operator milestone.

### R023 — Full cost and usage telemetry across agents and projects
- Class: admin/support
- Status: deferred
- Description: Lumon provides consolidated cost, token, and resource visibility across the portfolio.
- Why it matters: Useful for scaling operations, but secondary to getting orchestration right.
- Source: inferred
- Primary owning slice: M006 (provisional)
- Supporting slices: none
- Validation: unmapped
- Notes: Surface only what is necessary before this becomes primary focus.

### R024 — Cloud or distributed runtime beyond local-first orchestration
- Class: quality-attribute
- Status: deferred
- Description: Lumon can supervise builds beyond a single local-first operator machine.
- Why it matters: This may matter at scale, but it is not the first product problem.
- Source: inferred
- Primary owning slice: M006 (provisional)
- Supporting slices: none
- Validation: unmapped
- Notes: Current architecture direction remains local-first.

### R025 — Automated domain purchase execution after confirmation
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

### R026 — Client self-service or public multi-tenant Lumon
- Class: anti-feature
- Status: out-of-scope
- Description: Outside users manage their own projects inside Lumon as a public product.
- Why it matters: Prevents the first version from drifting away from the single-operator mission-control use case.
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: n/a
- Notes: Could become a future product direction, but not this plan.

### R027 — Non-software venture types as first-class project targets
- Class: constraint
- Status: out-of-scope
- Description: Lumon treats media businesses, agencies, and unrelated venture types as equal first-class targets from day one.
- Why it matters: The current vision is specifically about software-product ventures.
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: n/a
- Notes: Keeps research, build, and handoff flows coherent.

### R028 — Replacing GSD rather than orchestrating around it
- Class: anti-feature
- Status: out-of-scope
- Description: Lumon reimplements GSD instead of bootstrapping and supervising it.
- Why it matters: Preserves the intended architecture boundary and prevents needless duplication.
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: n/a
- Notes: Lumon is the control plane around GSD, not a GSD clone.

### R029 — Fully autonomous irreversible actions without operator confirmation
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
| R002 | core-capability | active | M001/S02 | M001/S06 | mapped |
| R003 | primary-user-loop | active | M001/S03 | M002 (provisional) | mapped |
| R004 | operability | active | M002 (provisional) | M001/S03 | mapped |
| R005 | core-capability | active | M002 (provisional) | none | unmapped |
| R006 | core-capability | active | M002 (provisional) | none | unmapped |
| R007 | core-capability | active | M002 (provisional) | none | unmapped |
| R008 | differentiator | active | M002 (provisional) | none | unmapped |
| R009 | integration | active | M002 (provisional) | M005 (provisional) | unmapped |
| R010 | core-capability | active | M002 (provisional) | M001/S04, M003 (provisional) | mapped |
| R011 | integration | active | M003 (provisional) | none | unmapped |
| R012 | core-capability | active | M003 (provisional) | M001/S02 | mapped |
| R013 | integration | active | M003 (provisional) | M004 (provisional) | unmapped |
| R014 | quality-attribute | active | M003 (provisional) | M004 (provisional) | unmapped |
| R015 | failure-visibility | active | M004 (provisional) | M001/S05 | mapped |
| R016 | operability | active | M001/S03 | M001/S05, M001/S06, M004 (provisional) | mapped |
| R017 | continuity | active | M004 (provisional) | none | unmapped |
| R018 | compliance/security | active | M002 (provisional) | M005 (provisional) | unmapped |
| R019 | integration | active | M002 (provisional) | M001/S03 | unmapped |
| R020 | differentiator | active | M001/S05 | M001/S01, M001/S06 | mapped |
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

- Active requirements: 19
- Mapped to slices or provisional milestone owners: 20
- Validated: 1
- Unmapped active requirements: 0
