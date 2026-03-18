# M003: Repo Provisioning & GSD Handoff — Research

**Date:** 2026-03-17

## Summary

M003 bridges the gap between an approved discovery pipeline (M002) and real build execution. The handoff today is conceptual — `handoffPacket` and `handoff_ready` state exist as selector-derived view models, but no server-side action turns that into a real repository, real artifact files, or a real GSD project. M003 makes the handoff boundary concrete.

The codebase is well-positioned for this. The bridge server at `server/` already handles pipeline orchestration, artifact storage, and SSE push. The `gh` CLI is installed and authenticated. GSD (v2.28.0) is installed and can be bootstrapped via its CLI. The handoff packet model already tracks readiness across architecture, specification, prototype, and approval sections. The engine choice (`claude` or `codex`) is stored per project and rendered in the UI. The work is additive: new server routes, a provisioning service module, reducer/selector extensions, and handoff UI controls.

**Primary recommendation:** Start by proving the server-side provisioning primitive — `gh repo create`, local clone, artifact file write, and GSD bootstrap — as a standalone module before wiring it into REST endpoints and the UI. This is the M003 equivalent of M002's "prove the webhook→Wait→resume loop first" strategy. If repo creation, artifact formatting, and GSD init work as a server function, the REST layer, SSE events, and UI controls are additive.

## Recommendation

**Approach: Provisioning service module → REST endpoints → Client state → Handoff UI**

1. Build a provisioning service module in `server/` that orchestrates: GitHub repo creation via `gh` CLI, local workspace clone, artifact file formatting and write, and GSD project file scaffolding. Expose a `preview()` function that shows what will happen (repo name, files, engine) and a `provision()` function that executes it.

2. Add REST endpoints to the bridge server (`server/routes/provisioning.js`) with explicit confirmation gates: preview returns a plan, provision requires a second explicit POST. SSE events push provisioning progress to the client.

3. Extend the reducer, model, and selectors to track provisioning state per project — `provisioning: { status, repoUrl, workspacePath, error }` on the project record, surfaced through the existing handoff packet view model.

4. Add provisioning controls to the existing HandoffPanel UI — a confirmation dialog showing the preview, a provision button gated behind `handoff_ready`, and live progress via SSE. Follow the Severance-floor aesthetic.

5. The GSD bootstrap path writes `.gsd/PROJECT.md`, `.gsd/REQUIREMENTS.md`, and an initial milestone context derived from the approved dossier artifacts. Engine choice is recorded in `.gsd/preferences.md`. The result is a standalone project directory that GSD can manage immediately.

**Why this order:** The provisioning primitive is the risk. If `gh repo create` + clone + artifact write + GSD init works reliably as a server function, the REST/UI layer is known territory (same patterns as M002's pipeline endpoints). If it doesn't work, no amount of UI will fix it.

## Implementation Landscape

### Key Files

- `server/index.js` — Express app entrypoint; needs `provisioningRouter` mount at `/api/provisioning`
- `server/routes/pipeline.js` — Existing route file with SSE, trigger, callback, approve patterns; provisioning routes should follow the same structure
- `server/artifacts.js` — Artifact storage and retrieval; provisioning reads artifacts by project ID and converts them to human-readable files
- `server/config.js` — Webhook registry; provisioning needs its own config section for workspace root path, GitHub org defaults, and GSD preferences
- `server/pipeline.js` — In-memory execution state tracker; provisioning needs a similar tracking module or extension
- `src/lumon/model.js` — `createProject`, `createExecutionEngine`, `LUMON_PREBUILD_STAGE_KEYS`, `LUMON_HANDOFF_PACKET_SECTION_DEFINITIONS`; needs a provisioning state shape added to the project record
- `src/lumon/reducer.js` — Needs new action types for provisioning state updates (`lumon/update-provisioning`)
- `src/lumon/selectors.js` — `buildHandoffPacket`, `buildProjectDetailContract`; needs provisioning state surfaced through the handoff view model
- `src/lumon/sync.js` — SSE event handler; needs to handle new provisioning-progress events from the server
- `src/features/mission-control/DashboardTab.jsx` — `HandoffPanel` component; needs provisioning controls, confirmation dialog, and progress display
- `src/lumon/context.jsx` — `LumonProvider` and `useLumonActions`; needs `provisionProject` action wired through sync

### New Files (Expected)

- `server/provisioning.js` — Core provisioning service module: preview, provision, status, artifact formatting
- `server/routes/provisioning.js` — REST endpoints for provisioning preview, execute, and status
- `server/__tests__/provisioning.test.js` — Server-side provisioning tests
- `src/lumon/__tests__/provisioning-state.test.js` — Client-side provisioning state tests

### Build Order

**1. Provisioning service module (prove the primitive)**
Build `server/provisioning.js` with functions:
- `preview({ projectId })` — reads project artifacts, resolves repo name, returns what will be created
- `provision({ projectId, repoName, isPrivate, workspaceRoot })` — executes repo creation, clone, artifact write, GSD init
- `getStatus(projectId)` — returns current provisioning state

This is the foundational risk. Prove that `gh repo create <name> --private --clone` works from a Node child process, that artifacts can be formatted from JSON to markdown, and that GSD bootstrap files can be generated. Test this with a real (or mock) `gh` invocation.

**2. REST endpoints + SSE events (expose the primitive)**
Add `server/routes/provisioning.js` following the `pipeline.js` patterns:
- `POST /api/provisioning/preview` → returns provisioning plan (no side effects)
- `POST /api/provisioning/execute` → runs provisioning (requires explicit confirmation token from preview)
- `GET /api/provisioning/status/:projectId` → returns provisioning state

Wire SSE events (`provisioning-progress`, `provisioning-complete`, `provisioning-error`) through the existing SSE registry pattern from `pipeline.js`.

**3. Client state + selectors (track the state)**
Extend the project model with a `provisioning` field. Add reducer actions for provisioning state transitions. Surface provisioning state through the handoff packet view model so the existing HandoffPanel can render it.

**4. Handoff UI + confirmation dialog (make it usable)**
Add provisioning controls to the HandoffPanel: preview button → confirmation dialog → provision button → progress display. Gate the provision action behind `handoff_ready` and the explicit confirmation pattern (D005, R018).

**5. Integration tests (prove the loop)**
Server-side tests for the full provisioning flow. Client-side tests for provisioning state transitions and UI rendering.

### Verification Approach

- **Server primitive:** Unit tests for `provisioning.js` that mock `gh` CLI calls and verify artifact file structure
- **REST endpoints:** Supertest integration tests following the `pipeline-api.test.js` pattern
- **Client state:** Vitest + RTL tests for reducer/selector provisioning state transitions
- **UI:** RTL tests for HandoffPanel provisioning controls, confirmation dialog, and gated button states
- **End-to-end:** Manual verification with a real `gh repo create` against the authenticated GitHub account (test repo, delete after)
- Commands: `npx vitest run`, `npm run build`, `npx eslint server/ src/lumon/ src/features/mission-control/`

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| GitHub repo creation | `gh repo create` CLI | Already installed, authenticated, handles auth/org/visibility. Shelling out is simpler and more reliable than importing Octokit for a single operation. |
| Git operations (clone, add, commit, push) | `git` CLI via child_process | Already available; wrapping git commands is the established pattern for Node-based tooling rather than adding isomorphic-git or similar. |
| GSD project scaffolding | GSD file conventions from this repo's own `.gsd/` | The existing `.gsd/PROJECT.md`, `REQUIREMENTS.md`, and milestone structure are the proven contract. Copy the structure, not a library. |
| Artifact markdown formatting | Template strings with section headers | Artifacts are structured JSON with known fields per type. Simple template-based markdown conversion is cleaner than pulling in a markdown AST library. |
| Server-side child process execution | `node:child_process` `execFile`/`spawn` | Built-in, no dependencies. Use `execFile` for `gh` and `git` commands with proper error handling. |

## Constraints

- **Every provisioning side effect must be behind explicit operator confirmation** (D005, R018, R029). The preview/confirm/execute flow is not optional — it's a hard product requirement. The server must never create a repo from a single unauthenticated POST.
- **Artifacts must remain human-inspectable on disk** (M003-CONTEXT technical constraint). Write markdown files with clear section headers, not opaque JSON blobs. The handoff package should be readable by a developer opening the repo for the first time.
- **The workspace directory for provisioned projects must be outside the Lumon repo** (R014). Each project gets its own directory. Current parent directory structure: `/Users/djbeatbug/RoadToMillion/<project>/`. Workspace root should be configurable via env var (e.g., `LUMON_WORKSPACE_ROOT`).
- **The provisioning service runs server-side on the bridge server.** The frontend cannot shell out to `gh` or `git`. All provisioning happens through REST endpoints.
- **The `gh` CLI must be installed and authenticated.** If `gh` is not available, provisioning should fail clearly with a diagnostic message, not silently degrade.
- **GSD bootstrap must produce files that GSD can consume immediately.** The `.gsd/PROJECT.md` format, milestone structure, and `preferences.md` shape must match what GSD expects. This repo's own `.gsd/` is the reference implementation.
- **Provisioning state must survive page reload.** The project's provisioning status (pending, in-progress, complete, failed) must be persisted through the existing localStorage envelope, not just held in-memory.
- **The existing 6-stage pipeline model does not change.** Provisioning happens after the handoff gate is approved, not as a new pipeline stage. It's a post-pipeline action on the project.

## Common Pitfalls

- **Treating provisioning as a new pipeline stage.** Provisioning is a post-pipeline action triggered by handoff approval, not a stage within the intake→handoff pipeline. Adding a "provisioning" stage would break the existing stage taxonomy (D016) and every selector that counts stages.
- **Skipping the preview step.** A "one-click provision" that creates a repo without showing what will happen violates D005 and R018. The preview→confirm→execute flow is the contract.
- **Storing large artifacts in the client state.** Artifact content lives server-side (D027). The provisioning service reads artifacts from `server/data/` — never from client-side state. The client only tracks provisioning status, not the artifact payloads being written.
- **Hardcoding the workspace root path.** The workspace directory should be configurable via `LUMON_WORKSPACE_ROOT` env var. Don't hardcode `/Users/djbeatbug/RoadToMillion/` into source code.
- **Making provisioning non-idempotent.** If provisioning fails halfway (repo created but artifacts not written), retrying should resume from where it left off rather than failing because the repo already exists. Track provisioning steps individually.
- **Forgetting to handle `gh` CLI not installed.** The server should check for `gh` availability at startup or on first provisioning request and return a clear diagnostic error, not a cryptic ENOENT.
- **Breaking the existing HandoffPanel.** The HandoffPanel already renders packet sections, status, and readiness. Add provisioning controls alongside the existing content, not by replacing it.
- **Trying to auto-provision on handoff approval.** The operator approves the handoff gate (existing behavior), then separately initiates provisioning (new behavior). These are two distinct confirmations.

## Open Risks

- **GitHub rate limits on repo creation.** The GitHub API limits repo creation. For a single-operator tool, this is unlikely to be hit, but the provisioning service should handle 403/rate-limit responses gracefully.
- **Artifact content format varies by type.** The 9 artifact types have different JSON shapes. The markdown formatter needs type-specific templates. Missing or malformed artifact content should produce a clear fallback, not crash the provisioning flow.
- **GSD version compatibility.** The `.gsd/` structure may evolve across GSD versions. The bootstrap files should match the conventions observed in this repo's own `.gsd/` directory (GSD v2.28.0), with a note about the targeted version.
- **Workspace directory permissions and disk space.** The provisioning service creates directories and files on the operator's machine. Disk full, permission denied, or path-too-long errors need clear diagnostics.
- **Concurrent provisioning for the same project.** If the operator triggers provisioning twice (e.g., double-click), the second request should be rejected or queued, not create a duplicate repo.
- **Prototype scaffold artifact may contain actual code.** If the n8n-generated prototype artifact includes code files (not just a description), the provisioning service needs to extract and write them as real source files, not just markdown. Current implementation should handle the description case first and flag code extraction as a future enhancement.

## Sources

- Codebase exploration: `server/routes/pipeline.js` — SSE, trigger, callback, approve patterns (the template for provisioning routes)
- Codebase exploration: `server/artifacts.js` — disk-based JSON artifact storage (the source for provisioning file reads)
- Codebase exploration: `src/lumon/model.js` — `LUMON_HANDOFF_PACKET_SECTION_DEFINITIONS`, `createProject`, engine choice normalization
- Codebase exploration: `src/lumon/selectors.js` — `buildHandoffPacket`, `buildProjectDetailContract` (where provisioning state will be surfaced)
- Codebase exploration: `src/features/mission-control/DashboardTab.jsx` — `HandoffPanel`, `HandoffSectionCard` (where provisioning UI will be added)
- Codebase exploration: `.gsd/PROJECT.md`, `.gsd/REQUIREMENTS.md`, `.gsd/milestones/` — GSD bootstrap file format reference
- Codebase exploration: `~/.gsd/preferences.md` — GSD preferences format for engine and mode configuration
- Codebase exploration: `gh repo create --help` — GitHub CLI repo creation flags and behavior
- Prior art: M002-RESEARCH.md — "prove the primitive first" strategy and bridge server design rationale

## Requirement Analysis

### Table Stakes for M003

- **R011** (repo creation + artifact upload) — The defining requirement. Must prove that an approved project becomes a real GitHub repo with its dossier artifacts written as inspectable files.
- **R013** (GSD bootstrap + autonomous handoff) — Must prove that the provisioned repo contains GSD-ready project files (`PROJECT.md`, `REQUIREMENTS.md`, initial milestone) so GSD can manage the build immediately.
- **R014** (separate repos/workspaces) — Must prove that each provisioned project gets its own directory and repository, not a shared workspace.
- **R018** (explicit confirmation before irreversible) — Must prove the preview→confirm→execute flow for repo creation. No silent provisioning.

### Already Validated (M003 Consumes)

- **R012** (engine choice per project) — Validated in M001/S02. M003 reads the stored engine choice and records it in the GSD bootstrap files. No new validation needed, but the provisioning flow must faithfully propagate the choice.
- **R010** (tangible handoff package) — Validated in M002/S04. M003 reads the handoff packet artifacts. The packet structure is stable.

### Not in M003 Scope

- **R015** (see what each agent is doing) — M004 scope; requires live build supervision.
- **R017** (bounded recovery pass) — M004 scope; applies to runtime build execution, not provisioning.

### Candidate Requirements (Advisory)

- **Provisioning resumability:** If provisioning fails mid-way (repo created but artifacts not written), the operator should be able to retry without duplicating the repo. This is partially covered by the "operational complete" class in M003-CONTEXT but could be formalized as a requirement if the planner deems it table-stakes.
- **Provisioning status visibility:** The operator should see provisioning progress (repo created → artifacts written → GSD initialized → complete) in real time. This is implied by R011 but not explicitly stated.
- **`gh` CLI availability check:** The server should validate that `gh` is installed and authenticated before accepting provisioning requests. This is a developer-experience requirement, not user-facing.
