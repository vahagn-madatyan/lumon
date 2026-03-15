# M002: Discovery & Approval Pipeline — Research

**Date:** 2026-03-15

## Summary

M002 must bridge the gap between a proven client-only control surface (M001) and a real orchestrated discovery pipeline backed by n8n. The core integration contract is: Lumon triggers an n8n workflow via webhook, n8n executes stage work (research, naming, domain checks, etc.), pauses at a Wait node for operator approval, Lumon displays the stage output and posts back to `$execution.resumeUrl` to advance. This webhook-pause-resume loop is the atomic primitive that everything else builds on.

The biggest structural gap is that M001 is entirely client-side (React + localStorage, zero server). M002 requires a thin API layer between the Lumon frontend and n8n — the frontend cannot hold n8n credentials, manage approval resume URLs, or persist artifact payloads that exceed localStorage limits. This server is the foundational risk and should be proven first.

**Primary recommendation:** Start with the n8n↔Lumon synchronization contract — a minimal server that can trigger an n8n webhook, store the execution ID and resume URL, receive stage results via callback, and push state into the existing Lumon reducer. Prove this with a single discovery stage before expanding to the full pipeline. Keep the existing M001 stage taxonomy as the outer pipeline skeleton and layer n8n sub-workflows within stages.

## Recommendation

**Approach: Thin bridge server + n8n webhook-pause-resume contract**

1. Add a lightweight local server (Express or Hono) that Vite proxies to during dev. This server manages n8n communication, artifact persistence, and approval resume state.
2. Use n8n Webhook trigger nodes to start discovery stages. n8n Wait nodes pause at each approval gate and provide `$execution.resumeUrl` for Lumon to call when the operator approves.
3. Keep the existing `src/lumon/*` state spine as the authoritative client-side model. The server pushes stage results into the client via SSE or polling, and the reducer handles them through existing `updateStage` actions.
4. Stage outputs become structured artifact records (not single strings) stored server-side with lightweight references in the client state.
5. Prove the loop with one real stage (viability analysis), then extend to research, naming, domain/trademark, and architecture stages.

**Why this order:** The n8n↔Lumon sync contract is the risk. If that loop works, adding more stages is additive. If it doesn't, nothing else matters.

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| Workflow orchestration with pause/resume | n8n Wait node + `$execution.resumeUrl` | Built-in webhook-based approval gates — exactly the operator-approval pattern Lumon needs. Rolling custom orchestration would duplicate n8n's core value. |
| Domain availability checks | Domainr API (via RapidAPI) or WhoisFreaks API | Reliable availability + suggestion APIs with free tiers. n8n has HTTP Request nodes that can call these directly. |
| Trademark/status lookups | Marker API (markerapi.com) or USPTO TSDR API | Marker provides simple REST search against USPTO data. USPTO TSDR offers programmatic access to trademark case status. Both can be called from n8n HTTP Request nodes. |
| Sub-workflow composition | n8n Execute Sub-workflow node | n8n natively supports parent→child workflow calls with data passing. Each discovery stage can be a separate sub-workflow called from a master pipeline workflow. |
| Dev server proxy | Vite `server.proxy` config | Vite already supports proxying API routes to a backend server during dev. Avoids CORS complexity and keeps the frontend build unchanged. |

## Existing Code and Patterns

- `src/lumon/model.js` — **Core reuse target.** Stage taxonomy (`LUMON_PREBUILD_STAGE_KEYS`), approval states, and factory functions (`createPipelineStage`, `createApprovalState`) are stable contracts. M002 should extend, not replace these. The `stage.output` field (currently a string) needs to become a richer artifact reference.
- `src/lumon/reducer.js` — **`updateStage` action** already accepts arbitrary stage changes including approval state mutations. The server can push n8n results through this action path. No new reducer actions needed for basic stage sync.
- `src/lumon/selectors.js` — **Dossier and handoff packet derivation** already reads from `stage.output` and approval state. Once stage outputs carry real artifacts, the existing selector chain will surface them in the UI without dossier-specific changes.
- `src/lumon/context.jsx` — **Provider boundary** with effect-driven persistence. The `useLumonActions().updateStage()` hook is the natural injection point for server-pushed stage results.
- `src/lumon/persistence.js` — **localStorage envelope** with versioned format. Currently stores the full state tree. Large artifacts will need to live server-side with lightweight client references, or the localStorage payload will exceed browser limits.
- `src/features/mission-control/DashboardTab.jsx` — **Dossier and handoff panels** already render per-stage output cards with approval badges, detail state indicators, and missing-state diagnostics. M002 should add artifact rendering into these existing cards rather than creating parallel views.
- `src/lumon/seed.js` — **Demo data** uses synthetic stage outputs. M002 seed data should include at least one project with realistic n8n-populated stage artifacts so the control surface is exercisable without a live n8n instance.

## Constraints

- **No server exists.** M001 is entirely client-side. The first M002 slice must introduce a server before any n8n integration is possible. This is the critical path.
- **localStorage has ~5-10MB limit.** Stage artifacts from research, business plans, and architecture outputs will exceed this quickly if stored inline. Artifacts must live server-side with client-side references.
- **n8n must be running locally or self-hosted.** The integration assumes the operator has a reachable n8n instance. The server needs configurable n8n base URL and API credentials. Offline/disconnected mode should degrade gracefully (show cached results, disable trigger controls).
- **Stage taxonomy is a stable contract** (D016, D017). The 6-stage model (intake, research, plan, wave-*, verification, handoff) has stable IDs and gate contracts. M002 should not rename or reorder these stages — instead, layer sub-stage detail within them.
- **Approval gates are operator-controlled** (D002, D005). n8n Wait nodes model this perfectly, but the resume URL must only be callable from Lumon's approval action — never auto-resumed.
- **The Severance floor, orchestration view, and dashboard all consume the same selector-owned view models.** Any state shape changes must flow through the existing selector chain or all surfaces break.
- **React 19 + Vite 7 + Vitest 4** — the test harness is jsdom-based with RTL. Server-side code needs its own test approach (Vitest can run both).
- **n8n sub-workflow executions don't count toward execution limits.** This makes modular per-stage sub-workflows cost-effective and composable.

## Common Pitfalls

- **Trying to build the full pipeline before proving the sync loop.** If the webhook→Wait→resumeUrl contract between Lumon and n8n doesn't work cleanly, nothing downstream matters. Prove one stage end-to-end first.
- **Making the server a full REST CRUD backend.** The server exists to bridge n8n and the client. It needs: trigger endpoint, callback/result endpoint, approval-resume endpoint, artifact storage, and SSE/poll for client push. Don't add project CRUD that duplicates the client-side reducer.
- **Storing artifacts in localStorage.** Research outputs, business plans, and architecture docs can easily be 50-100KB each. With multiple projects and stages, localStorage will fill. Store artifacts on disk or SQLite server-side, reference by ID client-side.
- **Overstating domain/trademark certainty.** Domain availability is point-in-time and advisory. Trademark results are not legal clearance. The UI must clearly label these as "signals" not "clearance." (R009 explicitly flags this.)
- **Auto-advancing past approval gates.** The n8n Wait node naturally pauses, but a bug in the resume handler could skip gates. Every resume call must validate that the operator explicitly approved — never fire-and-forget.
- **Breaking the existing selector chain.** The dossier, handoff packet, floor diagnostics, and dashboard all derive from `stage.output` and `stage.approval`. If the stage shape changes incompatibly, five surfaces break simultaneously. Extend the existing shape, don't replace it.
- **Hardcoding n8n workflow IDs.** Workflow IDs change between n8n instances and redeployments. The stage→workflow mapping should be configurable, not baked into source code.
- **Ignoring offline/disconnected mode.** If n8n is unreachable, the Lumon UI should still work for reviewing cached artifacts and previous results. Don't make every render depend on a live n8n connection.

## Open Risks

- **n8n Wait node resume URL lifetime.** Resume URLs are unique per execution. If an execution is cleaned up (by n8n's execution pruning or manual deletion), the resume URL becomes invalid. Lumon needs to detect stale resume URLs and re-trigger the workflow if needed.
- **Stage output schema evolution.** Moving from a string `output` field to structured artifacts is a schema change. Existing persisted state from M001 must survive the migration gracefully (treat string outputs as legacy format, coerce on read).
- **Research provider rate limits and costs.** Domain availability APIs (Domainr, WhoisFreaks) and trademark APIs (Marker) have rate limits and credit-based pricing. The n8n workflows need to handle rate-limit errors and surface them as stage warnings, not pipeline failures.
- **n8n version compatibility.** The Wait node and webhook patterns are stable in n8n 1.x, but the API surface evolves. Pin to a tested n8n version and document the minimum supported version.
- **Server process lifecycle.** M001's "just open the HTML" experience gets more complex when a server must be running. The dev script should start both Vite and the API server, and `npm run dev` should remain the single entrypoint.
- **Large artifact rendering in the Severance-themed UI.** Research outputs and business plans can be multi-page documents. The current dossier card layout renders single-line output strings. Displaying full artifacts will need expandable/scrollable content areas or a detail flyout — without breaking the Severance aesthetic.
- **Concurrent pipeline runs.** If the operator triggers a re-run of a stage while a previous execution is still waiting, the system needs to handle duplicate executions cleanly (cancel previous, or reject the new trigger).

## Requirement Analysis

### Table Stakes (must be proven in M002)

| Req | Why table stakes |
|-----|-----------------|
| R004 — Explicit approval gates | This is the entire point of the milestone. If operator approval gates don't work, M002 fails. |
| R019 — n8n as first-class orchestrator | D004 makes this a hard architectural decision. The integration must be real, not mocked. |
| R018 — Explicit confirmation before irreversible actions | Domain checks and trademark lookups are read-only, but the approval-resume action advances pipeline state. Must require explicit operator action. |

### Core Deliverables (must reach durable output)

| Req | Assessment |
|-----|-----------|
| R005 — Viability analysis | First real content stage. Should produce a structured should-we-build assessment. Advisory and inspectable. |
| R006 — Business planning output | Revenue model, audience, pricing posture. Can share the research stage with R005 or be a separate sub-stage. |
| R007 — Tech-stack research | Comparative analysis of plausible approaches. Must inform but not auto-bind the stack choice. |
| R008 — Naming workflow | Name generation + comparison. Feeds into R009 domain/trademark checks. Operator picks the winner. |
| R009 — Domain/trademark checks | Advisory signals. Must clearly label as point-in-time and non-legal. Provider integration through n8n. |
| R010 — Architecture/spec/prototype package | The handoff packet structure exists (M001/S04). M002 must populate it with real artifacts from research and planning stages. |

### Candidate Requirements (surfaced by research, not yet binding)

| Candidate | Description | Recommendation |
|-----------|-------------|---------------|
| CR-001: Server/API layer | M002 requires a thin server for n8n bridge, artifact storage, and credential management. Not currently in REQUIREMENTS.md. | **Add as active requirement for M002.** It's the critical-path dependency. |
| CR-002: Offline/cached artifact access | Lumon should remain usable when n8n is unreachable — show cached results, disable triggers. | **Add as active requirement.** Aligns with local-first design principle. |
| CR-003: Stage artifact schema | Moving from string `output` to structured artifact records is a data model change that affects all surfaces. | **Track as a schema migration concern in M002 planning, not a standalone requirement.** |
| CR-004: n8n workflow templates | The discovery workflow definitions (JSON) should be shipped with Lumon and importable into n8n. | **Add as active requirement for M002.** Users shouldn't have to hand-build n8n workflows. |

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| n8n | czlonkowski/n8n-skills@n8n-workflow-patterns (2.4K installs) | install failed (tooling bug, not skill issue) — available for manual install |
| n8n | czlonkowski/n8n-skills@n8n-node-configuration (1.4K installs) | available |
| React Testing Library | react-testing-library (installed) | already available in system |

## Sources

- n8n Wait node `$execution.resumeUrl` is the webhook URL to call to resume a paused workflow — unique per execution, generated at runtime (source: [n8n docs — Wait node](https://github.com/n8n-io/n8n-docs/blob/main/docs/integrations/builtin/core-nodes/n8n-nodes-base.wait.md))
- n8n Execute Sub-workflow node enables modular parent→child workflow composition with data passing (source: [n8n docs — Sub-workflows](https://github.com/n8n-io/n8n-docs/blob/main/docs/flow-logic/subworkflows.md))
- n8n REST API at `{url}/api/v1` supports programmatic workflow creation, activation, and execution management (source: [n8n docs — API reference](https://github.com/n8n-io/n8n-docs/blob/main/docs/api/api-reference.md))
- n8n sub-workflow executions don't count toward plan execution limits (source: [n8n docs — Sub-workflows](https://github.com/n8n-io/n8n-docs/blob/main/docs/flow-logic/subworkflows.md))
- Domainr API provides domain search and availability status via `/v2/status` endpoint with JSON response (source: [Domainr API docs](https://domainr.com/docs/api))
- Marker API searches USPTO trademark database and returns JSON results with serial number, trademark name, description, status, and registration date (source: [Marker API](https://markerapi.com/))
- USPTO TSDR API provides programmatic access to trademark case status and documents (source: [USPTO Open Data Portal](https://developer.uspto.gov/api-catalog))
- M001 established stable stage/gate IDs and approval state machine in `src/lumon/model.js` — contracts are ready for n8n attachment (source: M001-SUMMARY.md)
- M001 handoff packet structure already exists with architecture, specification, prototype, and approval sections — M002 populates these with real artifacts (source: `src/lumon/selectors.js` handoff packet builder)
