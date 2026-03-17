---
id: T01
parent: S03
milestone: M002
provides:
  - PLAN_SUB_STAGES config export with naming_candidates → domain_signals → trademark_signals ordering
  - Compound webhook registry lookup (stageKey_subStage before stageKey before global)
  - Context field on pipeline execution records for propagating selected-name data
  - Plan sub-stage sequential orchestration in callback handler with context forwarding
  - Trigger endpoint defaults plan stage to naming_candidates sub-stage
key_files:
  - server/config.js
  - server/pipeline.js
  - server/routes/pipeline.js
  - server/__tests__/naming-pipeline.test.js
key_decisions:
  - Compound STAGE_ENV_MAP keys use full sub-stage name (plan_naming_candidates, not plan_naming) to match getWebhookUrl's stageKey + "_" + subStage construction
patterns_established:
  - Context forwarding through sequential sub-stage chains reads context from the current execution record and passes it to fireWebhook for the next sub-stage
  - getWebhookUrl accepts optional subStage param with 3-tier fallback: compound → stage → global
observability_surfaces:
  - "[bridge] webhook-registry stageKey=plan subStage=X source=compound" log line for compound webhook lookups
  - "[bridge] sequential-next subStage=domain_signals after=naming_candidates" and "subStage=trademark_signals after=domain_signals" for plan chain progression
  - GET /api/pipeline/status/:projectId returns execution records with context field
  - pipeline.recordFailure() captures failureReason; missing context on downstream records indicates forwarding failure
duration: 10m
verification_result: passed
completed_at: 2026-03-16
blocker_discovered: false
---

# T01: Wire plan sub-stage orchestration with context forwarding on the bridge server

**Extended bridge server with plan stage sequential orchestration (naming_candidates → domain_signals → trademark_signals) and context forwarding through the sub-stage chain.**

## What Happened

1. **server/config.js** — Added `PLAN_SUB_STAGES` export, compound `STAGE_ENV_MAP` entries (`plan_naming_candidates`, `plan_domain_signals`, `plan_trademark_signals`), and extended `getWebhookUrl(stageKey, subStage)` with 3-tier fallback: compound key → stage key → global.

2. **server/pipeline.js** — Added optional `context` parameter to `trigger()`. Execution records now store `context: object|null`.

3. **server/routes/pipeline.js** — Trigger handler defaults plan stage to `naming_candidates` (paralleling research → business_plan). Reads `req.body.context` and forwards it through `fireWebhook`. Callback handler adds plan sequential orchestration block that reads context from the current execution and forwards it to the auto-fired next sub-stage. `fireWebhook` updated to accept/forward context and use compound webhook lookups.

4. **server/__tests__/naming-pipeline.test.js** — 29 tests covering: PLAN_SUB_STAGES config, compound webhook registry (all 3 sub-stages + fallback chain), plan trigger defaults, context storage, full 3-stage sequential orchestration, context forwarding through the chain, webhook payload context inclusion/omission, compound routing through trigger endpoint, and backward compatibility for research + intake flows.

## Verification

- `npx vitest run` — **150 tests pass** (121 existing + 29 new), zero regressions
- `server/__tests__/research-pipeline.test.js` — all 18 tests pass unchanged
- `server/__tests__/pipeline-api.test.js` — all 15 tests pass unchanged
- `server/__tests__/naming-pipeline.test.js` — all 29 tests pass, covering compound webhooks, plan trigger defaults, sequential orchestration through all 3 sub-stages, context forwarding, webhook payload, and backward compatibility

### Slice-level verification (partial — T01 of 3):
- ✅ `npx vitest run` — all 150 tests pass (121 existing + 29 new)
- ✅ `server/__tests__/naming-pipeline.test.js` — plan orchestration, context forwarding, compound webhooks, plan trigger defaults
- ⬜ `src/lumon/__tests__/artifact-renderer.test.jsx` — not yet extended (T03)
- ⬜ `npx vite build` — not yet verified (T03)
- ⬜ n8n templates — not yet created (T02)

## Diagnostics

- **Log lines:** `[bridge] webhook-registry stageKey=plan subStage=X source=compound` traces compound webhook resolution; `[bridge] sequential-next subStage=domain_signals after=naming_candidates` and `subStage=trademark_signals after=domain_signals` trace plan chain progression
- **API inspection:** `GET /api/pipeline/status/:projectId` returns execution records with `context` field for plan sub-stages
- **Failure shapes:** `pipeline.recordFailure()` captures `failureReason`; context forwarding failures visible through `context: null` on downstream execution records

## Deviations

- Plan used short compound keys in STAGE_ENV_MAP (`plan_naming`, `plan_domain`, `plan_trademark`) but `getWebhookUrl` constructs `stageKey + "_" + subStage` = `plan_naming_candidates`. Fixed to use full compound keys (`plan_naming_candidates`, `plan_domain_signals`, `plan_trademark_signals`) matching the actual lookup construction.

## Known Issues

None.

## Files Created/Modified

- `server/config.js` — Added PLAN_SUB_STAGES export, compound STAGE_ENV_MAP entries, extended getWebhookUrl with subStage param
- `server/pipeline.js` — Added context field to trigger() and execution record
- `server/routes/pipeline.js` — Plan trigger defaults, context forwarding in fireWebhook/trigger/callback, plan sequential orchestration
- `server/__tests__/naming-pipeline.test.js` — New: 29 contract tests for plan orchestration and context forwarding
- `.gsd/milestones/M002/slices/S03/tasks/T01-PLAN.md` — Added Observability Impact section (pre-flight fix)
