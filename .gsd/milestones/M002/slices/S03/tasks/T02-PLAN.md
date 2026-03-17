---
estimated_steps: 4
estimated_files: 4
---

# T02: Create n8n workflow templates for plan sub-stages

**Slice:** S03 — Naming & Brand Signal Stages
**Milestone:** M002

## Description

Create three n8n workflow JSON templates for the plan stage sub-workflows: naming candidates generation, domain availability signals, and trademark search signals. Each follows the proven 4-node Webhook→Respond→Code→Callback pattern established by the existing templates. Update the n8n README with setup instructions for the new workflows.

These templates produce realistic mock data in their Code nodes. In production, the domain and trademark Code nodes would be replaced with real API calls (Domainr, USPTO TSDR, etc.), but for now they generate simulated data that matches the content schemas the client renderers expect.

**Important:** The naming workflow reads `context.selectedName` from the webhook payload — this is the operator's chosen name forwarded by the bridge server. The domain and trademark workflows also read the selected name from this context. The Code node in the naming workflow does NOT use context (it generates candidates), but the domain and trademark workflows need the selected name to generate per-name results.

## Steps

1. **Create `n8n/workflows/plan-naming-candidates.json`:**
   - 4-node workflow: Webhook Trigger → Respond to Webhook → Naming Candidates Analysis → Callback to Bridge
   - Webhook path: `lumon-plan-naming`
   - Code node generates 5-8 naming candidates as an array, each with: `{ name, rationale, domainHint, styleTags }`. Example candidates: "Nexus", "Aether", "Catalyst", etc. with realistic rationale and style tags.
   - Callback body sends: `{ executionId, projectId, stageKey, subStage: "naming_candidates", result: { type: "naming_candidates", content: { candidates: [...], methodology, generatedAt }, metadata: { engine: "n8n-plan-naming-v1" } } }`
   - Follow the exact JSON structure of `research-business-plan.json` for node types, versions, positions, and connections.

2. **Create `n8n/workflows/plan-domain-signals.json`:**
   - 4-node workflow: Webhook Trigger → Respond to Webhook → Domain Availability Check → Callback to Bridge
   - Webhook path: `lumon-plan-domain`
   - Code node reads `selectedName` from `$input.first().json.body.context?.selectedName` (fallback to a default name). Generates domain availability results for common TLDs (.com, .io, .dev, .co, .app, .ai): `{ domain, status: "available"|"taken"|"premium", price?, registrar? }`.
   - Callback sends artifact type `domain_signals` with content: `{ selectedName, signals: [...], checkedAt, disclaimer: "Domain availability is a point-in-time check. Results may change." }`

3. **Create `n8n/workflows/plan-trademark-signals.json`:**
   - 4-node workflow: Webhook Trigger → Respond to Webhook → Trademark Search → Callback to Bridge
   - Webhook path: `lumon-plan-trademark`
   - Code node reads `selectedName` from context (same as domain). Generates simulated trademark search results: `{ mark, status: "live"|"dead"|"pending", class, registrationNumber?, owner?, filingDate? }`.
   - Callback sends artifact type `trademark_signals` with content: `{ selectedName, signals: [...], searchedAt, disclaimer: "Trademark signals are advisory only and do not constitute legal advice. Consult a trademark attorney before proceeding." }`

4. **Update `n8n/README.md`:**
   - Add a new section "Plan Stage Workflows" after the existing flow diagram section with three workflow entries.
   - Document the env vars: `N8N_WEBHOOK_URL_PLAN_NAMING`, `N8N_WEBHOOK_URL_PLAN_DOMAIN`, `N8N_WEBHOOK_URL_PLAN_TRADEMARK`.
   - Note that domain and trademark workflows expect `context.selectedName` in the webhook payload (forwarded by the bridge after operator selection).
   - Keep the existing content intact — only append new sections.

## Must-Haves

- [ ] Three valid JSON workflow files in `n8n/workflows/`
- [ ] Each follows the 4-node Webhook→Respond→Code→Callback pattern
- [ ] Naming template generates 5+ candidates with rationale and style tags
- [ ] Domain template generates per-TLD availability with status badges
- [ ] Trademark template generates search results with status, class, and advisory disclaimer
- [ ] Callback URLs use `http://host.docker.internal:3001/api/pipeline/callback` (Docker convention)
- [ ] README updated with plan workflow documentation and env var names

## Verification

- `node -e "JSON.parse(require('fs').readFileSync('n8n/workflows/plan-naming-candidates.json'))"` — parses without error
- `node -e "JSON.parse(require('fs').readFileSync('n8n/workflows/plan-domain-signals.json'))"` — parses without error
- `node -e "JSON.parse(require('fs').readFileSync('n8n/workflows/plan-trademark-signals.json'))"` — parses without error
- Each workflow has 4 nodes and correct connection structure
- README has new plan workflow section

## Inputs

- `n8n/workflows/research-business-plan.json` — reference for JSON structure, node types, versions, and connection format
- `n8n/README.md` — current README to extend with new workflow documentation

## Expected Output

- `n8n/workflows/plan-naming-candidates.json` — importable n8n workflow with naming candidate generation
- `n8n/workflows/plan-domain-signals.json` — importable n8n workflow with domain availability simulation
- `n8n/workflows/plan-trademark-signals.json` — importable n8n workflow with trademark search simulation
- `n8n/README.md` — updated with plan stage workflow documentation and env vars
