# Project

## What This Is

Lumon is a local-first mission control dashboard for a single operator running multiple software-product initiatives from idea intake through research, approval, repo provisioning, GSD handoff, and autonomous build supervision.

M001 has been completed — the prototype is now a real control surface with persistent multi-project registry, canonical staged pipeline, selector-owned dossier and handoff views, and pipeline-aware Severance floor. All surfaces consume the same state spine and the operator loop is proven end-to-end.

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
- **Express bridge server at `server/` with 5 REST endpoints (trigger, callback, approve, artifact get, status) and disk-based JSON artifact storage. Vite proxies `/api/*` to Express; `npm run dev` starts both servers.**
- **`stage.output` migrated from string to `{ artifactId, summary, type }` structured references with backward-compatible coercion — all M001 selectors consume the new shape without modification.**
- **SSE endpoint streams typed events per projectId; `useServerSync` hook bridges server events to reducer dispatch. Dashboard shows connection status and conditional trigger/approve/reject buttons.**
- **n8n intake/viability workflow template shipped as importable JSON. Full trigger→execute→callback→approve loop proven against live n8n Docker instance.**
- **Per-stage webhook registry routes different n8n workflow URLs by stageKey with global fallback. Sequential sub-workflow orchestration fires business plan then tech stack. Auto-trigger chain starts research after intake approval.**
- **Multi-artifact accumulation via `lumon/append-artifact` reducer action — SSE artifact-ready events accumulate into `artifactIds` arrays without overwriting. Selectors project artifactIds through dossier and handoff packet evidence.**
- **Type-dispatched `ArtifactRenderer` renders structured artifact content (viability_analysis, business_plan, tech_research) with section-based sub-renderers. `useArtifact` hook fetches content from server with module-level caching.**
- Vitest + RTL tests cover reducer/selectors, persistence, rendered registry, pipeline visibility, dossier/handoff, floor sync, full operator loop, API contracts, artifact output migration, server sync, research pipeline orchestration, and artifact rendering (12 files, 121 tests).
- The full operator loop (create → inspect → cross-surface → reload) is proven in jsdom and real browser.
- Next: M002/S03 adds naming and brand signal stages; S04 integrates the full pipeline with offline mode.

## Architecture / Key Patterns

- Canonical domain and selector layer lives in `src/lumon/*` — source of truth for project, agent, orchestration, dossier, handoff, and floor view models.
- `src/features/mission-control/*` contains provider-backed surface modules; local-only interaction state stays local.
- `src/severance-floor.jsx` is a presentational/interaction shell over `selectFloorViewModel` plus seeded floor-layout helpers.
- React 19 + Vite + `@xyflow/react` remain the UI foundation.
- The Severance-style presentation is part of the product value, not disposable polish.
- Persistence uses a versioned localStorage envelope at the provider boundary with explicit initialState precedence.
- Stage taxonomy and gate IDs are stable contracts consumed by the n8n integration layer.
- Express bridge server at `server/` handles n8n communication, artifact persistence, and SSE event streaming. Pipeline execution state is in-memory; artifacts persist to disk as JSON files.
- n8n workflow templates live in `n8n/workflows/` as importable JSON. The Wait node resumeUrl is the approval primitive — never auto-resumed.
- `vitest.workspace.js` separates Node (server) and jsdom (client) test environments under one `npx vitest run` command.

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

6 requirements validated in M001: R001, R002, R003, R012, R016, R020.
14 requirements remain active for future milestones.

## Milestone Sequence

- [x] M001: Lumon Control Surface — Persistent multi-project registry, canonical staged pipeline, selector-owned dossier/handoff, pipeline-aware Severance floor, and proven operator loop.
- [ ] M002: Discovery & Approval Pipeline — Orchestrate stage-gated pre-build research, business planning, naming, technical planning, and prototype approval through n8n.
- [ ] M003: Repo Provisioning & GSD Handoff — Create repos and workspaces, package approved artifacts, select execution engine, and bootstrap GSD-ready project handoff.
- [ ] M004: Autonomous Build Orchestrator — Run and supervise independent project builds with live agent visibility, isolation, retry, and escalation behavior.
- [ ] M005: External Action Layer — Add controlled integrations for registrar, trademark/status lookup, and other explicit-confirmation side effects.
- [ ] M006: Reliability, Governance, and Launch Readiness — Harden auth, auditability, resumability, cost visibility, safeguards, and production-like operations.
