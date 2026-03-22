---
estimated_steps: 5
estimated_files: 7
skills_used:
  - best-practices
  - test
  - review
---

# T01: Build server-side confirmation gate, Porkbun provider, and REST API

**Slice:** S02 — Confirmation-Gated Domain Actions
**Milestone:** M005

## Description

Create the server-side foundation for the external actions system: an in-memory state tracker with a server-enforced confirmation gate (D051), a Porkbun API client for domain purchase, and Express REST endpoints. The confirmation gate is the core of R018 and R029 — `executeAction()` must reject execution when the action has not been explicitly confirmed. The Porkbun provider uses `POST https://api.porkbun.com/api/json/v3/domain/create/{domain}` (verified from official docs — NOT `register`). All purchase tests mock the Porkbun API.

## Steps

1. **Create `server/external-actions.js`** — In-memory state tracker using a `Map<string, ExternalAction[]>` (same pattern as `server/provisioning.js`). Action shape:
   ```js
   {
     id: crypto.randomUUID(),
     projectId,
     type,           // 'domain-purchase'
     params,         // { domain, cost, ... }
     status,         // 'pending' | 'confirmed' | 'executing' | 'completed' | 'failed' | 'cancelled'
     requestedAt, confirmedAt, executedAt, completedAt,
     result,         // provider response on success
     error,          // error message on failure
   }
   ```
   Functions: `requestAction({ projectId, type, params })`, `confirmAction({ projectId, actionId })`, `cancelAction({ projectId, actionId })`, `executeAction({ projectId, actionId, provider })` — **THE GATE**: must check `action.status === 'confirmed'` and throw/reject with a clear error code if not. Also: `getActions(projectId)`, `getAction(actionId)`, `clear()` (test cleanup). The `executeAction` function takes a provider callback so the actual API call is injected — this makes testing clean.

2. **Create `server/providers/porkbun.js`** — Porkbun API client module exporting:
   - `checkAvailability(domain, { apiKey, apiSecret })` — POST to `https://api.porkbun.com/api/json/v3/domain/checkDomain/{domain}`
   - `purchaseDomain({ domain, cost, apiKey, apiSecret })` — POST to `https://api.porkbun.com/api/json/v3/domain/create/{domain}` with body `{ secretapikey, apikey, cost, agreeToTerms: "yes" }`. Cost is in pennies (integer). Response includes `{ status, domain, cost, orderId, balance }`.
   
   Import `getPorkbunCredentials()` from `server/config.js` for credential access. Error handling must distinguish: insufficient funds, domain already taken, API auth failure, network errors. Rate limit: 1 call per 10s (S01 finding).

3. **Create `server/routes/external-actions.js`** — Express Router:
   - `POST /request` — body `{ projectId, type, params }`. Creates pending action, emits SSE `external-action-requested`. **Simulated data guard (D052)**: if `type === 'domain-purchase'`, check the domain artifact's `metadata.engine`. If it equals `'n8n-plan-domain-v1-simulated'`, reject with 400 and a clear reason.
   - `POST /confirm/:actionId` — body `{ projectId }`. Confirms action, emits SSE `external-action-confirmed`.
   - `POST /cancel/:actionId` — body `{ projectId }`. Cancels action, emits SSE `external-action-cancelled`.
   - `POST /execute/:actionId` — body `{ projectId }`. Calls `executeAction()` which enforces the confirmation gate. On success emits `external-action-completed`; on failure emits `external-action-failed`. Returns 403 if not confirmed.
   - `GET /status/:projectId` — returns all actions for project.
   - `GET /action/:actionId` — returns single action.
   
   Import `emitSSE` from `./pipeline.js` (same as provisioning routes). Import `getPorkbunCredentials` from `../config.js`.

4. **Mount router in `server/index.js`** — Add import and `app.use("/api/external-actions", externalActionsRouter)` following the existing provisioning/execution mount pattern (around lines 17-23).

5. **Write test files:**
   - `server/__tests__/external-actions.test.js` — State tracker unit tests:
     - requestAction creates pending action with correct shape
     - confirmAction transitions to confirmed
     - cancelAction transitions to cancelled  
     - **executeAction on pending action REJECTS** (THE GATE — proves R018/R029)
     - **executeAction on confirmed action SUCCEEDS** and calls the provider
     - executeAction records result on success, records error on failure
     - getActions/getAction return correct data
     - clear() resets all state
   - `server/__tests__/external-actions-routes.test.js` — Supertest API tests:
     - POST /request creates action, returns 201
     - POST /confirm/:actionId returns 200
     - POST /execute/:actionId on unconfirmed returns **403** (THE GATE via API)
     - POST /execute/:actionId on confirmed returns 200
     - POST /cancel/:actionId returns 200
     - GET /status/:projectId returns action list
     - GET /action/:actionId returns single action
     - POST /request with simulated engine rejects with 400 (D052 guard)
   - `server/__tests__/porkbun-provider.test.js` — Mocked provider tests:
     - purchaseDomain with successful response returns domain + orderId
     - purchaseDomain with domain-taken error returns meaningful error
     - purchaseDomain with insufficient funds returns meaningful error
     - purchaseDomain with auth failure returns meaningful error
     - checkAvailability returns parsed availability data

## Must-Haves

- [ ] `executeAction()` throws/rejects when action status is not `'confirmed'` — this is the D051/R018/R029 gate
- [ ] Porkbun purchase uses correct endpoint: `POST https://api.porkbun.com/api/json/v3/domain/create/{domain}` with `cost` in pennies and `agreeToTerms: "yes"`
- [ ] Simulated data guard: POST /request rejects domain-purchase when artifact engine is `'n8n-plan-domain-v1-simulated'`
- [ ] SSE events emitted for all state transitions using `emitSSE()` from `server/routes/pipeline.js`
- [ ] All tests mock the Porkbun API — no real HTTP calls
- [ ] Porkbun credentials never appear in action records, SSE event payloads, or server logs

## Verification

- `npx vitest run server/__tests__/external-actions.test.js` — all state tracker tests pass
- `npx vitest run server/__tests__/external-actions-routes.test.js` — all API route tests pass including 403 gate
- `npx vitest run server/__tests__/porkbun-provider.test.js` — all mocked provider tests pass
- `npx vitest run` — full suite regression, 706+ passed, 0 failures

## Observability Impact

- Signals added: `[external-actions]` prefixed console.log for request/confirm/cancel/execute lifecycle; SSE events for all state transitions
- How a future agent inspects this: `GET /api/external-actions/status/:projectId` returns full action list with timestamps; server logs show lifecycle
- Failure state exposed: Action records carry `error` field; confirmation gate rejection returns 403 with `{ error, reason }` body

## Inputs

- `server/config.js` — `getPorkbunCredentials()` for Porkbun API credentials (proven in S01)
- `server/routes/pipeline.js` — `emitSSE()` function for SSE event broadcasting
- `server/artifacts.js` — `getByProject()` for checking domain artifact metadata.engine (D052 guard)
- `server/index.js` — mount point for the new router
- `server/provisioning.js` — structural pattern reference (in-memory Map, state lifecycle, step tracking)
- `server/routes/provisioning.js` — structural pattern reference (Express router, SSE event emission)

## Expected Output

- `server/external-actions.js` — new state tracker module with confirmation gate
- `server/providers/porkbun.js` — new Porkbun API client (checkAvailability + purchaseDomain)
- `server/routes/external-actions.js` — new Express router with 6 endpoints
- `server/index.js` — modified to mount external actions router
- `server/__tests__/external-actions.test.js` — new state tracker unit tests
- `server/__tests__/external-actions-routes.test.js` — new supertest API tests
- `server/__tests__/porkbun-provider.test.js` — new mocked provider tests
