---
estimated_steps: 5
estimated_files: 4
skills_used:
  - test
  - best-practices
---

# T01: Wire Porkbun credential injection into bridge server with integration tests

**Slice:** S01 — Live External Signal Gathering
**Milestone:** M005

## Description

The n8n runtime blocks `$env` access by default (D032). Porkbun API credentials must flow from the bridge server's environment through the webhook trigger body so the n8n Code node can read them from the input payload. This task adds the credential helper to `server/config.js`, modifies `fireWebhook()` to inject credentials only for the `domain_signals` sub-stage, and writes integration tests proving the injection, isolation, and end-to-end callback pipeline.

## Steps

1. **Add `getPorkbunCredentials()` to `server/config.js`**: Read `PORKBUN_API_KEY` and `PORKBUN_API_SECRET` from `process.env`. Return `{ apiKey, apiSecret }` — returns `null` values if env vars are unset. Export the helper. Never log credential values anywhere.

2. **Modify `fireWebhook()` in `server/routes/pipeline.js`**: After the existing body construction in `fireWebhook()`, detect when `stageKey === 'plan'` AND `subStage === 'domain_signals'`. When matched, call `getPorkbunCredentials()` and merge `porkbunApiKey` and `porkbunApiSecret` into `body.context` (creating `body.context` if null). Log `credentials=injected` or `credentials=missing` at info level — never the actual values. For all other sub-stages, do nothing — no credential injection.

3. **Write `server/__tests__/porkbun-credential-injection.test.js`**: Test `getPorkbunCredentials()` reads from env, returns nulls when unset. Test that `fireWebhook()` (via supertest against `/api/pipeline/trigger`) includes credentials in the context for `domain_signals` but NOT for `naming_candidates` or `trademark_signals`. Mock `fetch` to capture the outbound webhook body and assert credential presence/absence.

4. **Write `server/__tests__/domain-signals-pipeline.test.js`**: Integration test using the full pipeline callback flow. POST a callback with Porkbun-shaped artifact content (using the real API response shape: `{ selectedName, signals: [{ domain, status, price, registrar, renewalPrice, regularPrice, premium, firstYearPromo }], checkedAt, disclaimer, source, dataOrigin }`). Assert the artifact is stored, SSE events would emit, and the artifact can be retrieved via `GET /api/pipeline/artifacts/:projectId/plan`.

5. **Verify redaction**: Confirm that stored artifacts, console logs, and SSE event payloads never contain raw API key or secret values. The tests should assert that `porkbunApiKey` and `porkbunApiSecret` do NOT appear in artifact content or metadata.

## Must-Haves

- [ ] `getPorkbunCredentials()` exported from `server/config.js`, reads from env, returns nulls when missing
- [ ] `fireWebhook()` injects credentials into context ONLY for `plan` + `domain_signals`
- [ ] Credentials never logged, never in artifacts, never in SSE payloads
- [ ] Integration test proves callback with Porkbun-shaped artifact data stores correctly
- [ ] All server tests pass without regressions

## Verification

- `npx vitest run server/__tests__/porkbun-credential-injection.test.js` passes
- `npx vitest run server/__tests__/domain-signals-pipeline.test.js` passes
- `npx vitest run server/` passes (no regressions)

## Observability Impact

- Signals added/changed: `fireWebhook()` log line gains `credentials=injected|missing` for domain_signals sub-stage
- How a future agent inspects this: Grep server logs for `credentials=injected` to confirm creds were attached to the trigger
- Failure state exposed: `credentials=missing` log line when env vars are unset; n8n workflow will receive null credentials and should surface the error in the artifact

## Inputs

- `server/config.js` — existing webhook registry and execution config, add Porkbun credential helper
- `server/routes/pipeline.js` — existing `fireWebhook()` function to extend with credential injection
- `server/__tests__/pipeline-api.test.js` — existing test patterns for pipeline routes (reference for test structure)

## Expected Output

- `server/config.js` — modified with `getPorkbunCredentials()` export
- `server/routes/pipeline.js` — modified `fireWebhook()` with conditional credential injection
- `server/__tests__/porkbun-credential-injection.test.js` — new test file for credential injection logic
- `server/__tests__/domain-signals-pipeline.test.js` — new test file for end-to-end pipeline with Porkbun data
