# M002/S04 — Research

**Date:** 2026-03-16

## Summary

S04 is additive work on top of proven patterns from S01–S03. Every sub-system this slice touches — webhook registry, sequential orchestration, artifact storage, reducer/selector chain, type-dispatched rendering — already works and has contract tests. The slice has four deliverables: (1) architecture/spec/prototype n8n workflow templates and bridge server orchestration, (2) offline/disconnected mode, (3) rejection/iteration flow proof, and (4) the final full-pipeline integration test. None of these require new architecture — they extend existing patterns to new artifact types and add guards for edge cases.

**Primary recommendation:** Build in four tasks: (T01) architecture stage orchestration and n8n templates on the server, (T02) architecture renderers and handoff packet wiring on the client, (T03) offline/disconnected mode, (T04) rejection/iteration proof and final integrated acceptance tests. T01 and T02 can overlap since T02 only needs the artifact types defined, not the server running. T03 and T04 are independent of each other.

## Recommendation

**Follow the established S02/S03 pattern exactly for architecture sub-stages. Treat offline mode and rejection flows as independent verification concerns.**

The architecture/spec/prototype sub-workflows should run under the `verification` stage as sub-stages (`architecture_outline`, `specification`, `prototype_scaffold`). This keeps the stable 5-stage taxonomy (D016/D017) intact while placing architecture outputs where the handoff packet builder already reads from — `prototypeSections` sources from `wave-*` and `verification` stages. The `architectureSections` in the handoff packet reads from `research` and `plan` — those already have artifacts. Adding verification sub-stage artifacts ensures the prototype section of the handoff packet also has real content.

For offline mode, the infrastructure is 90% done: `useArtifact` has a module-level cache, `ConnectionStatusIndicator` already shows status, `PipelineActions` already has the conditional button rendering. The gap is that `PipelineActions` doesn't check connection status before showing buttons, and there's no explicit "offline" indicator that disables triggers while still allowing dossier browsing.

For rejection/iteration, the reducer already handles `rejected` approval state and the bridge server `recordApproval` already records rejections. The gap is proving that re-triggering a rejected stage replaces the execution record cleanly and that accumulated artifacts don't corrupt.

## Implementation Landscape

### Key Files

- `server/config.js` — Add `VERIFICATION_SUB_STAGES` array and compound `STAGE_ENV_MAP` entries for `verification_architecture_outline`, `verification_specification`, `verification_prototype_scaffold`. Follow exact pattern of `PLAN_SUB_STAGES`.
- `server/routes/pipeline.js` — Add verification sequential orchestration block in callback handler (copy the plan block pattern). Add verification default sub-stage in trigger handler.
- `server/pipeline.js` — No changes needed — per-stage tracking already handles any stageKey.
- `server/artifacts.js` — No changes needed.
- `n8n/workflows/` — Three new 4-node templates following the Webhook→Respond→Code→Callback pattern: `verification-architecture-outline.json`, `verification-specification.json`, `verification-prototype-scaffold.json`.
- `n8n/README.md` — Add verification stage documentation section.
- `src/features/mission-control/ArtifactRenderer.jsx` — Add `ArchitectureRenderer`, `SpecificationRenderer`, `PrototypeRenderer` to `TYPE_RENDERERS` lookup table. Follow the `CollapsibleSection` pattern from existing renderers.
- `src/features/mission-control/DashboardTab.jsx` — Guard `PipelineActions` with connection status from `useServerSyncStatus()`. Disable trigger/approve/reject buttons when disconnected.
- `src/lumon/context.jsx` — No changes needed — `ServerSyncContext` already exposes `connected` and `error`.
- `src/lumon/sync.js` — No changes needed.
- `src/lumon/selectors.js` — No changes needed — `buildHandoffPacket` already reads from `verification` stage output for the prototype section, and from `research`/`plan` for architecture/specification.
- `src/lumon/model.js` — No changes needed.
- `src/lumon/reducer.js` — No changes needed — `appendArtifact` already handles any stageId.

### Build Order

1. **T01: Architecture stage orchestration + n8n templates (server).** Add `VERIFICATION_SUB_STAGES` to config, extend callback handler with verification sequential orchestration, add auto-trigger from plan approval to verification, create three n8n workflow templates. Write contract tests following `naming-pipeline.test.js` pattern. This is the foundation — proves the bridge can orchestrate the final stage.

2. **T02: Architecture renderers + handoff packet wiring (client).** Add three new artifact type renderers to `ArtifactRenderer.jsx`. Write renderer tests following the existing test patterns. Verify that the handoff packet builder surfaces verification artifacts in the prototype section. This can start as soon as artifact type names are decided (parallel with T01).

3. **T03: Offline/disconnected mode.** Guard `PipelineActions` buttons with `useServerSyncStatus().connected`. Show a "Server offline — cached data only" banner when disconnected. Write tests confirming buttons are disabled when disconnected but dossier content still renders from cached state. Verify `useArtifact` cache serves stale data when server is unreachable.

4. **T04: Rejection/iteration proof + final acceptance.** Write tests proving: (a) reject a stage → re-trigger → new execution replaces old → artifacts accumulate correctly, (b) multi-stage rejection doesn't corrupt other stage state, (c) full pipeline test: create project → trigger intake → approve → auto-trigger research → research completes → approve plan → plan sub-stages → approve verification → verification sub-stages → handoff ready. This is the capstone.

### Verification Approach

- `npx vitest run` — all tests pass, zero regressions
- `npx vite build` — production build succeeds
- New test files:
  - `server/__tests__/verification-pipeline.test.js` — VERIFICATION_SUB_STAGES config, compound webhook registry, sequential orchestration, auto-trigger from plan approval, backward compatibility
  - `src/lumon/__tests__/artifact-renderer.test.jsx` — extend with 3 new renderer tests
  - `src/lumon/__tests__/offline-mode.test.jsx` — PipelineActions disabled when disconnected, dossier renders cached data
  - `server/__tests__/rejection-iteration.test.js` — reject → re-trigger → approve lifecycle, multi-artifact state integrity
  - `server/__tests__/full-pipeline.test.js` — end-to-end pipeline from intake to handoff_ready

## Constraints

- Stage taxonomy is a stable contract (D016/D017). The 5 prebuild stage keys (intake, research, plan, verification, handoff) must not change. Architecture content attaches as sub-stages under `verification`, not as new top-level stages.
- Approval gates are operator-controlled (D002, D005). Auto-trigger from plan to verification is acceptable because the verification gate has `required: true` — the operator must still explicitly approve.
- The handoff packet builder in `selectors.js` reads `prototypeSections` from wave stages + verification. Architecture artifacts stored under verification will surface in the prototype section of the handoff packet. The architecture section reads from research + plan, which already have artifacts from S01/S02/S03.
- `PipelineActions` currently checks `currentStage?.stageKey === "intake"` for the trigger button — this needs to be generalized so operators can trigger verification and other stages too.

## Common Pitfalls

- **Hardcoding the trigger button to intake only.** `PipelineActions` currently only shows the trigger button when `currentStage?.stageKey === "intake"`. This must be generalized so the operator can trigger any stage that is `queued` and has a webhook configured. The approval buttons already work for any stage.
- **Not updating the plan approve handler to auto-trigger verification.** S02 auto-triggers research after intake approval. The same pattern should auto-trigger verification after plan approval (when a verification webhook is configured).
- **Breaking the auto-trigger chain by forgetting the `VERIFICATION_SUB_STAGES` import** in `routes/pipeline.js`. Follow the exact same import pattern as `RESEARCH_SUB_STAGES` and `PLAN_SUB_STAGES`.

## Open Risks

- **Handoff packet readiness state may not resolve to "ready"** even with all artifacts stored, because `resolvePacketArtifactContract` checks for `LUMON_DETAIL_STATES.blocked`/`waiting`/`missing` on the source stage sections. The verification stage section will show "missing" until the stage output has real structured artifacts. Ensure verification artifacts are stored via `append-artifact` so the selector chain sees them as resolved.
- **Re-triggering after rejection creates a new execution record** but doesn't clean up the old one. `pipeline.js` stores the latest executionId per project+stage, so the old execution becomes orphaned in the `executions` Map. This is acceptable for single-operator scale but should be documented.
