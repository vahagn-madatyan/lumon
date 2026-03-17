---
estimated_steps: 5
estimated_files: 4
---

# T02: Add architecture renderers, generalize trigger button, and wire offline mode

**Slice:** S04 — Architecture Package & Full Pipeline Integration
**Milestone:** M002

## Description

Three new artifact types (architecture_outline, specification, prototype_scaffold) need dedicated renderers so structured content displays in the dossier instead of falling through to the GenericRenderer. The PipelineActions trigger button is currently hardcoded to `stageKey === "intake"` — it must be generalized so operators can trigger any queued stage. Offline mode must disable trigger/approve/reject buttons when the server is disconnected while still allowing cached dossier browsing.

## Steps

1. **Add three new renderers to `src/features/mission-control/ArtifactRenderer.jsx`.**
   - Use the existing `CollapsibleSection` component pattern from ViabilityRenderer/BusinessPlanRenderer.
   - **ArchitectureRenderer** (`data-testid="architecture-renderer"`):
     - Sections: System Overview (string, defaultOpen), Components (array of { name, responsibility, technology } — render as cards with name bold, responsibility description, technology badge), Data Flow (string), Deployment Model (string), Recommendation (emerald text)
     - Components section: each component renders in a `rounded border border-zinc-800 bg-zinc-950/70` card with `data-testid="architecture-component-{i}"`
   - **SpecificationRenderer** (`data-testid="specification-renderer"`):
     - Sections: Functional Requirements (array of { id, title, description, priority } — render as list with id badge and priority indicator), Non-Functional Requirements (array of { category, requirement, metric }), API Contracts (array of { endpoint, method, description } — render with method badge), Recommendation (emerald text)
     - Priority badges: high=red, medium=amber, low=zinc. Method badges: GET=emerald, POST=blue, PUT=amber, DELETE=red
   - **PrototypeRenderer** (`data-testid="prototype-renderer"`):
     - Sections: Project Structure (preformatted monospace text for directory tree), Entry Points (array of { file, purpose }), Dependencies (array of { name, version, purpose }), Setup Instructions (preformatted text), Recommendation (emerald text)
   - Register all three in `TYPE_RENDERERS`: `architecture_outline: ArchitectureRenderer`, `specification: SpecificationRenderer`, `prototype_scaffold: PrototypeRenderer`

2. **Generalize PipelineActions in `src/features/mission-control/DashboardTab.jsx`.**
   - Current `canTrigger` logic: `currentStage?.stageKey === "intake" && currentStage?.status === "queued"`
   - Change to: `currentStage?.status === "queued"` — any queued stage can be triggered (the webhook registry handles whether a webhook is configured)
   - Update the trigger button label from "Trigger Discovery" to a stage-aware label: use `currentStage?.label ?? "Trigger"` or keep "Trigger Discovery" for intake and "Trigger Stage" for others. Simplest: change to `Trigger ${currentStage?.label ?? "Stage"}` or just keep "Trigger Discovery" since the label works generically.
   - **Decision: keep "Trigger Discovery" as the button label** — it's the action name, not the stage name. The stage context is visible in the pipeline board already.

3. **Wire offline mode in PipelineActions.**
   - Import `useServerSyncStatus` (already imported in DashboardTab.jsx at the module level — it's used by `ConnectionStatusIndicator`)
   - Add `const { connected } = useServerSyncStatus();` inside `PipelineActions`
   - Add a `disabled` condition: all buttons disabled when `!connected` (in addition to existing `loading !== null` check)
   - Add an offline banner before the buttons when `!connected`:
     ```jsx
     {!connected && (
       <div
         className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1 font-mono text-[9px] text-zinc-400"
         data-testid="pipeline-actions-offline"
       >
         <WifiOff size={10} />
         <span>Server offline — triggers disabled</span>
       </div>
     )}
     ```
   - The `WifiOff` icon is already imported in DashboardTab.jsx
   - **Key behavior**: when disconnected, the PipelineActions component should still render (not return null) if there are actionable stages — it just shows the offline banner and disabled buttons. Dossier content continues to render from cached useArtifact data.

4. **Extend `src/lumon/__tests__/artifact-renderer.test.jsx` with renderer tests.**
   - Follow the existing pattern (import render/screen from @testing-library/react, test each renderer).
   - **ArchitectureRenderer tests** (3 tests):
     - Renders system overview and components sections
     - Renders component cards with name, responsibility, technology
     - Renders recommendation in emerald text
   - **SpecificationRenderer tests** (3 tests):
     - Renders functional requirements with id and priority
     - Renders API contracts with method badges
     - Renders recommendation
   - **PrototypeRenderer tests** (3 tests):
     - Renders project structure as preformatted text
     - Renders dependencies with name and version
     - Renders recommendation
   - **Dispatch tests** (3 tests):
     - ArtifactRenderer dispatches architecture_outline to ArchitectureRenderer
     - ArtifactRenderer dispatches specification to SpecificationRenderer
     - ArtifactRenderer dispatches prototype_scaffold to PrototypeRenderer

5. **Write `src/lumon/__tests__/offline-mode.test.jsx`.**
   - Test setup: mock `useServerSyncStatus` to return `{ connected: false, error: "Connection lost" }`
   - Mock `useLumonActions` to return stub trigger/approve functions
   - **Tests**:
     - PipelineActions shows offline banner when disconnected (`data-testid="pipeline-actions-offline"`)
     - Trigger button is disabled when disconnected
     - Approve/reject buttons are disabled when disconnected
     - PipelineActions buttons are enabled when connected (control test)
     - DossierStageOutputCard renders artifact content even when disconnected (mock useArtifact to return cached data, verify content renders)
   - **Important**: The PipelineActions component is defined in DashboardTab.jsx but not exported separately. Either export it for testing or test through the rendered DashboardTab with enough context mocked. Simplest approach: export PipelineActions as a named export from DashboardTab.jsx.
   - Run `npx vitest run src/lumon/__tests__/offline-mode.test.jsx` and `npx vite build`

## Must-Haves

- [ ] ArchitectureRenderer renders structured architecture content with components, data flow, deployment model
- [ ] SpecificationRenderer renders functional/non-functional requirements and API contracts
- [ ] PrototypeRenderer renders project structure, dependencies, and setup instructions
- [ ] All three registered in TYPE_RENDERERS lookup table
- [ ] PipelineActions triggers any queued stage (not just intake)
- [ ] PipelineActions shows offline banner and disables buttons when server is disconnected
- [ ] Dossier still renders cached artifacts when disconnected
- [ ] 12+ new tests across renderer and offline test files
- [ ] Zero regressions in existing tests
- [ ] Production build succeeds

## Verification

- `npx vitest run src/lumon/__tests__/artifact-renderer.test.jsx` — all existing + new tests pass
- `npx vitest run src/lumon/__tests__/offline-mode.test.jsx` — all tests pass
- `npx vitest run` — zero regressions
- `npx vite build` — production build succeeds

## Inputs

- `src/features/mission-control/ArtifactRenderer.jsx` — existing renderer file with TYPE_RENDERERS lookup, CollapsibleSection, and 6 existing renderers (add 3 more)
- `src/features/mission-control/DashboardTab.jsx` — PipelineActions component with hardcoded intake trigger, useServerSyncStatus already imported for ConnectionStatusIndicator
- `src/lumon/__tests__/artifact-renderer.test.jsx` — existing 40 tests to extend (follow same render/screen pattern)
- `src/lumon/context.jsx` — useServerSyncStatus hook (already used in DashboardTab, needs to be called in PipelineActions too)
- T01 summary — artifact type names: `architecture_outline`, `specification`, `prototype_scaffold`

## Expected Output

- `src/features/mission-control/ArtifactRenderer.jsx` — 3 new exported renderers + 3 new TYPE_RENDERERS entries
- `src/features/mission-control/DashboardTab.jsx` — PipelineActions generalized trigger + offline guard + offline banner + PipelineActions named export
- `src/lumon/__tests__/artifact-renderer.test.jsx` — 12+ new tests for 3 renderers + dispatch
- `src/lumon/__tests__/offline-mode.test.jsx` — new test file with 5+ offline mode tests
