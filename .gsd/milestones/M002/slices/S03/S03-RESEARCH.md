# S03: Naming & Brand Signal Stages — Research

**Date:** 2026-03-16

## Summary

S03 follows the exact pattern S02 established — sub-stage orchestration under a parent stage key, sequential n8n workflow triggers, artifact accumulation through `lumon/append-artifact`, and type-dispatched rendering in the dossier. The parent stage is `plan` (which has `required: true` gate), and the sub-stages are `naming_candidates`, `domain_signals`, and `trademark_signals`. Three new n8n workflow templates, three new artifact renderers, and one config/orchestration extension to the server.

The only genuinely new UI pattern is the **naming candidate selection interaction** — after the naming candidates artifact arrives, the operator must pick a winner before domain/trademark checks fire. This is a gated operator action within a sub-stage flow, not just passive artifact viewing. The selection triggers domain and trademark sub-workflows with the chosen name as input.

**Approach:** Extend the proven S02 sub-stage pattern to the plan stage. Add `PLAN_SUB_STAGES` to `server/config.js`, wire plan-stage sequential orchestration in the callback handler (naming → operator-selects → domain → trademark), extend the trigger endpoint to accept optional `context` data (passes the selected name to n8n), add three renderers to `ArtifactRenderer.jsx` with the naming list having interactive selection, and ship three n8n workflow templates. Advisory disclaimers on domain/trademark renderers per D026. Tests follow S02's split: server contract tests for orchestration + RTL tests for renderers.

## Recommendation

Follow the S02 playbook exactly for the mechanical parts (config, orchestration, templates, renderers). The only design decision is the naming selection flow:

1. **Naming candidates arrive** via callback → stored as `naming_candidates` artifact → SSE pushes to client → `NamingCandidatesRenderer` shows a selectable list with a "Select" action per candidate.
2. **Operator selects a name** → calls `triggerPipeline(projectId, "plan", { subStage: "domain_signals", context: { selectedName } })`. This requires extending the trigger endpoint to accept and forward optional `context` data to n8n — a one-line body merge, backward-compatible.
3. **Domain signals callback** arrives → auto-fires `trademark_signals` (same sequential pattern as research sub-stages) with the selected name forwarded.
4. **All three artifacts accumulate** on the plan stage via `lumon/append-artifact`. The operator reviews everything and approves/rejects the plan gate.

This keeps the trigger endpoint as the universal action verb — no new endpoints needed. The `context` field is optional and only forwarded to n8n when present.

## Implementation Landscape

### Key Files

- `server/config.js` — Add `PLAN_SUB_STAGES = ["naming_candidates", "domain_signals", "trademark_signals"]` array. Extend `STAGE_ENV_MAP` with plan sub-stage-specific webhook entries: `plan_naming: "N8N_WEBHOOK_URL_PLAN_NAMING"`, `plan_domain: "N8N_WEBHOOK_URL_PLAN_DOMAIN"`, `plan_trademark: "N8N_WEBHOOK_URL_PLAN_TRADEMARK"`. Extend `getWebhookUrl()` to check `stageKey_subStage` compound keys before the stageKey-level fallback. This preserves backward compatibility — existing single-key lookups still work.
- `server/routes/pipeline.js` — Three changes: (1) Import `PLAN_SUB_STAGES` from config. (2) In the trigger handler, add plan sub-stage default logic mirroring the research pattern: `stageKey === "plan" && !subStage ? PLAN_SUB_STAGES[0] : subStage`. Also forward `req.body.context` in the webhook payload. (3) In the callback handler, add plan sequential orchestration: when a plan sub-stage callback arrives, fire the next sub-stage if one exists, forwarding any `context` from the execution record.
- `server/pipeline.js` — Extend the execution record to store optional `context` data from the trigger call, so it can be forwarded when auto-firing the next sub-stage.
- `src/lumon/sync.js` — Extend `triggerPipeline()` to accept optional third argument for extra body data (`{ subStage, context }`), forwarded in the POST body. Currently sends `{ projectId, stageKey }` — add `...extra` spread.
- `src/features/mission-control/ArtifactRenderer.jsx` — Add three new renderers to `TYPE_RENDERERS` map:
  - `NamingCandidatesRenderer` — renders a list of name candidates with metadata (rationale, domain hint). Each candidate has a "Select" button. The selection action calls `triggerPipeline`. This is the one component that needs access to actions context, unlike the existing passive renderers. Simplest approach: accept an `onSelectName` callback prop from the parent `ArtifactDetailPanel`/`DossierStageOutputCard`.
  - `DomainSignalsRenderer` — renders domain availability results per TLD with status badges (available/taken/premium) and an advisory disclaimer banner at the top.
  - `TrademarkSignalsRenderer` — renders trademark search results with status, class, registration date, and an advisory disclaimer banner. Both signal renderers use `CollapsibleSection` (already in the file) and `Badge` (already imported).
- `n8n/workflows/plan-naming-candidates.json` — Webhook→Code→Callback template. Code node generates 5-8 naming candidates with rationale, domain availability hints, and style tags. Follows the proven 4-node pattern from research templates.
- `n8n/workflows/plan-domain-signals.json` — Webhook→Code→Callback template. Code node generates simulated domain availability signals for the selected name across common TLDs (.com, .io, .dev, .co, .app). In production, this would call Domainr API.
- `n8n/workflows/plan-trademark-signals.json` — Webhook→Code→Callback template. Code node generates simulated trademark search results. In production, this would call Marker API or USPTO TSDR.
- `n8n/README.md` — Add plan-stage workflow entries to the setup instructions.
- `server/__tests__/naming-pipeline.test.js` — New test file covering: plan sub-stage webhook registry, sequential orchestration (naming → domain → trademark), context forwarding, artifact accumulation. Pattern follows `research-pipeline.test.js`.
- `src/lumon/__tests__/artifact-renderer.test.jsx` — Extend with tests for three new renderers: candidate list rendering, selection callback, domain signal badges, trademark signal structure, advisory disclaimers.

### Build Order

**T01 — Server: plan sub-stage orchestration + context forwarding** (~20 min)
Extend `config.js` with `PLAN_SUB_STAGES` and compound webhook lookups. Extend trigger handler to forward `context` and default plan to first sub-stage. Extend callback handler with plan sequential orchestration. Extend `pipeline.js` execution record with `context` field. Write `naming-pipeline.test.js`. Verify: `npx vitest run` — all existing tests pass, new orchestration tests pass.

This unblocks everything — the naming selection flow, n8n templates, and renderers all depend on the server accepting plan sub-stages with context forwarding.

**T02 — n8n workflow templates** (~15 min)
Create three workflow JSON files following the proven Webhook→Code→Callback pattern. Each code node generates realistic mock data for the artifact type. Update `n8n/README.md` with the three new workflows. Verify: JSON valid, structure matches existing templates.

**T03 — Client: renderers + naming selection UI** (~25 min)
Add `NamingCandidatesRenderer`, `DomainSignalsRenderer`, `TrademarkSignalsRenderer` to `ArtifactRenderer.jsx`. Wire the naming selection action through `triggerPipeline`. Extend `triggerPipeline` in `sync.js` to accept context data. Add renderer tests. Verify: `npx vitest run` — all tests pass, `npx vite build` succeeds.

### Verification Approach

- `npx vitest run` — all existing tests pass (121 baseline from S02) + new naming tests
- `npx vite build` — production build succeeds
- Server contract: plan sub-stage trigger → callback → sequential next → context forwarding verified in `naming-pipeline.test.js`
- Renderer: candidate list renders, selection callback fires, domain/trademark advisory labels present, verified in `artifact-renderer.test.jsx`
- n8n templates: valid JSON, importable structure, callback URL follows convention

## Constraints

- **Stage taxonomy is stable (D016, D017).** Naming, domain, and trademark are sub-stages of the existing `plan` stage — not new top-level stages. The 5-stage model (intake, research, plan, verification, handoff) must not change.
- **Plan gate is `required: true`.** The operator must explicitly approve the plan stage after reviewing naming/domain/trademark artifacts. This is the natural gate for reviewing brand signals.
- **Advisory labeling is mandatory (D026).** Domain and trademark renderers must include explicit point-in-time and non-legal disclaimers. "These results are advisory signals, not legal clearance."
- **The `lumon/append-artifact` action handles accumulation generically (D037).** S03 does not need new reducer logic — three artifacts accumulate on the plan stage using the existing action.
- **Existing sub-stage orchestration pattern must be preserved.** The research sequential flow (business_plan → tech_stack) must continue working unchanged. Plan orchestration is additive, using the same `fireWebhook` + next-sub-stage pattern.

## Common Pitfalls

- **Making the naming selection a new reducer action or endpoint.** It's simpler to extend `triggerPipeline` to accept context data and use the existing trigger endpoint. The selection is just "trigger the next sub-stage with this context." No new verbs needed.
- **Forwarding context through the sequential chain.** When naming_candidates triggers domain_signals auto-fire, the selected name context must propagate. The execution record should store `context` so the callback handler can read it when firing the next sub-stage.
- **Breaking the plan trigger by defaulting to sub-stages.** The plan trigger should only default to `naming_candidates` when no subStage is specified. If subStage is explicit (e.g., when the naming selection triggers domain_signals), use it as-is. Same pattern as research.
- **NamingCandidatesRenderer needs action access.** Unlike existing renderers (pure display), the naming renderer needs to call `triggerPipeline`. Prop-drill `onSelectName` from the dossier card rather than importing actions context inside the renderer — keeps renderers testable without provider wrapping.

## Open Risks

- **Naming selection flow has a timing gap.** Between when the operator selects a name and when domain/trademark results arrive, there's no visual indicator that checks are in progress. The existing SSE `pipeline-status` events should cover this, but the dossier card needs to show a "checking" state for domain/trademark sub-stages while they're in flight.
- **Context forwarding through sequential sub-stages.** The naming selection flow requires that the selected name (in `context`) propagates from the domain_signals trigger through to the trademark_signals auto-fire. If `context` isn't persisted in the execution record and forwarded, trademark checks won't know which name to check.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| Domain availability | mattd3080/domain-shark@domain-shark (10 installs) | available — low install count, not installed |
| Trademark lookup | dylanfeltus/skills@trademark-search (51 installs) | available — moderate installs, not installed |

Both skills are for direct API integration rather than n8n workflow templates. Since S03's domain/trademark work happens inside n8n Code nodes (with simulated data now, real API calls later), these skills aren't needed for the current implementation.
