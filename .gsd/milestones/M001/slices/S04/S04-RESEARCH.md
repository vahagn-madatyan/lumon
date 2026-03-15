# S04 — Research

**Date:** 2026-03-14

## Summary

S04 directly advances **R010** (define the dossier and handoff packet structure the later pipeline will populate). It does not own new workflow logic, but it depends on validated **R002**, **R003**, **R012**, and **R016**, and it must preserve the approval/gate contract S03 established for later **R004** / **R019** work. The good news is that most of the truth S04 needs already exists: `selectSelectedProjectDetail()` in `src/lumon/selectors.js` already exposes project metadata, stage timeline, current gate, approval summaries, selected-stage detail, and handoff readiness from canonical state.

The main gaps are structural, not behavioral. The shell has no dossier surface yet, `createProject()` drops unknown top-level project fields, and there is no canonical dossier or handoff-packet contract in `src/lumon/*`. The other surprise is that the current model only supports a **thin working brief** (`name`, `description`, `engineChoice`, phase/wave, stage outputs, approval notes) and **point-in-time approval state** (`state`, `note`, `updatedAt`, owner/context) — not a historical approval ledger or real artifact archive. So S04 can show current approval state and packet structure cleanly, but it should not pretend M002/M003’s fuller artifact system already exists.

## Recommendation

Build S04 as a **selected-project detail expansion**, not a second project-state system. Use the existing dashboard right pane as the operator’s project-detail seam and introduce local subviews such as **Overview / Dossier / Handoff**. `Overview` can keep today’s header, pipeline snapshot, and agent summary. `Dossier` should project a structured working brief, per-stage outputs, and approval surfaces from `selectSelectedProjectDetail()`. `Handoff` should render a stable packet-outline contract with explicit section IDs and readiness states derived from current project + stage truth.

Keep the packet contract canonical but mostly derived for M001. A small model addition like exported dossier/packet section constants is worthwhile because M002 and M003 already assume durable inspectable dossier artifacts. But avoid persisting placeholder packet content if it is only decorative. If S04 truly needs durable data beyond `description` and stage outputs, add those fields explicitly in `createProject()` / `touchProject()` rather than hiding them in ad hoc component state or unknown top-level keys that the current model discards.

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| Project-stage truth for dossier sections | `selectSelectedProjectDetail()` / `buildProjectViewModel()` in `src/lumon/selectors.js` | Already reconciles current stage, selected stage, gate label, approval summary, handoff readiness, and stage timeline from canonical state |
| Project-detail navigation | Existing `Tabs` primitive in `src/components/ui/tabs.jsx` | Gives nested overview/dossier/handoff navigation without adding routing or new global state |
| Dense scrollable detail panes | Existing `Card` + `ScrollArea` primitives | Matches current shell patterns and avoids inventing one-off layout shells |
| Stage artifact placeholders and packet readiness | Canonical stage `description`, `output`, `approval`, `durationLabel`, and `agentIds` from `src/lumon/model.js` | Enough to define packet structure now and let M002/M003 swap in richer artifacts later without rewriting the UI contract |

## Existing Code and Patterns

- `src/lumon/selectors.js` — `buildProjectViewModel()` already computes the selected project’s stage timeline, current gate, selected stage, approval summaries, and handoff readiness. This is the strongest seam for dossier/handoff projection.
- `src/features/mission-control/DashboardTab.jsx` — the selected-project pane already exists and is the smallest safe place to attach Overview / Dossier / Handoff subviews without fragmenting project selection.
- `src/features/mission-control/MissionControlShell.jsx` — the top-level shell only exposes `dashboard`, `orchestration`, `architecture`, and `severed-floor`; there is no dossier route or tab yet.
- `src/features/mission-control/OrchestrationTab.jsx` — shows how stage detail can stay presentation-only while consuming selector-owned truth. Reuse that pattern for dossier sections.
- `src/lumon/model.js` — canonical stages already carry `description`, `output`, `approval`, `durationLabel`, and stable stage/gate IDs. `createApprovalState()` also preserves `note`, `updatedAt`, `owner`, and `context`.
- `src/lumon/model.js` + `src/lumon/reducer.js` — important constraint: `createProject()` and `touchProject()` only preserve explicit project fields (`id`, `name`, `description`, `phaseLabel`, `engineChoice`, timestamps, waves, agents, execution, meta`). New durable dossier fields must be modeled deliberately.
- `src/features/mission-control/NewProjectModal.jsx` — the operator currently supplies only `name`, `description`, `engineChoice`, and `agentCount`, so S04’s “working brief” will be intentionally thin unless the slice adds explicit new brief fields.
- `src/lumon/persistence.js` — persistence is already versioned at `lumon.registry.v1`; backward-compatible model additions are feasible, but they need explicit test coverage.
- `src/features/mission-control/__tests__/pipeline-board.test.jsx` and `src/lumon/__tests__/lumon-state.test.js` — existing proof pattern is selector assertions plus rendered `data-testid` surfaces. S04 should follow the same verification style.

## Constraints

- **Direct active requirement:** S04 primarily advances **R010**. It builds on validated **R002**, **R003**, **R012**, and **R016**, and must not weaken the approval/gate contract S03 established for later **R004** / **R019** work.
- **No second interpretation layer.** S03’s forward intelligence is explicit: dossier work should consume selector outputs and persisted execution metadata, not invent dossier-local status summaries.
- **Unknown top-level project fields are currently discarded.** If S04 needs durable `brief`, `dossier`, or `handoff` records, `createProject()` and reducer update helpers must be extended explicitly.
- **Approval state is current-state only.** The model stores current gate state, note, owner, context, and optional `updatedAt`, but there is no approval event history or audit ledger yet.
- **Empty state is first-class.** Dossier/handoff surfaces must handle empty registry and no-selected-project restores safely, just like dashboard and orchestration do now.
- **The shell has no router.** Any new project-detail navigation should stay local to the selected project surface unless S04 intentionally adds a new top-level shell tab.
- **Current artifact data is thin.** Per-stage durable detail today is mostly `description`, `output`, `approval`, `durationLabel`, and mapped agents. M001 should present that truth clearly without pretending M002’s full artifact set already exists.
- **Text-dense assertions are noisy in this repo.** Prior slices found `data-testid` and selector-level checks more reliable than broad page-text assertions.

## Common Pitfalls

- **Turning dossier/handoff into UI-only copy** — if section readiness or approval labels are recomputed inside components, S04 will reintroduce drift immediately. Keep that logic in selectors.
- **Hiding the future packet contract inside `meta` by default** — `meta` is flexible, but if the packet structure is meant to become a durable cross-milestone contract, anonymous nested blobs will get hard to reason about quickly.
- **Implying approval history that doesn’t exist** — the current model can show “current approval state” and the latest note, not a full audit trail.
- **Overfitting the packet to current demo copy** — M001 only defines structure. Keep section IDs and labels stable enough for M002 research outputs and M003 packaging to populate later.
- **Adding a new full-screen dossier surface too early** — duplicating selected-project context across a new shell tab can create more navigation complexity than value. Start from the existing selected-project seam unless layout pressure proves otherwise.
- **Forgetting the restore path** — any new dossier fields or packet contracts that persist must survive `lumon.registry.v1` reloads and older envelopes without corrupting selection or stage IDs.

## Open Risks

- The current working brief inputs may feel too sparse; S04 may need to decide whether a thin brief is acceptable for M001 or whether the slice should add a small explicit brief contract now.
- If S04 introduces new durable project fields, it will need model/reducer/persistence test coverage and careful backward-compat handling for older saved envelopes.
- The dashboard right pane is already dense (header, pipeline snapshot, agent roster, terminal). Adding dossier/handoff subviews without tightening information hierarchy could hurt legibility.
- The proof registry issue from S03 still applies: localStorage may contain deterministic verification projects, so UI research/debugging should check `window.localStorage['lumon.registry.v1']` before assuming seeded data.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| Lumon UI / detail-surface design | `frontend-design` | installed |
| React component/state patterns | `vercel-react-best-practices` | installed |
| Tailwind CSS layout work | `josiahsiegel/claude-plugin-marketplace@tailwindcss-advanced-layouts` | available — install with `npx skills add josiahsiegel/claude-plugin-marketplace@tailwindcss-advanced-layouts` |
| Vite app structure | `antfu/skills@vite` | available — install with `npx skills add antfu/skills@vite` |
| Testing Library integration tests | `jezweb/claude-skills@testing-library` | available — install with `npx skills add jezweb/claude-skills@testing-library` |

## Sources

- The selected-project selector already exposes most of the stage and approval truth S04 needs, including current stage, current gate, selected stage, stage timeline, and handoff readiness (source: repo inspection — `src/lumon/selectors.js`).
- The current project model preserves only explicit fields and will drop unknown top-level dossier/handoff properties unless the model is extended (source: repo inspection — `src/lumon/model.js`, `src/lumon/reducer.js`).
- The mission-control shell has no dossier surface yet; the existing selected-project pane in the dashboard is the smallest safe seam for overview/dossier/handoff navigation (source: repo inspection — `src/features/mission-control/MissionControlShell.jsx`, `src/features/mission-control/DashboardTab.jsx`).
- Approval records are point-in-time state with latest note/context, not a historical audit ledger, so S04 should show current approval truth without implying event history (source: repo inspection — `src/lumon/model.js`, `src/lumon/selectors.js`).
- M002 expects durable stage outputs and a project dossier inside Lumon, while M003 expects an inspectable handoff packet that preserves dossier fidelity. S04’s structure therefore needs stable section IDs and not just decorative placeholder cards (source: milestone context — `.gsd/milestones/M002/M002-CONTEXT.md`, `.gsd/milestones/M003/M003-CONTEXT.md`).
