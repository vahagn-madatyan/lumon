# S02: Research & Business Planning Stages

**Goal:** After intake approval, the research stage triggers business planning and tech-stack analysis sub-workflows in n8n, and their structured artifacts render as inspectable dossier content in the dashboard.
**Demo:** Approve the intake stage → bridge auto-triggers research → n8n executes business plan and tech stack analysis sequentially → two structured artifacts appear in the dossier card area as expandable, section-based content.

## Must-Haves

- Webhook registry maps stageKey → webhook URL, with backward-compatible `N8N_WEBHOOK_URL` fallback
- Bridge auto-triggers research stage after intake approval (research gate `required: false` means no operator action needed)
- Sequential sub-workflow orchestration: business plan fires first, tech stack fires after business plan callback completes
- Per-stage execution tracking so multiple stages can have independent executions under one project
- Two n8n workflow templates (business plan + tech research) following the proven Webhook→Code→Callback pattern
- Artifact list endpoint: `GET /api/artifacts/project/:projectId/stage/:stageKey`
- Client sync accumulates multiple artifact-ready events per stage instead of overwriting
- Selectors project `artifactIds` array alongside primary `artifactId` for multi-artifact stages
- `useArtifact` hook fetches artifact content from `GET /api/artifacts/:id` with loading state
- `ArtifactRenderer` dispatches on artifact `type` to type-specific sub-renderers (business_plan, tech_research, viability_analysis)
- DossierStageOutputCard renders artifact content when `hasArtifact` is true instead of plain text

## Proof Level

- This slice proves: integration — n8n-executed research sub-workflows produce structured artifacts that render in the dashboard
- Real runtime required: yes (n8n Docker instance for full integration proof, but contract tests don't require it)
- Human/UAT required: no (deferred to S04 full pipeline UAT)

## Verification

- `npx vitest run` — all tests pass including:
  - `server/__tests__/research-pipeline.test.js` — webhook registry lookup, per-stage execution tracking, sequential orchestration, auto-trigger after approval, artifact list endpoint
  - `src/lumon/__tests__/artifact-output.test.js` — updated for multi-artifact selector projections (artifactIds array)
  - `src/lumon/__tests__/artifact-renderer.test.jsx` — ArtifactRenderer dispatches by type, renders structured sections, handles loading state
- Zero regressions in existing M001 (32) and M002/S01 (43) tests
- `npx vite build` — production build succeeds

## Observability / Diagnostics

- Runtime signals: `[bridge]` log prefix for webhook registry lookup, sequential trigger progression, auto-trigger decisions; `[sync]` for multi-artifact event accumulation
- Inspection surfaces: `GET /api/pipeline/status/:projectId` shows per-stage execution records; `GET /api/artifacts/project/:projectId/stage/:stageKey` returns all artifacts for a stage
- Failure visibility: `pipeline.recordFailure()` captures per-stage failures; sequential orchestration logs which sub-workflow step failed
- Redaction constraints: n8n webhook URLs may contain auth tokens — log stageKey lookup result, not the raw URL

## Integration Closure

- Upstream surfaces consumed: S01 bridge server API (`trigger`, `callback`, `approve`, `artifacts`), S01 SSE push (`emitSSE`), S01 sync hook (`useServerSync`), S01 schema-migrated `stage.output` contract
- New wiring introduced: webhook registry in server config, auto-trigger chain in approve handler, artifact list endpoint, `useArtifact` hook + `ArtifactRenderer` in dossier cards
- What remains before the milestone is truly usable end-to-end: S03 (naming/brand stages), S04 (architecture package, full pipeline integration, rejection/iteration, offline mode)

## Tasks

- [x] **T01: Webhook registry, sequential research orchestration, and n8n workflow templates** `est:45m`
  - Why: The bridge server needs per-stage webhook routing, sequential sub-workflow orchestration, and auto-trigger logic so that approving intake automatically fires the research sub-workflows and stores their artifacts.
  - Files: `server/config.js`, `server/pipeline.js`, `server/routes/pipeline.js`, `server/artifacts.js`, `n8n/workflows/research-business-plan.json`, `n8n/workflows/research-tech-stack.json`, `server/__tests__/research-pipeline.test.js`
  - Do: (1) Create webhook registry config with stageKey→webhookUrl mapping from env vars, fallback to N8N_WEBHOOK_URL. (2) Extend pipeline.js projectIndex to `Map<string, Map<string, string>>` for per-stage execution tracking. (3) Update trigger handler to look up webhook URL by stageKey from registry. (4) Add sequential orchestration: when `stageKey=research`, fire business plan first; on its callback, auto-fire tech stack. (5) Add auto-trigger in approve handler: after intake approval succeeds, auto-trigger research if webhook available. (6) Add `getByProjectAndStage()` to artifacts.js and mount `GET /api/artifacts/project/:projectId/stage/:stageKey`. (7) Ship two n8n workflow templates following Webhook→Code→Callback pattern — no Wait node. (8) Write contract tests.
  - Verify: `npx vitest run` — new research-pipeline tests pass, existing tests don't regress
  - Done when: Bridge server can receive a research trigger, sequentially orchestrate two sub-workflows, store their artifacts, and auto-trigger research after intake approval — all proven by contract tests

- [x] **T02: Multi-artifact client sync and rich artifact rendering in dossier** `est:45m`
  - Why: The frontend needs to receive multiple artifact-ready events per stage without overwriting, project them through selectors, fetch artifact content from the server, and render structured sections in the dossier — this is the user-visible payoff of the research stage.
  - Files: `src/lumon/sync.js`, `src/lumon/selectors.js`, `src/lumon/useArtifact.js`, `src/features/mission-control/ArtifactRenderer.jsx`, `src/features/mission-control/DashboardTab.jsx`, `src/lumon/__tests__/artifact-output.test.js`, `src/lumon/__tests__/artifact-renderer.test.jsx`
  - Do: (1) Update sync.js `artifact-ready` handler to accumulate artifact references into an `artifactIds` array in `stage.output` rather than overwriting the primary artifactId. (2) Extend `buildDossierStageSection` in selectors.js to project `artifactIds` array from stage output. (3) Create `useArtifact(artifactId)` hook — fetch from `GET /api/artifacts/:id`, return `{ artifact, loading, error }` with local state caching. (4) Create `ArtifactRenderer` that dispatches on `artifact.type` to type-specific sub-renderers: `BusinessPlanRenderer`, `TechResearchRenderer`, `ViabilityRenderer` — each renders expandable sections with headings, key findings, score badges. (5) Wire `ArtifactRenderer` into `DossierStageOutputCard`: when `section.hasArtifact`, render artifact content instead of plain text; show summary immediately, progressively load full content. (6) Write tests: selector projection, renderer dispatch, loading states.
  - Verify: `npx vitest run` — artifact-output tests updated and passing, new artifact-renderer tests pass, zero regressions
  - Done when: A stage with structured artifact output renders its content as expandable, section-based dossier content in the dashboard — proven by RTL tests that assert on rendered artifact structure

## Files Likely Touched

- `server/config.js` (new)
- `server/pipeline.js`
- `server/routes/pipeline.js`
- `server/artifacts.js`
- `server/__tests__/research-pipeline.test.js` (new)
- `n8n/workflows/research-business-plan.json` (new)
- `n8n/workflows/research-tech-stack.json` (new)
- `src/lumon/sync.js`
- `src/lumon/selectors.js`
- `src/lumon/useArtifact.js` (new)
- `src/features/mission-control/ArtifactRenderer.jsx` (new)
- `src/features/mission-control/DashboardTab.jsx`
- `src/lumon/__tests__/artifact-output.test.js`
- `src/lumon/__tests__/artifact-renderer.test.jsx` (new)
