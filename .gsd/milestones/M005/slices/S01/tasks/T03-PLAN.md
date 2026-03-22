---
estimated_steps: 5
estimated_files: 3
skills_used:
  - test
  - react-best-practices
---

# T03: Enhance signal renderers for real provider data and add end-to-end verification

**Slice:** S01 — Live External Signal Gathering
**Milestone:** M005

## Description

The existing `DomainSignalsRenderer` and `TrademarkSignalsRenderer` work with the simulated data shapes but need minor enhancements to show data-source attribution for real provider data and handle optional enriched fields that come from Porkbun API responses. This task adds source-attribution UI, enriched field display, comprehensive renderer tests with real Porkbun data shapes, and a live integration test gated behind the `PORKBUN_LIVE_TEST` env var.

## Steps

1. **Enhance `DomainSignalsRenderer` in `ArtifactRenderer.jsx`**: Add source-attribution element: when `content.source` or `content.dataOrigin` is present, render a small label below the disclaimer showing the data origin (e.g., "Source: Porkbun Domain Availability API") with `data-testid="domain-source-attribution"`. For each signal, if `signal.renewalPrice` exists, show it below the main price in smaller text. If `signal.firstYearPromo` is truthy, show a small "PROMO" badge next to the price. Keep backward-compatible — missing fields render the same as before.

2. **Enhance `TrademarkSignalsRenderer` in `ArtifactRenderer.jsx`**: Add source-attribution element: when `content.dataOrigin` is present, render it below the disclaimer with `data-testid="trademark-source-attribution"`. When `content.sourceNote` is present, show it as a secondary advisory line below the disclaimer. Keep backward-compatible.

3. **Add renderer tests to `src/lumon/__tests__/artifact-renderer.test.jsx`**: Add new describe blocks:
   - "DomainSignalsRenderer — real Porkbun data": test with content shape matching real Porkbun API output (including `renewalPrice`, `regularPrice`, `firstYearPromo`, `premium`, `registrar: "Porkbun"`, `source: "porkbun-api"`, `dataOrigin: "Porkbun Domain Availability API"`). Assert source attribution renders. Assert renewal price displays. Assert promo badge shows for promotional domains. Assert backward compatibility: old simulated data shape still renders identically (no source attribution when `source`/`dataOrigin` missing).
   - "TrademarkSignalsRenderer — enhanced advisory": test with D026-compliant content including `dataOrigin` and `sourceNote`. Assert source attribution renders. Assert sourceNote renders. Assert backward compatibility.

4. **Write `server/__tests__/porkbun-live.test.js`**: A live integration test gated behind `PORKBUN_LIVE_TEST` env var. When enabled, it:
   - Calls the real Porkbun ping endpoint (`POST https://api.porkbun.com/api/json/v3/ping`) with credentials from env to verify API connectivity
   - Calls `checkDomain` for `example.com` and asserts response has `status: "SUCCESS"`, `response.avail` is a string, `response.price` is a string
   - When `PORKBUN_LIVE_TEST` is not set, the entire test file is skipped with `describe.skipIf(!process.env.PORKBUN_LIVE_TEST)`

5. **Verify no regressions**: Run the full existing renderer test suite and all server tests to confirm nothing breaks.

## Must-Haves

- [ ] DomainSignalsRenderer shows source attribution when `dataOrigin` is present
- [ ] DomainSignalsRenderer shows renewal price and promo badge when enriched fields are present
- [ ] TrademarkSignalsRenderer shows source attribution and source note when present
- [ ] Both renderers remain backward-compatible — old data shapes render unchanged
- [ ] Renderer tests cover real Porkbun data shapes and backward compatibility
- [ ] Live Porkbun test exists and is gated behind `PORKBUN_LIVE_TEST` env var
- [ ] All existing tests pass without regressions

## Verification

- `npx vitest run src/lumon/__tests__/artifact-renderer.test.jsx` — all tests pass including new real-data-shape tests
- `npx vitest run server/__tests__/porkbun-live.test.js` — test is skipped when `PORKBUN_LIVE_TEST` is unset (no failures)
- `npx vitest run` — full test suite passes with zero regressions

## Inputs

- `src/features/mission-control/ArtifactRenderer.jsx` — existing DomainSignalsRenderer and TrademarkSignalsRenderer to enhance
- `src/lumon/__tests__/artifact-renderer.test.jsx` — existing renderer test file to extend
- `server/__tests__/porkbun-credential-injection.test.js` — T01 output, for test pattern reference
- `n8n/workflows/plan-domain-signals.json` — T02 output, for real Porkbun data shape reference

## Expected Output

- `src/features/mission-control/ArtifactRenderer.jsx` — enhanced with source attribution, renewal price display, promo badge
- `src/lumon/__tests__/artifact-renderer.test.jsx` — extended with real Porkbun data shape tests and backward compatibility tests
- `server/__tests__/porkbun-live.test.js` — new live integration test file (env-gated)
