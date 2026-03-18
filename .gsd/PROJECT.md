# Project

## What This Is

Lumon is a local-first mission control dashboard for a single operator running multiple software-product initiatives from idea intake through research, approval, repo provisioning, GSD handoff, and autonomous build supervision.

M001 established the control surface. M002 has been completed — the control surface now drives a real orchestrated discovery pipeline through n8n with structured server-side artifacts, explicit approval gates, interactive naming selection, and offline degradation.

## Core Value

One operator can see where every project stands, understand what each agent is doing, and move approved ideas into autonomous execution without manual orchestration sprawl.

## Current State

- Vite + React control shell runs through a canonical `src/lumon/*` state spine with reducer, provider, seed data, shared selectors, and provider-bound persistence.
- Mission-control UI split into provider-backed dashboard, orchestration, architecture, terminal, and modal surface modules.
- Canonical project creation flows through the real shell with stable IDs/timestamps, persisted engine choice, immediate selection, and reload-safe restore from versioned local registry envelope.
- Projects share one canonical intake → handoff pipeline with 6 stages (intake, research, plan, wave execution, verification, handoff), stable stage/gate IDs, approval-gated progression, and reload-safe execution reconciliation.
- Dashboard and orchestration surfaces lead with shared selector-owned stage, gate, approval, and handoff-readiness truth.
- Selected-project pane exposes Overview, Dossier, and Handoff subviews with selector-owned brief, stage-output, approval, and packet-readiness view models.
- Empty registries are valid canonical state with explicit create-first UI fallbacks.
- Severance floor renders pipeline-aware department room tones, persistent shell indicators for stuck projects, and diagnostics panels — all deriving from canonical project pipeline view models.
- Dashboard↔floor synchronization proven for selected project, pipeline status, stage, gate, approval, and summary counts.
- Express bridge server at `server/` with 5 REST endpoints (trigger, callback, approve, artifact get, status) and disk-based JSON artifact storage. Vite proxies `/api/*` to Express; `npm run dev` starts both servers via concurrently.
- `stage.output` migrated from string to `{ artifactId, summary, type }` structured references with backward-compatible coercion — all M001 selectors consume the new shape without modification.
- SSE endpoint streams typed events per projectId; `useServerSync` hook bridges server events to reducer dispatch. Dashboard shows connection status and conditional trigger/approve/reject buttons.
- Per-stage webhook registry with compound key lookup routes different n8n workflow URLs by stageKey and subStage with 3-tier compound→stage→global fallback.
- Sequential sub-workflow orchestration proven across 3 multi-sub-stage stages (research: business_plan → tech_stack; plan: naming_candidates → domain_signals → trademark_signals; verification: architecture_outline → specification → prototype_scaffold) with context forwarding through the chain.
- Auto-trigger chains fire downstream stages on approval: intake→research, plan→verification.
- Multi-artifact accumulation via `lumon/append-artifact` reducer action with deduplication. Selectors project artifactIds through dossier and handoff packet evidence.
- Type-dispatched `ArtifactRenderer` with 9 sub-renderers (viability_analysis, business_plan, tech_research, naming_candidates, domain_signals, trademark_signals, architecture_outline, specification, prototype_scaffold) plus GenericRenderer fallback.
- Interactive NamingCandidatesRenderer lets operator select a name, triggering domain and trademark signal sub-workflows via context forwarding. Domain and trademark renderers include mandatory advisory disclaimers (D026).
- `useArtifact` hook fetches artifact content from server with module-level caching.
- PipelineActions generalized to trigger any queued stage. Offline mode disables all pipeline actions when server is disconnected with visible offline banner; dossier renders cached artifacts.
- Full 4-stage pipeline proven end-to-end: intake → research → plan → verification, producing 9 artifacts total. Rejection/iteration lifecycle proven clean with cross-stage isolation and artifact accumulation.
- 9 importable n8n workflow templates cover the complete discovery pipeline. Fundamental webhook→Wait→resumeUrl contract proven against live n8n Docker instance.
- Vitest + RTL tests cover reducer/selectors, persistence, rendered registry, pipeline visibility, dossier/handoff, floor sync, full operator loop, API contracts, artifact output migration, server sync, research pipeline orchestration, naming pipeline orchestration, verification pipeline orchestration, artifact rendering, offline mode, rejection/iteration resilience, and full pipeline integration (17 files, 223 tests).
- The full operator loop (create → inspect → cross-surface → reload) is proven in jsdom and real browser.
- Next: M003 repo provisioning and GSD handoff.

## Architecture / Key Patterns

- Canonical domain and selector layer lives in `src/lumon/*` — source of truth for project, agent, orchestration, dossier, handoff, and floor view models.
- `src/features/mission-control/*` contains provider-backed surface modules; local-only interaction state stays local.
- `src/severance-floor.jsx` is a presentational/interaction shell over `selectFloorViewModel` plus seeded floor-layout helpers.
- React 19 + Vite + `@xyflow/react` remain the UI foundation.
- The Severance-style presentation is part of the product value, not disposable polish.
- Persistence uses a versioned localStorage envelope at the provider boundary with explicit initialState precedence.
- Stage taxonomy and gate IDs are stable contracts consumed by the n8n integration layer.
- Express bridge server at `server/` handles n8n communication, artifact persistence, and SSE event streaming. Pipeline execution state is in-memory; artifacts persist to disk as JSON files.
- Webhook registry in `server/config.js` with per-stage env var lookup, compound keys for sub-stages, and global fallback.
- Sequential sub-workflow orchestration: callback handler checks stage sub-stages array and auto-fires next. Context forwarding propagates data between sub-stages.
- n8n workflow templates live in `n8n/workflows/` as importable JSON. The Wait node resumeUrl is the approval primitive — never auto-resumed.
- `vitest.workspace.js` separates Node (server) and jsdom (client) test environments under one `npx vitest run` command.
- Type-dispatched ArtifactRenderer dispatches on artifact.type via lookup table; new artifact types extend the table without changing the rendering chain.

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

14 requirements validated across M001 and M002: R001, R002, R003, R004, R005, R006, R007, R008, R009, R010, R012, R016, R019, R020.
6 requirements remain active for future milestones: R011, R013, R014, R015, R017, R018.
5 requirements deferred: R021, R022, R023, R024, R025.
4 requirements out of scope: R026, R027, R028, R029.

## Milestone Sequence

- [x] M001: Lumon Control Surface — Persistent multi-project registry, canonical staged pipeline, selector-owned dossier/handoff, pipeline-aware Severance floor, and proven operator loop.
- [x] M002: Discovery & Approval Pipeline — Complete 4-stage discovery pipeline orchestrated through n8n with structured server-side artifacts, explicit approval gates, interactive naming, sequential sub-workflow orchestration, and offline degradation.
- [ ] M003: Repo Provisioning & GSD Handoff — Create repos and workspaces, package approved artifacts, select execution engine, and bootstrap GSD-ready project handoff.
- [ ] M004: Autonomous Build Orchestrator — Run and supervise independent project builds with live agent visibility, isolation, retry, and escalation behavior.
- [ ] M005: External Action Layer — Add controlled integrations for registrar, trademark/status lookup, and other explicit-confirmation side effects.
- [ ] M006: Reliability, Governance, and Launch Readiness — Harden auth, auditability, resumability, cost visibility, safeguards, and production-like operations.
