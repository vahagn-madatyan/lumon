# M003: Repo Provisioning & GSD Handoff

**Vision:** An approved pre-build dossier becomes a real GitHub repository with human-readable artifacts and GSD-ready project files, provisioned through an explicit preview→confirm→execute flow in the Lumon UI.

## Success Criteria

- An approved project can be provisioned into a real GitHub repository with its dossier artifacts present as human-readable markdown files
- The operator sees a preview of what provisioning will create (repo name, file list, engine choice, workspace path) and must explicitly confirm before any repo creation or file writing occurs
- The provisioned repository contains GSD-ready project files (PROJECT.md, REQUIREMENTS.md, initial milestone context) that GSD can manage immediately
- Each provisioned project gets its own directory under a configurable workspace root, separate from the Lumon repo
- The chosen execution engine (Claude Code or Codex) is recorded in the provisioned project's GSD preferences
- Provisioning progress is visible in real time through the HandoffPanel, and provisioning state persists across page reload
- If provisioning fails partway through (repo created but artifacts not written), the operator can retry without duplicating the repository

## Key Risks / Unknowns

- gh CLI orchestration from Node child_process — repo creation, clone, commit, and push must work reliably through `execFile`/`spawn`. If this primitive fails, no amount of UI will fix it.
- Artifact formatting fidelity — 9 artifact types have different JSON shapes and must each produce clean, human-readable markdown. Missing or malformed content should produce a clear fallback, not crash the flow.
- GSD bootstrap compatibility — generated `.gsd/` files must match what GSD v2.28.0 expects so the provisioned project is immediately manageable. The contract is inferred from this repo's own `.gsd/` structure, not from a formal spec.

## Proof Strategy

- gh CLI orchestration → retire in S01 by building the real provisioning service that shells out to `gh` and `git`, proven by server tests with mocked CLI calls and exercisable through REST endpoints
- Artifact formatting fidelity → retire in S01 by implementing type-specific markdown templates for all 9 artifact types and verifying output structure in tests
- GSD bootstrap compatibility → retire in S01 by generating PROJECT.md, REQUIREMENTS.md, and initial milestone from approved dossier artifacts, verified against this repo's own `.gsd/` structure
- Operational resilience → retire in S02 by adding step-level provisioning tracking with idempotent retry, proven through a live GitHub integration test

## Verification Classes

- Contract verification: Vitest server tests for provisioning service (mocked gh/git CLI), client tests for provisioning state transitions and HandoffPanel rendering
- Integration verification: REST endpoint tests (supertest) for preview/execute/status flow; SSE event tests for provisioning progress delivery
- Operational verification: Idempotent retry test (provision fails midway, retry resumes); gh CLI availability check at server startup
- UAT / human verification: Manual provisioning of a test project against real GitHub, verifying repo contents and GSD file structure

## Milestone Definition of Done

This milestone is complete only when all are true:

- The provisioning service can create a GitHub repo, clone it locally, write formatted artifact files, and generate GSD bootstrap files
- REST endpoints expose preview/execute/status with SSE progress events
- Client state tracks provisioning lifecycle and surfaces it through the handoff view model
- HandoffPanel shows provisioning controls with a confirmation dialog gated behind `handoff_ready`
- Provisioning can be retried after partial failure without duplicating the repo
- The server checks for gh CLI availability and returns clear diagnostics when missing
- Success criteria are re-checked against a live provisioning flow, not just test artifacts
- All tests pass (`npx vitest run`), build succeeds (`npm run build`), lint clean (`npx eslint server/ src/lumon/ src/features/mission-control/`)

## Requirement Coverage

- Covers: R011 (repo creation + artifact upload), R013 (GSD bootstrap + autonomous handoff), R014 (separate repos/workspaces), R018 (explicit confirmation before irreversible)
- Consumes (already validated): R012 (engine choice per project — stored and rendered in M001, propagated to GSD preferences in M003)
- Leaves for later: R015 (live agent visibility — M004), R017 (bounded recovery pass — M004)
- Orphan risks: none — all active requirements relevant to M003 are mapped

## Slices

- [ ] **S01: Provisioning Service & Handoff Controls** `risk:high` `depends:[]`
  > After this: operator can preview provisioning details for an approved project, confirm via dialog, and execute — creating a real GitHub repo with formatted artifact files and GSD bootstrap structure. Proven by server tests with mocked gh CLI and client tests for provisioning state and UI.
- [ ] **S02: Operational Resilience & Live Integration** `risk:medium` `depends:[S01]`
  > After this: provisioning handles partial failures with idempotent retry, rejects concurrent requests for the same project, checks gh CLI availability at startup, and reports clear error diagnostics. Proven by a live integration test creating and cleaning up a real GitHub repo.

## Boundary Map

### S01 → S02

Produces:
- `server/provisioning.js` — provisioning service module with `preview(projectId)`, `provision(projectId, options)`, and `getStatus(projectId)` functions; artifact formatting and GSD file generation
- `server/routes/provisioning.js` — REST endpoints: `POST /api/provisioning/preview`, `POST /api/provisioning/execute`, `GET /api/provisioning/status/:projectId`; SSE events: `provisioning-progress`, `provisioning-complete`, `provisioning-error`
- Provisioning state shape on project model: `provisioning: { status, repoUrl, workspacePath, error, steps }` — persisted through the existing localStorage envelope
- Reducer actions: `lumon/update-provisioning` for status transitions
- Selectors: provisioning state surfaced through `buildHandoffPacket` and `buildProjectDetailContract`
- HandoffPanel provisioning controls: preview button → confirmation dialog → provision button → progress display, all gated behind `handoff_ready`

Consumes:
- nothing (first slice)

### S02

Produces:
- Step-level provisioning tracking in `server/provisioning.js` — each step (repo-create, clone, artifact-write, gsd-init, commit-push) tracked individually for resume
- Idempotent retry logic: checks for existing repo/workspace before re-executing completed steps
- Concurrent provisioning guard: rejects second provisioning request while one is in progress for the same project
- gh CLI availability check: validated at server startup with clear diagnostic error
- Enhanced error responses: specific failure reasons per provisioning step with actionable messages
- Live integration test exercising the full provisioning flow against real GitHub

Consumes:
- S01 provisioning service, REST endpoints, client state, and UI (extended, not replaced)
