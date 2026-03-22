---
estimated_steps: 4
estimated_files: 2
skills_used: []
---

# T02: Replace simulated n8n workflows with real Porkbun API calls and enhance trademark advisory signals

**Slice:** S01 — Live External Signal Gathering
**Milestone:** M005

## Description

The current n8n domain-signals workflow (`plan-domain-signals.json`) returns hardcoded simulated data. It must call the real Porkbun `checkDomain` API endpoint and translate responses into the shape the existing `DomainSignalsRenderer` expects (`{ domain, status, price }`). The trademark-signals workflow needs enhanced D026-compliant advisory framing with explicit data-origin labeling and strengthened non-legal disclaimers.

Key constraint: The Porkbun API hostname changed from `porkbun.com` to `api.porkbun.com`. The `checkDomain` endpoint is rate-limited to 1 check per 10 seconds, so the Code node must include delays between calls. Credentials come through the webhook input body (from T01's `fireWebhook()` injection), not from `$env`.

## Steps

1. **Rewrite the Code node in `plan-domain-signals.json`**: Replace the simulated data with real Porkbun API calls. The code must:
   - Read credentials from `$input.first().json.body.context.porkbunApiKey` and `.porkbunApiSecret`
   - If credentials are missing, fall back to the simulated data (so the workflow degrades gracefully without Porkbun API keys)
   - Build TLD list: `.com`, `.io`, `.dev`, `.co`, `.app`, `.ai`
   - For each TLD, call `POST https://api.porkbun.com/api/json/v3/domain/checkDomain/{baseName}.{tld}` with `{ apikey, secretapikey }` body
   - Wait 11 seconds between each check to respect rate limits (Porkbun: 1 check per 10 seconds)
   - Translate response: `avail === "yes"` → `status: "available"`, `premium === "yes"` → `status: "premium"`, else `status: "taken"`
   - Format price as `"$X.XX/yr"` from the numeric `price` field
   - Include enriched fields: `registrar: "Porkbun"`, `renewalPrice`, `regularPrice`, `premium`, `firstYearPromo`
   - Handle per-TLD errors: catch errors, add to `metadata.errors` array, continue with remaining TLDs
   - Set `metadata.engine: 'porkbun-live-v1'` and add `source: 'porkbun-api'` and `dataOrigin: 'Porkbun Domain Availability API'` to the result

2. **Update the callback URL hostname**: Verify the callback HTTP Request node uses `http://host.docker.internal:3001/api/pipeline/callback` (existing, should be correct).

3. **Update the Code node in `plan-trademark-signals.json`**: Keep the simulated trademark data but enhance advisory framing:
   - Update disclaimer: `"ADVISORY ONLY — These results are generated from a simulated database for planning purposes and do not constitute legal advice. They do not represent actual USPTO TESS search results. Consult a qualified trademark attorney before making any business decisions based on this information."`
   - Add `dataOrigin: "Simulated advisory database (not connected to USPTO TESS)"` to the output
   - Add `sourceNote: "Trademark signals are illustrative. Real trademark clearance requires professional legal search services."` to the output
   - Set `metadata.engine: 'n8n-plan-trademark-v2'` (version bump from v1)

4. **Verify JSON validity**: Ensure both workflow JSON files are valid JSON with properly escaped Code node strings.

## Must-Haves

- [ ] Domain workflow Code node calls real `api.porkbun.com` endpoint with credentials from input body
- [ ] Rate limiting: minimum 11 seconds between consecutive API calls
- [ ] Graceful degradation: falls back to simulated data when credentials are missing
- [ ] Error isolation: per-TLD errors don't fail the entire workflow
- [ ] Response translation: Porkbun `avail`/`premium` fields map to renderer-compatible `status` values
- [ ] Trademark workflow has D026-compliant enhanced advisory disclaimer with data-origin labeling
- [ ] Both workflow JSON files are syntactically valid

## Verification

- `node -e "const w = JSON.parse(require('fs').readFileSync('./n8n/workflows/plan-domain-signals.json', 'utf8')); const code = w.nodes.find(n => n.name === 'Domain Availability Check').parameters.jsCode; console.log(code.includes('api.porkbun.com') && code.includes('porkbunApiKey') ? 'PASS' : 'FAIL')"` prints `PASS`
- `node -e "const w = JSON.parse(require('fs').readFileSync('./n8n/workflows/plan-trademark-signals.json', 'utf8')); const code = w.nodes.find(n => n.name === 'Trademark Search').parameters.jsCode; console.log(code.includes('ADVISORY ONLY') && code.includes('dataOrigin') ? 'PASS' : 'FAIL')"` prints `PASS`
- `node -e "JSON.parse(require('fs').readFileSync('./n8n/workflows/plan-domain-signals.json', 'utf8')); JSON.parse(require('fs').readFileSync('./n8n/workflows/plan-trademark-signals.json', 'utf8')); console.log('VALID JSON')"` prints `VALID JSON`

## Inputs

- `n8n/workflows/plan-domain-signals.json` — existing simulated domain workflow to rewrite
- `n8n/workflows/plan-trademark-signals.json` — existing simulated trademark workflow to enhance
- `server/routes/pipeline.js` — reference for how credentials are injected into `body.context` (from T01)

## Expected Output

- `n8n/workflows/plan-domain-signals.json` — rewritten Code node with real Porkbun API calls, rate limiting, error handling, and graceful degradation
- `n8n/workflows/plan-trademark-signals.json` — enhanced Code node with D026-compliant advisory disclaimer, data-origin labeling, and version-bumped engine metadata
