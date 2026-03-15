---
id: T04
parent: S01
milestone: M002
provides:
  - "Importable n8n workflow JSON at n8n/workflows/intake-viability.json with 6 nodes: Webhook Trigger, Respond, Viability Analysis (Code), Callback to Bridge (HTTP), Wait for Approval, Post Approval"
  - "n8n/README.md with setup instructions, flow diagram, and troubleshooting table"
  - "S01-UAT.md documenting full trigger→callback→approve and trigger→callback→reject loops verified against live n8n"
key_files:
  - n8n/workflows/intake-viability.json
  - n8n/README.md
  - server/routes/pipeline.js
  - server/pipeline.js
  - .gsd/milestones/M002/slices/S01/S01-UAT.md
key_decisions:
  - "Execution record created before calling n8n webhook so executionId can be passed to n8n and echoed back in callback"
  - "Callback URL hardcoded to host.docker.internal:3001 in workflow template instead of using $env (n8n blocks env var access by default)"
  - "Added pipeline.recordFailure() to mark executions as failed when n8n is unreachable after trigger"
patterns_established:
  - "n8n workflow templates stored in n8n/workflows/ as importable JSON files"
  - "Wait node resume webhook (resumeUrl) as the approval primitive — bridge stores the URL from callback and GETs it on approve"
observability_surfaces:
  - "n8n execution status visible via n8n REST API at /rest/executions"
  - "pipeline.recordFailure() adds failureReason and completedAt to execution records for post-mortem inspection"
  - "GET /api/pipeline/status/:projectId shows resumeUrl when awaiting approval"
duration: 1 session
verification_result: passed
completed_at: 2026-03-15
blocker_discovered: false
---

# T04: n8n workflow template and end-to-end integration proof

**Shipped importable n8n workflow for intake/viability stage and proved the full trigger→execute→callback→approve/reject loop against a live n8n instance.**

## What Happened

Built the n8n workflow template with 6 nodes covering the complete intake/viability stage lifecycle. The workflow receives a project trigger via webhook, runs a viability analysis (Code node generating market assessment, technical feasibility, risk factors, and recommendation), calls back to the bridge server with structured results and the Wait node's resumeUrl, then pauses for operator approval.

Refactored the bridge trigger handler to create the execution record *before* calling n8n, so the executionId flows through the entire chain: bridge → n8n → callback → bridge. This was necessary because n8n needs to echo back the executionId in its callback so the bridge can match it to the right execution.

Added `pipeline.recordFailure()` to properly mark executions as failed when n8n is unreachable, rather than leaving them in "triggered" state forever.

Ran the full integration against a live n8n Docker container: trigger fires webhook → n8n analyzes → callback stores artifact → execution pauses at Wait → approve calls resumeUrl → n8n resumes → execution completes. Both approve and reject paths verified.

## Verification

- `npx vitest run` — **75 tests pass** across 10 test files (all existing tests backward-compatible)
- API-level integration verified with curl against live n8n (Docker) + bridge server:
  - Trigger: `POST /api/pipeline/trigger` → n8n webhook fires → returns `{executionId, status: "triggered"}`
  - Callback: n8n posts structured result → artifact stored → status → `awaiting_approval` → resumeUrl populated
  - Approve: `POST /api/pipeline/approve` → resumeUrl called → n8n execution completes (`status: success`) → bridge status → `approved`
  - Reject: `POST /api/pipeline/approve decision=rejected` → status → `rejected` → n8n execution left waiting
- n8n workflow imports and activates via REST API without errors
- Artifacts persisted to disk with full structured viability content (4 sections, scores, key findings)

## Diagnostics

- `GET /api/pipeline/status/:projectId` — shows `resumeUrl` field when awaiting approval, `failureReason` when failed
- n8n execution history at `http://localhost:5678` UI or `/rest/executions` API — shows waiting/success/error status
- Artifact content via `GET /api/artifacts/:id` — includes `metadata.engine: "n8n-intake-v1"` for n8n-generated artifacts
- Bridge logs: `[bridge] POST /api/pipeline/trigger projectId=X stageKey=Y executionId=Z` traces the full flow

## Deviations

- **Trigger handler refactored** — moved execution creation before the n8n webhook call (was after). This is a behavioral improvement, not a plan deviation — the original order couldn't pass executionId to n8n.
- **`$env` replaced with hardcoded URL** — n8n blocks environment variable access by default. Workflow template uses `http://host.docker.internal:3001` directly instead of `$env.LUMON_BRIDGE_URL`. README documents how to change it.
- **Browser-level UI flow not fully exercised** — API-level integration was fully proven. Dashboard UI flow (clicking Trigger Discovery button in browser) was started but not completed within time budget. The buttons dispatch to the same API wrappers verified at the API level.

## Known Issues

- n8n Wait node webhook URL uses `localhost:5678` which only works when bridge runs on the same host as the Docker port mapping. Cross-host deployments would need URL rewriting.
- Old test artifacts in `server/data/` from API-level integration testing persist on disk (not auto-cleaned).

## Files Created/Modified

- `n8n/workflows/intake-viability.json` — importable n8n workflow with 6 nodes for intake/viability stage
- `n8n/README.md` — setup instructions, flow diagram, troubleshooting guide
- `server/routes/pipeline.js` — refactored trigger handler to create execution before calling n8n, passes executionId in webhook payload
- `server/pipeline.js` — added `recordFailure()` for marking failed executions, removed unused `n8nExecutionId` param from `trigger()`
- `.gsd/milestones/M002/slices/S01/S01-UAT.md` — documented end-to-end integration proof with pass/fail for each step
