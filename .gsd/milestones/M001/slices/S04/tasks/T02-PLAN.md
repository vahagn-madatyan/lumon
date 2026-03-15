---
estimated_steps: 4
estimated_files: 4
---

# T02: Wire Overview, Dossier, and Handoff into the selected-project pane

**Slice:** S04 — Project dossier and handoff packet views
**Milestone:** M001

## Description

Project the new dossier and handoff contract into the existing dashboard detail seam so the operator can inspect a selected project through local Overview, Dossier, and Handoff views without adding a new top-level route or duplicating selection state.

## Steps

1. Refactor `src/features/mission-control/DashboardTab.jsx` so the selected-project pane becomes a local Overview/Dossier/Handoff tabset built on the existing tabs primitive instead of a single always-on detail column.
2. Keep Overview as the current header, pipeline snapshot, and agent roster, then add Dossier panels for the working brief, approval summaries, and per-stage outputs plus a Handoff panel for packet-outline sections such as architecture, specs, prototype, and approval readiness.
3. Add stable `data-testid` surfaces plus a new rendered integration test file covering tab switching, selector-driven dossier/handoff content, explicit no-selection handling, and honest missing-state messaging.
4. Extend the existing reload integration proof to confirm selected-project restore still lights up the dossier and handoff views after remount, then finish with browser assertions and clean console/network diagnostics.

## Must-Haves

- [ ] The selected-project pane supports Overview, Dossier, and Handoff tabs without introducing new global state or a second project-detail route.
- [ ] Rendered integration proof covers dossier/handoff visibility, missing-state honesty, and reload-safe selected-project continuity.

## Verification

- `npm run test -- --run src/features/mission-control/__tests__/project-dossier.test.jsx src/features/mission-control/__tests__/project-registry.test.jsx`
- Preview/browser assertions confirm tab switching, dossier and packet section visibility, reload-safe selected-project restore, and no console or failed-network regressions.

## Observability Impact

- Signals added/changed: the dashboard gains explicit dossier/handoff test surfaces for current brief data, per-stage outputs, packet readiness, and missing-section reasons.
- How a future agent inspects this: rendered test ids plus the selected-project UI make it obvious whether the issue is selector data, tab wiring, or empty-state handling.
- Failure state exposed: if dossier/handoff content is missing, the UI shows which section is missing or blocked instead of silently collapsing the pane.

## Inputs

- `src/features/mission-control/DashboardTab.jsx` — existing selected-project detail seam that S04 should expand instead of replacing with a new shell-level surface.
- `src/components/ui/tabs.jsx` — existing tab primitive for nested project-detail navigation.
- `src/features/mission-control/__tests__/project-registry.test.jsx` — current reload-safe integration proof that should extend to dossier/handoff continuity.
- T01 output: selector-owned dossier and handoff packet contract with stable section IDs and readiness states.

## Expected Output

- `src/features/mission-control/DashboardTab.jsx` — a selected-project detail pane with local Overview, Dossier, and Handoff tabs backed by selector-owned data.
- `src/features/mission-control/__tests__/project-dossier.test.jsx` — rendered proof for dossier/handoff content and missing-state handling.
- `src/features/mission-control/__tests__/project-registry.test.jsx` — reload proof extended to the new selected-project detail views.
