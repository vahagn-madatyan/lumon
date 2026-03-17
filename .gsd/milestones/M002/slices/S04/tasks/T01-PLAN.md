---
estimated_steps: 6
estimated_files: 7
---

# T01: Wire verification stage orchestration and ship n8n workflow templates

**Slice:** S04 — Architecture Package & Full Pipeline Integration
**Milestone:** M002

## Description

Extend the bridge server to orchestrate the verification stage as three sequential sub-stages: architecture_outline → specification → prototype_scaffold. This follows the exact pattern established for research (S02) and plan (S03) stages. Add auto-trigger from plan approval to verification. Ship three n8n workflow templates with realistic mock output. Write contract tests proving the orchestration chain.

The verification stage sits under the stable 5-stage taxonomy (D016/D017). Architecture content attaches as sub-stages under `verification`, not as new top-level stages. The approval gate for verification has `required: true`, so the operator must explicitly approve.

## Steps

1. **Add VERIFICATION_SUB_STAGES and compound webhook entries to `server/config.js`.**
   - Export `VERIFICATION_SUB_STAGES = ["architecture_outline", "specification", "prototype_scaffold"]`
   - Add compound entries to `STAGE_ENV_MAP`:
     - `verification: "N8N_WEBHOOK_URL_VERIFICATION"`
     - `verification_architecture_outline: "N8N_WEBHOOK_URL_VERIFICATION_ARCHITECTURE"`
     - `verification_specification: "N8N_WEBHOOK_URL_VERIFICATION_SPECIFICATION"`
     - `verification_prototype_scaffold: "N8N_WEBHOOK_URL_VERIFICATION_PROTOTYPE"`
   - Follow the exact pattern of `PLAN_SUB_STAGES` and compound plan entries

2. **Extend `server/routes/pipeline.js` with verification orchestration.**
   - Import `VERIFICATION_SUB_STAGES` from config.js alongside existing imports
   - In the **trigger handler**: add a case for `stageKey === "verification"` that defaults to `VERIFICATION_SUB_STAGES[0]` when no subStage is provided (copy the plan/research pattern)
   - In the **callback handler**: add a verification sequential orchestration block after the plan block. When `stageKey === "verification" && subStage`, find the current index in `VERIFICATION_SUB_STAGES` and fire the next sub-stage if one exists. Follow the plan pattern exactly — forward `execution.context` to the next sub-stage.
   - In the **approve handler**: add an auto-trigger block for verification after plan approval. When `decision === "approved" && stageKey === "plan"`, check `getWebhookUrl("verification")` and fire verification with the first sub-stage. Follow the exact pattern of the intake→research auto-trigger.

3. **Create three n8n workflow templates.**
   - `n8n/workflows/verification-architecture-outline.json` — 4-node Webhook→Respond→Code→Callback pattern. Code node generates mock architecture outline with: `systemOverview` (string), `components` (array of { name, responsibility, technology }), `dataFlow` (string), `deploymentModel` (string), `recommendation` (string). Callback to `http://host.docker.internal:3001/api/pipeline/callback`.
   - `n8n/workflows/verification-specification.json` — 4-node pattern. Code node generates mock specification with: `functionalRequirements` (array of { id, title, description, priority }), `nonFunctionalRequirements` (array of { category, requirement, metric }), `apiContracts` (array of { endpoint, method, description }), `recommendation` (string).
   - `n8n/workflows/verification-prototype-scaffold.json` — 4-node pattern. Code node generates mock prototype scaffold with: `projectStructure` (string showing directory tree), `entryPoints` (array of { file, purpose }), `dependencies` (array of { name, version, purpose }), `setupInstructions` (string), `recommendation` (string).
   - Each workflow: set `subStage` field in callback body to the appropriate sub-stage name. Set artifact `type` to `architecture_outline`, `specification`, or `prototype_scaffold` respectively. Use `result.content` wrapper for the structured data. Keep callback URL as `http://host.docker.internal:3001/api/pipeline/callback`.

4. **Update `n8n/README.md` with verification stage documentation.**
   - Add a "Verification Stage Workflows" section after the Plan Stage section
   - Document the three sub-stages with their env var names
   - Note that verification auto-triggers after plan approval
   - Include a flow diagram: `Plan approved → architecture_outline → specification → prototype_scaffold → Verification gate`

5. **Write `server/__tests__/verification-pipeline.test.js` contract tests.**
   - Follow `server/__tests__/naming-pipeline.test.js` as the authoritative pattern (29 tests)
   - Test groups:
     - **Config**: VERIFICATION_SUB_STAGES exports correctly, all compound webhook entries exist in STAGE_ENV_MAP
     - **Compound webhooks**: each of the 3 sub-stages resolves via compound key → stage fallback → global fallback
     - **Trigger defaults**: triggering `verification` without subStage defaults to `architecture_outline`
     - **Sequential orchestration**: callback for `architecture_outline` auto-fires `specification`; callback for `specification` auto-fires `prototype_scaffold`; callback for `prototype_scaffold` does NOT auto-fire anything
     - **Context forwarding**: context from execution record forwards through sub-stage chain
     - **Auto-trigger from plan approval**: approving plan with decision="approved" auto-triggers verification when webhook configured; does NOT auto-trigger when no webhook configured
     - **Backward compatibility**: intake trigger, research orchestration, and plan orchestration still work unchanged
   - Use the same test infrastructure: mock `fetch`, mock `pipeline`, mock `artifacts`, import from config.js
   - **Important test setup**: The test file must set up the Express router the same way `naming-pipeline.test.js` does — import the router, mount it on an express app with `express.json()`, use `supertest`.

6. **Run verification.**
   - `npx vitest run server/__tests__/verification-pipeline.test.js` — all new tests pass
   - `npx vitest run` — all existing tests pass (zero regressions from 171 baseline)

## Must-Haves

- [ ] `VERIFICATION_SUB_STAGES` exported from `server/config.js` with correct 3-element array
- [ ] All 4 compound STAGE_ENV_MAP entries present (verification + 3 sub-stages)
- [ ] Trigger handler defaults verification to architecture_outline sub-stage
- [ ] Callback handler orchestrates verification sub-stages sequentially (architecture_outline → specification → prototype_scaffold)
- [ ] Approve handler auto-triggers verification after plan approval (when webhook configured)
- [ ] Three n8n workflow JSON files parse without error, each with 4 nodes
- [ ] Contract tests cover config, compound webhooks, sequential orchestration, auto-trigger, and backward compatibility
- [ ] Zero regressions in existing test suite

## Verification

- `npx vitest run server/__tests__/verification-pipeline.test.js` — all tests pass
- `npx vitest run` — 171+ tests pass, zero failures
- `node -e "JSON.parse(require('fs').readFileSync('n8n/workflows/verification-architecture-outline.json'))"` — each template parses as valid JSON

## Observability Impact

- Signals added: `[bridge] sequential-next subStage=specification after=architecture_outline` and `subStage=prototype_scaffold after=specification` log lines for verification chain progression; `[bridge] auto-trigger verification after plan approval` log on plan→verification transition
- How a future agent inspects this: `GET /api/pipeline/status/:projectId` returns verification execution records with subStage field
- Failure state exposed: `pipeline.recordFailure()` stores failureReason for any failed verification sub-stage webhook call

## Inputs

- `server/config.js` — existing webhook registry with RESEARCH_SUB_STAGES, PLAN_SUB_STAGES, getWebhookUrl (add VERIFICATION_SUB_STAGES alongside)
- `server/routes/pipeline.js` — existing trigger/callback/approve handlers with research and plan orchestration (extend with verification blocks)
- `server/__tests__/naming-pipeline.test.js` — authoritative test pattern for sub-stage orchestration tests (copy structure)
- `n8n/workflows/plan-naming-candidates.json` — template pattern for 4-node Webhook→Respond→Code→Callback workflow
- `n8n/README.md` — existing docs with plan stage section (add verification section after)

## Expected Output

- `server/config.js` — extended with VERIFICATION_SUB_STAGES export and 4 new STAGE_ENV_MAP entries
- `server/routes/pipeline.js` — extended with verification trigger default, callback sequential orchestration, and plan→verification auto-trigger
- `n8n/workflows/verification-architecture-outline.json` — new 4-node workflow template
- `n8n/workflows/verification-specification.json` — new 4-node workflow template
- `n8n/workflows/verification-prototype-scaffold.json` — new 4-node workflow template
- `n8n/README.md` — extended with verification stage documentation section
- `server/__tests__/verification-pipeline.test.js` — new test file with 20+ contract tests
