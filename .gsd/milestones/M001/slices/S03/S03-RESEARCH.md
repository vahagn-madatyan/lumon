# S03 — Research

**Date:** 2026-03-13

## Summary

S03 directly owns **R003** (explicit stage-based intake pipeline) and **R016** (dashboard-first stage and agent visibility), and it materially supports **R004** (approval gates) and **R019** (n8n-ready workflow orchestration). The codebase already has the raw primitives for this slice: canonical `PipelineStage` and `ApprovalState` constructors in `src/lumon/model.js`, a single `updateStage` mutation seam in `src/lumon/reducer.js`, persisted project identity from S02, and selector-owned orchestration projections in `src/lumon/selectors.js`. What it does **not** have yet is a stable pre-build taxonomy, real gate semantics, or dashboard-first stage visibility.

The main architectural surprise is that the current stage model is split across three places: generated/demo pipelines in `src/lumon/seed.js`, default project-stage creation in `src/features/mission-control/MissionControlShell.jsx`, and status/progress derivation in `src/lumon/selectors.js`. Approval data also exists only as a stage-local blob (`id`, `label`, `state`, `owner`, `note`, `updatedAt`, `meta`) with no event history, no transition rules, and no project-level interpretation of "waiting", "blocked", or "ready for handoff". That means S03 cannot be just a UI board; it needs a canonical pipeline contract and selector layer first.

The second surprise is that **R016 is still unmet in the main dashboard**. `DashboardTab.jsx` leads with active/total/cost/tokens and per-agent cards; the explicit stage journey only appears inside `OrchestrationTab.jsx`. If S03 ships only a richer orchestration flow, the milestone still misses the stated dashboard priority. The right move is to centralize the intake taxonomy and approval semantics in `src/lumon/*`, then project a dashboard-first pipeline board/view model that the orchestration canvas can continue to consume as a local adapter.

## Recommendation

Take a **domain-first, selector-owned** S03 approach:

1. **Canonicalize the pre-build taxonomy in `src/lumon/*`, not in UI modules.**
   Move the default intake journey out of `MissionControlShell.jsx` and replace the current ad hoc stage arrays with one reusable canonical stage factory/constant set. S03 needs stable stages from intake through approved handoff-ready; the shell should only request a new project, not invent its own pipeline.

2. **Keep execution status and approval status as separate concepts.**
   The current stage model already supports this well enough:
   - `stage.status` for work lifecycle (`queued`, `running`, `complete`, `failed`)
   - `stage.approval.state` for gate lifecycle (`not_required`, `pending`, `approved`, `rejected`, `needs_iteration`)

   Don’t overload agent status or stage status to represent approvals. Instead, add selector-derived project/stage summaries such as:
   - `running` — active work in progress
   - `waiting` — stage work complete but operator approval pending
   - `blocked` — rejected, needs iteration, or failed
   - `idle` — not started / queued
   - `handoff_ready` — terminal summary label for the dossier/handoff path

3. **Make the dashboard consume a pipeline-board selector, not just agent metrics.**
   S03 should add a selector that projects per-project stage timeline, current gate, approval summary, and handoff readiness into the main dashboard. Agent metrics still matter, but they should become secondary to the pipeline board if R016 is going to be true.

4. **Treat React Flow as presentation only.**
   Keep `useNodesState` / `useEdgesState` local in `OrchestrationTab.jsx`, with nodes/edges derived from canonical pipeline selectors. That preserves D009 and avoids turning the canvas into the source of truth.

5. **Shape the approval model so n8n can attach later without changing the UI contract.**
   S03 doesn’t need real n8n execution, but it should expose stable stage/gate identifiers and pending-approval metadata that map naturally to a future paused workflow / resume action boundary.

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| Default pipeline creation is duplicated between seed data and new-project flow | Centralize a canonical intake-stage factory in `src/lumon/*` and call it from both seed/setup paths | Prevents stage drift between persisted projects, seeded demos, and UI-created projects |
| React Flow can tempt the app into canvas-owned workflow state | Keep `useNodesState` / `useEdgesState` as local controlled state over selector-derived graph data | Matches the current architecture decision and keeps S03 from reintroducing split-brain state |
| Future approval pauses could invite a custom pause/resume protocol | Model gates so they can later map to n8n Wait/resume semantics instead of inventing a parallel mechanism | Keeps S03 aligned with D004 and makes M002 integration cleaner |

## Existing Code and Patterns

- `src/lumon/model.js` — already defines open-ended `createPipelineStage()` and `createApprovalState()` shapes. Good place to formalize stage kinds, approval states, and canonical constructors for new projects.
- `src/lumon/reducer.js` — `updateStage()` is the canonical mutation seam for S03, but note that advancing the active stage still requires explicit `currentStageId` management.
- `src/lumon/selectors.js` — already derives orchestration stages from canonical state, but dashboard and floor projections still mostly read project/agent status rather than gate-aware pipeline status.
- `src/lumon/seed.js` — contains both detailed seed pipelines and generated fallback stages. Useful source material, but it currently mixes demo-specific labels with the stage contract S03 needs to stabilize.
- `src/features/mission-control/MissionControlShell.jsx` — currently creates default project stages in the UI layer. This is the main stage-taxonomy drift point and should be retired in S03.
- `src/features/mission-control/DashboardTab.jsx` — currently emphasizes agent metrics and selected-project agent detail. It has no pipeline-board view yet, which is the main product-level gap against R016.
- `src/features/mission-control/OrchestrationTab.jsx` — already proves React Flow can stay a local adapter over selector output. Reuse this pattern; don’t promote flow nodes/edges into canonical app state.
- `src/severance-floor.jsx` + `selectFloorViewModel()` — S05 will need stage-aware project status here, but today the floor only understands agent-derived project states. S03 should define the status contract S05 will consume.

## Constraints

- **The source of truth must stay in `src/lumon/*`.** D009 and the current `ArchitectureTab.jsx` explicitly position React Flow as a local adapter, not the canonical workflow model.
- **Persisted state already ships through `lumon.registry.v1`.** Backward-compatible additions to `project.execution.stages[*].approval` are low-friction; larger shape changes may need a migration or storage-version bump.
- **`phaseLabel` is currently freeform and separate from the stage contract.** If S03 leaves it independent, the dashboard can say one thing while the board says another.
- **`selectProjectStatus()` is agent-driven today.** It only returns `running`, `queued`, `complete`, or `failed`, which is too coarse for the waiting/blocked/approval-gated behavior S03 and S05 need.
- **Progress is currently completion-count based.** `selectOrchestrationInput()` calculates progress from completed stages, so an approval-pending stage can look “done” unless approval-aware progress/summary rules are added.
- **`currentStageId` is not fully self-healing.** Reducer updates don’t automatically compute the next active stage when approvals or statuses change; S03 should centralize that rule instead of scattering it across UI handlers.

## Common Pitfalls

- **Leaving stage creation in `MissionControlShell.jsx`** — that would keep UI-created projects on a different taxonomy than seeded/persisted ones. Move stage construction behind canonical helpers.
- **Using approval as decorative copy only** — if approval state doesn’t affect project summaries, current gate selection, and dashboard ordering, S03 will look finished while missing R003/R016.
- **Collapsing approvals into `stage.status`** — `waiting for approval` is not the same thing as `queued` or `complete`. Keep approval semantics separate so later n8n and dossier work stays clean.
- **Trusting stored `execution.status` too much** — selectors already derive richer truth from stages/agents. Prefer derived status over stale stored fields.
- **Bolting a stage board onto the orchestration tab only** — that preserves the current information hierarchy problem and leaves the main dashboard stage-blind.

## Open Risks

- S03 may need to introduce a new project-level pipeline summary selector and possibly a richer status vocabulary before S05 can render waiting/blocked/idle correctly.
- If the slice adds approval history or gate actions in a way that isn’t backward-compatible with `lumon.registry.v1`, persisted reload behavior could regress.
- There is a scope trap here: S03 should define the approval model and visible board, but not overreach into S04 dossier/handoff artifact rendering.
- The existing dashboard is already dense; forcing a board in without rebalancing content could satisfy the contract technically while hurting legibility.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| React | `vercel-react-best-practices` | installed |
| React Flow | `existential-birds/beagle@react-flow` | available — install with `npx skills add existential-birds/beagle@react-flow` |
| n8n | `czlonkowski/n8n-skills@n8n-workflow-patterns` | available — install with `npx skills add czlonkowski/n8n-skills@n8n-workflow-patterns` |

## Sources

- The canonical domain already supports open-ended stage and approval shapes, but only as stage-local records with no gate/event semantics yet (source: repo inspection — `src/lumon/model.js`, `src/lumon/reducer.js`).
- The current seed and fallback pipelines already encode multiple stage kinds, but the taxonomy is still mixed with demo-specific labels and generated defaults (source: repo inspection — `src/lumon/seed.js`).
- UI-created projects still invent their own default stages in the shell layer, which is the clearest current drift point (source: repo inspection — `src/features/mission-control/MissionControlShell.jsx`).
- The dashboard still prioritizes agent metrics and selected-agent detail over the explicit stage journey, so R016 remains open (source: repo inspection — `src/features/mission-control/DashboardTab.jsx`, `src/lumon/selectors.js`).
- React Flow’s controlled-state hooks (`useNodesState`, `useEdgesState`) are intended for locally managed node/edge state, which matches the current adapter pattern in `OrchestrationTab.jsx` (source: [React Flow hooks docs](https://reactflow.dev/api-reference/hooks)).
- n8n’s Wait node exposes a per-execution resume URL for paused workflows, which is the clean future attachment point for approval-gated progression rather than inventing a custom pause protocol in S03 (source: [n8n Wait node docs](https://github.com/n8n-io/n8n-docs/blob/main/docs/integrations/builtin/core-nodes/n8n-nodes-base.wait.md)).
