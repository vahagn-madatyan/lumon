# S02: Project registry and persistence — UAT

**Milestone:** M001
**Written:** 2026-03-14

## UAT Type

- UAT mode: mixed
- Why this mode is sufficient: S02 is only proven when both automated persistence contracts and the real browser reload path agree that canonical projects, engine choice, and selection survive restore.

## Preconditions

- Dependencies are installed.
- A preview build is running locally (`npm run preview -- --host 127.0.0.1 --port 4174` or the auto-shifted port Vite reports).
- Browser localStorage is available.
- For the main create/reload check, start from the normal seeded fleet or clear `lumon.registry.v1` if you want a clean baseline.

## Smoke Test

Create one project from the real Mission Control shell, choose an engine, reload the page, and confirm the same project stays selected with the same engine badge.

## Test Cases

### 1. Create and restore a canonical project

1. Open the Mission Control preview in the browser.
2. Click **Spawn new project**.
3. Enter a project name and description.
4. Choose either **Claude Code** or **Codex CLI**.
5. Set an agent count and submit the modal.
6. Confirm the new project becomes the selected project immediately.
7. Reload the page.
8. **Expected:** The same project still exists, remains selected, and shows the same engine identity and description after reload.

### 2. Inspect persistence envelope directly

1. After creating a project, open browser devtools.
2. Read `window.localStorage.getItem('lumon.registry.v1')`.
3. Parse the stored JSON.
4. **Expected:** The payload is a versioned Lumon registry envelope containing canonical project records, the selected `projectId`, and the created project’s `engineChoice`.

## Edge Cases

### Intentionally empty registry restore

1. Seed `lumon.registry.v1` with a valid envelope whose `projects` array is empty.
2. Load or reload the app without passing an explicit `initialState`.
3. **Expected:** The app shows a coherent empty/create-first state instead of reseeding demo projects or crashing on a missing selection.

## Failure Signals

- A created project disappears after reload.
- The selected project changes unexpectedly after restore.
- Engine badges revert, disappear, or show the wrong engine after reload.
- The app silently reseeds demo projects over an intentionally empty registry.
- Console errors or failed network requests appear during create/reload verification.
- LocalStorage contains a malformed or unversioned registry payload.

## Requirements Proved By This UAT

- R002 — Proves the operator can create, store, browse, and revisit multiple canonical projects through local persistence.
- R012 — Proves each project carries an explicit persisted engine choice that survives reload.

## Not Proven By This UAT

- Stage-based pipeline progression, approvals, dossier views, and handoff packet structure.
- Real external handoff behavior to GSD, GitHub, or runtime agents.
- Rich project update/delete UI flows beyond the creation and restore path proven in this slice.

## Notes for Tester

- If port `4174` is busy, Vite may auto-shift to another preview port; use the actual reported preview URL.
- The most trustworthy runtime diagnostic is the stored `lumon.registry.v1` envelope combined with the selected-project surface in the dashboard.
- If automated browser text assertions seem noisy on the dense dashboard, inspect specific UI badges/selection state or localStorage instead of relying on broad body-text matching.
