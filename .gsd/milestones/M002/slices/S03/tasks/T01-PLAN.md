---
estimated_steps: 6
estimated_files: 4
---

# T01: Wire plan sub-stage orchestration with context forwarding on the bridge server

**Slice:** S03 — Naming & Brand Signal Stages
**Milestone:** M002

## Description

Extend the bridge server to support the plan stage's three sub-stages (naming_candidates → domain_signals → trademark_signals) with sequential orchestration and context forwarding. The plan stage follows the exact same pattern as research sub-stages (S02), but adds a new `context` field that lets the selected name propagate from the naming trigger through domain and trademark auto-fires.

This is the critical path for S03 — the naming selection UI, n8n templates, and renderers all depend on the server accepting plan sub-stages with context forwarding.

**Key patterns from S02 to follow:**
- `RESEARCH_SUB_STAGES` array in `server/config.js` → add parallel `PLAN_SUB_STAGES`
- Webhook registry with `STAGE_ENV_MAP` → add compound keys (`plan_naming`, `plan_domain`, `plan_trademark`)
- `getWebhookUrl()` → extend to check `stageKey_subStage` compound keys before stageKey-level fallback
- Sequential orchestration in callback handler → add plan branch alongside research branch
- Trigger handler defaults research to first sub-stage → add same logic for plan stage

## Steps

1. **Extend `server/config.js`:**
   - Add `PLAN_SUB_STAGES = ["naming_candidates", "domain_signals", "trademark_signals"]` export.
   - Add compound webhook entries to `STAGE_ENV_MAP`: `plan_naming: "N8N_WEBHOOK_URL_PLAN_NAMING"`, `plan_domain: "N8N_WEBHOOK_URL_PLAN_DOMAIN"`, `plan_trademark: "N8N_WEBHOOK_URL_PLAN_TRADEMARK"`.
   - Modify `getWebhookUrl(stageKey, subStage)` to accept an optional second argument `subStage`. When provided, first check `STAGE_ENV_MAP[stageKey + "_" + subStage]`, then fall back to `STAGE_ENV_MAP[stageKey]`, then the global `N8N_WEBHOOK_URL`. This is backward-compatible — existing calls without subStage work identically.

2. **Extend `server/pipeline.js`:**
   - Add optional `context` field to the execution record in `trigger()`. Accept it from the params: `trigger({ projectId, stageKey, subStage = null, context = null })`. Store as `context: context || null` in the record.
   - No other changes needed — the existing trigger/callback/approve lifecycle is unchanged.

3. **Extend `server/routes/pipeline.js` trigger handler:**
   - Import `PLAN_SUB_STAGES` from config.
   - Add plan-stage default logic alongside the research default: `stageKey === "plan" && !subStage ? PLAN_SUB_STAGES[0] : subStage`.
   - Read `req.body.context` from the request body.
   - Pass `context` to `pipeline.trigger()` so it's stored in the execution record.
   - Forward `context` in the webhook payload alongside `projectId`, `stageKey`, `subStage`, `executionId`.
   - Pass `subStage` to `getWebhookUrl(stageKey, effectiveSubStage)` so compound lookups work.

4. **Extend `server/routes/pipeline.js` callback handler:**
   - Add plan sequential orchestration alongside the existing research block. When `stageKey === "plan"` and `subStage` is present, check `PLAN_SUB_STAGES` for the next sub-stage.
   - When auto-firing the next plan sub-stage, read the `context` from the current execution record and forward it to the next `fireWebhook` call.
   - Update `fireWebhook` to accept and forward `context` — pass it to `pipeline.trigger()` and include in the webhook POST body.

5. **Update `fireWebhook` helper:**
   - Accept optional `context` parameter: `fireWebhook({ projectId, stageKey, subStage, context })`.
   - Pass `context` to `pipeline.trigger()`.
   - Include `context` in the webhook POST body (only when truthy to keep backward-compatible).
   - Pass `subStage` to `getWebhookUrl(stageKey, subStage)`.

6. **Write `server/__tests__/naming-pipeline.test.js`:**
   - Follow the exact pattern of `research-pipeline.test.js` for structure, imports, test data dir setup, and cleanup.
   - Test groups:
     - **Compound webhook registry**: `getWebhookUrl("plan", "naming_candidates")` checks `N8N_WEBHOOK_URL_PLAN_NAMING` first, falls back to `N8N_WEBHOOK_URL_PLAN` (if it existed), then global.
     - **Plan trigger defaults**: POST `/api/pipeline/trigger` with `{ projectId, stageKey: "plan" }` (no subStage) creates execution with `subStage: "naming_candidates"`.
     - **Sequential plan orchestration**: naming_candidates callback → auto-fires domain_signals; domain_signals callback → auto-fires trademark_signals; trademark_signals callback → no next (last in chain).
     - **Context forwarding**: Trigger with `context: { selectedName: "Nexus" }` → callback → context persists in execution record → auto-fired next sub-stage also gets context.
     - **Context in webhook payload**: Mock `global.fetch` and verify the webhook POST body includes `context` when provided.
     - **Backward compatibility**: Existing research orchestration still works. Existing intake lifecycle unchanged.

## Must-Haves

- [ ] `PLAN_SUB_STAGES` exported from config.js with correct ordering
- [ ] `getWebhookUrl()` supports compound `stageKey_subStage` lookups before stageKey fallback
- [ ] Pipeline execution record stores optional `context` field
- [ ] Trigger endpoint defaults plan stage to `naming_candidates` sub-stage
- [ ] Trigger endpoint forwards `context` to webhook and stores in execution
- [ ] Callback handler auto-fires next plan sub-stage with context forwarding
- [ ] All 121 existing tests pass unchanged (zero regressions)
- [ ] New naming-pipeline tests cover orchestration, context forwarding, and compound webhooks

## Verification

- `npx vitest run` — all tests pass (121 existing + new naming-pipeline tests)
- New test file covers: compound webhook lookups, plan trigger defaults, sequential orchestration through all 3 sub-stages, context forwarding, backward compatibility
- Existing `research-pipeline.test.js` passes unchanged

## Inputs

- `server/config.js` — current webhook registry with `STAGE_ENV_MAP` and `RESEARCH_SUB_STAGES`
- `server/pipeline.js` — current execution state tracker with `trigger()`, `recordCallback()`, `recordApproval()`, `getExecution()`
- `server/routes/pipeline.js` — current router with `fireWebhook()`, trigger/callback/approve/status endpoints, research sequential orchestration
- `server/__tests__/research-pipeline.test.js` — reference for test structure and patterns

## Expected Output

- `server/config.js` — extended with `PLAN_SUB_STAGES`, compound `STAGE_ENV_MAP` entries, `getWebhookUrl(stageKey, subStage)` signature
- `server/pipeline.js` — execution record includes optional `context` field
- `server/routes/pipeline.js` — plan sub-stage orchestration in callback, context forwarding in trigger and fireWebhook, plan default sub-stage logic
- `server/__tests__/naming-pipeline.test.js` — comprehensive contract tests for plan orchestration and context forwarding
