---
estimated_steps: 6
estimated_files: 4
---

# T03: Add naming, domain, and trademark renderers with interactive selection

**Slice:** S03 — Naming & Brand Signal Stages
**Milestone:** M002

## Description

Add three new artifact renderers to the ArtifactRenderer dispatch table and wire the naming selection flow through the dossier UI. This is the only genuinely new UI pattern in S03 — the naming candidates renderer has interactive "Select" buttons that trigger domain/trademark checks via `triggerPipeline` with context data.

The domain and trademark renderers are passive display with mandatory advisory disclaimers per D026 ("These results are advisory signals, not legal clearance").

**Key design choice:** The naming selection callback (`onSelectName`) is prop-drilled from `DossierStageOutputCard` through `ArtifactDetailPanel` to `ArtifactRenderer` to `NamingCandidatesRenderer`. This keeps renderers testable without provider wrapping. The ArtifactRenderer accepts an optional `onAction` callback that is forwarded to interactive renderers.

## Steps

1. **Extend `triggerPipeline` in `src/lumon/sync.js`:**
   - Change signature to accept optional third argument: `triggerPipeline(projectId, stageKey, extra = {})`.
   - Spread `extra` into the POST body: `body: JSON.stringify({ projectId, stageKey, ...extra })`.
   - This is backward-compatible — existing calls with two args still work. The `extra` object can contain `subStage` and `context` fields.

2. **Add `NamingCandidatesRenderer` to `src/features/mission-control/ArtifactRenderer.jsx`:**
   - Accepts `{ content, onAction }` props. `onAction` is optional — if missing, selection buttons are disabled.
   - Renders a list of naming candidates from `content.candidates` array. Each candidate shows: `name` (prominent), `rationale` (description), `domainHint` (subtle hint), and `styleTags` as badges.
   - Each candidate has a "Select" button. On click, calls `onAction({ type: "select-name", selectedName: candidate.name })`.
   - If `content.methodology` exists, show it in a collapsed section at the top.
   - Uses `data-testid="naming-candidates-renderer"` and per-candidate `data-testid="naming-candidate-{index}"`.
   - Style: consistent with existing renderers (zinc-900 palette, font-mono, 10-11px sizes).

3. **Add `DomainSignalsRenderer` to `src/features/mission-control/ArtifactRenderer.jsx`:**
   - Accepts `{ content }` props (passive display).
   - Renders an advisory disclaimer banner at the top (amber border, amber text): the `content.disclaimer` text or a default "Domain availability is a point-in-time advisory signal, not a guaranteed reservation."
   - Renders the selected name as a header.
   - Renders each domain signal from `content.signals` array with: `domain` name, `status` badge (available=emerald, taken=red, premium=amber), optional `price`.
   - Uses `data-testid="domain-signals-renderer"` and `data-testid="domain-advisory-disclaimer"`.

4. **Add `TrademarkSignalsRenderer` to `src/features/mission-control/ArtifactRenderer.jsx`:**
   - Accepts `{ content }` props (passive display).
   - Renders an advisory disclaimer banner at the top: the `content.disclaimer` text or a default "Trademark signals are advisory only and do not constitute legal advice. Consult a trademark attorney before proceeding."
   - Renders the selected name as a header.
   - Renders each trademark signal from `content.signals` array with: `mark`, `status` badge (live=red/warning, dead=zinc/muted, pending=amber), `class`, optional `registrationNumber`, optional `owner`.
   - Uses `data-testid="trademark-signals-renderer"` and `data-testid="trademark-advisory-disclaimer"`.

5. **Wire the naming selection through `DossierStageOutputCard` in `src/features/mission-control/DashboardTab.jsx`:**
   - Register all three new renderers in `TYPE_RENDERERS` map in `ArtifactRenderer.jsx`: `naming_candidates: NamingCandidatesRenderer`, `domain_signals: DomainSignalsRenderer`, `trademark_signals: TrademarkSignalsRenderer`.
   - Modify `ArtifactRenderer` to accept and forward an optional `onAction` prop to the sub-renderer (only `NamingCandidatesRenderer` uses it, but the pattern is generic).
   - Modify `ArtifactDetailPanel` to accept and forward `onAction` prop.
   - **Important:** The `section` object from `buildDossierStageSection` does NOT include `projectId`. Thread `projectId` from `DossierPanel` (which receives `project`) through to `DossierStageOutputCard` as a new prop: `<DossierStageOutputCard key={section.id} section={section} projectId={project.id} />`.
   - In `DossierStageOutputCard`, accept `projectId` prop. Get `triggerPipeline` from `useLumonActions()`. Create an `onAction` handler that, when it receives `{ type: "select-name", selectedName }`, calls `triggerPipeline(projectId, "plan", { subStage: "domain_signals", context: { selectedName } })`. Pass `onAction` to `ArtifactDetailPanel`.

6. **Extend `src/lumon/__tests__/artifact-renderer.test.jsx`:**
   - **NamingCandidatesRenderer tests:**
     - Renders candidate list with names and rationale
     - Renders style tags as badges
     - Select button calls onAction with correct payload
     - Renders nothing when content is null
     - Renders methodology section when present
   - **DomainSignalsRenderer tests:**
     - Renders domain signals with status badges
     - Advisory disclaimer banner is present with correct text
     - Status badges use correct color treatment (available=emerald, taken=red, premium=amber)
     - Renders selected name header
   - **TrademarkSignalsRenderer tests:**
     - Renders trademark signals with status and class
     - Advisory disclaimer banner is present with correct text
     - Renders selected name header
   - **ArtifactRenderer dispatch tests:**
     - Dispatches to NamingCandidatesRenderer for `naming_candidates` type
     - Dispatches to DomainSignalsRenderer for `domain_signals` type
     - Dispatches to TrademarkSignalsRenderer for `trademark_signals` type
     - Forwards `onAction` prop to sub-renderer

## Must-Haves

- [ ] `triggerPipeline` accepts optional third argument for extra body data
- [ ] NamingCandidatesRenderer renders candidate list with interactive Select buttons
- [ ] NamingCandidatesRenderer calls `onAction` with selected name payload
- [ ] DomainSignalsRenderer renders per-TLD status badges with advisory disclaimer
- [ ] TrademarkSignalsRenderer renders trademark results with advisory disclaimer
- [ ] All three types dispatch correctly through `TYPE_RENDERERS`
- [ ] `onAction` prop flows from DossierStageOutputCard through ArtifactDetailPanel to ArtifactRenderer to sub-renderer
- [ ] Advisory disclaimers present on both domain and trademark renderers (D026)
- [ ] All existing 121 tests pass unchanged
- [ ] New renderer tests cover selection callback, disclaimers, and badge rendering
- [ ] `npx vite build` succeeds

## Verification

- `npx vitest run` — all tests pass (existing + new renderer tests)
- `npx vite build` — production build succeeds
- New tests verify: naming candidate rendering + selection callback, domain signal badges + disclaimer, trademark signal status + disclaimer, ArtifactRenderer dispatch for all three new types

## Observability Impact

- **Console log:** `triggerPipeline` calls produce `[sync] SSE connected` and network activity visible in browser devtools Network tab as POST `/api/pipeline/trigger` with `subStage` and `context` fields in the request body when naming selection fires.
- **DOM inspection:** Advisory disclaimers are testable via `data-testid="domain-advisory-disclaimer"` and `data-testid="trademark-advisory-disclaimer"`. Naming selection buttons carry `data-testid="naming-candidate-{index}"`.
- **Failure shapes:** If `onAction` is not provided to `NamingCandidatesRenderer`, Select buttons render as `disabled`. If `triggerPipeline` fails (network error), the error surfaces through the existing `{ error, reason }` return shape — no new error paths added.
- **Runtime signals:** Naming selection triggers `triggerPipeline(projectId, "plan", { subStage: "domain_signals", context: { selectedName } })` which is visible in server logs as `[bridge] sequential-next subStage=domain_signals`.

## Inputs

- `src/features/mission-control/ArtifactRenderer.jsx` — current renderer with `TYPE_RENDERERS` dispatch table, `CollapsibleSection`, `ScoreBadge`, `Badge` already imported
- `src/lumon/sync.js` — current `triggerPipeline(projectId, stageKey)` signature to extend
- `src/features/mission-control/DashboardTab.jsx` — current `DossierStageOutputCard` and `ArtifactDetailPanel` components; `useLumonActions` already available
- `src/lumon/__tests__/artifact-renderer.test.jsx` — current 19 tests for existing renderers, extend with new tests
- T01 provides: server-side plan sub-stage orchestration with context forwarding (the client doesn't need T01 running to render — renderers are tested with mocked data)

## Expected Output

- `src/lumon/sync.js` — `triggerPipeline(projectId, stageKey, extra)` with extra body spread
- `src/features/mission-control/ArtifactRenderer.jsx` — three new renderers + updated TYPE_RENDERERS + onAction prop forwarding
- `src/features/mission-control/DashboardTab.jsx` — DossierStageOutputCard wires onAction through triggerPipeline for naming selection
- `src/lumon/__tests__/artifact-renderer.test.jsx` — extended with ~15 new tests for three renderers + dispatch + selection
