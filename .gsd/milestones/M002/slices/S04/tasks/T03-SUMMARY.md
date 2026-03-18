---
id: T03
parent: S04
milestone: M002
provides:
  - Rejection/iteration resilience proven — reject → re-trigger → approve lifecycle works cleanly without state corruption
  - Full pipeline integration proven — 9 artifacts across 4 stages (intake, research, plan, verification) with auto-triggers and sequential orchestration
  - Multi-stage rejection isolation proven — rejecting one stage doesn't corrupt others
  - Artifact accumulation across rejections proven — multiple rejections accumulate all callback artifacts
key_files:
  - server/__tests__/rejection-iteration.test.js
  - server/__tests__/full-pipeline.test.js
key_decisions:
  - Increased timeout for sequential-orchestration test to 15s due to ~15 sequential HTTP requests under parallel test load
patterns_established:
  - Full-pipeline integration tests mock global.fetch with a global N8N_WEBHOOK_URL to enable auto-trigger chains, then reset fetchCalls between phases to isolate verification of each auto-trigger
observability_surfaces:
  - Run `npx vitest run server/__tests__/rejection-iteration.test.js` to verify rejection/iteration resilience (4 tests)
  - Run `npx vitest run server/__tests__/full-pipeline.test.js` to verify full pipeline integration (3 tests)
  - Any failure reveals a regression in the pipeline state machine or artifact accumulation logic
duration: 10m
verification_result: passed
completed_at: 2026-03-17
blocker_discovered: false
---

# T03: Prove rejection/iteration resilience and full pipeline integration

**Capstone verification: 7 new tests prove rejection lifecycle resilience and full 4-stage pipeline integration producing 9 artifacts with auto-triggers and sequential orchestration**

## What Happened

Wrote two test files that serve as the authoritative proof for M002's core success criteria:

1. **`rejection-iteration.test.js`** (4 tests): Proves the rejection/iteration lifecycle is clean. Tests cover single-stage reject→re-trigger→approve, cross-stage rejection isolation (rejecting research doesn't corrupt intake), triple-rejection artifact accumulation (3 callbacks = 3 artifacts, no data loss), and execution record replacement (re-trigger creates a new executionId and `getStageExecution` returns the latest).

2. **`full-pipeline.test.js`** (3 tests): The authoritative end-to-end proof. The primary test drives all 4 stages from intake through verification to approved status, verifying: intake produces 1 artifact (viability_analysis), research produces 2 (business_plan, tech_stack), plan produces 3 (naming_candidates, domain_signals, trademark_signals), verification produces 3 (architecture_outline, specification, prototype_scaffold) — totaling 9 artifacts. Auto-trigger chains are tested in isolation (intake→research, plan→verification). Sequential orchestration is proven for all three multi-sub-stage stages in a dedicated test.

No production code was changed — these are pure test files exercising existing infrastructure.

## Verification

- `npx vitest run server/__tests__/rejection-iteration.test.js` — 4/4 tests pass
- `npx vitest run server/__tests__/full-pipeline.test.js` — 3/3 tests pass
- `npx vitest run` — **223 tests pass**, zero failures, zero regressions
- `npx vite build` — production build succeeds
- Test count: 171 (baseline) → 197 (T01 +26) → 204 (T02 +7) → 211 (T03 +7) = 211 from slice tasks, plus 12 tests from earlier work = **223 total**

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run server/__tests__/rejection-iteration.test.js` | 0 | ✅ pass | 2.7s |
| 2 | `npx vitest run server/__tests__/full-pipeline.test.js` | 0 | ✅ pass | 2.7s |
| 3 | `npx vitest run` | 0 | ✅ pass | 4.1s |
| 4 | `npx vite build` | 0 | ✅ pass | 1.5s |

### Slice Verification Checks

| # | Check | Verdict |
|---|-------|---------|
| 1 | `npx vitest run` — all tests pass, zero regressions from 171 baseline | ✅ 223 pass |
| 2 | `server/__tests__/verification-pipeline.test.js` — config, webhooks, sequential, auto-trigger, compat | ✅ 26 tests pass |
| 3 | `src/lumon/__tests__/artifact-renderer.test.jsx` — 3 new renderers + dispatch routing | ✅ 52 tests pass |
| 4 | `src/lumon/__tests__/offline-mode.test.jsx` — disabled actions, cached dossier | ✅ 7 tests pass |
| 5 | `server/__tests__/rejection-iteration.test.js` — rejection lifecycle, artifact integrity | ✅ 4 tests pass |
| 6 | `server/__tests__/full-pipeline.test.js` — end-to-end pipeline, 9 artifacts | ✅ 3 tests pass |
| 7 | `npx vite build` — production build succeeds | ✅ pass |
| 8 | verification-pipeline includes `recordFailure()` tests | ✅ 2 failure tests pass |

## Diagnostics

- **Rejection resilience:** Run rejection-iteration tests — each test logs `[bridge] POST /api/pipeline/approve ... decision=rejected` followed by re-trigger with new executionId, proving the state machine handles rejection cleanly.
- **Full pipeline tracing:** Full-pipeline test logs show the complete chain: `auto-trigger research after intake approval`, `sequential-next subStage=tech_stack after=business_plan`, `auto-trigger verification after plan approval`, `sequential-next subStage=specification after=architecture_outline`.
- **Artifact count verification:** `artifacts.getByProjectAndStage` assertions in the full-pipeline test verify exact counts: 1 + 2 + 3 + 3 = 9 total.

## Deviations

- Added `{ timeout: 15000 }` to the sequential-orchestration test because it makes ~15 sequential supertest requests and the default 5s timeout was hit under parallel test load. This is expected for integration tests that exercise long chains.

## Known Issues

None.

## Files Created/Modified

- `server/__tests__/rejection-iteration.test.js` — new: 4 tests proving rejection/iteration resilience (single-stage lifecycle, cross-stage isolation, multi-rejection accumulation, execution record replacement)
- `server/__tests__/full-pipeline.test.js` — new: 3 tests proving full pipeline integration (9 artifacts across 4 stages, auto-trigger chains, sequential orchestration for all multi-sub-stage stages)
- `.gsd/milestones/M002/slices/S04/tasks/T03-PLAN.md` — added Observability Impact section (pre-flight fix)
