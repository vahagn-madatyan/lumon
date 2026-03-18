# S04: Architecture Package & Full Pipeline Integration — UAT

**Milestone:** M002
**Written:** 2026-03-17

## UAT Type

- UAT mode: mixed (artifact-driven for contract verification + live-runtime for browser walkthrough)
- Why this mode is sufficient: Contract tests prove the full orchestration chain at the API level (223 tests). This UAT script covers the live browser experience to validate that the proven contracts manifest as usable UI.

## Preconditions

1. `npm run dev` running (starts both Vite dev server and Express bridge server)
2. n8n running locally via Docker with workflow templates imported from `n8n/workflows/`:
   - `intake-viability.json` (from S01)
   - `research-business-plan.json`, `research-tech-stack.json` (from S02)
   - `plan-naming-candidates.json`, `plan-domain-signals.json`, `plan-trademark-signals.json` (from S03)
   - `verification-architecture-outline.json`, `verification-specification.json`, `verification-prototype-scaffold.json` (from S04)
3. `.env` configured with `N8N_WEBHOOK_URL` pointing to n8n instance (e.g., `http://localhost:5678/webhook/...`)
4. Browser open at `http://localhost:5173`
5. No existing project state (clear localStorage or use incognito)

## Smoke Test

Create a new project via the intake modal, select it in the dashboard, click "Trigger Discovery" on the intake stage, and confirm a viability analysis artifact appears in the dossier within 10 seconds.

## Test Cases

### 1. Full Pipeline — Intake to Handoff-Ready

1. Create a new project ("UAT Test Project", engine: Claude Code)
2. Select the project in the dashboard
3. Click "Trigger Discovery" on the intake stage
4. Wait for viability analysis artifact to appear in the dossier
5. Click "Approve" on the intake stage
6. **Expected:** Research stage auto-triggers (no manual action required). Business plan and tech stack artifacts appear sequentially in the dossier.
7. Click "Approve" on the research stage
8. Trigger the plan stage manually (if not auto-triggered)
9. Wait for naming candidates to appear. Select a name from the candidate list.
10. **Expected:** Domain signals and trademark signals sub-stages fire automatically. Domain results show availability badges. Trademark results show status badges. Both include advisory disclaimers.
11. Click "Approve" on the plan stage
12. **Expected:** Verification stage auto-triggers. Architecture outline, specification, and prototype scaffold artifacts appear sequentially.
13. Click "Approve" on the verification stage
14. Switch to the Handoff subview
15. **Expected:** Handoff packet shows "ready" status. Packet sections include real artifacts from all 4 stages: viability analysis, business plan, tech stack, naming candidates, domain signals, trademark signals, architecture outline, specification, prototype scaffold.

### 2. Architecture Outline Renderer

1. Navigate to the dossier for a project that has completed the verification stage
2. Locate the architecture_outline artifact
3. **Expected:** Renders with sections: System Overview (text), Components (cards with name/responsibility/technology badge), Data Flow (text), Deployment Model (text), Recommendation (emerald-highlighted text)

### 3. Specification Renderer

1. Locate the specification artifact in the same dossier
2. **Expected:** Renders with sections: Functional Requirements (list with ID badges and priority color — high=red, medium=amber, low=zinc), Non-Functional Requirements (list), API Contracts (entries with HTTP method badges — GET=emerald, POST=blue, PUT=amber, DELETE=red), Recommendation

### 4. Prototype Scaffold Renderer

1. Locate the prototype_scaffold artifact in the same dossier
2. **Expected:** Renders with sections: Project Structure (preformatted/monospace), Entry Points (list), Dependencies (name + version badge), Setup Instructions (preformatted/monospace), Recommendation

### 5. Generalized Trigger Button

1. Create a new project but do NOT trigger intake
2. Observe the intake stage shows "Trigger Discovery" button
3. Trigger intake, complete callback, approve it
4. Observe the next queued stage (research) — if it has a webhook configured, it auto-triggers; if not, it should show "Trigger Discovery"
5. **Expected:** The trigger button appears for ANY stage with `status === "queued"`, not just intake

### 6. Rejection and Iteration

1. Start a new pipeline run (trigger intake, wait for callback)
2. Click "Reject" on the intake stage
3. **Expected:** Stage returns to a re-triggerable state
4. Click "Trigger Discovery" again on the rejected intake stage
5. Wait for new viability analysis artifact
6. **Expected:** New artifact appears alongside the first (artifacts accumulate, not replace)
7. Click "Approve"
8. **Expected:** Pipeline advances to research. Intake approval is recorded. Previous rejection does not block advancement.

### 7. Cross-Stage Rejection Isolation

1. Complete intake and let research auto-trigger
2. After research produces artifacts, click "Reject" on research
3. **Expected:** Intake remains approved with its artifacts intact. Rejecting research does not affect intake status or artifacts.
4. Re-trigger research, wait for new artifacts, approve
5. **Expected:** Pipeline continues normally to plan stage

## Edge Cases

### Offline Mode — Server Disconnected

1. Stop the Express server (kill the `npm run dev` process or just the server portion)
2. Observe the dashboard for the selected project
3. **Expected:** Offline banner with WifiOff icon appears (`data-testid="pipeline-actions-offline"`)
4. **Expected:** All pipeline action buttons (Trigger Discovery, Approve, Reject) are disabled
5. **Expected:** Previously loaded dossier content still renders from cache — artifacts are visible and browsable
6. Restart the server
7. **Expected:** Offline banner disappears, buttons re-enable

### Offline Mode — Cached Dossier Browsing

1. Complete at least the intake stage with artifacts visible in the dossier
2. Stop the server
3. Navigate between Overview, Dossier, and Handoff subviews
4. **Expected:** All three subviews render without errors. Dossier shows cached artifact content. No loading spinners or error states for previously fetched artifacts.

### Triple Rejection Recovery

1. Trigger intake
2. After callback, reject
3. Re-trigger, after callback, reject again
4. Re-trigger a third time, after callback, approve
5. **Expected:** 3 artifacts accumulated for the intake stage (one from each iteration). Final status is approved. Pipeline advances normally.

### n8n Unreachable During Trigger

1. Ensure n8n is not running but the bridge server IS running
2. Click "Trigger Discovery"
3. **Expected:** Server returns a 502 error with failure reason. The trigger button remains available for retry. `pipeline.recordFailure()` stores the failureReason on the execution record.

## Failure Signals

- Any pipeline action button enabled when the server is disconnected
- Artifacts from a previous iteration disappearing after rejection and re-trigger
- Approving a stage that doesn't auto-trigger the next expected stage (intake→research, plan→verification)
- Verification sub-stages appearing out of order (must be architecture_outline → specification → prototype_scaffold)
- Handoff packet showing "missing" for any section after all 4 stages are approved
- Offline banner not appearing within 5 seconds of server disconnection
- Any of the 223 contract tests failing

## Requirements Proved By This UAT

- R004 — Reject→re-trigger→approve lifecycle proven; state advances only through explicit approval gates
- R005 — Viability assessment is the first artifact, produced before any downstream work
- R006 — Business plan artifact visible in dossier and handoff packet
- R007 — Tech stack research artifact visible in dossier and handoff packet
- R008 — Naming candidates render as a selectable list; selection triggers downstream stages
- R009 — Domain availability and trademark signals display with advisory labels and disclaimers
- R010 — Handoff packet contains real architecture, specification, and prototype artifacts from all stages
- R018 — All stage transitions require explicit operator approval (trigger and approve are separate actions)
- R019 — n8n orchestrates the full pipeline with 9 workflow templates across 4 stages

## Not Proven By This UAT

- **R010 completeness at M003 level** — handoff packet structure is proven but artifact content is mock-generated by n8n templates, not from real AI research. M003 needs real content flowing through.
- **Concurrent execution handling** — if two triggers fire simultaneously for the same stage, behavior is undefined. Not tested.
- **Server restart resilience** — in-memory execution state is lost on server restart. Artifacts survive (disk-persisted) but active pipeline state does not.
- **Production deployment** — only tested with local dev server. No production build serving has been exercised.

## Notes for Tester

- The `csstree-match BREAK after 15000 iterations` stderr warnings in test output are from the CSS parser in jsdom — they are harmless and do not indicate failures.
- The n8n workflow templates generate realistic but hardcoded mock data. The "research" and "analysis" content is illustrative, not from real AI processing.
- Domain availability and trademark signal values are simulated — they don't query real registrars or trademark databases.
- The bundle size warning during `npx vite build` (chunk >500KB) is known and deferred to a future milestone for code-splitting.
- When testing offline mode, give the SSE reconnection logic ~3-5 seconds to detect the disconnect and update the UI.
