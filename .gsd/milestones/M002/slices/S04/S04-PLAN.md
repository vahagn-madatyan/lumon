# S04: Architecture Package & Full Pipeline Integration

**Goal:** A project runs through the complete discovery pipeline from intake to approved build dossier, with architecture/spec/prototype artifacts populating the handoff packet, rejection/iteration flows proven, offline mode working, and n8n workflow templates shipped as importable JSON.
**Demo:** Trigger a project → intake → research sub-stages → plan sub-stages → verification sub-stages → handoff packet shows "ready" with real artifacts from every stage. Reject a stage mid-flow, re-trigger, re-approve without state corruption. Disconnect the server and confirm dossier still renders cached artifacts with trigger buttons disabled.

## Must-Haves

- Verification stage orchestrates three sub-stages (architecture_outline, specification, prototype_scaffold) via the bridge server with sequential progression and auto-trigger from plan approval
- Three n8n workflow templates for verification sub-stages following the Webhook→Respond→Code→Callback pattern
- Three new artifact renderers (architecture, specification, prototype) registered in ArtifactRenderer.jsx
- PipelineActions generalized to trigger any queued stage with a configured webhook (not hardcoded to intake only)
- PipelineActions disabled when server is disconnected, with visible offline indicator
- Dossier renders cached artifact content when server is unreachable
- Rejection → re-trigger → re-approve lifecycle proven without state corruption
- Full pipeline integration test from intake to handoff_ready with artifacts from every stage
- n8n README updated with verification stage documentation

## Proof Level

- This slice proves: final-assembly
- Real runtime required: no (contract tests prove orchestration; live n8n is UAT)
- Human/UAT required: yes (full browser walkthrough is milestone-level UAT, deferred to milestone closeout)

## Verification

- `npx vitest run` — all tests pass, zero regressions from existing 171 tests
- `server/__tests__/verification-pipeline.test.js` — VERIFICATION_SUB_STAGES config, compound webhook registry, sequential orchestration, auto-trigger from plan approval, backward compatibility
- `src/lumon/__tests__/artifact-renderer.test.jsx` — extended with 3 new renderer tests (architecture, specification, prototype) + dispatch routing
- `src/lumon/__tests__/offline-mode.test.jsx` — PipelineActions disabled when disconnected, trigger buttons hidden, dossier renders cached data
- `server/__tests__/rejection-iteration.test.js` — reject → re-trigger → approve lifecycle, multi-artifact state integrity after rejection
- `server/__tests__/full-pipeline.test.js` — end-to-end pipeline from intake through all stages to handoff_ready state
- `npx vite build` — production build succeeds

## Observability / Diagnostics

- Runtime signals: `[bridge] sequential-next subStage=specification after=architecture_outline` log lines trace verification chain; `[bridge] auto-trigger verification after plan approval` log on plan→verification transition
- Inspection surfaces: `GET /api/pipeline/status/:projectId` returns verification execution records; `GET /api/artifacts/project/:projectId/stage/verification` returns architecture artifacts; offline banner visible in dashboard when disconnected
- Failure visibility: `pipeline.recordFailure()` stores failureReason for any verification sub-stage failure; PipelineActions shows disabled state with connection error reason
- Redaction constraints: none

## Integration Closure

- Upstream surfaces consumed: S01 bridge server (trigger/callback/approve/artifacts/status/SSE), S02 webhook registry + sequential orchestration pattern + append-artifact reducer + ArtifactRenderer dispatch, S03 compound webhook keys + context forwarding + onAction callback chain, M001 handoff packet selectors
- New wiring introduced in this slice: auto-trigger from plan approval to verification stage, generalized trigger button for any stage, offline connection guard on all pipeline actions
- What remains before the milestone is truly usable end-to-end: milestone-level UAT walkthrough in real browser with live n8n (not gated by this slice — S04 proves the contract, UAT proves the experience)

## Tasks

- [ ] **T01: Wire verification stage orchestration and ship n8n workflow templates** `est:30m`
  - Why: The verification stage (architecture_outline → specification → prototype_scaffold) needs the same server-side orchestration pattern proven for research and plan stages. Without this, the pipeline stops at plan approval and no architecture artifacts reach the handoff packet.
  - Files: `server/config.js`, `server/routes/pipeline.js`, `n8n/workflows/verification-architecture-outline.json`, `n8n/workflows/verification-specification.json`, `n8n/workflows/verification-prototype-scaffold.json`, `n8n/README.md`, `server/__tests__/verification-pipeline.test.js`
  - Do: Add `VERIFICATION_SUB_STAGES` to config.js with compound STAGE_ENV_MAP entries. Add verification sequential orchestration block in callback handler (copy plan pattern). Add auto-trigger from plan approval to verification in approve handler. Create 3 n8n workflow templates with realistic mock output. Write contract tests covering config, webhooks, sequential progression, auto-trigger, and backward compatibility.
  - Verify: `npx vitest run server/__tests__/verification-pipeline.test.js` passes all tests; `npx vitest run` passes with zero regressions
  - Done when: Verification sub-stages orchestrate sequentially, auto-trigger fires after plan approval, all contract tests pass, n8n templates parse as valid JSON

- [ ] **T02: Add architecture renderers, generalize trigger button, and wire offline mode** `est:30m`
  - Why: Architecture/spec/prototype artifacts need dedicated renderers so they display structured content in the dossier instead of raw JSON. The trigger button is currently hardcoded to intake — operators need to trigger any queued stage. Offline mode must disable triggers while preserving cached dossier browsing.
  - Files: `src/features/mission-control/ArtifactRenderer.jsx`, `src/features/mission-control/DashboardTab.jsx`, `src/lumon/__tests__/artifact-renderer.test.jsx`, `src/lumon/__tests__/offline-mode.test.jsx`
  - Do: Add ArchitectureRenderer, SpecificationRenderer, PrototypeRenderer to TYPE_RENDERERS using CollapsibleSection pattern. Generalize PipelineActions canTrigger from `stageKey === "intake"` to any stage with `status === "queued"`. Add `useServerSyncStatus().connected` guard — disable trigger/approve/reject buttons and show offline banner when disconnected. Write renderer tests and offline mode tests.
  - Verify: `npx vitest run src/lumon/__tests__/artifact-renderer.test.jsx` and `npx vitest run src/lumon/__tests__/offline-mode.test.jsx` pass; `npx vite build` succeeds
  - Done when: All 3 new artifact types render structured content, trigger works for any queued stage, buttons disabled when disconnected, offline banner visible

- [ ] **T03: Prove rejection/iteration resilience and full pipeline integration** `est:30m`
  - Why: This is the capstone verification — proving the complete pipeline works end-to-end and that rejection/iteration doesn't corrupt state. Without this, M002 can't claim its success criteria are met.
  - Files: `server/__tests__/rejection-iteration.test.js`, `server/__tests__/full-pipeline.test.js`
  - Do: Write rejection tests: reject a stage → re-trigger → new execution replaces old → artifacts accumulate correctly → approve succeeds. Write multi-stage rejection tests: reject plan, re-trigger, approve, verify other stages unaffected. Write full pipeline test: create project state → trigger intake → callback → approve → auto-research → research sub-stages → approve plan → plan sub-stages → approve verification → verification sub-stages → verify handoff packet contains artifacts from all stages.
  - Verify: `npx vitest run server/__tests__/rejection-iteration.test.js` and `npx vitest run server/__tests__/full-pipeline.test.js` pass; `npx vitest run` shows zero regressions across all test files
  - Done when: Rejection/iteration lifecycle is proven clean, full pipeline test passes from intake to handoff_ready, total test count increases by 20+ with zero regressions

## Files Likely Touched

- `server/config.js`
- `server/routes/pipeline.js`
- `server/__tests__/verification-pipeline.test.js`
- `server/__tests__/rejection-iteration.test.js`
- `server/__tests__/full-pipeline.test.js`
- `n8n/workflows/verification-architecture-outline.json`
- `n8n/workflows/verification-specification.json`
- `n8n/workflows/verification-prototype-scaffold.json`
- `n8n/README.md`
- `src/features/mission-control/ArtifactRenderer.jsx`
- `src/features/mission-control/DashboardTab.jsx`
- `src/lumon/__tests__/artifact-renderer.test.jsx`
- `src/lumon/__tests__/offline-mode.test.jsx`
