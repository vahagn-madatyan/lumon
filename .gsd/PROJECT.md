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
- Vitest + RTL tests cover reducer/selectors, persistence, rendered registry, pipeline visibility, dossier/handoff, floor sync, and full operator loop (7 files, 32 tests).
- The full operator loop (create → inspect → cross-surface → reload) is proven in jsdom and real browser.
- Next: M002 will attach real pre-build research, business planning, naming, and n8n-orchestrated approval workflows to the stable stage/gate contracts.

## Architecture / Key Patterns

- Canonical domain and selector layer lives in `src/lumon/*` — source of truth for project, agent, orchestration, dossier, handoff, and floor view models.
- `src/features/mission-control/*` contains provider-backed surface modules; local-only interaction state stays local.
- `src/severance-floor.jsx` is a presentational/interaction shell over `selectFloorViewModel` plus seeded floor-layout helpers.
- React 19 + Vite + `@xyflow/react` remain the UI foundation.
- The Severance-style presentation is part of the product value, not disposable polish.
- Persistence uses a versioned localStorage envelope at the provider boundary with explicit initialState precedence.
- Stage taxonomy and gate IDs are stable contracts ready for n8n attachment.

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
