# Project

## What This Is

Lumon is a local-first mission control dashboard for a single operator running multiple software-product initiatives from idea intake through research, approval, repo provisioning, GSD handoff, and autonomous build supervision.

The current repository contains a strong visual prototype and architecture thinking, but it is not yet a working orchestration system. M001 turns the existing prototype into the real control surface the later milestones will plug into.

## Core Value

One operator can see where every project stands, understand what each agent is doing, and move approved ideas into autonomous execution without manual orchestration sprawl.

## Current State

- Vite + React prototype with a mission-control dashboard and a distinctive Severance-inspired floor simulation.
- Existing architecture documents describe a future local-first runtime built around a custom server, tmux, SQLite, git worktrees, GSD, and remote access.
- Current UI is powered by mock data and duplicated view-specific state rather than a canonical project model.
- No real project persistence, no stage-gated intake workflow, no n8n orchestration, no repo provisioning, and no live agent runtime yet.

## Architecture / Key Patterns

- Frontend-first prototype centered in `src/mission-control.jsx`, `src/severance-floor.jsx`, and `src/components/ui/*`.
- React 19 + Vite + `@xyflow/react` are already in use and match the dashboard/workflow visualization direction.
- The current code leans on rich mock data; M001 should replace this with a canonical Lumon domain model that all surfaces consume.
- The Severance-style presentation is part of the product value, not disposable polish.
- Later milestones will connect the control surface to n8n, GitHub, GSD, agent runtimes, registrar APIs, and trademark/status lookups.

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

## Milestone Sequence

- [ ] M001: Lumon Control Surface — Turn the current prototype into a real operator shell with persistent projects, stage model, dossier surfaces, and synced Severance presentation.
- [ ] M002: Discovery & Approval Pipeline — Orchestrate stage-gated pre-build research, business planning, naming, technical planning, and prototype approval through n8n.
- [ ] M003: Repo Provisioning & GSD Handoff — Create repos and workspaces, package approved artifacts, select execution engine, and bootstrap GSD-ready project handoff.
- [ ] M004: Autonomous Build Orchestrator — Run and supervise independent project builds with live agent visibility, isolation, retry, and escalation behavior.
- [ ] M005: External Action Layer — Add controlled integrations for registrar, trademark/status lookup, and other explicit-confirmation side effects.
- [ ] M006: Reliability, Governance, and Launch Readiness — Harden auth, auditability, resumability, cost visibility, safeguards, and production-like operations.
