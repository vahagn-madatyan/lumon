---
estimated_steps: 4
estimated_files: 4
---

# T04: n8n workflow template and end-to-end integration proof

**Slice:** S01 — Bridge Server & Intake Stage
**Milestone:** M002

## Description

Ship the importable n8n workflow JSON template for the intake/viability stage and prove the full trigger→execute→callback→display→approve loop in a real browser with a live n8n instance. This is the slice's integration closure — everything prior is proven through this end-to-end walkthrough.

## Steps

1. Create `n8n/workflows/intake-viability.json` — importable n8n workflow:
   - **Trigger node:** Webhook node that receives `{ projectId, stageKey }` from the bridge server's trigger endpoint
   - **Processing nodes:** Simple viability analysis logic (can be a Code node that generates a structured viability result with sections: market assessment, technical feasibility, risk factors, recommendation)
   - **Callback node:** HTTP Request node that POSTs the result back to the bridge server's callback endpoint: `{ executionId, projectId, stageKey, result: { ... }, resumeUrl: "{{ $execution.resumeUrl }}" }`
   - **Wait node:** Wait node that pauses for operator approval via resumeUrl
   - **Post-approval node:** Code node that logs approval received (later slices will extend this)
   - Use n8n's standard workflow JSON export format so it can be imported via the n8n UI
2. Create `n8n/README.md` — setup and usage instructions:
   - Prerequisites: n8n running locally (Docker or npm)
   - How to import the workflow template
   - How to configure the webhook URL in the bridge server's environment
   - How to configure the callback URL in the n8n workflow (pointing back to the bridge server)
   - Expected flow sequence with a diagram
3. Run the full end-to-end integration in the browser:
   - Start n8n locally, import the workflow, activate it
   - Start Lumon with `npm run dev`
   - Create or select a project in the dashboard
   - Click "Trigger Discovery" → verify n8n webhook fires
   - Verify n8n executes the viability analysis and sends callback
   - Verify the artifact appears in the dashboard with structured content
   - Click "Approve" → verify the resumeUrl is called and pipeline advances
   - Click "Reject" on a second run → verify the stage reflects rejection state
4. Document the integration proof in `.gsd/milestones/M002/slices/S01/S01-UAT.md`:
   - Record each step's observed behavior (pass/fail)
   - Note any issues found and how they were resolved
   - Capture the final working state as the acceptance baseline

## Must-Haves

- [ ] n8n workflow JSON imports cleanly into a fresh n8n instance
- [ ] Webhook trigger fires when Lumon bridge server calls it
- [ ] Viability result arrives at the bridge server via callback with structured content
- [ ] Artifact is visible and inspectable in the Lumon dashboard dossier view
- [ ] Approve action calls the resumeUrl and pipeline advances
- [ ] Reject action reflects rejection state in the dashboard
- [ ] Setup instructions in README are sufficient to reproduce the integration

## Verification

- n8n workflow imports without errors
- Full trigger→approve loop works in browser with live n8n
- Full trigger→reject loop works in browser with live n8n
- Artifact content is visible in the dashboard dossier stage section
- `S01-UAT.md` documents observed behavior for each step

## Inputs

- `server/routes/pipeline.js` — T01 + T03's API endpoints and SSE push
- `server/pipeline.js` — T01's execution state tracker with resumeUrl storage
- `src/lumon/sync.js` — T03's trigger/approve API wrappers
- `src/features/mission-control/DashboardTab.jsx` — T03's trigger/approve buttons
- D024 decision: n8n Wait node resumeUrl as the approval primitive

## Expected Output

- `n8n/workflows/intake-viability.json` — importable n8n workflow for intake/viability stage
- `n8n/README.md` — setup and usage instructions for the n8n integration
- `.gsd/milestones/M002/slices/S01/S01-UAT.md` — documented end-to-end integration proof
