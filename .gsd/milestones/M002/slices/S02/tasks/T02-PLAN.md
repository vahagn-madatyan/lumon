---
estimated_steps: 6
estimated_files: 7
---

# T02: Multi-artifact client sync and rich artifact rendering in dossier

**Slice:** S02 — Research & Business Planning Stages
**Milestone:** M002

## Description

Close the client-side loop: accumulate multiple artifact-ready SSE events per stage, project them through selectors, fetch artifact content from the server, and render structured business plan / tech research content in expandable dossier cards. This is the user-visible payoff — without it, research artifacts are invisible references stored on disk.

## Steps

1. **Accumulate multi-artifact references in sync.js** — Update the `artifact-ready` event handler in `useServerSync`. Instead of setting `stage.output` to a single `{ artifactId, summary, type }`, accumulate into `{ artifactId, summary, type, artifactIds: [...] }` where `artifactId` is always the latest and `artifactIds` collects all artifact IDs for the stage. Use a `lumon/append-artifact` reducer action (or extend the existing `lumon/update-stage` with merge semantics) so that the second artifact-ready event doesn't clobber the first's reference.

2. **Extend selectors for multi-artifact projection** — Update `buildDossierStageSection` in `selectors.js` to project `artifactIds` (array) from `stage.output.artifactIds` when present. Keep `artifactId` as the primary for single-artifact stages. Update `buildHandoffPacketEvidenceChain` similarly. Update existing artifact-output tests to cover the new `artifactIds` array projection.

3. **Create useArtifact hook** — Add `src/lumon/useArtifact.js` with a `useArtifact(artifactId)` hook. On mount, fetch `GET /api/artifacts/${artifactId}`. Return `{ artifact, loading, error }`. Cache fetched artifacts in a module-level Map so repeated renders don't re-fetch. Handle null/undefined artifactId (return `{ artifact: null, loading: false, error: null }`).

4. **Create ArtifactRenderer component** — Add `src/features/mission-control/ArtifactRenderer.jsx`. Top-level component dispatches on `artifact.type`:
   - `viability_analysis` → `ViabilityRenderer` — renders `marketAssessment`, `technicalFeasibility`, `riskFactors`, `recommendation` as collapsible sections
   - `business_plan` → `BusinessPlanRenderer` — renders `targetAudience`, `pricingPosture`, `featurePhases`, `revenueModel`, `recommendation`
   - `tech_research` → `TechResearchRenderer` — renders `approaches` as a scored comparison list, `tradeoffs`, `recommendation`
   - Unknown type → generic JSON fallback with formatted content
   
   Each sub-renderer follows the Severance aesthetic: `font-mono`, zinc color palette, expandable sections via Collapsible, score badges where applicable. Include `data-testid` attributes for test targeting.

5. **Wire ArtifactRenderer into DossierStageOutputCard** — When `section.hasArtifact` is true, render the summary text immediately (from `section.outputSummary`), then render an `ArtifactDetailPanel` below it that fetches and displays the full artifact content using `useArtifact` and `ArtifactRenderer`. For multi-artifact stages (`section.artifactIds?.length > 1`), render each artifact in its own collapsible panel. Show a loading skeleton while fetching.

6. **Write tests** — Add `src/lumon/__tests__/artifact-renderer.test.jsx`:
   - ArtifactRenderer dispatches to correct sub-renderer by type
   - BusinessPlanRenderer renders all expected sections
   - TechResearchRenderer renders scored approaches
   - ViabilityRenderer renders existing S01 format
   - Unknown type falls back to generic renderer
   - Loading state renders skeleton
   
   Update `src/lumon/__tests__/artifact-output.test.js`:
   - Multi-artifact `artifactIds` array projected by `buildDossierStageSection`
   - Single-artifact backward compatibility preserved

## Must-Haves

- [ ] Multiple artifact-ready events for the same stage accumulate — second event doesn't clobber first
- [ ] Selectors project `artifactIds` array for multi-artifact stages
- [ ] `useArtifact` fetches and caches artifact content with loading/error state
- [ ] ArtifactRenderer renders business_plan, tech_research, viability_analysis types with structured sections
- [ ] DossierStageOutputCard shows rich artifact content instead of plain text when hasArtifact is true
- [ ] Summary text renders immediately; full artifact content loads progressively

## Verification

- `npx vitest run` — all tests pass including new `artifact-renderer.test.jsx` and updated `artifact-output.test.js`
- `npx vite build` — production build succeeds (no import errors, component tree compiles)
- Zero regressions in M001 tests (32) and S01 server tests (15)

## Inputs

- `src/lumon/sync.js` — S01 SSE event handlers to extend for accumulation
- `src/lumon/selectors.js` — S01 `buildDossierStageSection` to extend for `artifactIds`
- `src/features/mission-control/DashboardTab.jsx` — S01 `DossierStageOutputCard` to wire artifact rendering into
- T01's artifact content schemas — `business_plan` sections (targetAudience, pricingPosture, featurePhases, revenueModel, recommendation), `tech_research` sections (approaches, tradeoffs, recommendation)
- T01's artifact list endpoint — `GET /api/artifacts/project/:projectId/stage/:stageKey`

## Expected Output

- `src/lumon/sync.js` — updated to accumulate multi-artifact references
- `src/lumon/selectors.js` — projects `artifactIds` array in dossier sections
- `src/lumon/useArtifact.js` — fetch + cache hook for artifact content
- `src/features/mission-control/ArtifactRenderer.jsx` — type-dispatched structured content rendering
- `src/features/mission-control/DashboardTab.jsx` — DossierStageOutputCard wired to ArtifactRenderer
- `src/lumon/__tests__/artifact-output.test.js` — updated with multi-artifact projection tests
- `src/lumon/__tests__/artifact-renderer.test.jsx` — renderer dispatch and content tests
