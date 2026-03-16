---
estimated_steps: 8
estimated_files: 7
---

# T01: Webhook registry, sequential research orchestration, and n8n workflow templates

**Slice:** S02 — Research & Business Planning Stages
**Milestone:** M002

## Description

Extend the S01 bridge server to support per-stage webhook routing, sequential sub-workflow orchestration for the research stage, auto-triggering research after intake approval, and ship two n8n workflow templates for business plan and tech stack analysis. The core integration primitive (webhook→callback→artifact) is proven — this task extends it to multi-stage, multi-artifact flows.

## Steps

1. **Create webhook registry config** — Add `server/config.js` with a `getWebhookUrl(stageKey)` function. Reads stage-specific env vars like `N8N_WEBHOOK_URL_RESEARCH` first, falls back to `N8N_WEBHOOK_URL` as the global default. Log the lookup result (stageKey + whether fallback was used), not the raw URL.

2. **Extend pipeline execution tracking to per-stage** — Change `projectIndex` in `server/pipeline.js` from `Map<string, string>` (projectId→executionId) to `Map<string, Map<string, string>>` (projectId→Map<stageKey, executionId>). Update `trigger()`, `getStatus()`, and any code that reads `projectIndex` to use the new two-level structure. `getStatus()` should return all stage executions for a project.

3. **Update trigger handler for webhook registry** — In `server/routes/pipeline.js`, replace `process.env.N8N_WEBHOOK_URL` with `getWebhookUrl(stageKey)`. If no URL is configured for the stage, log intent and continue (same graceful degradation as S01).

4. **Add sequential research orchestration** — When the callback handler receives a result for a research sub-stage (e.g., `stageKey=research` with `subStage=business_plan`), check if there's a pending next sub-stage (tech_stack). If so, auto-trigger the tech stack workflow using the research webhook URL. Track sub-stage progression in the execution record. Both callbacks store separate artifacts with different `type` values (`business_plan`, `tech_research`).

5. **Add auto-trigger after intake approval** — In the approve handler, after a successful intake approval, check if a research webhook is configured. If so, automatically trigger the research stage pipeline. Log the auto-trigger decision.

6. **Add artifact list endpoint** — Add `getByProjectAndStage(projectId, stageKey)` to `server/artifacts.js`. Mount `GET /api/artifacts/project/:projectId/stage/:stageKey` on the pipeline router, returning all artifacts for that project+stage combination.

7. **Ship n8n workflow templates** — Create `n8n/workflows/research-business-plan.json` and `n8n/workflows/research-tech-stack.json` following the proven Webhook→Code→Callback pattern from `intake-viability.json`. No Wait node (research gate has `required: false`). Business plan Code node produces structured JSON with sections: `targetAudience`, `pricingPosture`, `featurePhases`, `revenueModel`, `recommendation`. Tech stack Code node produces: `approaches` (array of scored options), `tradeoffs`, `recommendation`. Both call back with `subStage` field to identify themselves.

8. **Write contract tests** — Add `server/__tests__/research-pipeline.test.js` testing: webhook registry lookup (stage-specific, fallback, unconfigured), per-stage execution tracking, sequential callback progression, auto-trigger after approval, artifact list endpoint filtering.

## Must-Haves

- [ ] `getWebhookUrl(stageKey)` returns stage-specific URL or global fallback
- [ ] Pipeline execution tracker stores independent executions per stage per project
- [ ] Sequential orchestration: business plan callback triggers tech stack automatically
- [ ] Approve handler auto-triggers research after intake approval when webhook is configured
- [ ] `GET /api/artifacts/project/:projectId/stage/:stageKey` returns filtered artifact list
- [ ] Two n8n workflow templates produce defined artifact content schemas
- [ ] Backward compatibility: existing S01 intake flow still works with only `N8N_WEBHOOK_URL` set

## Verification

- `npx vitest run` — all tests pass including new `research-pipeline.test.js`
- Zero regressions in existing `pipeline-api.test.js` (S01 tests)
- Test the webhook registry fallback explicitly: when only `N8N_WEBHOOK_URL` is set, research trigger uses it

## Observability Impact

- Signals added: `[bridge] webhook-registry stageKey=${stageKey} source=${source}` log on trigger; `[bridge] auto-trigger research after intake approval` log; `[bridge] sequential-next subStage=${next}` log on sub-stage progression
- How a future agent inspects this: `GET /api/pipeline/status/:projectId` now returns per-stage execution records; `GET /api/artifacts/project/:projectId/stage/research` returns both business plan and tech stack artifacts
- Failure state exposed: Sequential orchestration failure logged with which sub-stage failed; `pipeline.recordFailure()` captures per-sub-stage failure reasons

## Inputs

- `server/routes/pipeline.js` — S01 trigger/callback/approve handlers to extend
- `server/pipeline.js` — S01 execution tracker to refactor for per-stage indexing
- `server/artifacts.js` — S01 artifact storage to add stage-scoped query
- `n8n/workflows/intake-viability.json` — template pattern to follow for new workflows
- S01 Summary Forward Intelligence — `emitSSE` contract, callback handler already stage-agnostic

## Expected Output

- `server/config.js` — webhook registry module with `getWebhookUrl(stageKey)`
- `server/pipeline.js` — per-stage execution tracking with two-level `projectIndex`
- `server/routes/pipeline.js` — updated trigger/callback/approve handlers with registry lookup, sequential orchestration, and auto-trigger
- `server/artifacts.js` — `getByProjectAndStage()` helper
- `server/__tests__/research-pipeline.test.js` — contract tests for all new server behavior
- `n8n/workflows/research-business-plan.json` — importable n8n workflow template
- `n8n/workflows/research-tech-stack.json` — importable n8n workflow template
