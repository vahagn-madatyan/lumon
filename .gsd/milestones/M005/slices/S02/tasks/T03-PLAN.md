---
estimated_steps: 4
estimated_files: 3
skills_used:
  - frontend-design
  - react-best-practices
  - test
  - make-interfaces-feel-better
  - accessibility
---

# T03: Build ExternalActionsPanel UI and integrate into DashboardTab

**Slice:** S02 — Confirmation-Gated Domain Actions
**Milestone:** M005

## Description

Build the ExternalActionsPanel component that shows external action lifecycle states in the dashboard, and integrate it into DashboardTab alongside the existing ProvisioningSection. The panel renders pending actions with Confirm/Cancel buttons, confirmed actions with an Execute button, executing actions with a spinner, completed actions with the result, and failed actions with the error. This completes the end-to-end user experience for the confirmation-gated domain purchase flow.

## Steps

1. **Create `src/features/mission-control/ExternalActionsPanel.jsx`** — A React component that receives the project view model (from selectors) and the action helpers (from context). Structure:

   - **Panel wrapper** — only renders when the project has external actions or when domain signals are available. Uses the same card/section styling as ProvisioningSection. `data-testid="external-actions-panel"`.
   - **Empty state** — subtle message when no actions exist yet, with a "Purchase Domain" button if domain signals are available with live data (not simulated engine).
   - **Action cards** — map over `externalActions.actions` from the view model:
     - **Pending**: Show domain name, status badge "Pending confirmation", Confirm button (`data-testid="external-action-confirm-btn"`), Cancel button (`data-testid="external-action-cancel-btn"`)
     - **Confirmed**: Show domain name, status badge "Confirmed", Execute button (`data-testid="external-action-execute-btn"`)
     - **Executing**: Show domain name, status badge "Executing…", spinner/pulse animation
     - **Completed**: Show domain name, status badge "Completed", result details (orderId, cost, balance if available)
     - **Failed**: Show domain name, status badge "Failed", error message
     - **Cancelled**: Show domain name, status badge "Cancelled", muted styling
   - Each action card has `data-testid="external-action-{actionId}"` for testing.
   - Use the Severance design language: zinc backgrounds, amber/emerald/rose accent tones for status, monospace type for technical details, `tracking-[0.12em]` uppercase labels.
   - The Confirm button should have a deliberate feel — perhaps a distinct color (amber) to signal the operator is about to authorize a financial transaction.

2. **Create a "Purchase Domain" initiation flow** — When domain signals show an available domain, the panel offers a "Purchase" button. Clicking it calls `requestExternalAction(projectId, 'domain-purchase', { domain, cost })` from the context actions. The domain and cost come from the domain signals artifact data. The panel should surface the domain price clearly before the operator initiates.

3. **Integrate into `src/features/mission-control/DashboardTab.jsx`**:
   - Import `ExternalActionsPanel` at the top of the file.
   - Render it in the dossier/detail area, after ProvisioningSection and before or alongside the BuildExecutionPanel. The panel should be visible when the project has any external actions OR when the project has completed the plan stage (domain signals are available).
   - Pass the project view model and the action helpers from context.

4. **Write RTL tests in `src/features/mission-control/__tests__/external-actions-ui.test.jsx`**:
   - Panel renders when project has external actions
   - Panel does not render when project has no actions and no domain signals
   - Pending action shows Confirm and Cancel buttons
   - Clicking Confirm calls `confirmExternalAction` with correct actionId
   - Clicking Cancel calls `cancelExternalAction` with correct actionId
   - Confirmed action shows Execute button
   - Clicking Execute calls `executeExternalAction` with correct actionId
   - Executing action shows spinner, no action buttons
   - Completed action shows result details, no action buttons
   - Failed action shows error message
   - Cancelled action shows cancelled badge
   - Multiple actions render correctly
   
   Use the existing test patterns from the project — wrap with LumonProvider, mock context actions, use `data-testid` selectors for assertions.

## Must-Haves

- [ ] ExternalActionsPanel renders all 6 action states (pending, confirmed, executing, completed, failed, cancelled) with correct visual treatment
- [ ] Confirm/Cancel/Execute buttons dispatch correct context action helpers
- [ ] Panel integrates into DashboardTab at the correct location
- [ ] `data-testid` attributes follow existing conventions for testability
- [ ] RTL tests cover all action states and user interactions
- [ ] Severance design language maintained — zinc/amber/emerald/rose tones, monospace, uppercase tracking labels
- [ ] No regressions in existing DashboardTab functionality

## Verification

- `npx vitest run src/features/mission-control/__tests__/external-actions-ui.test.jsx` — all RTL tests pass
- `npx vitest run` — full suite regression, 706+ passed, 0 failures

## Inputs

- `src/lumon/selectors.js` — external actions view model in `buildProjectViewModel()` (from T02)
- `src/lumon/context.jsx` — `requestExternalAction`, `confirmExternalAction`, `cancelExternalAction`, `executeExternalAction` action helpers (from T02)
- `src/features/mission-control/DashboardTab.jsx` — existing component to integrate into
- `src/lumon/reducer.js` — action types for external actions (from T02)

## Expected Output

- `src/features/mission-control/ExternalActionsPanel.jsx` — new UI component for external action lifecycle display
- `src/features/mission-control/DashboardTab.jsx` — modified to import and render ExternalActionsPanel
- `src/features/mission-control/__tests__/external-actions-ui.test.jsx` — new RTL test file
