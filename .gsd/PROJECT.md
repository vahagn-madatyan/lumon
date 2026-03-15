# Project

## What This Is

Lumon is a local-first mission control dashboard for a single operator running multiple software-product initiatives from idea intake through research, approval, repo provisioning, GSD handoff, and autonomous build supervision.

The current repository contains a strong visual prototype and architecture thinking, and M001 is turning it into the real control surface the later milestones will plug into.

## Core Value

One operator can see where every project stands, understand what each agent is doing, and move approved ideas into autonomous execution without manual orchestration sprawl.

## Current State

- Vite + React control shell now runs through a canonical `src/lumon/*` state spine with reducer, provider, seed data, shared selectors, and provider-bound persistence.
- The mission-control UI has been split into provider-backed dashboard, orchestration, architecture, terminal, and modal surface modules instead of one monolith.
- Canonical project creation now flows through the real shell: new projects get stable IDs/timestamps, a persisted engine choice, immediate selection, and reload-safe restore from the versioned local registry envelope.
- Projects now share one canonical intake → handoff pipeline with stable stage and gate IDs, approval-aware progression, and reload-safe execution reconciliation for seeded, spawned, and rehydrated state.
- The dashboard and orchestration surfaces now lead with the same selector-owned stage, gate, approval, and handoff-readiness truth instead of UI-local status summaries.
- Empty persisted registries are treated as valid state, and rendered mission-control surfaces now guard against missing seeded selection assumptions.
- The Severance-inspired floor now renders from deterministic seeded layout data and the same project/agent truth as the dashboard.
- Vitest + React Testing Library contract/integration tests now cover reducer selectors, persistence round-trip behavior, rendered create/remount registry restore, and stage-first pipeline visibility.
- Still missing: dossier/handoff packet views, Severance floor live-state integration beyond seeded presentation, repo/GSD integrations, and live runtime telemetry.

## Architecture / Key Patterns

- Canonical domain and selector layer lives in `src/lumon/*` and is the source of truth for project, agent, orchestration, and floor view models.
- `src/features/mission-control/*` contains provider-backed surface modules; local-only interaction state stays local unless it affects shared domain truth.
- `src/severance-floor.jsx` is now a presentational/interaction shell over `selectFloorViewModel` plus seeded floor-layout helpers.
- React 19 + Vite + `@xyflow/react` remain the UI foundation for the dashboard/workflow visualization direction.
- The Severance-style presentation is part of the product value, not disposable polish.
- Later milestones will connect the control surface to local persistence, n8n, GitHub, GSD, agent runtimes, registrar APIs, and trademark/status lookups.

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

## Milestone Sequence

- [ ] M001: Lumon Control Surface — Turn the current prototype into a real operator shell with persistent projects, stage model, dossier surfaces, and synced Severance presentation.
- [ ] M002: Discovery & Approval Pipeline — Orchestrate stage-gated pre-build research, business planning, naming, technical planning, and prototype approval through n8n.
- [ ] M003: Repo Provisioning & GSD Handoff — Create repos and workspaces, package approved artifacts, select execution engine, and bootstrap GSD-ready project handoff.
- [ ] M004: Autonomous Build Orchestrator — Run and supervise independent project builds with live agent visibility, isolation, retry, and escalation behavior.
- [ ] M005: External Action Layer — Add controlled integrations for registrar, trademark/status lookup, and other explicit-confirmation side effects.
- [ ] M006: Reliability, Governance, and Launch Readiness — Harden auth, auditability, resumability, cost visibility, safeguards, and production-like operations.
