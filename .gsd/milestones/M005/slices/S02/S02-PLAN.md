# S02: Confirmation-Gated Domain Actions

**Goal:** The operator can initiate a domain purchase action from the dashboard, see it pending in an External Actions panel, confirm it through a server-enforced gate, and see the outcome recorded — with the server rejecting any execution attempt that lacks a prior confirmation record.
**Demo:** Operator reviews domain signals → clicks "Purchase" on an available domain → sees the action pending in External Actions panel → clicks "Confirm" → clicks "Execute" → server calls Porkbun's domain create API (mocked in tests) → outcome appears as completed/failed in the panel. Attempting to execute without confirming returns HTTP 403.

## Must-Haves

- Server-side confirmation boundary in `server/external-actions.js` — `executeAction()` rejects with 403 when action status is not `confirmed` (D051, R018, R029)
- Porkbun domain purchase via `POST https://api.porkbun.com/api/json/v3/domain/create/{domain}` with cost in pennies and `agreeToTerms: "yes"` — all tests mock this endpoint
- Simulated-data guard: purchase requests rejected when domain artifact `metadata.engine === 'n8n-plan-domain-v1-simulated'` (D052)
- Client state model (`externalActions` on project shape) with normalizer, reducer actions, selectors, SSE sync, and context action helpers — following the provisioning/buildExecution pattern exactly
- ExternalActionsPanel UI component rendering pending/confirmed/executing/completed/failed action states with confirm/cancel/execute controls
- Full test suite regression: 706+ existing tests pass with zero failures

## Proof Level

- This slice proves: integration (server confirmation gate is the authoritative boundary; UI is supplementary)
- Real runtime required: no (all Porkbun purchase calls mocked; live tests only exercise availability check)
- Human/UAT required: no (RTL + supertest prove the full lifecycle)

## Verification

- `npx vitest run server/__tests__/external-actions.test.js` — confirmation boundary enforcement, state lifecycle
- `npx vitest run server/__tests__/external-actions-routes.test.js` — supertest API tests, 403 on unconfirmed execute
- `npx vitest run server/__tests__/porkbun-provider.test.js` — mocked purchase responses, error handling
- `npx vitest run src/lumon/__tests__/external-actions-state.test.js` — reducer + selector + model normalizer contract
- `npx vitest run src/features/mission-control/__tests__/external-actions-ui.test.jsx` — RTL tests for ExternalActionsPanel
- `npx vitest run` — full suite regression, 706+ passed, 0 failures

## Observability / Diagnostics

- Runtime signals: `[external-actions]` prefixed server logs for request/confirm/cancel/execute lifecycle; SSE events `external-action-requested`, `external-action-confirmed`, `external-action-completed`, `external-action-failed`, `external-action-cancelled`
- Inspection surfaces: `GET /api/external-actions/status/:projectId` returns all actions with full lifecycle timestamps; `GET /api/external-actions/action/:actionId` returns single action detail
- Failure visibility: Action records carry `error` field on failure; `status` field tracks lifecycle phase; confirmation gate rejection returns 403 with `reason` body
- Redaction constraints: Porkbun API credentials must never appear in action records, SSE events, or logs — only `credentials=injected|missing` style indicators

## Integration Closure

- Upstream surfaces consumed: `server/config.js` `getPorkbunCredentials()` (S01), `server/routes/pipeline.js` `emitSSE()` (M002), `server/artifacts.js` for outcome persistence, existing provisioning/buildExecution patterns in model/reducer/selectors/sync/context
- New wiring introduced in this slice: `server/routes/external-actions.js` mounted at `/api/external-actions` in `server/index.js`; SSE event listeners in `sync.js`; context action helpers; ExternalActionsPanel rendered in DashboardTab
- What remains before the milestone is truly usable end-to-end: nothing — S02 is the final slice in M005

## Tasks

- [ ] **T01: Build server-side confirmation gate, Porkbun provider, and REST API** `est:2h`
  - Why: The server confirmation boundary is the highest-risk, highest-value piece — it enforces R018/R029 and unblocks all downstream work. The Porkbun provider and REST routes are tightly coupled to the state tracker.
  - Files: `server/external-actions.js`, `server/providers/porkbun.js`, `server/routes/external-actions.js`, `server/index.js`, `server/__tests__/external-actions.test.js`, `server/__tests__/external-actions-routes.test.js`, `server/__tests__/porkbun-provider.test.js`
  - Do: Create in-memory state tracker with confirmation gate (executeAction rejects non-confirmed with 403). Create Porkbun purchase client using `domain/create/{domain}` endpoint (cost in pennies, agreeToTerms required). Create Express router with request/confirm/cancel/execute/status endpoints. Mount at `/api/external-actions` in index.js. Write comprehensive tests proving gate enforcement, lifecycle transitions, API error handling.
  - Verify: `npx vitest run server/__tests__/external-actions.test.js server/__tests__/external-actions-routes.test.js server/__tests__/porkbun-provider.test.js`
  - Done when: All server tests pass; executeAction on a pending action returns 403; executeAction on a confirmed action calls the provider and records the outcome; full suite regression passes.

- [ ] **T02: Add client state model, reducer, selectors, SSE sync, and context actions** `est:1.5h`
  - Why: The client needs to track external action state, respond to SSE events, and expose action helpers — following the exact patterns established by provisioning and buildExecution.
  - Files: `src/lumon/model.js`, `src/lumon/reducer.js`, `src/lumon/selectors.js`, `src/lumon/sync.js`, `src/lumon/context.jsx`, `src/lumon/__tests__/external-actions-state.test.js`
  - Do: Add `normalizeExternalActionsState()` to model.js, add `externalActions` to `createProject()`. Add 5 reducer action types for external action lifecycle. Add external actions view model to `buildProjectViewModel()` in selectors.js. Add 5 SSE event listeners in sync.js. Add 4 REST action helpers in context.jsx.
  - Verify: `npx vitest run src/lumon/__tests__/external-actions-state.test.js`
  - Done when: Contract tests prove reducer actions update state correctly; selector produces view model with status labels, tones, and boolean helpers; normalizer handles undefined/null/malformed input; full suite regression passes.

- [ ] **T03: Build ExternalActionsPanel UI and integrate into DashboardTab** `est:1.5h`
  - Why: The operator needs a visible panel to review pending actions, confirm, cancel, or execute them, and see outcomes — completing the end-to-end user experience.
  - Files: `src/features/mission-control/ExternalActionsPanel.jsx`, `src/features/mission-control/DashboardTab.jsx`, `src/features/mission-control/__tests__/external-actions-ui.test.jsx`
  - Do: Build ExternalActionsPanel with pending/confirmed/executing/completed/failed action cards. Add confirm/cancel/execute buttons with appropriate state guards. Integrate into DashboardTab alongside ProvisioningSection. Write RTL tests covering all action states and user interactions.
  - Verify: `npx vitest run src/features/mission-control/__tests__/external-actions-ui.test.jsx && npx vitest run`
  - Done when: RTL tests prove all action states render correctly; confirm/cancel/execute buttons dispatch correct context actions; panel integrates into DashboardTab; full test suite passes with 706+ tests, 0 failures.

## Files Likely Touched

- `server/external-actions.js` (new)
- `server/providers/porkbun.js` (new)
- `server/routes/external-actions.js` (new)
- `server/index.js` (modify — mount router)
- `src/lumon/model.js` (modify — add normalizer + project shape)
- `src/lumon/reducer.js` (modify — add 5 action types)
- `src/lumon/selectors.js` (modify — add view model)
- `src/lumon/sync.js` (modify — add 5 SSE listeners)
- `src/lumon/context.jsx` (modify — add 4 action helpers)
- `src/features/mission-control/ExternalActionsPanel.jsx` (new)
- `src/features/mission-control/DashboardTab.jsx` (modify — import and render)
- `server/__tests__/external-actions.test.js` (new)
- `server/__tests__/external-actions-routes.test.js` (new)
- `server/__tests__/porkbun-provider.test.js` (new)
- `src/lumon/__tests__/external-actions-state.test.js` (new)
- `src/features/mission-control/__tests__/external-actions-ui.test.jsx` (new)
