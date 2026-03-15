---
estimated_steps: 5
estimated_files: 5
---

# T02: Live browser acceptance and M001 milestone closure

**Slice:** S06 — End-to-end operator loop integration
**Milestone:** M001

## Description

Run the same operator loop scenarios from T01 in the real browser against a running dev/preview server. This is the final M001 acceptance evidence — the milestone definition of done requires "the real browser entrypoint supports a coherent operator loop" verified against live browser behavior. After verification, produce the S06 summary, mark the slice and milestone complete, and update project state.

## Steps

1. Build the app and start a preview server
2. Verify project creation through the real modal:
   - Open new-project modal, fill name/description, select engine, submit
   - Confirm the new project appears on the dashboard with correct pipeline state
   - Use `browser_evaluate` to inspect `window.localStorage['lumon.registry.v1']` and confirm persisted canonical state
3. Verify detail inspection surfaces:
   - Check dossier and handoff tab content (use `browser_evaluate` for selector output if Base UI tab switching is unreliable)
   - Switch to orchestration tab, confirm pipeline status/stage/gate/approval match dashboard
   - Switch to Severed Floor tab, confirm diagnostics match (fall back to `browser_evaluate` with `selectFloorViewModel` if tab switching fails)
4. Verify persistence:
   - Reload the page
   - Confirm the project and selection survive reload
   - Confirm pipeline state and detail surfaces restore correctly
5. Produce milestone closure artifacts:
   - Write S06 summary with verification evidence
   - Update M001 roadmap to mark S06 complete
   - Update STATE.md, PROJECT.md, and REQUIREMENTS.md to reflect milestone completion
   - Commit all closure artifacts

## Must-Haves

- [ ] Project creation works in the real browser
- [ ] Dashboard, orchestration, and floor surfaces show consistent pipeline state
- [ ] Persistence survives page reload
- [ ] All M001 milestone success criteria confirmed against live behavior
- [ ] S06 summary, state, and roadmap artifacts written

## Verification

- Browser assertions pass for: project visible on dashboard after creation, pipeline state correct, floor diagnostics match, reload preserves state
- No console errors or failed network requests during the acceptance pass
- M001 success criteria checklist verified against live behavior

## Inputs

- T01 summary — confirms the jsdom integration test passed and the old shell test was removed
- M001 context success criteria — the acceptance checklist this task verifies against
- S03/S04/S05 forward intelligence — Base UI tab fragility workaround, modal input patterns

## Expected Output

- `.gsd/milestones/M001/slices/S06/S06-SUMMARY.md` — slice summary with verification evidence
- `.gsd/milestones/M001/M001-ROADMAP.md` — S06 marked complete
- `.gsd/STATE.md` — reflects M001 completion
- `.gsd/PROJECT.md` — updated to reflect the shipped M001 state
- `.gsd/REQUIREMENTS.md` — supporting requirements updated if applicable
