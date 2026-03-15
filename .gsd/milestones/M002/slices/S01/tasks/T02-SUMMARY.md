---
id: T02
parent: S01
milestone: M002
provides:
  - "createPipelineStage accepts both string and { artifactId, summary, type } output formats"
  - "isStructuredOutput() and getOutputSummary() exported helpers for downstream consumers"
  - "All selector view models expose outputSummary, artifactId, and hasArtifact fields"
key_files:
  - src/lumon/model.js
  - src/lumon/selectors.js
  - src/lumon/__tests__/artifact-output.test.js
key_decisions:
  - "Output normalization happens at the model boundary (createPipelineStage), so every selector inherits the new shape without individual migration"
  - "Structured output objects are shallow-copied on create to prevent shared mutation"
  - "getOutputSummary falls back to artifactId when summary is absent, and to 'Pending' for null/non-object values"
patterns_established:
  - "isStructuredOutput(output) guard used consistently in selectors before accessing artifact fields"
  - "View models expose both raw output (full object or string) and computed outputSummary (always a display string)"
observability_surfaces:
  - none
duration: 20m
verification_result: passed
completed_at: 2025-03-15
blocker_discovered: false
---

# T02: Migrate stage output to structured artifact references

**Backward-compatible output normalization at the model boundary with full selector chain projection.**

## What Happened

Added `isStructuredOutput()` and `getOutputSummary()` helper functions to `model.js`. Updated `createPipelineStage` to shallow-copy structured artifact reference objects while leaving string outputs untouched. Updated three selector surfaces — stage view models in `buildProjectViewModel`, `buildDossierStageSection`, and `buildPacketEvidence` — to project `outputSummary` (always a display string), `artifactId` (string or null), and `hasArtifact` (boolean) from the raw output.

Dossier stage sections now use `getOutputSummary` for their `summary` field, so structured outputs display the summary text rather than `[object Object]`.

## Verification

- `npx vitest run` — **67 tests passed** (47 existing + 20 new), zero regressions
- `npx vitest run src/lumon/__tests__/artifact-output.test.js` — 20 tests: isStructuredOutput (6), getOutputSummary (5), createPipelineStage normalization (4), selector view models with both formats (5)

### Slice-level verification status

- ✅ `npx vitest run` — all existing M001 tests pass (backward-compatible)
- ✅ `server/__tests__/pipeline-api.test.js` — 15 API contract tests pass (T01)
- ✅ `src/lumon/__tests__/artifact-output.test.js` — 20 artifact-output tests pass (this task)
- ⬜ `src/lumon/__tests__/server-sync.test.js` — not yet created (T03)
- ⬜ Manual UAT — not yet (T04)

## Diagnostics

None — this task is pure model/selector logic with no runtime behavior.

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/lumon/model.js` — added `isStructuredOutput()`, `getOutputSummary()` exports; updated `createPipelineStage` output normalization
- `src/lumon/selectors.js` — imported new helpers; updated `buildDossierStageSection`, `buildPacketEvidence`, and stage view model builder to expose `outputSummary`, `artifactId`, `hasArtifact`
- `src/lumon/__tests__/artifact-output.test.js` — new test file with 20 tests covering both output formats through model and selector chain
