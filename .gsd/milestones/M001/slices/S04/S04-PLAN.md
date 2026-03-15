# S04: Project dossier and handoff packet views

**Goal:** Make the selected-project detail surface expose a canonical dossier and future handoff packet contract so the operator can inspect the brief, stage outputs, approval state, and build-readiness without leaving the dashboard seam.
**Demo:** In the real app, selecting a project and switching between Overview, Dossier, and Handoff reveals the same canonical project truth: a thin working brief, per-stage outputs and gate notes, current approval state, and a stable packet outline for architecture/spec/prototype handoff sections, all surviving reload-safe selected-project restore.

## Must-Haves

- `src/lumon/*` exposes selector-owned dossier and handoff packet view models with stable section IDs, readiness states, and current approval summaries derived from canonical project/stage truth rather than UI-local copy. (R010)
- The dashboard selected-project pane gains local `Overview`, `Dossier`, and `Handoff` subviews using the existing tabs primitive, with Dossier showing the working brief plus stage outputs and Handoff showing future packet sections for architecture, specs, prototype, and approval state. (R010)
- Dossier and handoff surfaces stay honest about current data: they render empty or missing states safely, show current approval truth without implying audit history, and continue working after selection restore or intentionally empty registries.

## Proof Level

- This slice proves: integration
- Real runtime required: yes
- Human/UAT required: no

## Verification

- `npm run test -- --run src/lumon/__tests__/lumon-state.test.js`
- `npm run test -- --run src/features/mission-control/__tests__/project-dossier.test.jsx src/features/mission-control/__tests__/project-registry.test.jsx`
- `npx eslint src/lumon src/features/mission-control`
- `npm run build`
- Preview/browser assertions on the local preview URL for: selected-project detail tab switching, dossier brief and stage-output visibility, handoff packet section readiness, reload-safe selected-project restore, explicit empty/no-selection fallback, and no console or failed-network regressions

## Observability / Diagnostics

- Runtime signals: the selected-project selector exposes dossier sections, handoff packet readiness, current gate summaries, and missing-section reasons instead of burying that state inside component copy
- Inspection surfaces: `selectSelectedProjectDetail`, dossier/handoff `data-testid` surfaces in the dashboard detail pane, and `window.localStorage['lumon.registry.v1']` for canonical project/stage truth
- Failure visibility: packet sections show why they are waiting, blocked, or missing instead of disappearing; empty-registry and no-selected-project detail states stay explicit
- Redaction constraints: project descriptions and approval notes persist locally, so the packet contract must not introduce secrets or fabricated artifact content into placeholder sections

## Integration Closure

- Upstream surfaces consumed: `src/lumon/model.js`, `src/lumon/selectors.js`, `src/features/mission-control/DashboardTab.jsx`, `src/components/ui/tabs.jsx`, and persisted selection behavior from `src/lumon/context.jsx`
- New wiring introduced in this slice: selector-owned dossier/packet contracts rendered as local subviews inside the existing dashboard selected-project pane
- What remains before the milestone is truly usable end-to-end: S05 Severed Floor live-state integration, S06 end-to-end operator-loop proof, and later milestones populating the packet with real research/spec/prototype artifacts

## Tasks

- [x] **T01: Define the canonical dossier and handoff packet contract** `est:1.5h`
  - Why: R010 is still hollow if dossier sections and packet readiness live as UI copy instead of a shared selector contract over canonical project state.
  - Files: `src/lumon/model.js`, `src/lumon/selectors.js`, `src/lumon/__tests__/lumon-state.test.js`
  - Do: Add stable dossier and handoff section definitions in `src/lumon/model.js`; extend `selectSelectedProjectDetail()` in `src/lumon/selectors.js` with a thin working brief, current gate summary, per-stage dossier entries, and packet sections whose `ready`/`waiting`/`blocked`/`missing` states are derived from project metadata, stage outputs, and approval truth; keep M001 content derived from existing canonical fields instead of persisting decorative placeholder packet records; and prove the contract in lumon selector/state tests.
  - Verify: `npm run test -- --run src/lumon/__tests__/lumon-state.test.js`
  - Done when: the selected-project selector already exposes the full dossier and handoff contract the UI needs, with stable IDs and honest readiness reasons, and the state tests prove that contract against canonical project data.
- [x] **T02: Wire Overview, Dossier, and Handoff into the selected-project pane** `est:1.5h`
  - Why: S04 is not real until the operator can inspect the selector-owned contract in the live dashboard without losing the existing overview context.
  - Files: `src/features/mission-control/DashboardTab.jsx`, `src/components/ui/tabs.jsx`, `src/features/mission-control/__tests__/project-dossier.test.jsx`, `src/features/mission-control/__tests__/project-registry.test.jsx`
  - Do: Refactor the selected-project detail area into local Overview/Dossier/Handoff tabs using the existing tabs primitive; keep Overview as the current header, pipeline snapshot, and agent roster; render Dossier and Handoff from the new selector data with stable test surfaces and explicit empty/missing states; and add rendered/browser proof for tab switching, reload-safe restore, and clean diagnostics.
  - Verify: `npm run test -- --run src/features/mission-control/__tests__/project-dossier.test.jsx src/features/mission-control/__tests__/project-registry.test.jsx`
  - Done when: the selected-project pane can switch between Overview, Dossier, and Handoff, the dossier and packet views match selector truth for the selected project, and rendered/browser checks pass after reload without console or network regressions.

## Files Likely Touched

- `src/lumon/model.js`
- `src/lumon/selectors.js`
- `src/lumon/__tests__/lumon-state.test.js`
- `src/features/mission-control/DashboardTab.jsx`
- `src/components/ui/tabs.jsx`
- `src/features/mission-control/__tests__/project-dossier.test.jsx`
- `src/features/mission-control/__tests__/project-registry.test.jsx`
