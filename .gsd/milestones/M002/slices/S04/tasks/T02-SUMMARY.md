---
id: T02
parent: S04
milestone: M002
provides:
  - Three dedicated artifact renderers (ArchitectureRenderer, SpecificationRenderer, PrototypeRenderer) for verification stage content
  - Generalized PipelineActions trigger for any queued stage
  - Offline mode guard on all pipeline action buttons with visible offline banner
key_files:
  - src/features/mission-control/ArtifactRenderer.jsx
  - src/features/mission-control/DashboardTab.jsx
  - src/lumon/__tests__/artifact-renderer.test.jsx
  - src/lumon/__tests__/offline-mode.test.jsx
key_decisions:
  - Keep "Trigger Discovery" as button label regardless of stage (per plan decision)
  - Export PipelineActions as named export from DashboardTab.jsx to enable isolated testing
patterns_established:
  - Priority badge color mapping (high=red, medium=amber, low=zinc) and HTTP method badge colors (GET=emerald, POST=blue, PUT=amber, DELETE=red) for specification renderer
observability_surfaces:
  - data-testid="pipeline-actions-offline" banner visible when server disconnected
  - data-testid="architecture-renderer", "specification-renderer", "prototype-renderer" confirm correct dispatch
  - All pipeline action buttons show disabled attribute when !connected
duration: 8m
verification_result: passed
completed_at: 2026-03-16
blocker_discovered: false
---

# T02: Add architecture renderers, generalize trigger button, and wire offline mode

**Added 3 verification-stage artifact renderers, generalized trigger to any queued stage, and wired offline mode with disabled buttons and banner.**

## What Happened

1. **Three new renderers** added to `ArtifactRenderer.jsx`:
   - `ArchitectureRenderer` — System Overview, Components (cards with name/responsibility/technology badge), Data Flow, Deployment Model, Recommendation (emerald)
   - `SpecificationRenderer` — Functional Requirements (id badge + priority color), Non-Functional Requirements, API Contracts (method badges: GET=emerald, POST=blue, PUT=amber, DELETE=red), Recommendation
   - `PrototypeRenderer` — Project Structure (preformatted), Entry Points, Dependencies (name + version badge), Setup Instructions (preformatted), Recommendation

2. All three registered in `TYPE_RENDERERS`: `architecture_outline`, `specification`, `prototype_scaffold`

3. **PipelineActions generalized**: `canTrigger` changed from `stageKey === "intake" && status === "queued"` to just `status === "queued"` — any queued stage can be triggered

4. **Offline mode wired**: `useServerSyncStatus().connected` guard added — all buttons disabled when disconnected, offline banner with WifiOff icon shown. PipelineActions still renders (not null) when disconnected so the offline state is visible.

5. **PipelineActions exported** as named export for isolated testing.

6. **19 new tests** written: 12 renderer tests (3 per renderer + 3 dispatch) and 7 offline mode tests.

## Verification

- `npx vitest run src/lumon/__tests__/artifact-renderer.test.jsx` — 52 tests passed (40 existing + 12 new)
- `npx vitest run src/lumon/__tests__/offline-mode.test.jsx` — 7 tests passed
- `npx vitest run` — 216 tests passed across 15 test files, zero regressions
- `npx vite build` — production build succeeds

### Slice-level verification status (T02 of 3):
- ✅ `npx vitest run` — 216 tests, zero regressions
- ✅ `src/lumon/__tests__/artifact-renderer.test.jsx` — extended with 3 new renderer tests + dispatch routing
- ✅ `src/lumon/__tests__/offline-mode.test.jsx` — PipelineActions disabled when disconnected, triggers disabled, dossier renders cached data
- ✅ `npx vite build` — production build succeeds
- ✅ `server/__tests__/verification-pipeline.test.js` — 26 tests pass (from T01)
- ⬜ `server/__tests__/rejection-iteration.test.js` — T03
- ⬜ `server/__tests__/full-pipeline.test.js` — T03

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run src/lumon/__tests__/artifact-renderer.test.jsx` | 0 | ✅ pass (52 tests) | 2.1s |
| 2 | `npx vitest run src/lumon/__tests__/offline-mode.test.jsx` | 0 | ✅ pass (7 tests) | 1.8s |
| 3 | `npx vitest run` | 0 | ✅ pass (216 tests) | 4.0s |
| 4 | `npx vite build` | 0 | ✅ production build | 3.2s |

## Diagnostics

- **Offline banner**: `data-testid="pipeline-actions-offline"` visible when `useServerSyncStatus().connected` is false
- **Button disabled state**: All pipeline action buttons (`trigger-discovery-btn`, `approve-btn`, `reject-btn`) have `disabled` attribute when disconnected
- **Renderer dispatch**: `data-testid="architecture-renderer"`, `data-testid="specification-renderer"`, `data-testid="prototype-renderer"` confirm correct TYPE_RENDERERS routing
- **Cached dossier**: ArtifactRenderer renders from useArtifact cache regardless of connection state — no loading/error states for previously fetched artifacts

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/features/mission-control/ArtifactRenderer.jsx` — Added ArchitectureRenderer, SpecificationRenderer, PrototypeRenderer + TYPE_RENDERERS entries
- `src/features/mission-control/DashboardTab.jsx` — Generalized PipelineActions trigger, added offline guard + banner, exported PipelineActions
- `src/lumon/__tests__/artifact-renderer.test.jsx` — 12 new tests for renderers + dispatch
- `src/lumon/__tests__/offline-mode.test.jsx` — New file with 7 offline mode tests
- `.gsd/milestones/M002/slices/S04/tasks/T02-PLAN.md` — Added Observability Impact section (pre-flight fix)
