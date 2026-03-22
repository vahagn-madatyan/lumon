# S01: Live External Signal Gathering

**Goal:** The plan stage domain signals come from the real Porkbun API instead of hardcoded simulated data, trademark advisory signals render with clear sourcing and D026-compliant disclaimers, and the full pipeline contract is proven end-to-end with real external data shapes.
**Demo:** Operator triggers the plan stage on a project → the bridge server injects Porkbun API credentials into the n8n webhook context → the n8n workflow calls the real Porkbun `checkDomain` endpoint for each TLD → real availability, pricing, and premium status flow back through callback → artifact → SSE → reducer → DomainSignalsRenderer with source attribution. Trademark signals render with explicit advisory framing, data-origin labeling, and non-legal disclaimers.

## Must-Haves

- Bridge server reads `PORKBUN_API_KEY` and `PORKBUN_API_SECRET` from env and injects them into the webhook trigger body for the `domain_signals` sub-stage (D032 compliance — n8n can't read `$env`)
- n8n `plan-domain-signals` workflow calls `POST https://api.porkbun.com/api/json/v3/domain/checkDomain/{domain}` for each TLD with rate-limit-safe delays between checks
- Real Porkbun response (`avail`, `price`, `premium`, `regularPrice`) is translated to the existing renderer shape `{ domain, status, price }` in the n8n Code node
- n8n `plan-trademark-signals` workflow includes enhanced data-origin labeling and strengthened D026-compliant disclaimer text
- DomainSignalsRenderer shows data-source attribution ("Porkbun API") and handles optional enriched fields from real responses
- TrademarkSignalsRenderer shows explicit advisory framing with source label
- Server tests prove credential injection flows through `fireWebhook()` into the trigger body
- Renderer tests prove real Porkbun data shapes render correctly through existing components
- End-to-end pipeline test proves callback with Porkbun-shaped artifact data stores and emits correctly

## Proof Level

- This slice proves: integration
- Real runtime required: yes (Porkbun API for live test; mocked for CI)
- Human/UAT required: no (live test gated behind `PORKBUN_LIVE_TEST` env var)

## Verification

- `npx vitest run server/__tests__/porkbun-credential-injection.test.js` — server credential injection and callback pipeline tests pass
- `npx vitest run src/lumon/__tests__/artifact-renderer.test.jsx` — renderer tests pass with real Porkbun data shapes
- `npx vitest run server/__tests__/domain-signals-pipeline.test.js` — end-to-end pipeline test with Porkbun-shaped artifact data passes
- `PORKBUN_LIVE_TEST=1 npx vitest run server/__tests__/porkbun-live.test.js` — live Porkbun API integration test passes (optional, env-gated)

## Observability / Diagnostics

- Runtime signals: `[bridge] fireWebhook` logs now include `credentials=injected` when Porkbun creds are attached to domain_signals trigger; n8n Code node logs Porkbun API response status per TLD
- Inspection surfaces: `GET /api/pipeline/artifacts/:projectId/plan` returns domain_signals artifact with `metadata.engine: 'porkbun-live-v1'` and `metadata.source: 'porkbun-api'` — distinguishable from simulated data by engine version
- Failure visibility: Porkbun API errors (rate limit, auth failure, network) are captured in the artifact metadata as `metadata.errors` array with per-TLD error messages; callback still succeeds with partial results
- Redaction constraints: Porkbun API key and secret must never appear in logs, SSE events, artifact content, or client-visible state — only in the server→n8n trigger body

## Integration Closure

- Upstream surfaces consumed: `server/config.js` webhook registry, `server/routes/pipeline.js` fireWebhook and callback flow, `server/pipeline.js` execution tracker, `server/artifacts.js` storage, `src/lumon/sync.js` SSE listeners, `src/lumon/reducer.js` artifact actions, `src/features/mission-control/ArtifactRenderer.jsx` domain/trademark renderers
- New wiring introduced in this slice: `getPorkbunCredentials()` config helper → `fireWebhook()` credential injection for `plan_domain_signals` sub-stage → n8n Code node Porkbun API client
- What remains before the milestone is truly usable end-to-end: S02 — confirmation-gated domain actions (purchase flow, external action state model, confirmation boundary)

## Tasks

- [ ] **T01: Wire Porkbun credential injection into bridge server with integration tests** `est:1h`
  - Why: The n8n runtime can't access `$env` (D032). The bridge server must read Porkbun credentials from its own env and inject them into the webhook trigger body so the n8n Code node can use them for real API calls.
  - Files: `server/config.js`, `server/routes/pipeline.js`, `server/__tests__/porkbun-credential-injection.test.js`, `server/__tests__/domain-signals-pipeline.test.js`
  - Do: Add `getPorkbunCredentials()` to `server/config.js` that reads `PORKBUN_API_KEY` and `PORKBUN_API_SECRET` from `process.env` and returns `{ apiKey, apiSecret }` (returns nulls if missing). Modify `fireWebhook()` in `server/routes/pipeline.js` to detect when `stageKey === 'plan'` and `subStage === 'domain_signals'`, then merge Porkbun credentials into the `context` field of the trigger body. Never log credential values — only log `credentials=injected` or `credentials=missing`. Write server integration tests: (1) `getPorkbunCredentials()` reads from env, (2) `fireWebhook()` injects credentials for domain_signals but not other sub-stages, (3) end-to-end callback with Porkbun-shaped artifact data stores correctly. Redaction: ensure credentials never appear in SSE events or artifact content.
  - Verify: `npx vitest run server/__tests__/porkbun-credential-injection.test.js server/__tests__/domain-signals-pipeline.test.js`
  - Done when: `getPorkbunCredentials()` returns credentials from env; `fireWebhook()` injects them only for `domain_signals`; pipeline callback stores Porkbun-shaped artifact; all tests pass

- [ ] **T02: Replace simulated n8n workflows with real Porkbun API calls and enhance trademark advisory signals** `est:1h`
  - Why: The current n8n domain-signals workflow returns hardcoded fake data. It must call the real Porkbun `checkDomain` API and translate responses to the renderer-compatible shape. The trademark-signals workflow needs enhanced D026-compliant advisory framing.
  - Files: `n8n/workflows/plan-domain-signals.json`, `n8n/workflows/plan-trademark-signals.json`
  - Do: Rewrite the Code node in `plan-domain-signals.json` to: (1) read Porkbun credentials from `$input.first().json.body.context.porkbunApiKey` and `.porkbunApiSecret`, (2) construct TLD list from selectedName (`.com`, `.io`, `.dev`, `.co`, `.app`, `.ai`), (3) call `POST https://api.porkbun.com/api/json/v3/domain/checkDomain/{domain}` for each TLD with 11-second delays between calls for rate limiting, (4) translate each response: `avail=yes` → `status: "available"`, `avail=no` + `premium=no` → `status: "taken"`, `premium=yes` → `status: "premium"`, price formatted as `"$X.XX/yr"`, (5) include `registrar: "Porkbun"`, `renewalPrice`, `regularPrice` as optional enriched fields, (6) handle API errors gracefully — capture per-TLD errors in metadata without failing the whole workflow, (7) set `metadata.engine: 'porkbun-live-v1'` and `metadata.source: 'porkbun-api'`. For trademark signals: update disclaimer to include explicit non-legal framing per D026, add `dataOrigin: "Simulated advisory database"` and `sourceNote` explaining these are not from a live trademark registry, strengthen disclaimer text.
  - Verify: `node -e "const w = require('./n8n/workflows/plan-domain-signals.json'); const code = w.nodes.find(n => n.name === 'Domain Availability Check').parameters.jsCode; console.log(code.includes('api.porkbun.com') && code.includes('porkbunApiKey'))"` prints `true`
  - Done when: Domain workflow Code node calls real Porkbun API with credential passthrough and rate limiting; trademark workflow has enhanced D026-compliant advisory framing; both produce shapes compatible with existing renderers

- [ ] **T03: Enhance signal renderers for real provider data and add end-to-end verification** `est:1h`
  - Why: The renderers need minor enhancements to show data-source attribution for real provider data and handle optional enriched fields from Porkbun responses. Integration tests must prove the full pipeline contract works with real external data shapes.
  - Files: `src/features/mission-control/ArtifactRenderer.jsx`, `src/lumon/__tests__/artifact-renderer.test.jsx`, `server/__tests__/porkbun-live.test.js`
  - Do: In `DomainSignalsRenderer`: (1) add a source-attribution line below the disclaimer showing data origin when `content.source` or `content.dataOrigin` is present (e.g., "Source: Porkbun API"), (2) show `renewalPrice` below the main price when present, (3) show a "PROMO" mini-badge next to price when `signal.firstYearPromo` is truthy, (4) add `data-testid="domain-source-attribution"`. In `TrademarkSignalsRenderer`: (1) add source-attribution line when `content.dataOrigin` is present, (2) add `data-testid="trademark-source-attribution"`. Add renderer tests: real Porkbun-shaped domain data with enriched fields renders correctly; trademark source attribution appears; missing optional fields don't break rendering. Add `server/__tests__/porkbun-live.test.js` — a live integration test gated behind `PORKBUN_LIVE_TEST` env var that calls the real Porkbun ping endpoint and checkDomain for `example.com` to prove API connectivity and response shape.
  - Verify: `npx vitest run src/lumon/__tests__/artifact-renderer.test.jsx server/__tests__/porkbun-live.test.js`
  - Done when: DomainSignalsRenderer shows source attribution and handles enriched Porkbun fields; TrademarkSignalsRenderer shows enhanced advisory framing; all renderer tests pass; live test passes when `PORKBUN_LIVE_TEST=1`

## Files Likely Touched

- `server/config.js`
- `server/routes/pipeline.js`
- `server/__tests__/porkbun-credential-injection.test.js`
- `server/__tests__/domain-signals-pipeline.test.js`
- `server/__tests__/porkbun-live.test.js`
- `n8n/workflows/plan-domain-signals.json`
- `n8n/workflows/plan-trademark-signals.json`
- `src/features/mission-control/ArtifactRenderer.jsx`
- `src/lumon/__tests__/artifact-renderer.test.jsx`
