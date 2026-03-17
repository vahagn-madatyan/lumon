---
estimated_steps: 4
estimated_files: 2
---

# T03: Prove rejection/iteration resilience and full pipeline integration

**Slice:** S04 — Architecture Package & Full Pipeline Integration
**Milestone:** M002

## Description

This is the capstone verification task. It proves two things: (1) rejection/iteration flows don't corrupt state — rejecting a stage, re-triggering it, and re-approving works cleanly with artifacts accumulating correctly. (2) The full discovery pipeline works end-to-end from intake through all stages to a handoff-ready state with real artifacts from every stage.

These are pure test files — no production code changes. They exercise the server-side pipeline infrastructure established across S01–S04 and validate the milestone's core success criteria.

## Steps

1. **Write `server/__tests__/rejection-iteration.test.js`.**
   - Use the same test infrastructure as `naming-pipeline.test.js`: import router, mount on express app with `express.json()`, use supertest, mock `fetch` to capture webhook calls and return success.
   - Import `pipeline`, `artifacts` from their modules. Use `pipeline.reset()` (or clear state manually) and `artifacts.setDataDir()` with a temp directory for test isolation.
   - **Test: reject → re-trigger → approve lifecycle** (single stage):
     1. POST /trigger with projectId="test-proj", stageKey="intake" → 201
     2. POST /callback with executionId, result, resumeUrl → 200
     3. POST /approve with decision="rejected" → 200, verify decision recorded
     4. POST /trigger again with same projectId + stageKey → 201, verify NEW executionId
     5. POST /callback with new executionId, new result, new resumeUrl → 200
     6. Verify artifacts.getByProjectAndStage returns 2 artifacts (both callbacks stored one)
     7. POST /approve with decision="approved" → 200
     8. Verify GET /status shows execution in approved/completed state
   - **Test: rejection doesn't affect other stages**:
     1. Trigger and complete intake → approve
     2. Research auto-triggers (or manually trigger research)
     3. Research callback arrives → reject research
     4. Verify intake stage execution state is still approved (not corrupted)
     5. Verify intake artifacts still exist
     6. Re-trigger research → callback → approve → verify clean
   - **Test: multiple rejections accumulate artifacts correctly**:
     1. Trigger intake → callback → reject → re-trigger → callback → reject → re-trigger → callback → approve
     2. Verify 3 artifacts total for the stage (one per callback)
     3. Verify final execution state is approved
   - **Test: re-trigger after rejection creates new execution record**:
     1. Trigger → callback → reject → re-trigger
     2. Verify the new trigger returns a different executionId
     3. Verify pipeline.getStageExecution returns the LATEST execution (not the rejected one)

2. **Write `server/__tests__/full-pipeline.test.js`.**
   - This is the authoritative end-to-end proof for the entire M002 milestone. It drives the complete pipeline through all stages via HTTP API calls.
   - Same test infrastructure setup as rejection tests.
   - **Full pipeline test** (one large test or a describe block with sequential tests):
     1. **Intake**: POST /trigger (stageKey="intake") → callback with viability_analysis artifact → approve → verify auto-trigger fires for research
     2. **Research sub-stages**: callback for research/business_plan → verify sequential-next fires tech_stack → callback for research/tech_stack → approve research
     3. **Plan sub-stages**: manually trigger plan (or verify auto-trigger if implemented) → callback for plan/naming_candidates → verify sequential-next fires domain_signals → callback for plan/domain_signals → verify sequential-next fires trademark_signals → callback for plan/trademark_signals → approve plan → verify auto-trigger fires for verification
     4. **Verification sub-stages**: callback for verification/architecture_outline → verify sequential-next fires specification → callback for verification/specification → verify sequential-next fires prototype_scaffold → callback for verification/prototype_scaffold → approve verification
     5. **Final state checks**:
        - GET /status returns execution records for all stages (intake, research, plan, verification)
        - All stage executions show approved status
        - artifacts.getByProjectAndStage returns artifacts for each stage:
          - intake: 1 artifact (viability_analysis)
          - research: 2 artifacts (business_plan, tech_stack)
          - plan: 3 artifacts (naming_candidates, domain_signals, trademark_signals)
          - verification: 3 artifacts (architecture_outline, specification, prototype_scaffold)
        - Total: 9 artifacts across all stages
   - **Important fetch mock setup**: mock `fetch` to:
     - Return `{ ok: true, json: () => ({}) }` for webhook calls (n8n triggers)
     - Return `{ ok: true }` for resumeUrl calls (approval resume)
     - Track all called URLs to verify auto-trigger webhooks fire
   - Keep each callback's `result` field realistic — use artifact type name and a minimal content object so stored artifacts have meaningful data.

3. **Run full verification suite.**
   - `npx vitest run server/__tests__/rejection-iteration.test.js` — all tests pass
   - `npx vitest run server/__tests__/full-pipeline.test.js` — all tests pass
   - `npx vitest run` — all tests pass with zero regressions from baseline (171 tests + T01 tests + T02 tests + T03 tests)

4. **Verify test count increase.**
   - The total test count should be 171 (baseline) + T01 tests + T02 tests + T03 tests = well over 200
   - Record the final test count in the task summary

## Must-Haves

- [ ] Reject → re-trigger → approve lifecycle proven clean (single stage)
- [ ] Multi-stage rejection proven (rejecting one stage doesn't corrupt others)
- [ ] Multiple rejections accumulate artifacts correctly (no data loss)
- [ ] Full pipeline from intake to verification approval proven via API
- [ ] All 4 stage types produce artifacts: intake (1), research (2), plan (3), verification (3) = 9 total
- [ ] Auto-trigger chains proven: intake→research, plan→verification
- [ ] Sequential orchestration proven for all three multi-sub-stage stages (research, plan, verification)
- [ ] Zero regressions across entire test suite

## Verification

- `npx vitest run server/__tests__/rejection-iteration.test.js` — all tests pass
- `npx vitest run server/__tests__/full-pipeline.test.js` — all tests pass
- `npx vitest run` — total test count 200+, zero failures

## Inputs

- `server/routes/pipeline.js` — the complete pipeline router with trigger/callback/approve handlers, all sequential orchestration blocks (research, plan, verification), and all auto-trigger chains
- `server/config.js` — RESEARCH_SUB_STAGES, PLAN_SUB_STAGES, VERIFICATION_SUB_STAGES, getWebhookUrl
- `server/pipeline.js` — execution state tracker with trigger/recordCallback/recordApproval/getStatus/getStageExecution
- `server/artifacts.js` — artifact storage with create/getByProjectAndStage/setDataDir
- `server/__tests__/naming-pipeline.test.js` — authoritative test infrastructure pattern (express app setup, supertest, fetch mock, temp directories)
- T01 summary — verification orchestration is wired and tested at the unit level
- T02 summary — client-side rendering is done (not needed for these server tests, but confirms the artifact types are consistent)

## Expected Output

- `server/__tests__/rejection-iteration.test.js` — new test file with 4+ tests proving rejection/iteration resilience
- `server/__tests__/full-pipeline.test.js` — new test file with 1+ comprehensive full-pipeline integration test proving 9 artifacts across 4 stages with auto-triggers and sequential orchestration
