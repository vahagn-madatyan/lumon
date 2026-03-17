# S03: Naming & Brand Signal Stages

**Goal:** Naming candidates appear as a selectable list in the dossier, the operator picks a winner, and domain availability and trademark signals display with advisory labels — all orchestrated through n8n sub-workflows under the plan stage.
**Demo:** Trigger the plan stage → naming candidates artifact arrives → operator selects a name → domain signals fire automatically → trademark signals fire automatically → all three artifacts render in the dossier with advisory disclaimers → plan gate ready for approval.

## Must-Haves

- Plan sub-stage orchestration (naming_candidates → domain_signals → trademark_signals) with sequential progression in the callback handler
- Context forwarding — the selected name propagates from the naming trigger through domain and trademark sub-stages via the execution record
- Trigger endpoint accepts optional `context` body field and forwards it to n8n webhooks (backward-compatible)
- Three n8n workflow templates (Webhook→Code→Callback pattern) producing realistic mock data
- NamingCandidatesRenderer with interactive "Select" action per candidate that calls `triggerPipeline` with context
- DomainSignalsRenderer with status badges and mandatory advisory disclaimer (D026)
- TrademarkSignalsRenderer with status/class info and mandatory advisory disclaimer (D026)
- `triggerPipeline` in sync.js extended to accept optional extra body data (`{ subStage, context }`)
- All three artifact types dispatch correctly through the ArtifactRenderer lookup table

## Proof Level

- This slice proves: contract + integration (server orchestration + client rendering + interactive selection)
- Real runtime required: no (contract tests prove the orchestration and rendering chain)
- Human/UAT required: no (deferred to S04 full pipeline integration)

## Verification

- `npx vitest run` — all 121 existing tests pass + new naming/plan tests (zero regressions)
- `server/__tests__/naming-pipeline.test.js` — plan sub-stage orchestration, context forwarding through sequential chain, compound webhook lookups, plan trigger defaults to naming_candidates
- `src/lumon/__tests__/artifact-renderer.test.jsx` — extended with NamingCandidatesRenderer (candidate list + selection callback), DomainSignalsRenderer (badges + advisory disclaimer), TrademarkSignalsRenderer (status + advisory disclaimer)
- `npx vite build` — production build succeeds
- n8n templates: valid JSON with correct Webhook→Code→Callback structure

## Observability / Diagnostics

- Runtime signals: `[bridge] sequential-next subStage=domain_signals after=naming_candidates` and `[bridge] sequential-next subStage=trademark_signals after=domain_signals` log lines trace plan sub-stage progression; `[bridge] webhook-registry stageKey=plan source=...` for compound webhook lookups
- Inspection surfaces: `GET /api/pipeline/status/:projectId` returns per-stage execution records including plan sub-stages with context; `GET /api/artifacts/project/:projectId/stage/plan` returns all plan artifacts
- Failure visibility: `pipeline.recordFailure()` captures failureReason per execution; context forwarding failures visible through missing `context` on downstream execution records
- Redaction constraints: none

## Integration Closure

- Upstream surfaces consumed: S01 bridge server API (trigger, callback, approve, artifacts), SSE push (emitSSE), sync hook (useServerSync), schema-migrated stage.output; S02 webhook registry pattern (getWebhookUrl), sequential orchestration pattern (callback handler sub-stage chain), artifact accumulation (lumon/append-artifact), type-dispatched rendering (ArtifactRenderer lookup table), DossierStageOutputCard + ArtifactDetailPanel
- New wiring introduced in this slice: `context` field on trigger endpoint + execution record; `triggerPipeline` extra body support; NamingCandidatesRenderer→triggerPipeline callback through ArtifactRenderer/DossierStageOutputCard prop chain; compound webhook key lookup (`plan_naming`, `plan_domain`, `plan_trademark`)
- What remains before the milestone is truly usable end-to-end: S04 — full pipeline integration with live n8n, rejection/iteration flows, offline mode, handoff packet with real artifacts, importable workflow bundle

## Tasks

- [x] **T01: Wire plan sub-stage orchestration with context forwarding on the bridge server** `est:20m`
  - Why: The plan stage needs the same sequential sub-stage orchestration as research — naming_candidates → domain_signals → trademark_signals — plus a new `context` field that lets the selected name propagate through the chain. This is the critical path: renderers and n8n templates depend on the server accepting plan sub-stages with context.
  - Files: `server/config.js`, `server/pipeline.js`, `server/routes/pipeline.js`, `server/__tests__/naming-pipeline.test.js`
  - Do: (1) Add `PLAN_SUB_STAGES` array and compound webhook entries (`plan_naming`, `plan_domain`, `plan_trademark`) to config.js. Extend `getWebhookUrl()` to check `stageKey_subStage` compound keys before stageKey-level lookup. (2) Add optional `context` field to pipeline.js execution record in `trigger()`. (3) In routes/pipeline.js trigger handler: default plan stage to `naming_candidates` sub-stage (same as research pattern), forward `req.body.context` in webhook payload. In callback handler: add plan sequential orchestration with context forwarding from execution record. (4) Write comprehensive contract tests in `naming-pipeline.test.js`.
  - Verify: `npx vitest run` — all 121 existing tests pass plus new naming-pipeline tests. Zero regressions.
  - Done when: Plan sub-stage trigger → callback → sequential next → context forwarding all proven by contract tests. Existing research orchestration unchanged.

- [x] **T02: Create n8n workflow templates for plan sub-stages** `est:15m`
  - Why: The plan stage needs three n8n workflow templates that follow the proven Webhook→Code→Callback pattern: naming candidates, domain signals, and trademark signals. These produce realistic mock data that matches the artifact content schemas the renderers will consume.
  - Files: `n8n/workflows/plan-naming-candidates.json`, `n8n/workflows/plan-domain-signals.json`, `n8n/workflows/plan-trademark-signals.json`, `n8n/README.md`
  - Do: (1) Create three workflow JSON files following the 4-node pattern (Webhook Trigger → Respond to Webhook → Code analysis → Callback to Bridge). Each Code node generates realistic structured data matching the artifact type schema. Naming generates 5-8 candidates with rationale and domain hints. Domain generates per-TLD availability with status (available/taken/premium). Trademark generates search results with status, class, and registration info. (2) Update n8n/README.md with the three new workflow entries, import instructions, and env var names.
  - Verify: JSON files parse without error. Structure matches existing templates. README additions are consistent.
  - Done when: Three valid n8n workflow JSON files exist in `n8n/workflows/` with correct Webhook→Code→Callback structure and realistic mock data. README updated.

- [x] **T03: Add naming, domain, and trademark renderers with interactive selection** `est:25m`
  - Why: The three plan sub-stage artifacts need type-dispatched renderers in the dashboard dossier. NamingCandidatesRenderer is the one genuinely new UI pattern — it has an interactive "Select" button per candidate that triggers domain_signals via `triggerPipeline` with the selected name as context. Domain and trademark renderers are passive display with mandatory advisory disclaimers (D026).
  - Files: `src/features/mission-control/ArtifactRenderer.jsx`, `src/lumon/sync.js`, `src/features/mission-control/DashboardTab.jsx`, `src/lumon/__tests__/artifact-renderer.test.jsx`
  - Do: (1) Extend `triggerPipeline` in sync.js to accept optional third argument for extra body data, spread into the POST body. (2) Add three renderers to ArtifactRenderer.jsx: `NamingCandidatesRenderer` (selectable candidate list with `onSelectName` callback prop), `DomainSignalsRenderer` (per-TLD badges + advisory disclaimer banner), `TrademarkSignalsRenderer` (status/class table + advisory disclaimer banner). Register all three in `TYPE_RENDERERS`. (3) Wire `onSelectName` callback through DossierStageOutputCard → ArtifactDetailPanel → ArtifactRenderer prop chain, calling `triggerPipeline(projectId, "plan", { subStage: "domain_signals", context: { selectedName } })`. (4) Extend artifact-renderer.test.jsx with tests for all three renderers + naming selection callback.
  - Verify: `npx vitest run` — all tests pass. `npx vite build` — production build succeeds.
  - Done when: All three renderers dispatch correctly from ArtifactRenderer, naming selection fires triggerPipeline with context, advisory disclaimers present on domain/trademark renderers, all tests pass, build succeeds.

## Files Likely Touched

- `server/config.js`
- `server/pipeline.js`
- `server/routes/pipeline.js`
- `server/__tests__/naming-pipeline.test.js` (new)
- `n8n/workflows/plan-naming-candidates.json` (new)
- `n8n/workflows/plan-domain-signals.json` (new)
- `n8n/workflows/plan-trademark-signals.json` (new)
- `n8n/README.md`
- `src/lumon/sync.js`
- `src/features/mission-control/ArtifactRenderer.jsx`
- `src/features/mission-control/DashboardTab.jsx`
- `src/lumon/__tests__/artifact-renderer.test.jsx`
