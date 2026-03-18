---
estimated_steps: 4
estimated_files: 2
---

# T04: Add HandoffPanel provisioning controls with confirmation dialog

**Slice:** S01 — Provisioning Service & Handoff Controls
**Milestone:** M003

## Description

Add provisioning controls to the existing HandoffPanel in `DashboardTab.jsx`. The operator flow is: see provisioning controls when `handoff_ready` → click "Preview provisioning" → review plan in confirmation dialog → click "Confirm & Provision" → watch step-level progress → see success with repo URL or failure with error details.

This task delivers R018 (explicit confirmation before irreversible) through the UI and completes the S01 demo. The controls follow the existing Severance-floor aesthetic: zinc/cyan color palette, mono fonts, subtle borders.

**Key patterns to follow:**
- Existing `HandoffPanel` and `HandoffSectionCard` components in `DashboardTab.jsx`
- Existing pipeline action buttons (trigger/approve/reject) for button styling and data-testid conventions
- `useLumonActions()` for dispatching provisioning actions
- `useServerSyncStatus()` for connection state checks

**Relevant installed skills:** Load `frontend-design` skill for UI quality guidance.

## Steps

1. **Add provisioning state display to HandoffPanel.** In the `HandoffPanel` component, read `project.provisioning` and `project.handoffPacket.provisioning` (from T03 selectors). Below the existing packet section cards, add a provisioning section that renders conditionally:
   - When `handoff_ready` and `provisioning.status === 'idle'`: show a "Preview provisioning" button (cyan accent, mono font, `data-testid="provisioning-preview-btn"`)
   - When `provisioning.status === 'previewing'`: show a loading indicator
   - When `provisioning.status === 'confirming'`: show the confirmation dialog (see step 2)
   - When `provisioning.status === 'provisioning'`: show the progress display (see step 3)
   - When `provisioning.status === 'complete'`: show success state with repo URL and workspace path
   - When `provisioning.status === 'failed'`: show error state with error message and failed step
   - When not `handoff_ready`: provisioning controls are completely hidden

2. **Build the confirmation dialog component.** Create a `ProvisioningConfirmDialog` component (inline in DashboardTab.jsx or as a private component in the same file). It receives the preview plan from `provisioning.previewPlan` and renders:
   - Header: "Provision Repository" in mono uppercase
   - Plan details: repo name, engine choice (with label "Claude Code" or "Codex CLI"), workspace path, file count
   - File list: scrollable list of files that will be created (artifact files + GSD files)
   - Warning text: "This will create a GitHub repository and write files to your local filesystem."
   - Two buttons: "Cancel" (`data-testid="provisioning-cancel-btn"`) dispatches `updateProvisioning(projectId, { status: 'idle', previewPlan: null })` and "Confirm & Provision" (`data-testid="provisioning-confirm-btn"`) calls `executeProvisioning(projectId, plan)`.
   - Style with the existing dialog patterns: dark zinc background, cyan accent on confirm button, zinc-600 border, mono fonts.

3. **Build the progress display component.** Create a `ProvisioningProgress` component that reads `provisioning.steps` and renders each step with a status indicator:
   - Step name (repo-create, clone, artifact-write, gsd-init, commit-push) as readable labels
   - Status icon: pending (zinc dot), running (cyan spinner/pulse), complete (green check), failed (red x)
   - Use `data-testid="provisioning-step-{stepName}"` on each step row
   - Show an overall progress summary: "Step 3 of 5: Writing artifact files..."
   - On complete: show repo URL as a clickable link (`data-testid="provisioning-repo-url"`) and workspace path (`data-testid="provisioning-workspace-path"`)
   - On failure: show error message in red/amber with the failing step highlighted

4. **Write RTL tests.** Create `src/features/mission-control/__tests__/provisioning-ui.test.jsx` following the patterns in existing test files (e.g., `project-dossier.test.jsx`, `pipeline-board.test.jsx`). The tests need a test harness that renders `HandoffPanel` with a project at different provisioning states. Tests should verify:
   - Provisioning controls are NOT rendered when `handoff_ready` is false (project at earlier pipeline stage)
   - "Preview provisioning" button IS rendered when `handoff_ready` is true and provisioning is idle
   - Confirmation dialog shows plan details (repo name, engine, workspace, file count)
   - "Cancel" button resets provisioning state
   - "Confirm & Provision" button calls executeProvisioning
   - Progress display shows steps with correct status indicators
   - Success state shows repo URL and workspace path
   - Error state shows error message and failed step name
   - All provisioning elements have proper `data-testid` attributes

## Must-Haves

- [ ] "Preview provisioning" button visible only when `handoff_ready` and provisioning idle
- [ ] Confirmation dialog shows repo name, engine, workspace path, and file list
- [ ] "Cancel" button in dialog resets state without side effects
- [ ] "Confirm & Provision" button triggers provisioning execution
- [ ] Step-level progress display with visual status indicators
- [ ] Success state displays repo URL and workspace path
- [ ] Error state displays error message and failed step
- [ ] All controls hidden when not `handoff_ready`
- [ ] All interactive elements have `data-testid` attributes
- [ ] All tests pass

## Verification

- `npx vitest run src/features/mission-control/__tests__/provisioning-ui.test.jsx` — all UI tests pass
- `npx vitest run` — all existing tests still pass (no regressions in DashboardTab changes)
- `npm run build` — build succeeds
- `npx eslint src/features/mission-control/` — lint clean

## Inputs

- `src/features/mission-control/DashboardTab.jsx` — existing HandoffPanel and HandoffSectionCard components
- `src/lumon/context.jsx` — `useLumonActions()` provides `previewProvisioning`, `executeProvisioning`, `updateProvisioning` (from T03)
- `src/lumon/selectors.js` — project view model includes `provisioning` state and `handoffPacket.provisioning.provisioningReady` (from T03)
- Existing test patterns from `src/features/mission-control/__tests__/project-dossier.test.jsx`
- The provisioning state shape: `{ status, repoUrl, workspacePath, error, steps, previewPlan }`

## Expected Output

- `src/features/mission-control/DashboardTab.jsx` — updated HandoffPanel with ProvisioningConfirmDialog and ProvisioningProgress components (~150-200 lines added)
- `src/features/mission-control/__tests__/provisioning-ui.test.jsx` — new test file (~200-250 lines)
