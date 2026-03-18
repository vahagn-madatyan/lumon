---
verdict: needs-attention
remediation_round: 0
---

# Milestone Validation: M002 — Discovery & Approval Pipeline

## Success Criteria Checklist

- [x] **The operator can trigger a discovery pipeline for a project and watch it progress through named stages with real n8n-executed work** — evidence: S01 proves the full trigger→webhook→callback→approve loop against a live n8n Docker instance (T04). S04's `full-pipeline.test.js` drives all 4 stages (intake → research → plan → verification) to approved status. PipelineActions generalized to trigger any queued stage. 9 n8n workflow templates shipped and importable. *Contract-proven; browser-level visual walkthrough deferred to milestone UAT.*
- [x] **Per-stage outputs appear inside Lumon as structured, inspectable artifacts — not transient strings or console-only output** — evidence: S01 migrates `stage.output` to `{ artifactId, summary, type }` with backward-compatible coercion. S02/S03/S04 add 9 type-dispatched sub-renderers covering all artifact types (viability_analysis, business_plan, tech_research, naming_candidates, domain_signals, trademark_signals, architecture_outline, specification, prototype_scaffold). Artifacts stored as server-side JSON files on disk, fetched via `useArtifact` hook. 52 renderer tests + 29 artifact-output tests confirm structured rendering.
- [x] **The operator can approve one stage, reject another, iterate on the rejected stage, and see state advance only through explicit gates** — evidence: S04 `rejection-iteration.test.js` (4 tests) proves single-stage reject→re-trigger→approve lifecycle, cross-stage isolation (rejecting research doesn't corrupt intake), triple-rejection artifact accumulation without data loss, and execution record replacement. `full-pipeline.test.js` drives all stages through explicit approval gates. n8n Wait node resumeUrl ensures approval never auto-fires (D024).
- [x] **A project can run through a complete discovery pipeline from intake to approved pre-build dossier with architecture, spec, and prototype artifacts** — evidence: S04 `full-pipeline.test.js` (3 tests) proves the complete 4-stage pipeline producing 9 artifacts (1 intake + 2 research + 3 plan + 3 verification). Auto-trigger chains (intake→research, plan→verification) and sequential sub-stage orchestration all exercised. *Contract-proven; live n8n end-to-end deferred to milestone UAT.*
- [x] **Lumon remains usable for reviewing cached artifacts when n8n is unreachable** — evidence: S04 `offline-mode.test.jsx` (7 tests) proves pipeline action buttons disable when server disconnected, offline banner with WifiOff icon renders, and cached dossier content continues rendering from the module-level artifact cache.

## Slice Delivery Audit

| Slice | Claimed | Delivered | Status |
|-------|---------|-----------|--------|
| S01 | Bridge server, artifact storage, SSE push, schema migration, n8n intake workflow, full trigger→approve loop proven in real browser with live n8n | All infrastructure delivered and proven. API-level integration against live n8n confirmed (trigger→webhook→callback→approve). Browser UI flow proven at API level but not clicked through in rendered UI (noted as deviation). | pass |
| S02 | Per-stage webhook registry, sequential research orchestration, auto-trigger after intake approval, multi-artifact accumulation, rich artifact rendering in dossier | Webhook registry with compound lookup, sequential business_plan→tech_stack orchestration, auto-trigger chain, `lumon/append-artifact` reducer, `useArtifact` hook, `ArtifactRenderer` with 3 type-dispatched sub-renderers. 28 new tests, 121 total. | pass |
| S03 | Naming candidates as selectable list, domain/trademark signals with advisory labels, all orchestrated through n8n with context forwarding | Plan sub-stage orchestration (naming→domain→trademark), context forwarding, compound webhook keys, interactive NamingCandidatesRenderer with Select buttons, DomainSignalsRenderer and TrademarkSignalsRenderer with advisory disclaimers (D026). 3 n8n templates. 171 total tests. S03 UAT: PASS. | pass |
| S04 | Complete pipeline intake→dossier, architecture/spec/prototype artifacts, rejection/iteration, offline mode, n8n workflow bundle | Verification sub-stage orchestration, 3 dedicated renderers, generalized PipelineActions, offline mode guard, rejection/iteration proven clean, full 4-stage integration proven with 9 artifacts. 223 total tests. | pass |

All 4 slices delivered their claimed outputs at the contract level. No slice has a gap between its summary claims and the evidence provided.

## Cross-Slice Integration

### S01 → S02/S03/S04 (bridge server foundation)

| Boundary Item | Produced by S01 | Consumed by | Match? |
|---------------|----------------|-------------|--------|
| Express bridge server with 5 REST endpoints | `server/index.js`, `server/routes/pipeline.js` | S02, S03, S04 all extend routes | ✅ |
| Disk-based JSON artifact storage | `server/artifacts.js` | S02 adds `getByProjectAndStage()`, S04 stores verification artifacts | ✅ |
| SSE endpoint with `emitSSE` | `server/routes/pipeline.js` | S02/S03/S04 emit events for new artifact types | ✅ |
| `useServerSync` hook | `src/lumon/sync.js` | S02 updated for `append-artifact`, S03 extended `triggerPipeline` signature | ✅ |
| Schema-migrated `stage.output` | `src/lumon/model.js` | All selectors consume structured output via `isStructuredOutput()`/`getOutputSummary()` | ✅ |
| `npm run dev` starts both servers | `package.json` | All slices use the same entrypoint | ✅ |

### S02 → S04 (research artifacts)

| Boundary Item | Produced by S02 | Consumed by S04 | Match? |
|---------------|----------------|-----------------|--------|
| Webhook registry pattern | `server/config.js` | S04 adds `VERIFICATION_SUB_STAGES` and compound env map entries | ✅ |
| Sequential sub-workflow pattern | Callback handler chaining | S04 reuses identical pattern for verification sub-stages | ✅ |
| `append-artifact` reducer | `src/lumon/reducer.js` | S04 full-pipeline test accumulates 9 artifacts through same action | ✅ |
| `ArtifactRenderer` dispatch table | `TYPE_RENDERERS` lookup | S04 adds 3 verification renderers to same table | ✅ |

### S03 → S04 (plan artifacts)

| Boundary Item | Produced by S03 | Consumed by S04 | Match? |
|---------------|----------------|-----------------|--------|
| Compound webhook keys | `STAGE_ENV_MAP` compound entries | S04 adds verification compound entries following same convention | ✅ |
| Context forwarding | `pipeline.trigger()` context field | S04 full-pipeline test exercises context through chain | ✅ |
| `onAction` callback pattern | Prop-drilled through renderer chain | S04 renderers don't need onAction but the pattern is stable | ✅ |

**No boundary mismatches found.** All produces/consumes pairs align with what was actually built.

## Requirement Coverage

All 9 requirements mapped to M002 in the roadmap have slice coverage:

| Requirement | Description | Slice Coverage | Status |
|-------------|-------------|----------------|--------|
| R004 | Approval gates | S01 (intake gate), S04 (rejection/iteration, all 4 gates) | Advanced — contract-proven across all stages |
| R005 | Viability analysis | S01 (n8n-executed viability), S04 (first artifact in pipeline) | Advanced — artifact produced and rendered |
| R006 | Business planning | S02 (business_plan artifact + renderer), S04 (handoff packet) | Advanced — structured content in dossier |
| R007 | Tech-stack research | S02 (tech_research artifact + renderer), S04 (handoff packet) | Advanced — alongside architecture outline |
| R008 | Naming workflow | S03 (naming candidates, interactive selection, downstream triggers) | Advanced — selectable list with n8n orchestration |
| R009 | Domain/trademark signals | S03 (domain + trademark renderers with D026 advisory disclaimers) | Advanced — advisory labels present |
| R010 | Handoff package | S04 (9 artifacts across 4 stages populate packet) | Validated — full-pipeline integration test proves |
| R018 | Explicit confirmation | S01 (Wait node resumeUrl, never auto-resume) | Advanced for pipeline gates; repo/domain confirmation deferred to M003/M005 |
| R019 | n8n as orchestrator | S01-S04 (9 templates, webhooks, sequential orchestration, auto-triggers) | Advanced — full 4-stage proof |

**No unaddressed requirements.** All mapped requirements have substantive slice evidence.

## Definition of Done Reconciliation

| DoD Item | Met? | Evidence |
|----------|------|---------|
| All slice deliverables complete and verified | ✅ | S01-S04 all show `verification_result: passed`, 223 tests pass |
| Complete discovery pipeline with real n8n work visible in Lumon | ⚠️ | Contract-proven by `full-pipeline.test.js`; live n8n browser walkthrough pending human UAT |
| Approve/reject/iterate with explicit gates | ✅ | `rejection-iteration.test.js` + `full-pipeline.test.js` |
| Structured artifacts stored server-side, rendered in dossier | ✅ | Server-side JSON storage, 9 type-dispatched renderers, 52 renderer tests |
| Handoff packet with real architecture/spec/prototype artifacts | ✅ | Full-pipeline integration produces 9 artifacts across all stages |
| Graceful degradation when n8n unreachable | ✅ | `offline-mode.test.jsx` (7 tests) |
| n8n workflow templates importable and functional | ✅ | 9 templates on disk; intake template proven against live n8n in S01 |
| Success criteria re-checked against live browser behavior | ❌ | Explicitly requires browser UAT — not yet performed |
| Final integrated acceptance scenarios pass | ⚠️ | Contract integration passes; browser-level acceptance deferred |

## Verdict Rationale

**Verdict: `needs-attention`**

All 4 slices are code-complete with 223 tests passing and zero regressions. The full 4-stage pipeline is proven end-to-end at the contract level. All 9 requirements have substantive coverage. Cross-slice integration boundaries are clean. Production build succeeds.

The single gap is **browser-level UAT with a live n8n instance**, which the milestone's own Definition of Done item #8 explicitly requires ("Success criteria are re-checked against live browser behavior, not just test artifacts"). This is not a code or architecture gap — all the infrastructure is in place. It is a human verification gate:

- **S01 UAT:** surfaced-for-human-review (pending)
- **S02 UAT:** surfaced-for-human-review (pending)
- **S03 UAT:** PASS (completed)
- **S04 UAT:** spec exists, result not filed

This does not warrant `needs-remediation` because:
1. No new code, slices, or architectural changes are needed
2. The pending UATs are `mixed` type requiring human execution with live n8n Docker
3. All contract tests comprehensively prove the behavior the UATs would exercise
4. S03's completed artifact-driven UAT demonstrates the pattern works

### What the human reviewer should do to close M002:

1. Start Docker + n8n locally (`docker compose up -d` per `n8n/README.md`)
2. Import all 9 workflow templates into n8n and activate them
3. Run `npm run dev` to start both Vite and the bridge server
4. In the browser: create a project → trigger discovery → watch stages progress → approve intake → observe auto-trigger research → approve research → trigger plan → select a name → observe domain/trademark signals → approve plan → observe auto-trigger verification → approve verification → inspect the complete handoff dossier
5. Reject one stage mid-pipeline, re-trigger it, approve it, and confirm state integrity
6. Kill the bridge server and confirm offline mode renders cached artifacts with disabled actions
7. File UAT results for S01, S02, and S04

Once those UATs pass, M002 can be sealed as complete.

## Remediation Plan

No remediation slices needed. The gap is human UAT execution, not missing deliverables.

### Known limitations to carry forward (not blockers):

- Pipeline execution state is in-memory — server restart loses active executions (artifacts persist on disk)
- Module-level artifact cache in `useArtifact` has no invalidation — stale content may display after rejection + re-generation until cache is cleared
- Production bundle exceeds 500 KB — code-splitting deferred to a later milestone
- No offline trigger queue — buttons simply disable; operator must re-trigger after reconnection
- n8n Wait node resumeUrl uses `localhost:5678` — only works when bridge and Docker n8n share the same host
