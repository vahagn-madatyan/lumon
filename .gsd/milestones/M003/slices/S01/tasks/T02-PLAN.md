---
estimated_steps: 4
estimated_files: 3
---

# T02: Add REST endpoints and SSE events for provisioning

**Slice:** S01 — Provisioning Service & Handoff Controls
**Milestone:** M003

## Description

Expose the provisioning service from T01 through REST endpoints following the established bridge server patterns from `server/routes/pipeline.js`. The preview/execute/status flow uses the same architecture proven in M002's pipeline routes. SSE events push provisioning progress to the client in real time.

This task follows the exact patterns of the existing pipeline router: Express Router with request validation, structured JSON responses, SSE events via the shared `emitSSE` helper, and supertest-based integration tests.

**Key patterns to follow:**
- `server/routes/pipeline.js` — SSE client registry, `emitSSE()`, typed events, request validation
- `server/__tests__/pipeline-api.test.js` — supertest patterns, test isolation, app import

## Steps

1. **Create `server/routes/provisioning.js` with route structure.** Import the provisioning service from `server/provisioning.js`. Import `emitSSE` from `server/routes/pipeline.js` (it's already exported). Create an Express Router with three endpoints.

2. **Implement the three REST endpoints.**
   - `POST /api/provisioning/preview` — validates `projectId` in request body, reads artifacts from `server/artifacts.js` by project, calls `preview(projectId, artifacts)`, returns the plan object. No side effects. Returns 400 if projectId missing.
   - `POST /api/provisioning/execute` — validates `projectId` and confirmation options in request body, reads artifacts, calls `provision(projectId, { repoName, isPrivate, workspacePath, engineChoice, artifacts })`. During provisioning, emits SSE events for each step via `emitSSE(projectId, 'provisioning-progress', { step, status })`. On completion, emits `provisioning-complete`. On failure, emits `provisioning-error` with step and error message. Returns 201 on success start, 400 for missing fields, 409 if provisioning already in progress for this project.
   - `GET /api/provisioning/status/:projectId` — calls `getStatus(projectId)`, returns current state. Returns `{ status: 'idle' }` if no provisioning has been initiated.

3. **Mount the router in `server/index.js`.** Import the provisioning router and mount it at `/api/provisioning`. Add it after the existing pipeline router mount. This is a two-line change: one import, one `app.use()`.

4. **Write supertest integration tests.** Create `server/__tests__/provisioning-routes.test.js` following the patterns in `server/__tests__/pipeline-api.test.js`. Use the same test structure: import app from `../index.js`, use `request(app)` for HTTP assertions, mock the provisioning service functions (not the CLI — that's mocked in T01's tests). Tests should verify:
   - POST `/api/provisioning/preview` returns plan object with correct structure
   - POST `/api/provisioning/preview` returns 400 without projectId
   - POST `/api/provisioning/execute` triggers provisioning and returns status
   - POST `/api/provisioning/execute` returns 400 without required fields
   - GET `/api/provisioning/status/:projectId` returns current provisioning state
   - GET `/api/provisioning/status/:projectId` returns idle when no provisioning exists
   - SSE events are emitted during provisioning (verify via the emitSSE spy)

## Must-Haves

- [ ] `POST /api/provisioning/preview` returns plan without side effects
- [ ] `POST /api/provisioning/execute` triggers provisioning and emits SSE events
- [ ] `GET /api/provisioning/status/:projectId` returns current provisioning state
- [ ] Router mounted at `/api/provisioning` in `server/index.js`
- [ ] Request validation returns proper 400 responses
- [ ] SSE events emitted: `provisioning-progress`, `provisioning-complete`, `provisioning-error`
- [ ] All tests pass

## Verification

- `npx vitest run server/__tests__/provisioning-routes.test.js` — all route tests pass
- Preview endpoint returns the plan object from the provisioning service
- Execute endpoint returns 201 and triggers provisioning
- Status endpoint returns the current provisioning state
- Invalid requests get 400 with descriptive error messages
- `npx vitest run` — all existing server tests still pass (no regressions)

## Inputs

- `server/provisioning.js` — from T01; provides `preview()`, `provision()`, `getStatus()` functions
- `server/routes/pipeline.js` — existing route patterns and `emitSSE` export
- `server/index.js` — Express app entrypoint where the router must be mounted
- `server/__tests__/pipeline-api.test.js` — reference test patterns (supertest, app import, test isolation)

## Expected Output

- `server/routes/provisioning.js` — Express router with 3 endpoints (~80-120 lines)
- `server/index.js` — updated with provisioning router import and mount (2 lines changed)
- `server/__tests__/provisioning-routes.test.js` — supertest integration tests (~120-180 lines)
