---
estimated_steps: 4
estimated_files: 4
---

# T02: Migrate stage output to structured artifact references

**Slice:** S01 — Bridge Server & Intake Stage
**Milestone:** M002

## Description

Migrate `stage.output` from a plain string to a format that supports structured artifact references (`{ artifactId, summary, type }`) while remaining backward-compatible with all existing M001 surfaces and tests. The coercion happens at the model boundary (`createPipelineStage`) so every downstream selector and view model inherits the new shape.

## Steps

1. In `src/lumon/model.js`, update `createPipelineStage` to normalize `stage.output`:
   - If output is a string, store it as-is (legacy format — no migration cost for seeded data)
   - If output is an object with `artifactId`, preserve the full `{ artifactId, summary, type }` shape
   - Add a helper `isStructuredOutput(output)` that returns true for artifact-reference objects
   - Add a helper `getOutputSummary(output)` that returns the display string from either format
2. In `src/lumon/selectors.js`, update all view model builders that read `stage.output`:
   - Add `outputSummary` (always a display string) alongside `output` (raw value)
   - Add `artifactId` (string or null) for structured outputs
   - Add `hasArtifact` boolean for conditional UI rendering
   - Update `buildDossierStageSection` to use `getOutputSummary` for display and expose `artifactId`
   - Update `buildPacketEvidence` to pass through `artifactId`
3. Write `src/lumon/__tests__/artifact-output.test.js`:
   - `createPipelineStage` with string output returns string output unchanged
   - `createPipelineStage` with `{ artifactId, summary, type }` preserves the object
   - `getOutputSummary` returns display text from both formats
   - Selector view models project `outputSummary`, `artifactId`, and `hasArtifact` correctly for both formats
   - Dossier stage sections work with both output types
4. Run `npx vitest run` — confirm all 32 existing M001 tests still pass plus new artifact-output tests

## Must-Haves

- [ ] `createPipelineStage` accepts both string and structured object output without breaking
- [ ] `getOutputSummary` returns a display string from either format
- [ ] All selector view models expose `outputSummary`, `artifactId`, and `hasArtifact`
- [ ] Zero regressions in existing M001 test suite
- [ ] Dossier and handoff packet selectors work correctly with artifact references

## Verification

- `npx vitest run` — all 32+ existing tests pass
- `npx vitest run src/lumon/__tests__/artifact-output.test.js` — new artifact-output tests pass

## Inputs

- `src/lumon/model.js` — current `createPipelineStage` with `output: input.output ?? "Pending"` (line ~268)
- `src/lumon/selectors.js` — view model builders that reference `stage.output`
- D023 decision: structured artifact references replace string stage output

## Expected Output

- `src/lumon/model.js` — updated with output normalization helpers and backward-compatible coercion
- `src/lumon/selectors.js` — updated view models with `outputSummary`, `artifactId`, `hasArtifact`
- `src/lumon/__tests__/artifact-output.test.js` — new test file proving both output formats work through the model and selector chain
