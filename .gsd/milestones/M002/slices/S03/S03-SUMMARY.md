---
id: S03
parent: M002
milestone: M002
provides:
  - Plan sub-stage sequential orchestration (naming_candidates → domain_signals → trademark_signals) on the bridge server
  - Context forwarding through sub-stage chains — selected name propagates from naming through domain and trademark
  - Compound webhook registry lookup (stageKey_subStage before stageKey before global)
  - Three n8n workflow templates for plan sub-stages with realistic mock data
  - NamingCandidatesRenderer with interactive Select buttons and onAction callback
  - DomainSignalsRenderer with per-TLD status badges and advisory disclaimer (D026)
  - TrademarkSignalsRenderer with status/class display and advisory disclaimer (D026)
  - triggerPipeline extended with optional extra body data for subStage/context forwarding
  - onAction prop chain from DossierStageOutputCard → ArtifactDetailPanel → ArtifactRenderer → sub-renderer
requires:
  - slice: S01
    provides: Bridge server API (trigger, callback, approve, artifacts), SSE push (emitSSE), sync hook (useServerSync), schema-migrated stage.output
  - slice: S02
    provides: Webhook registry pattern (getWebhookUrl), sequential orchestration pattern (callback handler sub-stage chain), artifact accumulation (lumon/append-artifact), type-dispatched rendering (ArtifactRenderer lookup table), DossierStageOutputCard + ArtifactDetailPanel
affects:
  - S04
key_files:
  - server/config.js
  - server/pipeline.js
  - server/routes/pipeline.js
  - server/__tests__/naming-pipeline.test.js
  - n8n/workflows/plan-naming-candidates.json
  - n8n/workflows/plan-domain-signals.json
  - n8n/workflows/plan-trademark-signals.json
  - n8n/README.md
  - src/lumon/sync.js
  - src/features/mission-control/ArtifactRenderer.jsx
  - src/features/mission-control/DashboardTab.jsx
  - src/lumon/__tests__/artifact-renderer.test.jsx
key_decisions:
  - D039: Compound STAGE_ENV_MAP keys use full sub-stage names (plan_naming_candidates not plan_naming) matching getWebhookUrl's stageKey + "_" + subStage construction
  - D040: Generic onAction({ type, ...payload }) prop-drilled through component chain rather than context provider — keeps renderers testable without wrapping
  - Advisory disclaimer banners use amber border/text with data-testid suffixed with -advisory-disclaimer for D026 compliance
patterns_established:
  - Context forwarding through sequential sub-stage chains — reads context from current execution record and passes it to fireWebhook for the next sub-stage
  - getWebhookUrl accepts optional subStage param with 3-tier fallback (compound → stage → global)
  - Interactive artifact renderers receive optional onAction callback via ArtifactRenderer forwarding — future interactive renderers follow the same pattern
  - Plan sub-stage n8n workflows follow identical 4-node Webhook→Respond→Code→Callback pattern as research templates
observability_surfaces:
  - "[bridge] webhook-registry stageKey=plan subStage=X source=compound" log line for compound webhook resolution
  - "[bridge] sequential-next subStage=domain_signals after=naming_candidates" and "subStage=trademark_signals after=domain_signals" for plan chain progression
  - GET /api/pipeline/status/:projectId returns execution records with context field for plan sub-stages
  - GET /api/artifacts/project/:projectId/stage/plan returns all plan artifacts
  - DOM data-testid="naming-candidate-{i}-select" for selection buttons, data-testid="domain-advisory-disclaimer" and data-testid="trademark-advisory-disclaimer" for D026 disclaimers
  - POST /api/pipeline/trigger with subStage and context fields in body when naming selection fires
drill_down_paths:
  - .gsd/milestones/M002/slices/S03/tasks/T01-SUMMARY.md
  - .gsd/milestones/M002/slices/S03/tasks/T02-SUMMARY.md
  - .gsd/milestones/M002/slices/S03/tasks/T03-SUMMARY.md
duration: 30m
verification_result: passed
completed_at: 2026-03-16
---

# S03: Naming & Brand Signal Stages

**Plan stage orchestrates naming candidates, domain availability, and trademark signals as sequential sub-stages with context forwarding, interactive candidate selection, and advisory-labeled renderers — all proven by 171 passing tests and a clean production build.**

## What Happened

The plan stage needed the same sequential sub-workflow pattern established for research in S02, but with two new dimensions: context forwarding (the selected name must propagate through the chain) and interactive rendering (the operator picks a name, which triggers downstream signals).

**T01 — Bridge server orchestration.** Extended `server/config.js` with `PLAN_SUB_STAGES` (naming_candidates → domain_signals → trademark_signals) and compound `STAGE_ENV_MAP` entries. Extended `getWebhookUrl(stageKey, subStage)` with 3-tier compound→stage→global fallback. Added optional `context` field to pipeline execution records. The callback handler gained plan sequential orchestration that reads context from the current execution and forwards it to the next sub-stage's webhook call. The trigger handler defaults plan to naming_candidates sub-stage. 29 contract tests prove the full orchestration chain including compound webhooks, context forwarding, sequential progression, and backward compatibility with intake and research flows.

**T02 — n8n workflow templates.** Three importable JSON files following the 4-node Webhook→Respond→Code→Callback pattern: naming candidates (6 candidates with rationale, domainHint, styleTags), domain signals (6 TLDs with availability status/registrar/price), trademark signals (5 records with status/class/registration). Domain and trademark Code nodes read `selectedName` from `body.context?.selectedName` with fallback for standalone testing. README updated with plan stage documentation, env var references, and flow diagram.

**T03 — Renderers and interactive selection.** Extended `triggerPipeline` in sync.js to accept optional third argument for extra body data (backward-compatible). Added three renderers to ArtifactRenderer.jsx: `NamingCandidatesRenderer` (selectable candidate list with Select buttons that call `onAction({ type: "select-name", selectedName })`), `DomainSignalsRenderer` (per-TLD status badges with advisory disclaimer), `TrademarkSignalsRenderer` (status/class table with advisory disclaimer). Wired the onAction callback through DossierStageOutputCard → ArtifactDetailPanel → ArtifactRenderer → sub-renderer, with naming selection calling `triggerPipeline(projectId, "plan", { subStage: "domain_signals", context: { selectedName } })`. 21 new tests cover all three renderers plus dispatch and onAction forwarding.

## Verification

- **`npx vitest run`** — 171 tests pass across 13 files (150 existing + 21 new), zero regressions
- **`npx vite build`** — production build succeeds (701KB JS, 115KB CSS)
- **`server/__tests__/naming-pipeline.test.js`** — 29 tests: PLAN_SUB_STAGES config, compound webhook registry (all 3 sub-stages + fallback chain), plan trigger defaults, context storage, full 3-stage sequential orchestration, context forwarding through chain, webhook payload context inclusion/omission, compound routing through trigger endpoint, backward compatibility for research + intake flows
- **`src/lumon/__tests__/artifact-renderer.test.jsx`** — 40 tests total (19 existing + 21 new): NamingCandidatesRenderer (candidate list + selection callback + disabled buttons), DomainSignalsRenderer (status badges + advisory disclaimer), TrademarkSignalsRenderer (status/class + advisory disclaimer), ArtifactRenderer dispatch for all three new types, onAction forwarding
- **n8n templates** — All 3 JSON files parse without error, each has 4 nodes and 2 connection sources, callback URLs consistent
- **Observability** — Log lines for compound webhook resolution, sequential chain progression, and context forwarding all verified through test output

## Requirements Advanced

- R008 — Naming candidates now generate as structured artifacts through n8n, render as a selectable list in the dossier, and the operator's selection triggers downstream signals. The workflow is orchestrated, not manual.
- R009 — Domain availability and trademark signal artifacts render with status badges and mandatory advisory disclaimers (D026). The signals are clearly labeled as point-in-time advisory, not legal clearance.
- R019 — n8n orchestration extended to the plan stage with three sub-workflows, compound webhook routing, and context forwarding through the sequential chain. The workflow engine handles naming→domain→trademark progression.

## Requirements Validated

- None — R008 and R009 advance significantly but full validation requires S04's live n8n integration and end-to-end pipeline proof.

## New Requirements Surfaced

- None

## Requirements Invalidated or Re-scoped

- None

## Deviations

- T01 plan initially used short compound keys in STAGE_ENV_MAP (`plan_naming`, `plan_domain`, `plan_trademark`) but `getWebhookUrl` constructs `stageKey + "_" + subStage` = `plan_naming_candidates`. Fixed to use full compound keys during T01 execution. Recorded as D039.

## Known Limitations

- Plan sub-stage orchestration is proven by contract tests only — live n8n integration proof deferred to S04
- Naming selection triggers domain_signals via triggerPipeline but there is no UI feedback (loading state, error toast) for the trigger call itself — adequate for contract proof, needs operational polish in S04 or later
- No auto-trigger chain from research approval to plan stage — plan must be manually triggered (consistent with plan gate having `required: true`)

## Follow-ups

- S04 must prove the full pipeline end-to-end with live n8n: intake → research → plan (naming → domain → trademark) → architecture → handoff
- S04 should verify that plan artifacts accumulate correctly into the handoff packet evidence sections
- The onAction callback chain (DossierStageOutputCard → ArtifactDetailPanel → ArtifactRenderer) is 3 levels deep — if S04 adds more interactive renderers, consider whether a context provider is cleaner

## Files Created/Modified

- `server/config.js` — Added PLAN_SUB_STAGES export, compound STAGE_ENV_MAP entries, extended getWebhookUrl with subStage param and 3-tier fallback
- `server/pipeline.js` — Added context field to trigger() and execution record
- `server/routes/pipeline.js` — Plan trigger defaults, context forwarding in fireWebhook/trigger/callback, plan sequential orchestration
- `server/__tests__/naming-pipeline.test.js` — New: 29 contract tests for plan orchestration and context forwarding
- `n8n/workflows/plan-naming-candidates.json` — New: 4-node naming candidates workflow template with 6 candidates
- `n8n/workflows/plan-domain-signals.json` — New: 4-node domain availability workflow template with 6 TLDs
- `n8n/workflows/plan-trademark-signals.json` — New: 4-node trademark search workflow template with 5 records
- `n8n/README.md` — Added Plan Stage Workflows section with env vars, context forwarding docs, and flow diagram
- `src/lumon/sync.js` — Extended triggerPipeline signature with optional extra third arg, spread into POST body
- `src/features/mission-control/ArtifactRenderer.jsx` — Added NamingCandidatesRenderer, DomainSignalsRenderer, TrademarkSignalsRenderer; registered in TYPE_RENDERERS; ArtifactRenderer accepts/forwards onAction prop
- `src/features/mission-control/DashboardTab.jsx` — ArtifactDetailPanel accepts/forwards onAction; DossierStageOutputCard accepts projectId, creates onAction handler wiring triggerPipeline; DossierPanel passes project.id
- `src/lumon/__tests__/artifact-renderer.test.jsx` — Added 21 new tests for three renderers + dispatch + onAction forwarding

## Forward Intelligence

### What the next slice should know
- The plan stage now has full parity with research for sub-stage orchestration — same `STAGE_SUB_STAGES` config, same callback handler pattern, same webhook registry lookup. S04 can add architecture/wave stages by following the identical pattern.
- Context forwarding is the new primitive — it lets data flow between sub-stages. S04's architecture stage may need context from prior plan decisions (selected name, tech stack choice). The mechanism is proven.
- The `triggerPipeline(projectId, stageKey, extra)` third-arg pattern is the way to pass subStage and context from the UI. S04 should use this for any interactive trigger.

### What's fragile
- The compound webhook key convention (`plan_naming_candidates` not `plan_naming`) is a naming contract — if someone adds a sub-stage whose name doesn't match the env var suffix convention, the lookup silently falls back to stage-level or global. This is fine for now but could surprise.
- The onAction prop chain is 3 levels deep (DossierStageOutputCard → ArtifactDetailPanel → ArtifactRenderer → sub-renderer). It works, but adding a 4th interactive level would make it awkward.

### Authoritative diagnostics
- `server/__tests__/naming-pipeline.test.js` — 29 tests are the authoritative proof for plan sub-stage orchestration, context forwarding, compound webhooks, and backward compatibility
- `src/lumon/__tests__/artifact-renderer.test.jsx` — 40 tests (including 21 new) are the authoritative proof for all artifact type dispatch including naming selection callback
- The `[bridge] sequential-next subStage=X after=Y` log lines in test output confirm the chain fires correctly

### What assumptions changed
- No assumptions changed. The plan stage followed the research pattern exactly as S02 established. Context forwarding was new but landed cleanly without requiring changes to existing infrastructure.
