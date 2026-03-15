---
id: M001
provides:
  - Canonical Lumon domain model with project, engine, stage, approval, and agent shapes driving all surfaces from one state spine
  - Persistent multi-project registry with versioned local envelope, reload-safe selection restore, and per-project engine identity
  - Intake-to-handoff pipeline with stable stage/gate IDs, approval-gated progression, and execution reconciliation across seeded, spawned, and rehydrated state
  - Selector-owned dossier and handoff packet contract with section-level readiness diagnostics
  - Pipeline-aware Severance floor with per-department diagnostics, room tones, persistent shell indicators, and dashboard↔floor synchronization
  - End-to-end operator loop proven in jsdom and real browser: create → inspect → cross-surface → reload
key_decisions:
  - D009: Introduce src/lumon/* reducer/context/selector spine, keep React Flow interaction state local
  - D011: Keep agents project-owned, let execution stages reference agent IDs, synthesize generic stages for partial orchestration detail
  - D012: Modal intake drafts, terminal playback, and React Flow canvas state stay local; provider owns canonical project/agent/stage truth
  - D013: Project Severance floor through selectFloorViewModel plus seeded layout for deterministic cross-surface behavior
  - D014: Persist canonical registry through versioned localStorage envelope at provider boundary with explicit initialState precedence
  - D016: Canonicalize intake-to-handoff stage taxonomy in src/lumon/*, dashboard and orchestration read selector-derived pipeline summaries
  - D019: Keep dossier and handoff as subviews inside the dashboard selected-project pane
  - D020: M001 dossier and packet are stable section IDs with readiness states, intentionally thin until later milestones add real artifacts
  - D021: Floor departments and diagnostics derive from canonical project pipeline view models, pipeline states map to floor presentation at the project layer
patterns_established:
  - All surfaces (dashboard, orchestration, dossier, handoff, Severance floor) consume selector-owned view models from one canonical Lumon state tree
  - Distinctive UI layout and motion variation comes from deterministic seeded helpers, not render-path randomness
  - Initialization precedence is explicit: initialState → persisted registry → seeded demo state
  - Persisted empty registries are valid canonical state and render safe create-first surfaces
  - Floor departments carry a .diagnostics object mirroring canonical pipeline truth; rooms visually encode pipeline state through border/background tone
  - Factory helpers (createWaitingProject, createHandoffReadyProject) keep integration tests fast and composable
observability_surfaces:
  - npm run test -- --run (7 files, 32 tests)
  - window.localStorage['lumon.registry.v1'] — runtime truth for project roster, engine choice, stage/gate/approval state, and selection
  - selectDashboardProjects / selectSelectedProjectDetail / selectOrchestrationInput / selectFloorViewModel — canonical selector contracts
  - data-testid surfaces for pipeline-status, current-stage, current-gate, approval-state, dossier, handoff, floor diagnostics, and summary strip
  - npx eslint src/lumon src/features/mission-control src/severance-floor.jsx
  - npm run build
requirement_outcomes:
  - id: R001
    from_status: active
    to_status: validated
    proof: S01 shared-state reducer/selector/RTL proof plus S06 full create→inspect→cross-surface→reload loop in jsdom and browser
  - id: R002
    from_status: active
    to_status: validated
    proof: S02 canonical create, versioned persistence, reload-safe restore, and live browser create+reload verification; S06 acceptance confirms 15-project fleet survives reload
  - id: R003
    from_status: active
    to_status: validated
    proof: S03 canonical 6-stage intake→handoff taxonomy with stable stage/gate IDs, approval-aware progression, persistence round-trip, and live dashboard/orchestration browser verification
  - id: R012
    from_status: active
    to_status: validated
    proof: S02 engine choice stored in canonical project identity, persisted in localStorage, rendered in dashboard badges, and restored after reload
  - id: R016
    from_status: active
    to_status: validated
    proof: S03 stage-first dashboard/orchestration projection with selector-owned pipeline summaries; S05 floor sync; S06 cross-surface agreement confirmed in browser
  - id: R020
    from_status: active
    to_status: validated
    proof: S05 pipeline-aware department room tones, persistent shell indicators, fluorescent strip coloring, and diagnostics panels maintaining control-room aesthetic while exposing pipeline truth
duration: ~13h across 6 slices
verification_result: passed
completed_at: 2026-03-15
---

# M001: Lumon Control Surface

**Turned the Lumon prototype into a real single-operator mission-control shell with persistent multi-project registry, canonical staged pipeline, selector-owned detail surfaces, and pipeline-aware Severance floor — all consuming the same state spine and proven end-to-end in jsdom and the real browser entrypoint.**

## What Happened

M001 retired the foundational risk that Lumon's strong visual prototype would remain a disconnected mock incapable of supporting real orchestration.

**S01 (Core control-shell refactor)** extracted the canonical domain model into `src/lumon/*` — project, engine, stage, approval, and agent shapes with a reducer/context/selector spine. The mission-control monolith was split into provider-backed surface modules (dashboard, orchestration, architecture, terminal, modal). The Severance floor was rebound to `selectFloorViewModel` with deterministic seeded layout, eliminating render-path randomness while preserving the atmosphere. A Vitest + RTL harness proved that dashboard, orchestration, and floor all consume the same canonical state.

**S02 (Project registry and persistence)** added durable project creation with stable IDs, timestamps, and per-project engine choice. A versioned `lumon.registry.v1` localStorage envelope persists the registry at the provider boundary, with explicit `initialState` precedence for tests and controlled renders. The old local pending-intake queue was retired — modal submissions now create canonical projects immediately. Empty registries became first-class state with explicit create-first UI fallbacks. Browser verification proved create → choose engine → reload → restore.

**S03 (Pipeline board and approval model)** canonicalized the intake-to-handoff stage taxonomy: intake, research, plan, wave execution, verification, and handoff with stable `<projectId>:<stageKey>` stage IDs and named approval gates. Execution reconciliation recomputes `currentStageId`, `currentGateId`, `currentApprovalState`, `pipelineStatus`, handoff readiness, and progress from stage truth. Legacy persisted stage IDs survive reload through alias-based reconciliation. Dashboard and orchestration now consume one selector-owned pipeline view model with stable test surfaces. Browser verification proved waiting, blocked, and handoff-ready projects render from the same canonical contract.

**S04 (Project dossier and handoff packet views)** added the selected-project detail seam with Overview, Dossier, and Handoff subviews inside the dashboard. The dossier projects a working brief, current approval summary, and per-stage output ledger. The handoff packet exposes architecture, specification, prototype, and approval readiness sections with explicit `ready` / `waiting` / `blocked` / `missing` states and honest reasons — all derived from canonical selector output, not persisted placeholder artifacts. Reload continuity reaches into the nested detail tabs.

**S05 (Severed floor live-state integration)** added pipeline-aware floor projection. Each department now carries a `.diagnostics` object with pipeline status, stage, gate, approval, progress, and boolean flags. Department rooms show red-tinted borders for blocked, amber for waiting, blue for handoff-ready, and green for running/complete. A `PersistentShellIndicator` renders for departments with zero desk agents, preventing invisible stuck projects. Seven rendered integration tests proved dashboard↔floor synchronization across all pipeline states.

**S06 (End-to-end operator loop integration)** closed the milestone with a comprehensive jsdom integration test (3 focused blocks: full loop, cross-surface selection propagation, and persistence round-trip) and live browser acceptance against the real Vite preview entrypoint. The old timeout-prone 14-project shell test was replaced with lean factory fixtures. The browser acceptance pass created a project through the modal, verified it across all five surfaces (dashboard, orchestration, dossier, handoff, Severance floor), reloaded, and confirmed full state persistence — with zero console errors and zero failed requests.

## Cross-Slice Verification

### Success Criterion 1: Create multiple projects, choose engine, reload, recover fleet
- S02 browser: created "Persistence Sentinel" with Codex CLI, reloaded, confirmed same project+engine persisted in `lumon.registry.v1`
- S06 browser: created "Acceptance Test Project" with Codex CLI, confirmed 15 projects in fleet, reloaded, confirmed full state persistence including engine choice
- S06 jsdom: persistence round-trip test creates project, remounts with persisted state, verifies project survives

### Success Criterion 2: Dashboard, dossier, and Severance floor reflect same project/stage truth
- S06 browser: dashboard shows WAITING/Intake/Intake approval → dossier shows same stage/gate/approval → orchestration shows same → floor diagnostics show matching pipeline status, stage, gate, approval
- S05 rendered tests: 7 integration tests prove dashboard↔floor synchronization for waiting, blocked, handoff-ready, and running states
- S04 rendered tests: dossier and handoff views derive from `selectSelectedProjectDetail` — same selector path as dashboard

### Success Criterion 3: Pre-build journey as explicit staged workflow with approval gates and handoff packet
- S03: canonical 6-stage taxonomy (intake→research→plan→wave→verification→handoff) with named approval gates and `pending`/`approved`/`rejected`/`needs_iteration` states
- S04: handoff packet with 4 sections (architecture, specification, prototype, approval readiness) showing explicit waiting/missing reasons
- S06 browser: confirmed 6-stage pipeline and approval-gated progression visible in the real app

### Success Criterion 4: Real browser entrypoint supports coherent operator loop
- S06 T02: built production app, ran acceptance against Vite preview server — create → inspect all tabs → orchestration → floor → reload persistence all confirmed
- Zero console errors, zero failed network requests throughout the acceptance pass

### Definition of Done
- ✅ All 6 slices complete with summaries
- ✅ All outputs wired into the same `src/lumon/*` state model
- ✅ Project creation, persistence, detail, stage board, and Severance floor connect through canonical selectors
- ✅ Real browser entrypoint supports coherent operator loop (S06 browser acceptance)
- ✅ Success criteria re-checked against live browser behavior (S06 T02)
- ✅ Final integrated acceptance scenarios pass (7 test files, 32 tests + browser acceptance)

## Requirement Changes

- R001: active → validated — S01 shared-state proof harness, S03/S05/S06 cross-surface integration, S06 full operator loop in jsdom and browser
- R002: active → validated — S02 canonical create/persist/restore, S06 acceptance proves 15-project fleet survives reload with engine identity intact
- R003: active → validated — S03 canonical 6-stage taxonomy with approval gates, persistence round-trip, and live dashboard/orchestration browser verification
- R012: active → validated — S02 engine choice in canonical project identity, persisted in localStorage, rendered in badges, restored after reload
- R016: active → validated — S03 stage-first dashboard/orchestration selectors, S05 floor synchronization, S06 cross-surface agreement in browser
- R020: active → validated — S05 pipeline-aware room tones, persistent shell indicators, fluorescent strip coloring, and diagnostics panels with control-room aesthetic

Requirements advanced but remaining active:
- R004: S03 shaped stable approval-gate identifiers and pending/rejected/needs-iteration semantics; full approval execution deferred to M002
- R010: S04 proved dossier/packet structure and readiness diagnostics; real artifact population deferred to M002
- R015: S05 established pipeline-aware floor diagnostics surface; real agent telemetry deferred to M004
- R019: S03 shaped stage contracts for n8n attachment; real n8n integration deferred to M002

## Forward Intelligence

### What the next milestone should know
- The `src/lumon/*` spine is the authoritative domain boundary. Extend the existing reducer/context/selectors rather than bypassing them — all five surfaces depend on shared selected-project and selector-owned view model semantics.
- The stage taxonomy (intake, research, plan, wave_execution, verification, handoff) and gate IDs (gate:intake-review, gate:research-review, etc.) are stable contracts. n8n workflows should attach to these identifiers directly.
- The handoff packet structure already exists with section IDs and readiness states. M002 should populate the existing sections with real artifacts rather than introducing a parallel packet model.
- Empty registries are valid state and surfaces handle them gracefully. Don't quietly reseed demo data.

### What's fragile
- Base UI overlay intercepts Playwright-style clicks inside dialogs — documented workaround uses JS-dispatched clicks via `browser_evaluate`. This affects any browser automation that needs to interact with modal internals.
- The styling/test stack emits non-fatal `csstree-match` warnings during rendered tests. Functional assertions remain trustworthy; stderr noise should be filtered, not chased.
- Browser text assertions against the full page body can fail due to truncation on text-dense dashboards — use targeted `selector_visible`, `data-testid`, and `browser_find` assertions instead.
- The production build emits a large-chunk warning for the main bundle. Not blocking but should be revisited if bundle growth continues into M002.

### Authoritative diagnostics
- `window.localStorage['lumon.registry.v1']` — fastest runtime truth for project roster, engine, stage/gate/approval state, and selection
- `selectDashboardProjects` / `selectSelectedProjectDetail` / `selectOrchestrationInput` / `selectFloorViewModel` — canonical selector contracts that every surface reads
- `npm run test -- --run` (7 files, 32 tests) — the integrated proof that state contracts, persistence, rendered surfaces, floor sync, and operator loop all hold
- `data-testid` surfaces throughout dashboard, orchestration, dossier, handoff, and floor — stable inspection points for browser automation

### What assumptions changed
- "The Severance floor needs bespoke internal grouping/randomness to preserve the feel" — a selector-owned floor view model plus seeded layout data preserved the presentation while making behavior deterministic and testable.
- "The shell needs a separate pending-intake draft registry" — canonical project creation at modal submit time was simpler and more reliable than maintaining a second draft queue.
- "Pipeline truth can live partly in shell defaults and partly in surface presentation" — this drifted immediately; stability only came when stage, approval, and status derivation moved fully into `src/lumon/*` and shared selectors.
- "The dossier would need its own navigation surface" — keeping it as subviews inside the dashboard selected-project pane avoided selection context duplication without sacrificing inspection depth.

## Files Created/Modified

### Domain model and state
- `src/lumon/model.js` — canonical constructors for projects, engines, stages, approvals, agents; dossier/packet section definitions; spawn helpers and execution reconciliation
- `src/lumon/seed.js` — demo fleet seed data and deterministic floor layout seed
- `src/lumon/reducer.js` — Lumon reducer with project CRUD, stage mutations, selection, and hydration
- `src/lumon/context.jsx` — provider/hooks boundary with initialization precedence and effect-driven persistence
- `src/lumon/selectors.js` — fleet, detail, orchestration, floor, dossier, handoff, and diagnostics projections
- `src/lumon/persistence.js` — versioned localStorage envelope with safe storage checks and fallback

### Mission-control surfaces
- `src/mission-control.jsx` — thin provider wrapper with configurable persistence boundary
- `src/features/mission-control/MissionControlShell.jsx` — provider-backed top-level shell with canonical project spawning
- `src/features/mission-control/DashboardTab.jsx` — stage-first project cards, engine badges, and Overview/Dossier/Handoff detail pane
- `src/features/mission-control/OrchestrationTab.jsx` — selector-owned pipeline status, stage, gate, approval surfaces
- `src/features/mission-control/ArchitectureTab.jsx` — extracted architecture surface
- `src/features/mission-control/TerminalPanel.jsx` — selected-agent-bound terminal/detail state
- `src/features/mission-control/NewProjectModal.jsx` — canonical project creation with engine choice

### Severance floor
- `src/severance-floor.jsx` — pipeline-aware room tones, persistent shell indicators, diagnostics panels, fluorescent strip coloring

### Test harness
- `vite.config.js` — Vitest/jsdom setup
- `src/test/setup.js` — RTL/jest-dom setup, DOM helpers, deterministic storage cleanup
- `src/lumon/__tests__/lumon-state.test.js` — reducer, selector, taxonomy, approval, dossier, floor diagnostics contracts (10 tests)
- `src/lumon/__tests__/lumon-persistence.test.js` — persistence round-trip, empty restore, corrupt fallback, initialState precedence
- `src/features/mission-control/__tests__/project-registry.test.jsx` — create/remount persistence, empty-registry UI, reload continuity into dossier/handoff
- `src/features/mission-control/__tests__/pipeline-board.test.jsx` — waiting/blocked/handoff-ready rendered pipeline states
- `src/features/mission-control/__tests__/project-dossier.test.jsx` — tab switching, missing-state rendering, empty fallback
- `src/features/mission-control/__tests__/severance-floor-live-state.test.jsx` — 7 dashboard↔floor synchronization tests
- `src/features/mission-control/__tests__/operator-loop.test.jsx` — full loop, cross-surface selection, persistence round-trip (3 tests)

### Project artifacts
- `.gsd/PROJECT.md`, `.gsd/STATE.md`, `.gsd/REQUIREMENTS.md`, `.gsd/DECISIONS.md` — updated throughout
- `.gsd/milestones/M001/M001-ROADMAP.md` — all slices marked complete
- `package.json` — test script, removed invalid Linux-only dependency
