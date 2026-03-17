---
id: T01
parent: S04
milestone: M002
provides:
  - Verification stage sequential orchestration (architecture_outline → specification → prototype_scaffold)
  - Auto-trigger from plan approval to verification
  - Three n8n workflow templates for verification sub-stages
  - 26 contract tests covering config, webhooks, orchestration, auto-trigger, failure recording, and backward compatibility
key_files:
  - server/config.js
  - server/routes/pipeline.js
  - server/__tests__/verification-pipeline.test.js
  - n8n/workflows/verification-architecture-outline.json
  - n8n/workflows/verification-specification.json
  - n8n/workflows/verification-prototype-scaffold.json
  - n8n/README.md
key_decisions:
  - Verification sub-stages follow the exact same orchestration pattern as research and plan (compound webhooks, sequential callback chaining, context forwarding)
patterns_established:
  - Third stage (verification) reuses the same sequential orchestration pattern, confirming the pattern is stable and generalizable
observability_surfaces:
  - "[bridge] sequential-next subStage=specification after=architecture_outline" log lines trace verification chain
  - "[bridge] auto-trigger verification after plan approval" log on plan→verification transition
  - pipeline.recordFailure() stores failureReason for failed verification webhook calls
  - GET /api/pipeline/status/:projectId returns verification execution records with subStage field
duration: 12m
verification_result: passed
completed_at: 2026-03-16
blocker_discovered: false
---

# T01: Wire verification stage orchestration and ship n8n workflow templates

**Extended bridge server with verification stage orchestration (architecture_outline → specification → prototype_scaffold), auto-trigger from plan approval, three n8n workflow templates, and 26 contract tests.**

## What Happened

Added `VERIFICATION_SUB_STAGES` to `server/config.js` with 4 compound `STAGE_ENV_MAP` entries (verification + 3 sub-stages). Extended `server/routes/pipeline.js` in three places: (1) trigger handler defaults verification to `architecture_outline`, (2) callback handler chains verification sub-stages sequentially with context forwarding, (3) approve handler auto-triggers verification after plan approval when webhook is configured.

Created three n8n workflow templates following the established 4-node Webhook→Respond→Code→Callback pattern. Each generates realistic mock output: architecture outline (systemOverview, components, dataFlow, deploymentModel), specification (functional/non-functional requirements, API contracts), and prototype scaffold (directory tree, entry points, dependencies, setup instructions).

Wrote 26 contract tests covering: config exports (2), compound webhook resolution (7), trigger defaults (2), sequential orchestration (4), context forwarding (2), auto-trigger from plan approval (3), failure recording (2), backward compatibility (4).

Updated `n8n/README.md` with verification stage documentation including flow diagram.

## Verification

- `npx vitest run server/__tests__/verification-pipeline.test.js` — 26 tests pass
- `npx vitest run` — 197 tests pass, zero failures (up from 171 baseline)
- All 3 n8n workflow JSON files parse as valid JSON with exactly 4 nodes each
- Observability log lines verified in test output: `sequential-next subStage=specification after=architecture_outline`, `auto-trigger verification after plan approval`

### Slice-level verification status (T01 is task 1 of 3):
- ✅ `npx vitest run` — 197 tests pass, zero regressions
- ✅ `server/__tests__/verification-pipeline.test.js` — all tests pass
- ✅ Failure-path verification: webhook failure recording tested (503 response + ECONNREFUSED)
- ⬜ `src/lumon/__tests__/artifact-renderer.test.jsx` — not yet extended (T02)
- ⬜ `src/lumon/__tests__/offline-mode.test.jsx` — not yet created (T02)
- ⬜ `server/__tests__/rejection-iteration.test.js` — not yet created (T03)
- ⬜ `server/__tests__/full-pipeline.test.js` — not yet created (T03)
- ⬜ `npx vite build` — not yet verified (T02/T03)

## Diagnostics

- **Sequential chain:** `[bridge] sequential-next subStage=specification after=architecture_outline` and `subStage=prototype_scaffold after=specification` log lines trace verification progression
- **Auto-trigger:** `[bridge] auto-trigger verification after plan approval projectId=<id>` log when plan is approved with webhook configured
- **Failure states:** `pipeline.recordFailure()` stores failureReason for any failed verification sub-stage webhook call; trigger endpoint returns 502 with reason
- **Status inspection:** `GET /api/pipeline/status/:projectId` returns verification execution records with subStage field

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `server/config.js` — Added VERIFICATION_SUB_STAGES export and 4 compound STAGE_ENV_MAP entries
- `server/routes/pipeline.js` — Added verification trigger default, callback sequential orchestration, plan→verification auto-trigger
- `server/__tests__/verification-pipeline.test.js` — New test file with 26 contract tests
- `n8n/workflows/verification-architecture-outline.json` — New 4-node workflow template
- `n8n/workflows/verification-specification.json` — New 4-node workflow template
- `n8n/workflows/verification-prototype-scaffold.json` — New 4-node workflow template
- `n8n/README.md` — Added verification stage documentation section with flow diagram
- `.gsd/milestones/M002/slices/S04/S04-PLAN.md` — Added failure-path verification step; marked T01 done
