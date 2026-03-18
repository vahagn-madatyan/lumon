---
id: M002
provides:
  - Express bridge server at server/ with 5 REST endpoints, disk-based JSON artifact storage, in-memory pipeline execution state, and SSE event streaming
  - stage.output migrated from string to { artifactId, summary, type } with backward-compatible coercion at model boundary
  - Per-stage webhook registry with compound key lookup and global fallback for routing n8n workflow triggers
  - Sequential sub-workflow orchestration across three multi-sub-stage stages (research, plan, verification) with context forwarding
  - Auto-trigger chains (intake→research, plan→verification) on approval when webhooks are configured
  - Multi-artifact accumulation via lumon/append-artifact reducer action with deduplication
  - Type-dispatched ArtifactRenderer with 9 sub-renderers (viability_analysis, business_plan, tech_research, naming_candidates, domain_signals, trademark_signals, architecture_outline, specification, prototype_scaffold)
  - Interactive NamingCandidatesRenderer with operator selection triggering downstream domain/trademark signals via context forwarding
  - Domain and trademark renderers with mandatory advisory disclaimers (D026)
  - useArtifact hook with module-level cache for server-side artifact content fetching
  - useServerSync hook bridging SSE events to reducer dispatch with triggerPipeline/approvePipeline API wrappers
  - Generalized PipelineActions triggering any queued stage with offline mode guard
  - Offline mode — disabled pipeline actions, offline banner, cached dossier rendering when server disconnected
  - 9 importable n8n workflow templates covering the complete discovery pipeline (intake, research×2, plan×3, verification×3)
  - Vite proxy for /api/* and npm run dev starts both Vite and Express via concurrently
  - vitest.workspace.js separating Node (server) and jsdom (client) test environments
key_decisions:
  - "D022: Thin Express bridge server at server/ — frontend can't hold n8n credentials, resume URLs, or large artifacts"
  - "D023: stage.output migrated to { artifactId, summary, type } with backward-compatible coercion at model boundary"
  - "D024: n8n Wait node resumeUrl as the atomic approval primitive — never auto-resume"
  - "D027: Flat JSON files under server/data/ for artifact persistence — debuggable by inspection, upgrade path to SQLite"
  - "D028: vitest.workspace.js separates Node (server) and jsdom (client) test environments under one command"
  - "D029: SSE connections stored per-projectId in Map<string, Set<Response>> with inline emitSSE"
  - "D030: triggerPipeline/approvePipeline exposed through LumonProvider actions context"
  - "D031: Execution record created before n8n webhook call so executionId flows through entire chain"
  - "D032: n8n workflow templates stored in n8n/workflows/ as importable JSON; callback URL hardcoded for Docker"
  - "D033: Webhook registry with per-stage env var lookup and global fallback"
  - "D034: Per-stage execution tracking in pipeline.js"
  - "D035: Sequential sub-workflow orchestration — no parallel triggers"
  - "D036: Auto-trigger research after intake approval"
  - "D037: Dedicated append-artifact reducer action for multi-artifact accumulation"
  - "D038: Module-level Map cache for useArtifact hook"
  - "D039: Compound webhook STAGE_ENV_MAP keys use full sub-stage names matching getWebhookUrl construction"
  - "D040: Generic onAction({ type, ...payload }) prop-drilled through renderer chain"
patterns_established:
  - "[bridge] log prefix for all server requests with method, path, projectId"
  - "[sync] log prefix for client-side SSE lifecycle"
  - Graceful degradation when N8N_WEBHOOK_URL absent — trigger records intent only
  - Structured error responses with { error, reason } shape on all server error paths
  - isStructuredOutput()/getOutputSummary() guards in selector chain for dual output format support
  - Webhook registry pattern — stage-specific env var → global fallback → null (graceful degradation)
  - Sequential sub-stage orchestration — callback handler checks stage sub-stages order and auto-fires next
  - Auto-trigger chain — approve handler fires next stage when webhook configured
  - Artifact accumulation — append-artifact reads existing artifactIds, deduplicates, sets latest as primary
  - Type-dispatched rendering — ArtifactRenderer dispatches on artifact.type via lookup table; unknown types get GenericRenderer
  - Context forwarding through sequential sub-stage chains — data propagates between sub-stages via execution record context
  - Compound webhook key convention — getWebhookUrl(stageKey, subStage) with 3-tier compound→stage→global fallback
  - Interactive artifact renderers receive optional onAction callback — generic { type, ...payload } interface
  - Priority/method badge color mapping in specification renderer
observability_surfaces:
  - "GET /api/pipeline/status/:projectId — full execution state with per-stage records, resumeUrl, timestamps, failure reasons"
  - "GET /api/artifacts/:id — stored artifact content with metadata"
  - "GET /api/artifacts/project/:projectId/stage/:stageKey — filtered artifact list per stage"
  - "Server logs with [bridge] prefix: SSE connect/disconnect, event emissions, webhook registry lookups, auto-triggers, sequential chain progression"
  - "Client [sync] logs: SSE connected/closed/error with projectId, artifact-ready events"
  - "data-testid='sync-connection-status' in dashboard header"
  - "data-testid='pipeline-actions' with trigger/approve/reject buttons"
  - "data-testid='pipeline-actions-offline' banner when server disconnected"
  - "data-testid='architecture-renderer', 'specification-renderer', 'prototype-renderer' for verification renderers"
  - "pipeline.recordFailure() persists failureReason for post-mortem on webhook failures"
requirement_outcomes:
  - id: R004
    from_status: active
    to_status: validated
    proof: "rejection-iteration.test.js proves reject→re-trigger→approve lifecycle, cross-stage isolation, triple-rejection artifact accumulation. full-pipeline.test.js drives all 4 stages through explicit approval gates. 7 tests total."
  - id: R005
    from_status: active
    to_status: validated
    proof: "S01 viability_analysis artifact produced by n8n with market/technical/risk sections. full-pipeline.test.js confirms viability_analysis is the first artifact before any downstream work. Operator must approve before pipeline advances."
  - id: R006
    from_status: active
    to_status: validated
    proof: "S02 business_plan artifact with targetAudience, pricingPosture, featurePhases, revenueModel. BusinessPlanRenderer renders structured sections. full-pipeline.test.js confirms artifact flows through to handoff packet."
  - id: R007
    from_status: active
    to_status: validated
    proof: "S02 tech_research artifact with scored approaches and tradeoffs. TechResearchRenderer renders comparisons. full-pipeline.test.js confirms artifact present in handoff packet alongside architecture_outline."
  - id: R008
    from_status: active
    to_status: validated
    proof: "S03 naming_candidates artifact renders as selectable list with NamingCandidatesRenderer. Operator's selection triggers downstream domain/trademark signals via context forwarding. 29 orchestration tests + 21 renderer tests prove the flow."
  - id: R009
    from_status: active
    to_status: validated
    proof: "S03 domain_signals and trademark_signals artifacts render with status badges and mandatory advisory disclaimers (D026). DomainSignalsRenderer and TrademarkSignalsRenderer proven by renderer tests. Signals labeled as point-in-time advisory, not legal clearance."
  - id: R019
    from_status: active
    to_status: validated
    proof: "9 n8n workflow templates shipped. full-pipeline.test.js proves complete 4-stage pipeline with sequential sub-workflows, auto-trigger chains, compound webhook routing, and context forwarding. S01 proved the fundamental webhook→Wait→resumeUrl contract against a live n8n Docker instance."
duration: ~4h across 4 slices (S01 ~90m, S02 ~40m, S03 ~30m, S04 ~30m)
verification_result: passed
completed_at: 2026-03-17
---

# M002: Discovery & Approval Pipeline

**Complete 4-stage discovery pipeline orchestrated through n8n — intake, research, plan, and verification stages with structured server-side artifacts, explicit approval gates, interactive naming selection, sequential sub-workflow orchestration, and offline degradation — proven by 223 tests and 9 importable n8n workflow templates.**

## What Happened

M002 transformed the M001 client-side control surface into a real orchestrated discovery pipeline by shipping a bridge server, structured artifact storage, n8n integration, and rich artifact rendering across four slices.

**S01 (Bridge Server & Intake Stage)** established the critical-path infrastructure: an Express bridge server on port 3001 with 5 REST endpoints (trigger, callback, approve, artifact get, status), disk-based JSON artifact storage, in-memory pipeline execution tracking, and SSE event streaming per projectId. The `stage.output` contract was migrated from plain strings to `{ artifactId, summary, type }` structured references with backward-compatible coercion at the model boundary — all 32 M001 tests continued passing unchanged. The `useServerSync` hook bridges SSE events to reducer dispatch, and the dashboard gained connection status and conditional trigger/approve/reject buttons. The complete trigger→webhook→viability analysis→callback→artifact storage→Wait→approval→resume loop was proven against a live n8n Docker instance.

**S02 (Research & Business Planning)** extended the bridge with per-stage webhook routing, sequential sub-workflow orchestration (business_plan → tech_stack), and auto-trigger chains that start research after intake approval. The `lumon/append-artifact` reducer action enabled multi-artifact accumulation per stage. A `useArtifact` hook fetches artifact content from the server with module-level caching. The type-dispatched `ArtifactRenderer` architecture was established with dedicated sub-renderers for viability analysis, business plans, and tech research — each rendering structured sections with expandable content.

**S03 (Naming & Brand Signals)** added the plan stage with three sequential sub-stages: naming candidates, domain signals, and trademark signals. The key new primitive was context forwarding — the operator's selected name propagates through the sub-stage chain so domain and trademark lookups use the chosen name. `NamingCandidatesRenderer` is the first interactive renderer, letting the operator pick a name via an `onAction` callback that triggers the domain signals sub-workflow. Domain and trademark renderers include mandatory advisory disclaimers per D026.

**S04 (Architecture Package & Full Pipeline Integration)** completed the pipeline with the verification stage (architecture_outline → specification → prototype_scaffold), then proved the assembled system works end-to-end. Full-pipeline integration tests drive all 4 stages through explicit approval to produce 9 artifacts total. Rejection/iteration resilience was proven: reject a stage, re-trigger it, approve, and state advances cleanly with cross-stage isolation. Offline mode disables all pipeline actions when the server is disconnected while the dossier continues rendering from cached artifacts.

The sequential sub-workflow orchestration pattern proved stable across all three multi-sub-stage stages (research, plan, verification) — compound webhooks, callback chaining, and context forwarding generalized cleanly without structural changes between slices.

## Cross-Slice Verification

| # | Success Criterion | Evidence | Verdict |
|---|-------------------|----------|---------|
| 1 | Operator triggers discovery pipeline, watches progress through named stages with real n8n-executed work | S01/T04: trigger→webhook→callback→approve loop proven against live n8n Docker instance. S04 full-pipeline.test.js: all 4 stages driven through auto-trigger chains (intake→research, plan→verification). PipelineActions generalized for any queued stage. | ✅ |
| 2 | Per-stage outputs appear as structured, inspectable artifacts — not transient strings | stage.output migrated to `{ artifactId, summary, type }` (S01). 9 type-specific sub-renderers in ArtifactRenderer (S02-S04). Artifacts stored as server-side JSON files under server/data/. DossierStageOutputCard renders rich content progressively. | ✅ |
| 3 | Operator can approve one stage, reject another, iterate, state advances only through explicit gates | rejection-iteration.test.js: 4 tests prove reject→re-trigger→approve lifecycle, cross-stage isolation (rejecting research doesn't corrupt intake), triple-rejection artifact accumulation without data loss. | ✅ |
| 4 | Complete discovery pipeline from intake to approved pre-build dossier with architecture, spec, and prototype artifacts | full-pipeline.test.js: 3 tests prove all 4 stages driven to approved status producing 9 artifacts (1 intake + 2 research + 3 plan + 3 verification). Architecture, specification, and prototype renderers display structured content. | ✅ |
| 5 | Lumon remains usable for reviewing cached artifacts when n8n is unreachable | offline-mode.test.jsx: 7 tests prove disabled pipeline actions, visible offline banner, cached dossier rendering from module-level artifact cache. | ✅ |
| 6 | n8n workflow templates importable and functional | 9 templates in n8n/workflows/ following consistent 4-node Webhook→Respond→Code→Callback pattern. S01/T04 proved import and activation via n8n REST API. README documents setup, env vars, and flow diagrams. | ✅ |
| 7 | Success criteria re-checked against live browser behavior | S01/T04 proved the n8n integration loop at API level with a live instance. Contract tests exercise identical code paths through the full pipeline. Browser-level click-through UAT was API-level, not full UI walkthrough — documented as known limitation. | ⚠️ partial |

**Aggregate verification:** `npx vitest run` — 223 tests pass across 17 files in <4s. `npx vite build` — production build succeeds (710KB JS, 94KB CSS). Zero regressions from M001's 32 baseline tests throughout all 4 slices.

**Known limitation on criterion 7:** The live n8n proof (S01/T04) verified the complete trigger→execute→callback→approve contract at the API level with curl against a real n8n Docker instance. Dashboard buttons dispatch to the same functions verified at the API level. A full click-through browser walkthrough with live n8n was not completed — the contract-level proof covers all code paths, but the rendered UI experience was not exercised end-to-end with a live orchestrator.

## Requirement Changes

- R004: active → validated — rejection-iteration.test.js proves reject→re-trigger→approve lifecycle with cross-stage isolation. full-pipeline.test.js confirms all 4 stages advance only through explicit operator approval. No auto-resume anywhere in the system.
- R005: active → validated — Viability analysis is the first pipeline artifact, produced by n8n with structured market/technical/risk sections. Full-pipeline integration confirms it exists before any downstream work begins. Operator must explicitly approve before the pipeline advances.
- R006: active → validated — business_plan artifact carries targetAudience, pricingPosture, featurePhases, and revenueModel. BusinessPlanRenderer renders structured sections in the dossier. Full-pipeline test confirms the artifact flows through to the handoff packet.
- R007: active → validated — tech_research artifact compares scored technical approaches with tradeoffs and recommendations. TechResearchRenderer displays structured comparisons. Full-pipeline test confirms the artifact is present in the handoff packet alongside architecture_outline.
- R008: active → validated — Naming candidates generate as structured artifacts through n8n, render as a selectable list in the dossier via NamingCandidatesRenderer, and the operator's selection triggers downstream domain/trademark signals via context forwarding through the sub-stage chain. 29 orchestration tests + 21 renderer tests prove the complete flow.
- R009: active → validated — Domain availability and trademark signal artifacts render with status badges and mandatory advisory disclaimers (D026). DomainSignalsRenderer and TrademarkSignalsRenderer proven by renderer tests. Signals are clearly labeled as point-in-time advisory, not legal clearance.
- R019: active → validated — 9 n8n workflow templates shipped. Full 4-stage pipeline proven with sequential sub-workflows, auto-trigger chains (intake→research, plan→verification), compound webhook routing, context forwarding, and offline degradation. The fundamental webhook→Wait→resumeUrl contract was proven against a live n8n Docker instance in S01.

## Forward Intelligence

### What the next milestone should know
- The bridge server API contract is stable: `POST /api/pipeline/trigger`, `POST /api/pipeline/callback`, `POST /api/pipeline/approve`, `GET /api/artifacts/:id`, `GET /api/pipeline/status/:projectId`, `GET /api/pipeline/events/:projectId` (SSE), `GET /api/artifacts/project/:projectId/stage/:stageKey`. M003 can consume artifacts directly — they are server-side JSON files indexed by project and stage.
- The handoff packet now contains real artifact references from every pipeline stage. The selectors in `src/lumon/selectors.js` project `artifactIds` through the dossier and packet evidence sections. M003's repo provisioning can read these artifacts from the server to populate the handoff package.
- The sequential orchestration pattern (compound webhooks, callback chaining, context forwarding) is proven across 3 multi-sub-stage stages and can be reused for any future pipeline stages without new infrastructure.
- `npm run dev` starts both Vite (port 5173) and Express (port 3001) via concurrently. The Vite proxy forwards `/api/*` to Express.
- The n8n workflow templates use `host.docker.internal:3001` for callback URLs — this only works when the bridge and Docker n8n share the same host. README documents how to change it.

### What's fragile
- **In-memory pipeline execution state** — `server/pipeline.js` stores executions in a plain Map. Server restart loses all active execution tracking. Artifacts survive (on disk) but the execution→artifact link and resumeUrl are lost. Acceptable for single-operator local dev; needs persistence before any production use or multi-session scenarios.
- **SSE reconnection** — relies on native EventSource auto-reconnect with no explicit retry logic or backoff. If the server goes down and comes back, clients reconnect but won't receive missed events. No event replay or sequence numbering.
- **Module-level artifact cache** — `useArtifact` caches at module level with no invalidation or TTL. If an artifact is re-generated after rejection, stale cached content may persist until page reload. Tests use `clearArtifactCache()` but runtime has no automatic invalidation.
- **Bundle size** — production build emits a 710KB JS chunk (above Vite's 500KB warning). Code-splitting is deferred.

### Authoritative diagnostics
- `npx vitest run server/__tests__/full-pipeline.test.js` — the single most authoritative test. If it passes, the complete 4-stage pipeline contract is intact. If it fails, the regression is in the orchestration chain.
- `npx vitest run server/__tests__/rejection-iteration.test.js` — tests the rejection state machine. If it fails, approval/rejection semantics have regressed.
- `npx vitest run` — 223 tests in <4s. If all pass, the model/selector/sync/renderer contract is intact.
- `GET /api/pipeline/status/:projectId` — runtime source of truth for pipeline execution state per stage.

### What assumptions changed
- **n8n `$env` access** — originally assumed workflow templates could use `$env.LUMON_BRIDGE_URL`. n8n blocks env var access by default, so templates use hardcoded `host.docker.internal:3001`.
- **Execution record timing** — must be created before the n8n webhook call so the bridge's executionId flows through the chain.
- **Artifact accumulation** — original plan assumed `lumon/update-stage` would handle it. A dedicated `lumon/append-artifact` action was cleaner and avoids requiring callers to pre-merge arrays.
- **Sequential orchestration stability** — flagged as low-risk in the roadmap, confirmed: the pattern generalized cleanly across all three multi-sub-stage stages with zero structural changes needed.
- **Offline mode simplicity** — plan anticipated complex degradation. In practice, connection guard + cached artifact rendering covers the primary use case without offline queuing or sync reconciliation.

## Files Created/Modified

- `server/index.js` — Express entrypoint, port 3001, CORS, JSON parsing, route mounting, artifact endpoints
- `server/artifacts.js` — Disk-based JSON artifact store with create/get/getByProject/getByProjectAndStage/list/clear/setDataDir
- `server/pipeline.js` — In-memory pipeline execution state tracker with per-stage tracking, context field, trigger/callback/approve/failure lifecycle
- `server/config.js` — Webhook registry with RESEARCH_SUB_STAGES, PLAN_SUB_STAGES, VERIFICATION_SUB_STAGES, compound STAGE_ENV_MAP, getWebhookUrl()
- `server/routes/pipeline.js` — REST router with trigger/callback/approve/status/SSE endpoints, fireWebhook helper, sequential orchestration, auto-trigger chains
- `server/data/.gitkeep` — Ensures artifact data directory exists in git
- `server/__tests__/pipeline-api.test.js` — 15 API contract tests for bridge server endpoints
- `server/__tests__/research-pipeline.test.js` — 22 contract tests for research orchestration
- `server/__tests__/naming-pipeline.test.js` — 29 contract tests for plan orchestration and context forwarding
- `server/__tests__/verification-pipeline.test.js` — 26 contract tests for verification orchestration
- `server/__tests__/rejection-iteration.test.js` — 4 tests for rejection/iteration resilience
- `server/__tests__/full-pipeline.test.js` — 3 tests for complete 4-stage pipeline integration
- `src/lumon/model.js` — isStructuredOutput(), getOutputSummary(), createPipelineStage output normalization
- `src/lumon/reducer.js` — appendArtifact action with accumulation and deduplication
- `src/lumon/selectors.js` — artifactIds projection in dossier/packet, outputSummary/hasArtifact fields
- `src/lumon/sync.js` — useServerSync hook with SSE subscription, reducer dispatch, triggerPipeline/approvePipeline wrappers
- `src/lumon/context.jsx` — Integrated useServerSync into LumonProvider, ServerSyncContext for connection status
- `src/lumon/useArtifact.js` — Fetch + cache hook for artifact content from server
- `src/features/mission-control/ArtifactRenderer.jsx` — Type-dispatched renderer with 9 sub-renderers (Viability, BusinessPlan, TechResearch, NamingCandidates, DomainSignals, TrademarkSignals, Architecture, Specification, Prototype) plus GenericRenderer fallback
- `src/features/mission-control/DashboardTab.jsx` — ConnectionStatusIndicator, PipelineActions (generalized trigger with offline guard), ArtifactDetailPanel, DossierStageOutputCard with onAction wiring
- `src/lumon/__tests__/artifact-output.test.js` — 29 tests for structured output migration and multi-artifact selectors
- `src/lumon/__tests__/artifact-renderer.test.jsx` — 52 tests for all artifact type dispatch and rendering
- `src/lumon/__tests__/server-sync.test.js` — 8 tests for sync hook integration
- `src/lumon/__tests__/offline-mode.test.jsx` — 7 tests for offline mode behavior
- `src/test/setup.js` — EventSource stub for jsdom
- `n8n/workflows/intake-viability.json` — 6-node intake/viability workflow template
- `n8n/workflows/research-business-plan.json` — 4-node business plan workflow template
- `n8n/workflows/research-tech-stack.json` — 4-node tech stack workflow template
- `n8n/workflows/plan-naming-candidates.json` — 4-node naming candidates workflow template
- `n8n/workflows/plan-domain-signals.json` — 4-node domain availability workflow template
- `n8n/workflows/plan-trademark-signals.json` — 4-node trademark signals workflow template
- `n8n/workflows/verification-architecture-outline.json` — 4-node architecture outline workflow template
- `n8n/workflows/verification-specification.json` — 4-node specification workflow template
- `n8n/workflows/verification-prototype-scaffold.json` — 4-node prototype scaffold workflow template
- `n8n/README.md` — Setup instructions, flow diagrams, env var reference, troubleshooting
- `vite.config.js` — Added /api proxy to localhost:3001
- `vitest.workspace.js` — Workspace config separating client (jsdom) and server (node) test environments
- `package.json` — Updated scripts for dev:server, dev:client, dev (concurrently)
