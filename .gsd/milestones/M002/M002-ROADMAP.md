# M002: Discovery & Approval Pipeline

**Vision:** Turn the proven Lumon control surface into a real orchestrated discovery pipeline — the operator launches staged pre-build research through n8n, reviews structured artifacts inside Lumon, approves or rejects at explicit gates, and arrives at a complete build dossier ready for handoff.

## Success Criteria

- The operator can trigger a discovery pipeline for a project and watch it progress through named stages with real n8n-executed work
- Per-stage outputs appear inside Lumon as structured, inspectable artifacts — not transient strings or console-only output
- The operator can approve one stage, reject another, iterate on the rejected stage, and see state advance only through explicit gates
- A project can run through a complete discovery pipeline from intake to approved pre-build dossier with architecture, spec, and prototype artifacts
- Lumon remains usable for reviewing cached artifacts when n8n is unreachable

## Key Risks / Unknowns

- No server exists — M001 is entirely client-side, and n8n integration requires a bridge server for credentials, callbacks, artifact storage, and state push. This is the critical path dependency.
- Stage output schema migration — moving from `output: "Pending"` (string) to structured artifact references is a cross-cutting change that touches all 5 surfaces through the selector chain.
- n8n webhook→Wait→resumeUrl contract — the atomic integration primitive must work cleanly before any content stage matters. Resume URL lifetime and execution pruning add fragility.
- Concurrent/stale execution handling — if a stage is re-triggered while a previous execution waits, the system must handle duplicate or orphaned executions cleanly.

## Proof Strategy

- No server exists → retire in S01 by shipping a working bridge server that triggers an n8n workflow, receives the result callback, stores a structured artifact, and pushes it to the Lumon dashboard through a real browser-visible demo
- Schema migration risk → retire in S01 by migrating `stage.output` to structured artifact references with backward-compatible coercion, proven by existing M001 tests still passing plus new artifact-aware tests
- n8n sync contract → retire in S01 by proving the full webhook→Wait→resume loop with a real n8n instance and real operator approval in the browser
- Concurrent execution → retire in S04 by proving rejection, iteration, and re-trigger flows don't corrupt project state

## Verification Classes

- Contract verification: Vitest + RTL tests for artifact schema, reducer actions, selector projections, server API contracts, and persistence migration
- Integration verification: Real n8n instance running locally with Lumon bridge server — webhook triggers, stage results, and approval resume calls exercised through the live system
- Operational verification: Server process lifecycle (single `npm run dev` starts both Vite and API server), offline/disconnected degradation, stale execution detection
- UAT / human verification: Full pipeline walkthrough in the browser — trigger discovery, inspect artifacts, approve/reject stages, iterate, arrive at complete dossier

## Milestone Definition of Done

This milestone is complete only when all are true:

- All slice deliverables are complete and verified
- A project can run through a complete discovery pipeline (intake → research → plan) with real n8n-executed work visible in Lumon
- The operator can approve one stage, reject another, iterate, and see state advance only through explicit gates
- Stage outputs are structured artifacts stored server-side and rendered in the dashboard dossier — not localStorage strings
- The handoff packet contains real architecture, spec, and prototype artifacts from the pipeline
- Lumon degrades gracefully when n8n is unreachable (cached artifact access, disabled triggers)
- Shipped n8n workflow templates are importable and functional
- Success criteria are re-checked against live browser behavior, not just test artifacts
- Final integrated acceptance scenarios pass

## Requirement Coverage

- Covers: R004, R005, R006, R007, R008, R009, R010, R018, R019
- Partially covers: none
- Leaves for later: R011 (M003), R013 (M003), R014 (M003), R015 (M004), R017 (M004)
- Orphan risks: none — all active requirements mapped to M002 have slice coverage

## Slices

- [x] **S01: Bridge Server & Intake Stage** `risk:high` `depends:[]`
  > After this: the operator triggers a discovery run on a project, n8n executes a viability analysis, the structured result appears in the Lumon dashboard, and the operator approves or rejects it — proven in the real browser with a live n8n instance.
- [x] **S02: Research & Business Planning Stages** `risk:medium` `depends:[S01]`
  > After this: after intake approval, the research stage triggers business planning and tech-stack analysis sub-workflows in n8n, and their structured artifacts render as inspectable dossier content in the dashboard.
- [x] **S03: Naming & Brand Signal Stages** `risk:medium` `depends:[S01]`
  > After this: naming candidates appear as a selectable list, the operator picks a winner, and domain availability and trademark signals display with advisory labels — all orchestrated through n8n.
- [ ] **S04: Architecture Package & Full Pipeline Integration** `risk:low` `depends:[S01,S02,S03]`
  > After this: a project runs through the complete discovery pipeline from intake to approved build dossier, with architecture/spec/prototype artifacts populating the handoff packet, rejection/iteration flows proven, offline mode working, and n8n workflow templates shipped as importable JSON.

## Boundary Map

### S01 → S02, S03, S04

Produces:
- Express bridge server at `server/` with Vite proxy — endpoints: `POST /api/pipeline/trigger`, `POST /api/pipeline/callback`, `POST /api/pipeline/approve`, `GET /api/artifacts/:id`, `GET /api/pipeline/status/:projectId`
- SSE endpoint `GET /api/pipeline/events/:projectId` for pushing stage results to the client
- Server-side artifact storage (disk or SQLite) with artifact record shape: `{ id, projectId, stageKey, type, content, metadata, createdAt }`
- Migrated `stage.output` from string to `{ artifactId, summary, type }` with backward-compatible coercion in `createPipelineStage`
- Client-side `useServerSync` hook or similar for connecting reducer actions to server push
- n8n workflow JSON template for the intake/viability stage (importable)
- `npm run dev` starts both Vite and the API server as a single entrypoint

Consumes:
- Existing `src/lumon/*` state spine (reducer, selectors, context, persistence)
- Existing stage taxonomy and approval state machine from `model.js`
- Existing `updateStage` reducer action for injecting n8n results
- Existing dossier/handoff selector chain in `selectors.js`
- Existing dashboard artifact rendering in `DashboardTab.jsx`

### S02 → S04

Produces:
- n8n sub-workflow templates for business planning and tech-stack research
- Structured artifact types: `viability_analysis`, `business_plan`, `tech_research` with defined content schemas
- Rich artifact rendering components (expandable structured content, section-based layout) in the dossier card area
- Research stage wired to trigger multiple sub-workflows and aggregate results

Consumes:
- S01 bridge server API and artifact storage
- S01 SSE push and client sync hook
- S01 schema-migrated stage output contract

### S03 → S04

Produces:
- n8n sub-workflow templates for naming generation, domain availability, and trademark lookup
- Candidate selection UI component (list of generated names with pick action)
- Structured artifact types: `naming_candidates`, `domain_signals`, `trademark_signals` with advisory labeling
- Domain and trademark results rendered with explicit point-in-time and non-legal disclaimers

Consumes:
- S01 bridge server API and artifact storage
- S01 SSE push and client sync hook
- S01 schema-migrated stage output contract

### S04

Produces:
- n8n sub-workflow templates for architecture/spec/prototype generation
- Handoff packet populated with real artifacts from all prior stages (architecture, specification, prototype, approval sections)
- Offline/disconnected mode: cached artifact rendering when n8n is unreachable, disabled trigger controls
- Rejection/iteration flows proven: reject → iterate → re-approve without state corruption
- Complete n8n workflow template bundle (importable JSON for the full discovery pipeline)
- Final integrated acceptance proof: full pipeline from intake to approved build dossier in real browser

Consumes:
- S01 bridge server, artifact storage, sync loop, schema migration
- S02 research artifacts and rendering components
- S03 naming/domain/trademark artifacts and selection UI
- Existing handoff packet structure from M001/S04 selectors
