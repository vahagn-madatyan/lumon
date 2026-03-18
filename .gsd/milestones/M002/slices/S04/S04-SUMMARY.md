---
id: S04
parent: M002
milestone: M002
provides:
  - Verification stage orchestration (architecture_outline → specification → prototype_scaffold) with auto-trigger from plan approval
  - Three n8n workflow templates for verification sub-stages (Webhook→Respond→Code→Callback pattern)
  - Three dedicated artifact renderers (ArchitectureRenderer, SpecificationRenderer, PrototypeRenderer)
  - Generalized PipelineActions trigger for any queued stage (not hardcoded to intake)
  - Offline mode guard — pipeline action buttons disabled when server is disconnected, offline banner visible, cached dossier still renders
  - Rejection/iteration lifecycle proven — reject → re-trigger → approve without state corruption
  - Full 4-stage pipeline integration proven — 9 artifacts across intake, research, plan, verification stages
requires:
  - slice: S01
    provides: Bridge server (trigger/callback/approve/artifacts/status/SSE), artifact storage, useServerSync hook, schema migration
  - slice: S02
    provides: Webhook registry with per-stage env var lookup, sequential sub-workflow orchestration pattern, append-artifact reducer, ArtifactRenderer dispatch architecture
  - slice: S03
    provides: Compound webhook keys, context forwarding through sub-stage chains, onAction callback pattern, plan sub-stage orchestration
affects:
  - M003 (handoff packet now contains real artifacts from all pipeline stages)
key_files:
  - server/config.js
  - server/routes/pipeline.js
  - server/__tests__/verification-pipeline.test.js
  - server/__tests__/rejection-iteration.test.js
  - server/__tests__/full-pipeline.test.js
  - src/features/mission-control/ArtifactRenderer.jsx
  - src/features/mission-control/DashboardTab.jsx
  - src/lumon/__tests__/artifact-renderer.test.jsx
  - src/lumon/__tests__/offline-mode.test.jsx
  - n8n/workflows/verification-architecture-outline.json
  - n8n/workflows/verification-specification.json
  - n8n/workflows/verification-prototype-scaffold.json
  - n8n/README.md
key_decisions:
  - Verification sub-stages follow the exact same orchestration pattern as research and plan (compound webhooks, sequential callback chaining, context forwarding) — confirming the pattern is stable and generalizable across all three multi-sub-stage stages
  - Keep "Trigger Discovery" as button label regardless of which stage is being triggered
  - PipelineActions exported as named export from DashboardTab.jsx for isolated offline mode testing
patterns_established:
  - Sequential sub-workflow orchestration pattern proven stable across three stages (research, plan, verification) — any future stage can follow the same compound-webhook + callback-chain pattern
  - Priority badge color mapping (high=red, medium=amber, low=zinc) and HTTP method badge colors (GET=emerald, POST=blue, PUT=amber, DELETE=red) in specification renderer
  - Full-pipeline integration test pattern — mock global.fetch with global N8N_WEBHOOK_URL, reset fetchCalls between phases to isolate auto-trigger verification
observability_surfaces:
  - "[bridge] sequential-next subStage=specification after=architecture_outline" log lines trace verification chain
  - "[bridge] auto-trigger verification after plan approval" log on plan→verification transition
  - pipeline.recordFailure() stores failureReason for failed verification webhook calls
  - GET /api/pipeline/status/:projectId returns verification execution records with subStage field
  - data-testid="pipeline-actions-offline" banner visible when server disconnected
  - data-testid="architecture-renderer", "specification-renderer", "prototype-renderer" confirm correct dispatch
  - All pipeline action buttons show disabled attribute when !connected
drill_down_paths:
  - .gsd/milestones/M002/slices/S04/tasks/T01-SUMMARY.md
  - .gsd/milestones/M002/slices/S04/tasks/T02-SUMMARY.md
  - .gsd/milestones/M002/slices/S04/tasks/T03-SUMMARY.md
duration: 30m
verification_result: passed
completed_at: 2026-03-17
---

# S04: Architecture Package & Full Pipeline Integration

**Complete 4-stage discovery pipeline proven end-to-end (intake → research → plan → verification) with 9 artifacts, verification-stage orchestration, dedicated architecture/spec/prototype renderers, offline mode, and rejection/iteration resilience — fulfilling all M002 success criteria at the contract level.**

## What Happened

S04 assembled the final pipeline stage and integration proof across three tasks:

**T01 (server-side orchestration):** Extended the bridge server with `VERIFICATION_SUB_STAGES` config and compound `STAGE_ENV_MAP` entries for architecture_outline, specification, and prototype_scaffold. The callback handler chains verification sub-stages sequentially with context forwarding — the same proven pattern from research (S02) and plan (S03). The approve handler auto-triggers verification after plan approval when a webhook is configured. Three n8n workflow templates were created following the 4-node Webhook→Respond→Code→Callback pattern, each generating realistic mock output (system architecture with components/data-flow/deployment, functional/non-functional requirements with API contracts, and prototype scaffolds with directory structure/dependencies/setup). 26 contract tests cover config, webhooks, sequential orchestration, auto-trigger, failure recording, and backward compatibility.

**T02 (client-side rendering and offline mode):** Added three dedicated renderers — ArchitectureRenderer (system overview, component cards with technology badges, data flow, deployment model), SpecificationRenderer (functional requirements with priority badges, API contracts with HTTP method colors), and PrototypeRenderer (project structure, entry points, dependencies with version badges, setup instructions). All registered in `TYPE_RENDERERS` for automatic dispatch. PipelineActions was generalized from `stageKey === "intake" && status === "queued"` to `status === "queued"` so any stage can be triggered. Offline mode wires `useServerSyncStatus().connected` guard — all pipeline action buttons disable when the server is unreachable, an offline banner with WifiOff icon appears, and the dossier continues rendering from the module-level artifact cache. 19 tests cover rendering and offline behavior.

**T03 (capstone verification):** Pure test code — no production changes. 4 rejection/iteration tests prove: single-stage reject→re-trigger→approve lifecycle, cross-stage isolation (rejecting research doesn't corrupt intake), triple-rejection artifact accumulation (no data loss), and execution record replacement. 3 full-pipeline integration tests prove: all 4 stages driven to approved status producing 9 total artifacts (1 intake + 2 research + 3 plan + 3 verification), auto-trigger chains (intake→research, plan→verification), and sequential orchestration across all multi-sub-stage stages.

## Verification

| # | Check | Verdict |
|---|-------|---------|
| 1 | `npx vitest run` — all tests pass, zero regressions from 171 baseline | ✅ 223 tests pass |
| 2 | `server/__tests__/verification-pipeline.test.js` — config, webhooks, sequential orchestration, auto-trigger, failure recording, backward compat | ✅ 26 tests pass |
| 3 | `src/lumon/__tests__/artifact-renderer.test.jsx` — 3 new renderers + dispatch routing | ✅ 52 tests pass |
| 4 | `src/lumon/__tests__/offline-mode.test.jsx` — disabled actions, offline banner, cached dossier | ✅ 7 tests pass |
| 5 | `server/__tests__/rejection-iteration.test.js` — rejection lifecycle, artifact integrity, cross-stage isolation | ✅ 4 tests pass |
| 6 | `server/__tests__/full-pipeline.test.js` — end-to-end pipeline, 9 artifacts, auto-trigger chains | ✅ 3 tests pass |
| 7 | `npx vite build` — production build succeeds | ✅ pass |
| 8 | `verification-pipeline.test.js` includes `recordFailure()` tests (503 + ECONNREFUSED) | ✅ 2 failure tests pass |

Test count progression: 171 (baseline) → 197 (T01 +26) → 216 (T02 +19) → 223 (T03 +7).

## Requirements Advanced

- R004 — Rejection/iteration lifecycle now proven: operator can reject a stage, iterate, re-approve, and state advances only through explicit gates. All 4 stages require explicit approval.
- R005 — Intake/viability assessment is the first stage artifact, produced by n8n and rendered as structured content. Full pipeline proves it exists before any downstream work.
- R006 — Business plan artifact (from S02) flows through the complete pipeline and appears in the final handoff packet with target audience, pricing, and feature phases.
- R007 — Tech stack research artifact (from S02) compares technical approaches and is present in the handoff packet alongside the architecture outline.
- R010 — Handoff packet now populated with real artifacts from all pipeline stages: viability analysis, business plan, tech research, naming candidates, domain/trademark signals, architecture outline, specification, and prototype scaffold.
- R019 — Full 4-stage pipeline proven end-to-end with n8n as the orchestration layer: sequential sub-workflows, auto-trigger chains, context forwarding, and compound webhook routing all exercised through the complete pipeline.

## Requirements Validated

- R010 — Full-pipeline integration test proves 9 artifacts across 4 stages populate the handoff packet. Architecture, specification, and prototype renderers display structured content. The handoff packet contract from M001/S04 selectors now consumes real artifacts.

## New Requirements Surfaced

- none

## Requirements Invalidated or Re-scoped

- none

## Deviations

- T03 increased timeout for sequential-orchestration test to 15s due to ~15 sequential HTTP requests under parallel test load. This is expected for integration tests exercising long chains — not a deviation from the plan's intent.

## Known Limitations

- **UAT deferred:** Full browser walkthrough with live n8n is milestone-level UAT, not gated by this slice. S04 proves the contract; UAT proves the experience.
- **Offline mode is connection-guard only:** No local queue for offline-submitted triggers — buttons simply disable. If the server reconnects, the operator must manually re-trigger.
- **No concurrent execution handling:** If a stage is re-triggered while a previous execution is still running, the new execution replaces the old in the index. The old n8n execution may still call back, which the system handles gracefully (artifacts accumulate), but the UX doesn't warn about orphaned executions.
- **Bundle size warning:** Production build emits a chunk >500KB. Code-splitting is deferred to a later milestone.

## Follow-ups

- Milestone-level UAT: full browser walkthrough with live n8n Docker instance proving all 4 stages in the real UI
- M002 closeout: re-check all success criteria against live browser behavior, not just test artifacts
- Consider offline trigger queueing if operator feedback indicates disconnected-then-reconnect is a common workflow

## Files Created/Modified

- `server/config.js` — Added VERIFICATION_SUB_STAGES export and 4 compound STAGE_ENV_MAP entries
- `server/routes/pipeline.js` — Added verification trigger default, callback sequential orchestration, plan→verification auto-trigger
- `server/__tests__/verification-pipeline.test.js` — 26 contract tests for verification stage
- `server/__tests__/rejection-iteration.test.js` — 4 tests proving rejection/iteration resilience
- `server/__tests__/full-pipeline.test.js` — 3 tests proving full 4-stage pipeline integration
- `n8n/workflows/verification-architecture-outline.json` — 4-node workflow template for architecture output
- `n8n/workflows/verification-specification.json` — 4-node workflow template for specification output
- `n8n/workflows/verification-prototype-scaffold.json` — 4-node workflow template for prototype scaffold output
- `n8n/README.md` — Added verification stage documentation with flow diagram
- `src/features/mission-control/ArtifactRenderer.jsx` — Added ArchitectureRenderer, SpecificationRenderer, PrototypeRenderer + TYPE_RENDERERS entries
- `src/features/mission-control/DashboardTab.jsx` — Generalized PipelineActions trigger, added offline guard + banner, exported PipelineActions
- `src/lumon/__tests__/artifact-renderer.test.jsx` — 12 new tests for verification-stage renderers + dispatch
- `src/lumon/__tests__/offline-mode.test.jsx` — 7 tests for offline mode behavior

## Forward Intelligence

### What the next slice should know
- M002 is contract-complete. All 4 slices are done and the full pipeline is proven at the test level. What remains is milestone-level UAT (live browser + live n8n) and milestone closeout. The reassess-roadmap agent should evaluate whether M002 can be closed or whether UAT findings create additional work.
- The handoff packet now contains real artifact references from every pipeline stage. M003 (repo provisioning) can consume these artifacts directly — they are server-side JSON files indexed by project/stage.
- The sequential orchestration pattern (compound webhooks, callback chaining, context forwarding) is proven across 3 stages and can be reused for any future pipeline stages without new infrastructure.

### What's fragile
- **In-memory pipeline execution state** — all execution records live in `Map` objects in the server process. Server restart loses all execution state. Artifacts survive (disk-persisted), but active executions and their status are lost. This matters for M003 if handoff depends on reading execution state rather than artifact state.
- **Module-level artifact cache** — `useArtifact` caches at module level, which means stale artifacts persist across component unmounts. If an artifact is re-generated after rejection, the old cached content may display until the cache entry expires or is cleared. Tests use `clearArtifactCache()` but runtime has no automatic invalidation.

### Authoritative diagnostics
- `npx vitest run server/__tests__/full-pipeline.test.js` — the single most authoritative test. If this passes, the complete pipeline contract is intact. If it fails, the regression is in the orchestration chain.
- `npx vitest run server/__tests__/rejection-iteration.test.js` — tests the rejection state machine. If this fails, approval/rejection semantics have regressed.
- `GET /api/pipeline/status/:projectId` — runtime inspection of pipeline state including per-stage execution records with subStage field.

### What assumptions changed
- **Sequential orchestration is stable** — original plan flagged this as low risk. Confirmed: the pattern generalized cleanly across all three multi-sub-stage stages (research, plan, verification) with zero structural changes needed.
- **Offline mode is simpler than expected** — the plan anticipated complex degradation. In practice, the connection guard + cached artifact rendering covers the primary use case cleanly. No offline queue or sync reconciliation was needed.
