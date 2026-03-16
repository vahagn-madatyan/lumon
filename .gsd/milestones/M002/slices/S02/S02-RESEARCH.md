# S02: Research & Business Planning Stages — Research

**Date:** 2026-03-16
**Status:** Post-implementation verified

## Summary

S02 extends the proven S01 bridge loop to the `research` stage — triggering business planning and tech-stack analysis sub-workflows in n8n, aggregating their structured artifacts, and rendering them as inspectable dossier content. The S01 integration primitive (webhook→callback→artifact→SSE→reducer) is stable, and S02 layers three capabilities on top:

1. **Per-stage webhook routing** — S01 hardcoded a single `N8N_WEBHOOK_URL`. S02 introduced a webhook registry (`server/config.js`) that resolves stage-specific env vars first, falls back to the global URL, and degrades gracefully when unconfigured. The `fireWebhook()` helper centralizes the trigger→record→call→fail pattern for all downstream stages.

2. **Multi-artifact aggregation** — The research stage produces two sub-artifacts (business plan + tech research) sequentially. A new `lumon/append-artifact` reducer action accumulates artifact references into an `artifactIds` array in `stage.output`, deduplicating and always promoting the latest arrival as the primary `artifactId`. The selector chain projects `artifactIds` alongside single-artifact backward compatibility.

3. **Rich artifact rendering** — A `useArtifact(artifactId)` hook fetches content from `GET /api/artifacts/:id` with module-level caching. `ArtifactRenderer` dispatches on `artifact.type` to structured sub-renderers: `BusinessPlanRenderer` (sections: target audience, pricing, feature phases, revenue model, recommendation), `TechResearchRenderer` (scored approaches, tradeoffs, recommendation), `ViabilityRenderer` (market assessment, technical feasibility, risks, recommendation), plus a `GenericRenderer` fallback. `DossierStageOutputCard` renders summary immediately from selector data and progressively loads full artifact content.

**Primary finding:** The research stage's auto-advance gate (`required: false`) means no Wait node is needed in n8n — workflows run to completion and push results through the existing callback→SSE→reducer path. This is simpler than the intake stage (which required Wait→resumeUrl for operator approval). The sequential sub-workflow pattern (business_plan first, then tech_stack on callback) avoids concurrent execution complexity while keeping the orchestration chain auditable via `[bridge] sequential-next` logs.

## Recommendation

**Approach: Webhook registry + sequential sub-workflows + type-dispatched rendering**

This was the approach taken and verified. The key architectural choices that worked well:

1. **Webhook registry in `server/config.js`** — Clean separation of stage→URL mapping from route logic. Stage-specific env vars (`N8N_WEBHOOK_URL_RESEARCH`) override the global `N8N_WEBHOOK_URL`. The fallback chain is: stage-specific → global → null (graceful degradation). S03 and S04 add entries to `STAGE_ENV_MAP` without touching route handlers.

2. **`fireWebhook()` internal helper** — Extracted in `server/routes/pipeline.js` to share between trigger handler, sequential orchestration, and auto-trigger. Creates execution record before calling n8n (matching D031 from S01). All three call sites get the same error handling and logging for free.

3. **`lumon/append-artifact` reducer action** — Dedicated action instead of extending `lumon/update-stage`. Accumulation logic (read existing ids, deduplicate, promote latest as primary) lives in one reducer case. The sync hook dispatches it directly from SSE `artifact-ready` events.

4. **Type-dispatched rendering** — `ArtifactRenderer` uses a lookup table (`TYPE_RENDERERS`) mapping `artifact.type` to sub-renderers. New artifact types in S03 (`naming_candidates`, `domain_signals`, `trademark_signals`) just add entries to this table.

5. **Progressive loading** — `DossierStageOutputCard` renders the summary text immediately from selector data (`outputSummary`) and loads full artifact content via `useArtifact` in a separate `ArtifactDetailPanel`. No blocking waterfall.

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| Business plan content generation | n8n Code node with structured JSON output | Same Webhook→Code→Callback pattern as S01 intake viability. Code node generates structured sections matching the `BusinessPlanRenderer` schema. |
| Tech stack comparison | n8n Code node with scoring matrix | Produces scored approaches with pros/cons/tradeoffs as JSON. `TechResearchRenderer` renders the matrix with `ScoreBadge` components. |
| Artifact content caching | Module-level `Map` in `useArtifact.js` | No SWR/TanStack Query needed at single-operator scale. The module-level cache deduplicates across component instances without serialization overhead. |
| Structured content rendering | `CollapsibleSection` primitive in `ArtifactRenderer.jsx` | Reusable expandable/collapsible section with `data-testid` support. All sub-renderers compose from this primitive. |
| Multi-artifact state accumulation | `lumon/append-artifact` reducer action | Handles the read-existing→deduplicate→merge pattern once. The sync hook dispatches it without pre-merging arrays. |

## Existing Code and Patterns

- `server/config.js` — **Webhook registry**. `getWebhookUrl(stageKey)` is the extension point for new stages. `STAGE_ENV_MAP` has pre-registered entries for `intake`, `research`, `naming`, `branding`, `architecture`. `RESEARCH_SUB_STAGES = ["business_plan", "tech_stack"]` defines the sequential orchestration order.
- `server/routes/pipeline.js` — **`fireWebhook()` helper** is the canonical way to trigger an n8n webhook. It creates the execution record, calls the webhook, handles failures, and returns `{ execution, error }`. The callback handler contains sequential orchestration logic that checks `RESEARCH_SUB_STAGES` order and auto-fires the next sub-stage. The approve handler auto-triggers research after intake approval when a webhook is configured.
- `server/pipeline.js` — **Two-level execution tracking**: `projectIndex` is `Map<projectId, Map<stageKey, executionId>>`. `getStageExecution(projectId, stageKey)` retrieves a specific stage's execution. `getStatus(projectId)` returns all stage executions.
- `server/artifacts.js` — **Disk-based JSON store** with `getByProjectAndStage(projectId, stageKey)` for filtering. `setDataDir(dir)` enables test isolation. Artifacts are stored as `server/data/{uuid}.json`.
- `src/lumon/reducer.js` — **`appendArtifact` case** reads existing `output.artifactIds` (or infers from single `output.artifactId`), deduplicates, merges, and sets latest as primary. Calls `updateProjectStage()` internally.
- `src/lumon/selectors.js` — **`buildDossierStageSection()`** projects `artifactIds` array when present, plus `artifactId`, `hasArtifact`, `outputSummary`. The handoff packet evidence chain reads `artifactIds` from dossier sections.
- `src/lumon/sync.js` — **SSE `artifact-ready` handler** dispatches `lumon/append-artifact` with `{ stageId, artifact: { artifactId, summary, type } }`. Logs each event with `[sync] artifact-ready`.
- `src/lumon/useArtifact.js` — **Fetch + cache hook**: `useArtifact(artifactId)` returns `{ artifact, loading, error }`. Module-level `Map` cache prevents refetching. `clearArtifactCache()` exported for tests.
- `src/features/mission-control/ArtifactRenderer.jsx` — **Type dispatch table**: `TYPE_RENDERERS = { viability_analysis, business_plan, tech_research }`. Each sub-renderer renders structured sections via `CollapsibleSection`. `GenericRenderer` formats unknown types as JSON. All renderers accept `{ content }` prop.
- `src/features/mission-control/DashboardTab.jsx` — **`ArtifactDetailPanel`** wraps `useArtifact` + `ArtifactRenderer` with loading/error states. **`DossierStageOutputCard`** renders summary immediately, then `ArtifactDetailPanel` for single-artifact stages or per-artifact panels for multi-artifact stages.
- `n8n/workflows/research-business-plan.json` — **4-node workflow**: Webhook→Respond→Code(business plan analysis)→HTTP Request(callback). Produces `business_plan` artifact with targetAudience, pricingPosture, featurePhases, revenueModel, recommendation.
- `n8n/workflows/research-tech-stack.json` — **4-node workflow**: Webhook→Respond→Code(tech stack analysis)→HTTP Request(callback). Produces `tech_research` artifact with scored approaches, tradeoffs, recommendation. Callback URL hardcoded to `host.docker.internal:3001`.

## Constraints

- **Research gate is auto-advance (`required: false`).** The n8n research workflows must not include Wait nodes. Results flow directly through callback→SSE→reducer. The operator reviews results in the dossier but does not gate them before pipeline advancement.
- **Sequential orchestration adds latency.** Business plan must complete before tech stack fires. Total research stage time is additive. Acceptable at single-operator scale; parallel triggering deferred to S04 if needed.
- **Artifact content lives server-side, never in the reducer/persistence state tree.** The `useArtifact` module-level cache is transient — page refresh re-fetches. Artifact references (`artifactId`, `summary`, `type`) persist in the reducer; content does not. This avoids localStorage bloat.
- **Route ordering in `server/index.js` matters.** The multi-segment `/api/artifacts/project/:projectId/stage/:stageKey` must be mounted before `/api/artifacts/:id`, or Express matches "project" as an ID. This is currently correct but fragile if routes are reordered.
- **Webhook registry env vars are not validated at startup.** If `N8N_WEBHOOK_URL_RESEARCH` is set to an invalid URL, the failure is discovered at trigger time, not startup. Acceptable for dev/single-operator but worth noting.
- **`useArtifact` cache has no invalidation or TTL.** Artifacts are immutable once stored, so this is currently safe. If artifact content ever becomes mutable, the cache will serve stale data.
- **`CollapsibleSection` defaults open in all renderers.** This is intentional — artifact content is the payoff of the research stage. Collapsible state is local to each render, not persisted.

## Common Pitfalls

- **Overwriting artifacts instead of accumulating.** The original `lumon/update-stage` path would clobber the first artifact reference when the second arrives. The `lumon/append-artifact` action handles this correctly, but any new code path that dispatches `update-stage` with artifact output will bypass accumulation. Always use `append-artifact` for SSE `artifact-ready` events.
- **Breaking the webhook registry fallback.** If a new stage is added to `STAGE_ENV_MAP` but the operator only has `N8N_WEBHOOK_URL` set, the stage-specific lookup returns `undefined` and the global fallback kicks in. This is correct behavior — don't add validation that rejects stages without dedicated env vars.
- **Mounting artifact routes in wrong order.** The multi-segment route must come before the single-param route in `server/index.js`. If reversed, `GET /api/artifacts/project/abc/stage/research` matches `/api/artifacts/:id` with `id="project"` and returns 404.
- **Testing with shared artifact directories.** `server/__tests__/research-pipeline.test.js` and `server/__tests__/pipeline-api.test.js` both write artifacts. Without `setDataDir()` isolation per test file, parallel vitest runs produce nondeterministic failures. Always call `setDataDir(tmpdir)` in `beforeAll`.
- **Assuming artifact content is in the selector chain.** Selectors project `artifactId`, `summary`, `type`, and `artifactIds` — never full content. Content is fetched by `useArtifact` at the component level. Don't try to add content to selector view models.

## Open Risks

- **Sequential orchestration is linear.** `RESEARCH_SUB_STAGES` is a flat array with linear scan in the callback handler. Adding more sub-stages or branching logic (e.g., conditional tech research based on business plan results) will need a more structured orchestration model. Currently acceptable for 2 sub-stages.
- **n8n template callback URLs are hardcoded.** Both research workflow templates use `http://host.docker.internal:3001/api/pipeline/callback`. This works for Docker-based n8n on the same host, but breaks for remote n8n instances. The `n8n/README.md` documents how to change it, but it's a manual step.
- **In-memory pipeline state loss on server restart.** `server/pipeline.js` stores execution records in a plain Map. Server restart loses all active execution tracking (sequential orchestration chain breaks). Artifacts survive on disk, but the execution→artifact link and sequential progression state are lost.
- **SSE reconnection doesn't replay missed events.** If the server goes down during sequential orchestration and comes back, the client reconnects but won't receive the `artifact-ready` event for the artifact that was stored while disconnected. The artifact is on disk but the client state tree won't know about it until a page reload or manual re-trigger.
- **Callback payload schema is implicit.** The bridge expects `{ executionId, projectId, stageKey, result, subStage }` but doesn't validate the shape. If an n8n workflow sends a malformed callback, the artifact is stored with whatever content was provided. No schema validation guard.

## Requirement Coverage

| Req | How S02 Advances It | Full Validation? |
|-----|---------------------|-----------------|
| R006 — Business planning output | `business_plan` artifact type defined with targetAudience, pricingPosture, featurePhases, revenueModel, recommendation schema; `BusinessPlanRenderer` renders structured sections in the dossier; n8n workflow template generates structured content | Primary owner — content schema and rendering proven by 19 renderer tests + 22 server tests |
| R007 — Tech-stack research | `tech_research` artifact type defined with scored approaches, tradeoffs, recommendation schema; `TechResearchRenderer` renders scored comparison with `ScoreBadge` components; n8n workflow template generates structured content | Primary owner — content schema and rendering proven by tests |
| R010 — Architecture package | S02 contributes research artifacts (business plan + tech stack) that feed the architecture section of the handoff packet via `artifactIds` in packet evidence; S04 owns final assembly | Supporting only — architecture artifacts come from S04 |
| R019 — n8n as orchestrator | S02 proves sequential sub-workflow orchestration, auto-trigger chain, and per-stage webhook routing — extending n8n integration beyond S01's single-stage proof | Supporting — full validation requires all stages across M002 |
| R004 — Approval gates | Research stage uses `required: false` gate (no operator approval needed); S02 demonstrates that auto-advance stages work alongside gated stages in the same pipeline | Supporting — approval gates proven at intake in S01; S04 proves full pipeline |

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| n8n workflow patterns | czlonkowski/n8n-skills@n8n-workflow-patterns (2.5K installs) | available — not installed; S02 templates follow proven Webhook→Code→Callback pattern without needing the skill |
| n8n node configuration | czlonkowski/n8n-skills@n8n-node-configuration (1.5K installs) | available — not needed for S02's simple Code+HTTP Request nodes |
| React Testing Library | react-testing-library | already installed — used for ArtifactRenderer tests |

## Sources

- S01 bridge server API contract — trigger/callback/approve/status/SSE endpoints are stable and stage-agnostic; S02 extended without breaking (source: `server/routes/pipeline.js`, S01-SUMMARY.md Forward Intelligence)
- Research stage gate blueprint — `required: false` means auto-advance, no Wait node needed (source: `src/lumon/model.js` `PREBUILD_STAGE_BLUEPRINTS.research.gate`)
- S01 n8n workflow template pattern: Webhook→Respond→Code→Callback — S02 templates follow the same 4-node structure minus Wait (source: `n8n/workflows/intake-viability.json`)
- Pipeline execution tracker two-level index — `Map<projectId, Map<stageKey, executionId>>` supports concurrent multi-stage tracking (source: `server/pipeline.js`)
- `emitSSE(projectId, eventType, data)` — stable push interface for server→client events (source: `server/routes/pipeline.js`, S01 Forward Intelligence)
- `useServerSync` hook auto-subscribes to selected project's SSE stream; new event types need a handler case in `onmessage` listeners (source: `src/lumon/sync.js`)
- Artifact content schemas: `business_plan` produces targetAudience/pricingPosture/featurePhases/revenueModel/recommendation; `tech_research` produces approaches(scored)/tradeoffs/recommendation (source: `n8n/workflows/research-business-plan.json`, `n8n/workflows/research-tech-stack.json`)
- `ArtifactRenderer` TYPE_RENDERERS dispatch table is the extension point for S03 and S04 artifact types (source: `src/features/mission-control/ArtifactRenderer.jsx`)
