# S03: Naming & Brand Signal Stages — UAT

**Milestone:** M002
**Written:** 2026-03-16

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: S03 is contract-proven through 171 passing tests covering server orchestration, context forwarding, n8n templates, and all three renderers. Live n8n integration proof is deferred to S04. The test artifacts cover every claim in the slice plan.

## Preconditions

- Repository cloned and dependencies installed (`npm install`)
- Node.js available for template validation
- No running server required (all tests are self-contained with supertest)

## Smoke Test

Run `npx vitest run` — all 171 tests pass across 13 files with zero failures. This confirms the entire S01+S02+S03 contract chain is intact.

## Test Cases

### 1. Plan sub-stage sequential orchestration

1. Open `server/__tests__/naming-pipeline.test.js`
2. Run `npx vitest run server/__tests__/naming-pipeline.test.js`
3. **Expected:** 29 tests pass. Log output shows:
   - `[bridge] sequential-next subStage=domain_signals after=naming_candidates`
   - `[bridge] sequential-next subStage=trademark_signals after=domain_signals`
   - No sequential-next after trademark_signals (last in chain)

### 2. Compound webhook registry lookup

1. Run naming-pipeline tests and check the "compound webhook registry" describe block
2. **Expected:** Tests confirm:
   - `plan_naming_candidates` compound key resolves when env var set
   - `plan_domain_signals` and `plan_trademark_signals` compound keys resolve
   - Falls back to stage-level when no compound key
   - Falls back to global when neither compound nor stage
   - Returns null when nothing configured
   - Backward compatible — getWebhookUrl without subStage still works

### 3. Context forwarding through plan chain

1. Run naming-pipeline tests and check "context forwarding" and "context in webhook POST body" describe blocks
2. **Expected:** Tests confirm:
   - Context from trigger propagates to auto-fired next sub-stage
   - Null context does not break sequential orchestration
   - Context included in webhook POST body when truthy
   - Context omitted from webhook POST body when not provided
   - Context forwarded in auto-fire webhook call after naming callback

### 4. Plan trigger defaults to naming_candidates

1. Run naming-pipeline tests and check "plan trigger defaults" describe block
2. **Expected:** Tests confirm:
   - Plan stage defaults to naming_candidates when no subStage provided
   - Explicit subStage preserved when provided
   - Research still defaults to business_plan (regression guard)

### 5. NamingCandidatesRenderer with interactive selection

1. Run `npx vitest run src/lumon/__tests__/artifact-renderer.test.jsx`
2. **Expected:** 40 tests pass. NamingCandidatesRenderer tests confirm:
   - Renders candidate names, rationale, and domain hints
   - Renders style tag badges per candidate
   - Select buttons call onAction with `{ type: "select-name", selectedName: "CandidateName" }`
   - Select buttons render disabled when onAction not provided
   - Optional methodology section renders when present
   - ArtifactRenderer dispatches naming_candidates type correctly

### 6. DomainSignalsRenderer with advisory disclaimer

1. Check artifact-renderer tests for DomainSignalsRenderer describe block
2. **Expected:** Tests confirm:
   - Renders selected name header
   - Per-TLD signal rows with status badges (emerald for available, red for taken, amber for premium)
   - Price displays when present
   - Advisory disclaimer banner present with data-testid="domain-advisory-disclaimer"
   - ArtifactRenderer dispatches domain_signals type correctly

### 7. TrademarkSignalsRenderer with advisory disclaimer

1. Check artifact-renderer tests for TrademarkSignalsRenderer describe block
2. **Expected:** Tests confirm:
   - Renders selected name header
   - Trademark signal rows with mark, class, status badges (red for live, zinc for dead, amber for pending)
   - Registration number and owner display when present
   - Advisory disclaimer banner present with data-testid="trademark-advisory-disclaimer"
   - ArtifactRenderer dispatches trademark_signals type correctly

### 8. triggerPipeline extra body support

1. Check `src/lumon/sync.js` — triggerPipeline function
2. Run server-sync tests: `npx vitest run src/lumon/__tests__/server-sync.test.js`
3. **Expected:** 8 tests pass. triggerPipeline accepts optional third argument that spreads into POST body. Existing two-arg calls unaffected.

### 9. n8n workflow template validity

1. Run: `for f in n8n/workflows/plan-*.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8')); console.log('VALID: $f')"; done`
2. **Expected:** All three files print VALID
3. Check naming template: `node -e "const w=JSON.parse(require('fs').readFileSync('n8n/workflows/plan-naming-candidates.json')); console.log('Candidates:', w.nodes.find(n=>n.type==='n8n-nodes-base.code').parameters.jsCode.includes('candidates'))"`
4. **Expected:** Prints `Candidates: true`
5. Verify callback URLs: `grep "host.docker.internal" n8n/workflows/plan-*.json | wc -l`
6. **Expected:** 3 (one per template)

### 10. Production build

1. Run `npx vite build`
2. **Expected:** Build succeeds with no errors. Output shows JS and CSS bundles.

### 11. Backward compatibility — no regressions

1. Run `npx vitest run server/__tests__/pipeline-api.test.js server/__tests__/research-pipeline.test.js`
2. **Expected:** 15 pipeline-api tests and 18 research-pipeline tests pass unchanged. No regressions from plan additions.

## Edge Cases

### Context with null/undefined values

1. Trigger plan stage with context: `{ selectedName: null }`
2. **Expected:** Context stored as-is, no crash. Downstream sub-stages receive the null context without breaking sequential orchestration. Proven in naming-pipeline test "null context does not break sequential orchestration".

### Plan trigger without subStage

1. POST to `/api/pipeline/trigger` with `{ projectId: "x", stageKey: "plan" }` (no subStage)
2. **Expected:** Defaults to naming_candidates sub-stage automatically. Proven in naming-pipeline test "defaults plan stage to naming_candidates when no subStage provided".

### NamingCandidatesRenderer without onAction

1. Render NamingCandidatesRenderer without passing onAction prop
2. **Expected:** Select buttons render but are disabled (not clickable). No console errors. Proven in artifact-renderer test.

### Trademark signals with missing optional fields

1. Render TrademarkSignalsRenderer with signals that omit registrationNumber and owner
2. **Expected:** Rows render without those fields, no crash. Proven in artifact-renderer test.

## Failure Signals

- `npx vitest run` reports any test failures — indicates regression or broken contract
- `npx vite build` fails — indicates import/export or type error in new renderers
- n8n JSON files fail `JSON.parse` — indicates malformed template
- Missing `data-testid="domain-advisory-disclaimer"` or `data-testid="trademark-advisory-disclaimer"` — indicates D026 compliance failure
- `[bridge] sequential-next` log lines missing from test output — indicates plan orchestration chain broken
- naming-pipeline backward compatibility tests fail — indicates S01/S02 regression

## Requirements Proved By This UAT

- R008 — Naming candidates generate as structured artifacts, render as selectable list, operator selection triggers downstream signals
- R009 — Domain and trademark signals render with status badges and mandatory advisory disclaimers (D026)
- R019 — n8n orchestration extended to plan stage with three sub-workflows, compound webhook routing, and context forwarding

## Not Proven By This UAT

- Live n8n execution of plan sub-workflows (deferred to S04)
- End-to-end pipeline from intake through plan approval in the browser (deferred to S04)
- Plan artifacts accumulating into the handoff packet evidence sections (deferred to S04)
- Offline/disconnected mode for plan artifacts (deferred to S04)
- Rejection and re-trigger flows for plan stage (deferred to S04)

## Notes for Tester

- The `csstree-match BREAK after 15000 iterations` stderr warnings in some test output are a known jsdom/CSS parsing quirk — they do not indicate test failures.
- All server tests use supertest with ephemeral Express instances — no running server needed.
- The naming-pipeline tests use project IDs prefixed with `proj-plan-*` and `proj-ctx-*` to avoid collision with other test suites.
- Advisory disclaimers are intentionally prominent (amber border) per D026. They are not optional or removable.
