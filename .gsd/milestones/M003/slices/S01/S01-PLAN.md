# S01: Provisioning Service & Handoff Controls

**Goal:** An approved project can be provisioned into a real GitHub repository with formatted artifact files and GSD bootstrap structure, through an explicit preview→confirm→execute flow controlled from the HandoffPanel.

**Demo:** With a project at `handoff_ready`, the operator clicks "Preview provisioning" in the HandoffPanel, reviews the repo name, file list, engine choice, and workspace path in a confirmation dialog, confirms, and watches provisioning progress as the server creates a GitHub repo, clones it locally, writes formatted markdown files for all approved artifacts, generates GSD bootstrap files (PROJECT.md, REQUIREMENTS.md, initial milestone, preferences), commits, and pushes. Provisioning state persists across page reload.

## Must-Haves

- Provisioning service module (`server/provisioning.js`) with `preview()`, `provision()`, and `getStatus()` functions
- Artifact-to-markdown formatters for all 9 artifact types (viability_analysis, business_plan, tech_research, naming_candidates, domain_signals, trademark_signals, architecture_outline, specification, prototype_scaffold)
- GSD bootstrap file generator producing `PROJECT.md`, `REQUIREMENTS.md`, initial milestone directory, and `.gsd/preferences.md` from approved dossier
- `gh repo create` and `git` operations via `node:child_process execFile` with proper error handling
- REST endpoints: `POST /api/provisioning/preview`, `POST /api/provisioning/execute`, `GET /api/provisioning/status/:projectId`
- SSE events: `provisioning-progress`, `provisioning-complete`, `provisioning-error`
- Provisioning state shape on project model: `provisioning: { status, repoUrl, workspacePath, error, steps }`
- Reducer action `lumon/update-provisioning` for provisioning state transitions
- Provisioning state surfaced through `buildHandoffPacket` and `buildProjectDetailContract` selectors
- SSE event handler for provisioning events in `useServerSync`
- HandoffPanel provisioning controls: preview button → confirmation dialog → provision button → progress display
- All provisioning controls gated behind `handoff_ready` pipeline status
- Workspace root configurable via `LUMON_WORKSPACE_ROOT` env var, defaulting to parent of Lumon repo directory
- Engine choice propagated from project record to GSD preferences file

## Proof Level

- This slice proves: contract + integration
- Real runtime required: no (mocked gh/git CLI in tests; S02 adds live integration test)
- Human/UAT required: no (S02 handles live GitHub verification)

## Verification

- `npx vitest run` — all existing tests pass plus new provisioning tests
- `server/__tests__/provisioning.test.js` — provisioning service with mocked CLI: preview returns expected plan, provision executes step sequence, artifact formatting produces valid markdown, GSD bootstrap files match expected structure
- `server/__tests__/provisioning-routes.test.js` — supertest integration: preview/execute/status endpoints, SSE event emission, error responses
- `src/lumon/__tests__/provisioning-state.test.js` — reducer handles `lumon/update-provisioning`, selectors surface provisioning in handoff packet, sync handles provisioning SSE events
- `src/features/mission-control/__tests__/provisioning-ui.test.jsx` — HandoffPanel shows provisioning controls when `handoff_ready`, confirmation dialog gates provisioning, progress display updates
- `npm run build` — build succeeds
- `npx eslint server/ src/lumon/ src/features/mission-control/` — lint clean

## Observability / Diagnostics

- Runtime signals: `[provisioning]` prefixed structured console logs for each provisioning step (repo-create, clone, artifact-write, gsd-init, commit-push); SSE typed events per projectId
- Inspection surfaces: `GET /api/provisioning/status/:projectId` returns step-level state; provisioning state on project model visible through selectors
- Failure visibility: provisioning error includes failing step name, error message, and timestamp; partial completion state shows which steps succeeded before failure
- Redaction constraints: workspace paths in logs/responses may reveal filesystem structure — acceptable for single-operator local tool

## Integration Closure

- Upstream surfaces consumed: `server/artifacts.js` (artifact reads by project), `src/lumon/model.js` (project state, engine choice, handoff packet definitions), `src/lumon/selectors.js` (handoff packet, project detail), `server/routes/pipeline.js` (SSE registry pattern, emitSSE function)
- New wiring introduced in this slice: `/api/provisioning/*` routes mounted in Express server, provisioning SSE events emitted through existing SSE registry, `lumon/update-provisioning` reducer action dispatched from sync hook, `provisionProject`/`previewProvisioning` actions wired through LumonProvider, HandoffPanel provisioning controls rendered when `handoff_ready`
- What remains before the milestone is truly usable end-to-end: S02 adds idempotent retry after partial failure, concurrent provisioning guard, gh CLI availability check at startup, and live integration test against real GitHub

## Tasks

- [x] **T01: Build provisioning service with artifact formatting and GSD bootstrap** `est:2h`
  - Why: The provisioning primitive is the foundational risk for M003. If `gh repo create` + clone + artifact write + GSD init work as a testable server function, the REST/UI layers are additive. This task retires the gh CLI orchestration risk, artifact formatting fidelity risk, and GSD bootstrap compatibility risk identified in the roadmap.
  - Files: `server/provisioning.js`, `server/__tests__/provisioning.test.js`
  - Do: Create `server/provisioning.js` exporting `preview(projectId, artifacts)`, `provision(projectId, options)`, and `getStatus(projectId)`. Implement `execGh()` and `execGit()` helpers wrapping `node:child_process execFile`. Implement `formatArtifactToMarkdown(artifact)` with type-dispatched templates for all 9 artifact types plus a generic fallback. Implement `generateGsdBootstrap({ projectName, description, engineChoice, requirements, milestoneContext })` that produces the `.gsd/PROJECT.md`, `.gsd/REQUIREMENTS.md`, `.gsd/preferences.md`, and initial milestone directory structure matching this repo's own `.gsd/` format. `preview()` reads artifacts from `server/artifacts.js`, resolves repo name from project, and returns a plan object with `{ repoName, files[], engineChoice, workspacePath }`. `provision()` executes steps in sequence: repo-create → clone → artifact-write → gsd-init → commit-push, tracking step status. `getStatus()` returns current provisioning state. Workspace root comes from `LUMON_WORKSPACE_ROOT` env var, defaulting to `path.resolve(__dirname, '../../')`. Write comprehensive tests in `server/__tests__/provisioning.test.js` with mocked `execFile` calls verifying: preview returns expected structure, provision calls gh/git in correct order, each artifact type produces valid markdown with section headers, GSD bootstrap files match expected format, provision tracks step-level status.
  - Verify: `npx vitest run server/__tests__/provisioning.test.js`
  - Done when: provisioning service passes all tests with mocked CLI, all 9 artifact types format to readable markdown, GSD bootstrap produces valid PROJECT.md/REQUIREMENTS.md/preferences.md matching this repo's `.gsd/` structure

- [ ] **T02: Add REST endpoints and SSE events for provisioning** `est:1h`
  - Why: The provisioning service needs to be accessible from the client through REST endpoints following the established bridge server patterns. The preview/execute/status flow with SSE progress events is the same architecture proven in M002's pipeline routes.
  - Files: `server/routes/provisioning.js`, `server/index.js`, `server/__tests__/provisioning-routes.test.js`
  - Do: Create `server/routes/provisioning.js` following `server/routes/pipeline.js` patterns. Implement `POST /api/provisioning/preview` (reads projectId from body, calls `preview()`, returns plan — no side effects). Implement `POST /api/provisioning/execute` (reads projectId + confirmed options from body, calls `provision()`, emits SSE events for each step via the existing `emitSSE` function from pipeline routes, returns provisioning status). Implement `GET /api/provisioning/status/:projectId` (calls `getStatus()`, returns current state). Import and use `emitSSE` from pipeline routes for SSE events: `provisioning-progress` (per step), `provisioning-complete` (on success), `provisioning-error` (on failure). Mount the router in `server/index.js` at `/api/provisioning`. Write supertest-based tests in `server/__tests__/provisioning-routes.test.js` verifying: preview returns plan without side effects, execute triggers provisioning and returns status, status endpoint returns current state, error responses for missing projectId, proper HTTP status codes.
  - Verify: `npx vitest run server/__tests__/provisioning-routes.test.js`
  - Done when: all 3 endpoints respond correctly, SSE events are emitted during provisioning, tests pass with mocked provisioning service

- [ ] **T03: Extend client state to track provisioning lifecycle** `est:1h`
  - Why: The client needs to track provisioning state per project so the HandoffPanel can show provisioning controls, progress, and results. This requires extending the model, reducer, selectors, and SSE sync hook — all within the established `src/lumon/*` state spine patterns.
  - Files: `src/lumon/model.js`, `src/lumon/reducer.js`, `src/lumon/selectors.js`, `src/lumon/sync.js`, `src/lumon/context.jsx`, `src/lumon/__tests__/provisioning-state.test.js`
  - Do: In `model.js`, add a `provisioning` field to `createProject()` with shape `{ status: 'idle'|'previewing'|'confirming'|'provisioning'|'complete'|'failed', repoUrl: null, workspacePath: null, error: null, steps: [] }`. Ensure `provisioning` state is initialized from input and persisted through the localStorage envelope. In `reducer.js`, add `lumon/update-provisioning` action type and handler that updates the provisioning field on the target project (identified by projectId in payload). In `selectors.js`, extend `buildHandoffPacket` to include `provisioning` state from the project, and `buildProjectDetailContract` to surface provisioning info. Add a `provisioningReady` boolean derived from `handoff_ready` + `provisioning.status === 'idle'`. In `sync.js`, add SSE event listeners for `provisioning-progress`, `provisioning-complete`, and `provisioning-error` that dispatch `lumon/update-provisioning`. In `context.jsx`, add `previewProvisioning(projectId)` and `executeProvisioning(projectId, options)` action helpers that call the REST endpoints and dispatch state updates. Write tests in `src/lumon/__tests__/provisioning-state.test.js` verifying: `createProject` includes provisioning default state, reducer handles `lumon/update-provisioning` action, selectors surface provisioning state in handoff packet, provisioning state survives model round-trip (persistence).
  - Verify: `npx vitest run src/lumon/__tests__/provisioning-state.test.js`
  - Done when: provisioning state flows from model through reducer and selectors, SSE events dispatch correct actions, provisioning actions are available through the provider, all tests pass

- [ ] **T04: Add HandoffPanel provisioning controls with confirmation dialog** `est:1.5h`
  - Why: The provisioning flow must be operator-initiated through an explicit preview→confirm→execute UI in the HandoffPanel, gated behind `handoff_ready`. This is the user-facing delivery of R018 (explicit confirmation before irreversible) and completes the S01 demo.
  - Files: `src/features/mission-control/DashboardTab.jsx`, `src/features/mission-control/__tests__/provisioning-ui.test.jsx`
  - Do: In `DashboardTab.jsx`, extend the `HandoffPanel` component to show provisioning controls when `project.handoffReady` is true. Add a "Preview provisioning" button that calls `previewProvisioning(projectId)` and displays a confirmation dialog showing the provisioning plan (repo name, file list, engine choice, workspace path). The confirmation dialog must have "Cancel" and "Confirm & Provision" buttons. "Confirm & Provision" calls `executeProvisioning(projectId, options)`. While provisioning is in progress (`provisioning.status === 'provisioning'`), show a step-level progress display listing each step with status indicators (pending/running/complete/failed). On success (`provisioning.status === 'complete'`), show the repo URL and workspace path. On failure (`provisioning.status === 'failed'`), show the error message and which step failed. All provisioning controls are hidden when `handoff_ready` is false. Use the existing Severance-floor aesthetic: zinc/cyan color palette, mono fonts, data-testid attributes for all interactive elements. Write RTL tests in `src/features/mission-control/__tests__/provisioning-ui.test.jsx` verifying: provisioning controls hidden when not handoff_ready, preview button visible when handoff_ready, confirmation dialog shows plan details, provision button triggers provisioning, progress display shows step states, success state shows repo URL, error state shows failure info.
  - Verify: `npx vitest run src/features/mission-control/__tests__/provisioning-ui.test.jsx`
  - Done when: HandoffPanel shows provisioning controls gated behind `handoff_ready`, confirmation dialog enforces explicit operator confirmation, progress/success/failure states render correctly, all tests pass

## Files Likely Touched

- `server/provisioning.js` (new)
- `server/routes/provisioning.js` (new)
- `server/index.js`
- `server/__tests__/provisioning.test.js` (new)
- `server/__tests__/provisioning-routes.test.js` (new)
- `src/lumon/model.js`
- `src/lumon/reducer.js`
- `src/lumon/selectors.js`
- `src/lumon/sync.js`
- `src/lumon/context.jsx`
- `src/lumon/__tests__/provisioning-state.test.js` (new)
- `src/features/mission-control/DashboardTab.jsx`
- `src/features/mission-control/__tests__/provisioning-ui.test.jsx` (new)
