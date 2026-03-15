# M001: Lumon Control Surface

**Vision:** Establish Lumon as a real single-operator mission-control shell for software-product ventures by turning the existing prototype into a persistent, stage-aware, multi-surface dashboard that later n8n, GitHub, GSD, and runtime orchestration can plug into.

## Success Criteria

- The operator can create multiple projects, choose Claude Code or Codex for each, reload the app, and recover the same fleet state.
- The main dashboard, project dossier, and Severance floor all reflect the same underlying project and stage truth.
- The pre-build journey exists as an explicit staged workflow with approval gates and a visible handoff packet structure.
- The current repo stops feeling like a disconnected prototype and starts feeling like the real Lumon control surface.

## Key Risks / Unknowns

- The current UI is built from mock-heavy, duplicated state — if that persists, later milestones will wire into unstable foundations.
- The repo’s strongest asset is its distinct visual language — refactoring could easily flatten or break the feel if the state model and presentation drift apart.
- Later milestones depend on a stable stage contract and dossier shape — weak modeling here will ripple into the n8n and GSD work.
- The main dashboard, dossier, and Severance floor can diverge unless they all consume the same canonical state.

## Proof Strategy

- Canonical state risk → retire in S01 by proving a shared Lumon domain model and selectors can drive more than one major surface.
- Persistence risk → retire in S02 by proving projects and engine choice survive reload and remain coherent after restore.
- Stage-contract risk → retire in S03 by proving the operator can move a project through explicit pre-build stages and approval gates.
- Multi-surface drift risk → retire in S05 by proving the Severance floor consumes the same project and agent summary state as the dashboard.
- Final assembly risk → retire in S06 by proving the full create → inspect → advance → observe loop works in the real browser entrypoint.

## Verification Classes

- Contract verification: artifact checks, domain-model wiring checks, persistence round-trip checks, and browser assertions over the real app.
- Integration verification: real browser interaction across project creation, reload, detail inspection, stage transitions, and floor synchronization.
- Operational verification: local reload continuity with preserved project fleet and stage state.
- UAT / human verification: the control-room feel remains legible and distinctive while carrying real shared state.

## Milestone Definition of Done

This milestone is complete only when all are true:

- all M001 slices are complete and their outputs are wired into the same app state model
- project creation, persistence, detail, stage board, and Severance floor actually connect rather than simulating disconnected mock states
- the real browser entrypoint supports a coherent operator loop from project creation through stage inspection
- success criteria are re-checked against live browser behavior, not just code artifacts
- the final integrated acceptance scenarios pass in the running app

## Requirement Coverage

- Covers: R001, R002, R003, R012, R016, R020
- Partially covers: R004, R010, R015, R019
- Leaves for later: R005, R006, R007, R008, R009, R011, R013, R014, R017, R018
- Orphan risks: none

## Slices

- [x] **S01: Core control-shell refactor** `risk:high` `depends:[]`
  > After this: the current prototype runs on a canonical Lumon app state and shared selectors instead of scattered mock-only view data.

- [x] **S02: Project registry and persistence** `risk:high` `depends:[S01]`
  > After this: the operator can create projects, choose Claude Code or Codex, and recover the same fleet after reload.

- [x] **S03: Pipeline board and approval model** `risk:medium` `depends:[S01,S02]`
  > After this: each project shows an explicit staged journey from intake to GSD handoff with approval-gated progression.

- [x] **S04: Project dossier and handoff packet views** `risk:medium` `depends:[S02,S03]`
  > After this: opening a project reveals its working brief, stage outputs, approval state, and the structure of the future handoff packet.

- [x] **S05: Severed floor live-state integration** `risk:medium` `depends:[S01,S02,S03]`
  > After this: the Severance floor reflects real shared project and agent-summary state instead of isolated mock behavior.

- [x] **S06: End-to-end operator loop integration** `risk:high` `depends:[S03,S04,S05]`
  > After this: the operator can create a project, move it through the M001 control flow, inspect it in detail, and watch all primary surfaces stay in sync.

## Boundary Map

### S01 → S02

Produces:
- canonical Lumon domain shapes for `Project`, `ExecutionEngine`, `PipelineStage`, `ApprovalState`, and `AgentSummary`
- centralized app-state module with create/update/select actions that later persistence can wrap
- shared selectors for fleet view, project detail, and scene-derived status summaries

Consumes:
- nothing (first slice)

### S02 → S03

Produces:
- persistent project registry adapter with create, update, delete, restore, and selected-project semantics
- durable engine-choice persistence bound to project identity
- stable project IDs and timestamps that later pipeline state can attach to

Consumes from S01:
- `Project` and `ExecutionEngine` shapes
- centralized app-state actions and selectors

### S02 → S04

Produces:
- stable persisted project metadata available to dossier and handoff views
- selected-project lookup and detail-loading contract

Consumes from S01:
- shared project selectors and identity rules

### S03 → S04

Produces:
- stable stage taxonomy from intake through approved-handoff-ready
- approval-event model for pending, approved, rejected, and needs-iteration states
- stage timeline selectors for project overview and dossier sections

Consumes from S02:
- persisted project registry and selected-project state

### S03 → S05

Produces:
- scene-friendly project and agent summary selectors derived from canonical stage state
- per-project visual status contract for running, waiting, blocked, and idle representations

Consumes from S01:
- canonical domain model and shared selectors

Consumes from S02:
- persisted project roster and engine identity

### S04 → S06

Produces:
- dossier and handoff packet structure for project brief, stage artifacts, approvals, and future build packet sections
- project detail interaction contract linking overview, dossier, and handoff surfaces

Consumes from S02:
- stable project identity and persistence

Consumes from S03:
- stage and approval state model

### S05 → S06

Produces:
- Severance floor integration layer that renders from real project and agent-summary state
- synchronized visual contract between main dashboard metrics and floor presence

Consumes from S03:
- scene-friendly status selectors

Consumes from S02:
- persisted project fleet state
