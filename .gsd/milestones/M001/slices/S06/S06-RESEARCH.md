# S06: End-to-end operator loop integration — Research

**Date:** 2026-03-15

## Summary

S06 is the final assembly slice for M001. Its job is proving the full operator loop — create a project, inspect it across dashboard/dossier/handoff, advance or observe pipeline state, and watch the Severance floor stay synchronized — actually works in the real browser entrypoint. The machinery already exists: S01–S05 built the canonical state spine, persistence, pipeline model, dossier contract, and floor integration. S06 assembles no new domain capability. It proves the connections.

The entire codebase is already wired through one selector-owned state contract. `selectDashboardProjects`, `selectSelectedProjectDetail`, `selectOrchestrationInput`, and `selectFloorViewModel` all derive from `buildProjectListViewModels()` which itself reads canonical reducer state. The project-creation flow through `NewProjectModal → createProjectSpawnInput → addProject` is proven in the project-registry test. Dashboard/orchestration/floor synchronization is proven in individual slice tests. What does not yet exist is a single integrated test that exercises the full loop end-to-end, and a real browser verification pass that proves it in the running app.

The primary risk is test render performance — the existing `mission-control-shell.test.jsx` times out at 5s when rendering the full 14-project seed. S06 tests must use a minimal fixture (1–3 projects) to stay well under the timeout. The secondary risk is Base UI tab switching in automated browser contexts — S05 documented that Playwright `click` on Base UI tabs doesn't reliably trigger the composite state change. The browser verification will need to work around this (keyboard navigation or direct URL/state inspection).

## Recommendation

Split S06 into two tasks:

**T01 — Integration test contract:** Write a single comprehensive Vitest + RTL test that exercises the full operator loop with a lean fixture: create a project from empty state → confirm it appears on dashboard with correct pipeline/stage/gate/approval state → switch to dossier/handoff tabs and confirm selector-owned content → switch to orchestration tab and confirm pipeline agreement → switch to Severance Floor tab and confirm floor diagnostics match dashboard → reload and confirm persistence. This test replaces the broken `mission-control-shell.test.jsx` with a version that uses 1–2 projects instead of 14, includes the pipeline/dossier/handoff verification that was missing, and actually passes within the 5s timeout. The test should also verify cross-surface project selection synchronization (select on dashboard → floor agrees, select on floor → dashboard agrees).

**T02 — Live browser acceptance:** Start the dev or preview server and run real browser verification of the end-to-end loop. This covers the same scenarios as T01 but in a real browser with real rendering. Verify: create project, inspect all detail tabs, check orchestration agreement, check floor synchronization, reload persistence. This also produces the final M001 acceptance evidence against the milestone context success criteria.

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| Project creation with canonical stages | `createProjectSpawnInput()` + `createLumonState()` in `src/lumon/model.js` | Already proven by S02/S03 tests — generates stable IDs, agents, and stage taxonomy |
| Pipeline/stage/gate status derivation | `selectDashboardProjects`, `selectSelectedProjectDetail`, `selectOrchestrationInput` in `src/lumon/selectors.js` | One contract drives all surfaces — don't re-derive pipeline truth |
| Floor diagnostics | `selectFloorViewModel` + `buildFloorDiagnostics` in `src/lumon/selectors.js` | Already maps pipeline status to department diagnostics |
| Persistence round-trip | `lumonLocalPersistence` + `LUMON_REGISTRY_STORAGE_KEY` in `src/lumon/persistence.js` | Proven reload-safe in S02 persistence tests |
| Dossier and packet contract | `selectSelectedProjectDetail(state).dossier` / `.handoffPacket` | Selector-owned — already proven in S04 dossier tests |
| Test factory for proof projects | `createCanonicalPrebuildStages` with `stageOverrides` | Used by every existing rendered test — produces any desired pipeline state |

## Existing Code and Patterns

- `src/features/mission-control/__tests__/project-registry.test.jsx` — **The closest existing pattern for S06.** Creates a project from empty state, verifies dashboard + pipeline + dossier + orchestration surfaces, reloads, and confirms persistence. S06 should extend this pattern to also cover floor synchronization and cross-surface selection.
- `src/features/mission-control/__tests__/severance-floor-live-state.test.jsx` — Proves dashboard↔floor synchronization for multiple pipeline states. S06 should test that selection events propagate across tab boundaries, not just that static state renders correctly.
- `src/features/mission-control/__tests__/project-dossier.test.jsx` — Proves tab switching between Overview/Dossier/Handoff and selector-owned content rendering. S06 should include this verification as part of the full loop rather than duplicating it in isolation.
- `src/features/mission-control/__tests__/mission-control-shell.test.jsx` — **Pre-existing timeout failure.** Renders 14-project seed and times out at 5s. S06 should supersede this test with a lean fixture that actually passes.
- `src/features/mission-control/NewProjectModal.jsx` — Modal uses controlled `<Input>` components that require `fireEvent.change` with `{ target: { value: ... } }` for test automation. The submit button is disabled when name is empty.
- `src/components/ui/tabs.jsx` — Uses `@base-ui/react` `TabsPrimitive.Root/Tab/Panel`. Tab activation uses `data-active` attribute instead of `data-state="active"`. In jsdom, `fireEvent.click` on `screen.getByRole("tab", { name: ... })` works correctly (the project-registry test proves this). The S05-documented Playwright issue is specific to real-browser automation, not jsdom.
- `src/lumon/context.jsx` — `LumonProvider` takes optional `initialState` and `persistence` props. When `initialState` is provided, it overrides persisted state. When omitted, it falls back to persistence → seed. The `MissionControl` wrapper passes both through.

## Constraints

- **5s default test timeout.** The 14-project seed causes render timeouts. S06 tests must use `createLumonState({ projects: [...] })` with 1–3 proof projects, not `createSeedLumonState()`.
- **Base UI tab automation in jsdom.** `fireEvent.click(screen.getByRole("tab", { name: ... }))` works in jsdom for Base UI tabs (proven by existing tests). The fragility warning from S05 applies to Playwright browser automation only.
- **Base UI tab automation in real browser.** `browser_click` on Base UI tabs may not trigger panel switching. Workaround: use keyboard navigation (Tab/ArrowRight), or verify floor content by checking `data-testid` presence without tab switching when the floor is already rendered.
- **`css: true` in vitest config.** CSS is processed during tests, which adds render time. Each additional project increases render cost significantly.
- **No route-level navigation.** The app is a single-page shell with tab-based navigation. There are no distinct URL routes to navigate between dashboard/orchestration/floor — everything is tab switching within `MissionControlShell`.

## Common Pitfalls

- **Rendering the full seed in S06 tests** — The existing shell test proves this causes timeouts. Use `createLumonState({ projects: [proof1, proof2] })` with at most 2–3 lean projects. The project-registry test already demonstrates this lean-fixture pattern.
- **Assuming `data-state="active"` for Base UI tabs** — Base UI uses `data-active` (a boolean attribute), not `data-state="active"` like Radix. Don't assert on `data-state`.
- **Testing floor diagnostics without a selected project** — `selectFloorViewModel(state).selectedProjectDiagnostics` is null when no project is selected. The test must select a project before asserting on floor diagnostics.
- **Forgetting to clear localStorage in `beforeEach`** — The test setup already does this globally in `src/test/setup.js`, but be aware: if a test unmounts and remounts without clearing storage, it will pick up the previously persisted state. This is actually useful for testing reload continuity.
- **New-project modal submit with empty name** — The submit button is disabled when `form.name.trim()` is falsy. The test must set the name field before clicking submit.

## Open Risks

- **Shell test timeout budget.** Even with 2–3 projects, the full shell render includes the floor SVG, terminal panel, and all tab content. If the S06 integration test approaches the 5s limit, it may need to set `testTimeout` or split assertions across multiple `it()` blocks to stay reliable.
- **Base UI tab switching in Playwright.** The browser verification pass needs to switch between Dashboard, Orchestration, and Severed Floor tabs. If `browser_click` doesn't trigger Base UI tab switching reliably, the workaround is: inspect localStorage and selector output via `browser_evaluate` to prove state agreement without relying on rendered tab panel visibility.
- **Floor SVG rendering in jsdom.** The floor uses SVG with `getBBox` — the test setup already stubs this, but complex SVG interactions (zoom, pan) won't work in jsdom. The integration test should assert on `data-testid` diagnostic surfaces, not SVG geometry.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| React Testing Library | `react-testing-library` | installed (available_skills) |
| Vitest | — | none found (core test framework, no skill needed) |
| @base-ui/react | — | none found (tab behavior already understood from codebase) |

## Sources

- Existing test patterns and Base UI tab behavior (source: codebase analysis of 7 existing test files and `src/components/ui/tabs.jsx`)
- S05 forward intelligence on Base UI tab fragility (source: `.gsd/milestones/M001/slices/S05/S05-SUMMARY.md`)
- S04 forward intelligence on modal input events (source: `.gsd/milestones/M001/slices/S04/S04-SUMMARY.md`)
