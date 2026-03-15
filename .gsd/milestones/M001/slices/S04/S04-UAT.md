# S04: Project dossier and handoff packet views — UAT

**Milestone:** M001
**Written:** 2026-03-14 20:25 PDT

## UAT Type

- UAT mode: mixed
- Why this mode is sufficient: selector and rendered tests prove the contract shape, while live browser checks prove the real detail seam, reload continuity, and empty-registry fallback behavior.

## Preconditions

- Local app running via `npm run preview -- --host 127.0.0.1 --port 4173` or an equivalent local Vite server
- Browser starts from either an empty registry or a known `window.localStorage['lumon.registry.v1']` envelope
- For a clean rerun, clear or replace `window.localStorage['lumon.registry.v1']` before loading the app

## Smoke Test

Spawn one project, open `Dossier`, then open `Handoff`. The same selected project description should appear in the brief, and packet sections should show explicit readiness or missing reasons instead of blank space.

## Test Cases

### 1. Selected-project detail seam shows canonical dossier and handoff state

1. Open Dashboard.
2. Click **Spawn new project** and create a project with a name and description.
3. Confirm **Overview** is visible by default for the selected project.
4. Switch to **Dossier**.
5. Switch to **Handoff**.
6. **Expected:** Overview, Dossier, and Handoff all reflect the same selected project, dossier brief text matches the project description, stage outputs remain visible, and packet sections show `waiting`, `blocked`, or `missing` reasons when artifacts do not exist yet.

### 2. Reload-safe selected-project continuity

1. Create at least two projects.
2. Select the later project so it becomes the active detail context.
3. Reload the app.
4. Open **Dossier** and **Handoff** again.
5. **Expected:** the same project remains selected after reload, and the dossier/handoff panels still render that project’s brief, stage state, and packet status.

## Edge Cases

### Intentionally empty registry restore

1. Replace `window.localStorage['lumon.registry.v1']` with a valid empty registry envelope and reload.
2. **Expected:** `dashboard-empty-registry` and `dashboard-no-selected-project` remain explicit, the detail pane asks the operator to create the first project, and the nested Overview/Dossier/Handoff tabs do not render.

### Missing packet evidence stays visible

1. Use a project that has not produced plan or later-stage outputs yet.
2. Open **Dossier** and **Handoff**.
3. **Expected:** stage-output and packet sections stay visible with honest `waiting` or `missing` copy instead of disappearing or implying stored artifacts.

## Failure Signals

- Dossier or Handoff tabs do not appear for a selected project
- Brief text diverges from the selected project description
- Packet sections disappear instead of showing waiting/missing/blocked reasons
- Reload changes the selected project unexpectedly
- Empty-registry restore leaves stale detail chrome behind
- Console errors or failed network requests appear during reload or fallback testing

## Requirements Proved By This UAT

- R010 — proves the live dossier/handoff inspection seam, packet outline, reload-safe detail rendering, and honest missing-state diagnostics established by M001/S04

## Not Proven By This UAT

- Real architecture diagrams, spec files, prototype artifacts, or stored handoff payloads
- Repo creation, artifact upload, or GSD bootstrap
- Severed Floor live-state synchronization

## Notes for Tester

The create-project modal expects real typed input before **Create canonical project** enables. The empty registry state is valid behavior, not a crash, and should still leave the operator with clear next actions.
