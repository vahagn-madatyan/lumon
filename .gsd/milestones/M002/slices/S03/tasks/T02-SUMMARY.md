---
id: T02
parent: S03
milestone: M002
provides:
  - Three n8n workflow JSON templates for plan sub-stages (naming_candidates, domain_signals, trademark_signals)
  - n8n README documentation for plan stage workflows with env var references
key_files:
  - n8n/workflows/plan-naming-candidates.json
  - n8n/workflows/plan-domain-signals.json
  - n8n/workflows/plan-trademark-signals.json
  - n8n/README.md
key_decisions:
  - Naming workflow generates 6 candidates (within 5-8 range) with rationale, domainHint, and styleTags fields
  - Domain/trademark Code nodes read selectedName from body.context?.selectedName with fallback to "Nexus" for standalone testing
patterns_established:
  - Plan sub-stage workflows follow identical 4-node Webhook→Respond→Code→Callback pattern as research templates with same node type versions and connection structure
observability_surfaces:
  - JSON parse validation: `node -e "JSON.parse(require('fs').readFileSync('n8n/workflows/plan-*.json'))"`
  - Webhook path grep: `grep '"path"' n8n/workflows/plan-*.json` verifies paths match STAGE_ENV_MAP compound keys
  - Callback URL consistency: `grep "host.docker.internal" n8n/workflows/plan-*.json`
duration: 8m
verification_result: passed
completed_at: 2026-03-16
blocker_discovered: false
---

# T02: Create n8n workflow templates for plan sub-stages

**Created three n8n workflow JSON templates (naming candidates, domain signals, trademark signals) following the 4-node Webhook→Respond→Code→Callback pattern with realistic mock data, plus README documentation.**

## What Happened

Created three workflow templates that match the exact JSON structure of the existing `research-business-plan.json` reference (same node types, versions, positions, and connection format):

1. **plan-naming-candidates.json** — Code node generates 6 naming candidates (Nexus, Aether, Catalyst, Meridian, Loom, Stratum) each with rationale, domainHint, and styleTags. Callback sends `naming_candidates` artifact type with methodology field.

2. **plan-domain-signals.json** — Code node reads `context.selectedName` from webhook payload (fallback: "Nexus"), generates domain availability for 6 TLDs (.com, .io, .dev, .co, .app, .ai) with status (available/taken/premium), registrar, and price. Includes point-in-time disclaimer.

3. **plan-trademark-signals.json** — Code node reads `context.selectedName`, generates 5 simulated trademark records with mark, status (live/dead/pending), class, registrationNumber, owner, and filingDate. Includes legal advisory disclaimer.

Updated `n8n/README.md` with a "Plan Stage Workflows" section documenting import steps, webhook paths, env vars (`N8N_WEBHOOK_URL_PLAN_NAMING`, `N8N_WEBHOOK_URL_PLAN_DOMAIN`, `N8N_WEBHOOK_URL_PLAN_TRADEMARK`), context forwarding behavior, and an ASCII flow diagram.

## Verification

- ✅ All three JSON files parse without error (`node -e "JSON.parse(...)"``)
- ✅ Each workflow has exactly 4 nodes and 2 connection sources (Webhook fan-out + Code→Callback)
- ✅ All callback URLs use `http://host.docker.internal:3001/api/pipeline/callback`
- ✅ Webhook paths: `lumon-plan-naming`, `lumon-plan-domain`, `lumon-plan-trademark`
- ✅ Naming: 6 candidates with rationale and styleTags
- ✅ Domain: 6 TLDs with status badges
- ✅ Trademark: disclaimer includes "do not constitute legal advice"
- ✅ README has plan workflow section with all 3 env vars documented
- ✅ `npx vitest run` — 150 tests pass (zero regressions)
- ✅ `npx vite build` — production build succeeds

## Diagnostics

- **Template validation:** `node -e "JSON.parse(require('fs').readFileSync('n8n/workflows/plan-naming-candidates.json'))"` (same for domain/trademark)
- **Webhook path audit:** `grep '"path"' n8n/workflows/plan-*.json` — verify paths match T01's STAGE_ENV_MAP compound keys
- **Callback URL audit:** `grep -r "host.docker.internal" n8n/workflows/plan-*.json` — all must show exactly 1 match each
- **Content schema inspection:** Import into n8n, execute manually, inspect output JSON shape for candidate/signal arrays

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `n8n/workflows/plan-naming-candidates.json` — new: 4-node naming candidates workflow template
- `n8n/workflows/plan-domain-signals.json` — new: 4-node domain availability workflow template
- `n8n/workflows/plan-trademark-signals.json` — new: 4-node trademark search workflow template
- `n8n/README.md` — added Plan Stage Workflows section with env vars, context forwarding docs, and flow diagram
- `.gsd/milestones/M002/slices/S03/tasks/T02-PLAN.md` — added Observability Impact section (pre-flight fix)
