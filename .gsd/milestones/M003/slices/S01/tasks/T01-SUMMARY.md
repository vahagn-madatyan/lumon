---
id: T01
parent: S01
milestone: M003
provides:
  - Provisioning service module with preview/provision/getStatus
  - Artifact-to-markdown formatters for all 9 artifact types
  - GSD bootstrap file generator matching this repo's .gsd/ structure
  - CLI helpers (execGh/execGit) wrapping node:child_process execFile
key_files:
  - server/provisioning.js
  - server/__tests__/provisioning.test.js
  - eslint.config.js
key_decisions:
  - Used _setExecFile/_resetExecFile injection pattern instead of vi.mock for ESM-compatible CLI mocking
  - Added node globals override in eslint.config.js for server/ files
patterns_established:
  - Provisioning service uses in-memory Map state tracker (same pattern as pipeline.js)
  - Test injection via _setExecFile/_setWorkspaceRoot for deterministic CLI and filesystem mocking
  - formatArtifactToMarkdown type-dispatch table mirrors ArtifactRenderer TYPE_RENDERERS pattern
observability_surfaces:
  - "[provisioning]" prefixed console logs for each step start/complete/fail
  - getStatus(projectId) returns step-level state with timestamps and errors
  - Failed provisioning includes step name, error message, and partial completion state
duration: 25m
verification_result: passed
completed_at: 2026-03-17
blocker_discovered: false
---

# T01: Build provisioning service with artifact formatting and GSD bootstrap

**Built provisioning service with 5-step execution sequence, 9 artifact-type markdown formatters, and GSD bootstrap generator — 40 tests pass with mocked CLI.**

## What Happened

Created `server/provisioning.js` (~380 lines) exporting `preview()`, `provision()`, `getStatus()`, `formatArtifactToMarkdown()`, and `generateGsdBootstrap()`. The module follows the same in-memory Map state tracker pattern as `server/pipeline.js`.

Key implementation details:
- `execGh()` and `execGit()` wrap a mutable `execFileAsync` reference that tests can replace via `_setExecFile()` — this avoids the vi.mock/ESM binding issues with Vitest 4's handling of `node:child_process`.
- `formatArtifactToMarkdown()` dispatches on artifact type through a lookup table (mirroring the `ArtifactRenderer` pattern). All 9 types produce readable markdown with `#` headers and structured sections matching the content shapes from the existing renderers.
- `generateGsdBootstrap()` produces 5 files (PROJECT.md, REQUIREMENTS.md, preferences.md, STATE.md, M001-ROADMAP.md) matching this repo's `.gsd/` format per D041.
- `provision()` runs 5 steps in sequence (repo-create → clone → artifact-write → gsd-init → commit-push) with per-step status tracking. On failure, execution stops and the failing step records the error.
- Workspace root is configurable via `LUMON_WORKSPACE_ROOT` env var (D044), with a `_setWorkspaceRoot()` test helper.

Also added a `server/**/*.js` override in `eslint.config.js` to include Node globals — previously server files linted against browser globals only, causing `process` to be flagged.

## Verification

- `npx vitest run server/__tests__/provisioning.test.js` — 40 tests pass
- `npx vitest run` — 263 tests pass across 18 files (zero regressions)
- `npm run build` — build succeeds
- `npx eslint server/provisioning.js server/__tests__/provisioning.test.js` — lint clean

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run server/__tests__/provisioning.test.js` | 0 | ✅ pass | 2.7s |
| 2 | `npx vitest run` | 0 | ✅ pass | 5.8s |
| 3 | `npm run build` | 0 | ✅ pass | 2.2s |
| 4 | `npx eslint server/provisioning.js server/__tests__/provisioning.test.js` | 0 | ✅ pass | 2.6s |

Slice-level checks (partial — T01 is 1 of 4 tasks):
| # | Check | Status |
|---|-------|--------|
| 1 | `npx vitest run` — all tests pass | ✅ pass (263/263) |
| 2 | `server/__tests__/provisioning.test.js` — provisioning service tests | ✅ pass (40/40) |
| 3 | `server/__tests__/provisioning-routes.test.js` — route tests | ⬜ T02 |
| 4 | `src/lumon/__tests__/provisioning-state.test.js` — state tests | ⬜ T03 |
| 5 | `src/features/mission-control/__tests__/provisioning-ui.test.jsx` — UI tests | ⬜ T04 |
| 6 | `npm run build` — build succeeds | ✅ pass |
| 7 | `npx eslint server/ src/lumon/ src/features/mission-control/` — lint clean | ⚠️ 14 pre-existing errors (none from T01 files) |

## Diagnostics

- **Step-level state:** `getStatus(projectId)` returns `{ projectId, status, startedAt, completedAt, error, steps[] }` where each step has `{ name, status, startedAt, completedAt, error }`.
- **Log prefix:** All provisioning operations emit `[provisioning]` prefixed console logs with step name and projectId.
- **Failure shape:** On failure, `record.error` contains `"Step '<stepName>' failed: <message>"` and the specific step's `error` field has the raw message. Steps after the failure remain `"pending"`.

## Deviations

- Used `_setExecFile()` / `_setWorkspaceRoot()` test injection instead of `vi.mock('node:child_process')` because Vitest 4 ESM mocking doesn't intercept `promisify`-wrapped bindings. This is a cleaner pattern for ESM server modules.
- Added `server/**/*.js` Node globals override to eslint.config.js — not in the task plan but required for lint compliance since server files use `process.env`.
- Vitest 4 changed test options API — `it("name", fn, { timeout })` is now `it("name", { timeout }, fn)`.

## Known Issues

- 14 pre-existing lint errors in existing files (react-hooks/set-state-in-effect in sync.js, unused vars in some test files). These are not from T01 changes.

## Files Created/Modified

- `server/provisioning.js` — New provisioning service module (~380 lines) with preview, provision, getStatus, formatArtifactToMarkdown, generateGsdBootstrap, execGh, execGit
- `server/__tests__/provisioning.test.js` — Comprehensive test file (40 tests) covering CLI helpers, all 9 artifact formatters, GSD bootstrap, preview, provision step execution, failure handling, and state tracking
- `eslint.config.js` — Added `server/**/*.js` override with Node globals
