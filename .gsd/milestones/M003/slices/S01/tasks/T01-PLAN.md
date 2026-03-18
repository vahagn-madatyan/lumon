---
estimated_steps: 5
estimated_files: 2
---

# T01: Build provisioning service with artifact formatting and GSD bootstrap

**Slice:** S01 — Provisioning Service & Handoff Controls
**Milestone:** M003

## Description

Build the core provisioning service module (`server/provisioning.js`) that orchestrates GitHub repo creation, local workspace clone, artifact-to-markdown formatting, and GSD bootstrap file generation. This is the foundational risk for M003 — if the server-side provisioning primitive works reliably, the REST/UI layers are additive.

The module exposes three functions:
- `preview(projectId, artifacts)` — returns a plan object describing what provisioning will create (repo name, file list, engine choice, workspace path) without any side effects
- `provision(projectId, options)` — executes the full provisioning sequence: repo-create → clone → artifact-write → gsd-init → commit-push, tracking step-level status
- `getStatus(projectId)` — returns current provisioning state for a project

Key sub-components:
- `execGh()` / `execGit()` — wrappers around `node:child_process execFile` for gh and git CLI
- `formatArtifactToMarkdown(artifact)` — type-dispatched formatter for all 9 artifact types (viability_analysis, business_plan, tech_research, naming_candidates, domain_signals, trademark_signals, architecture_outline, specification, prototype_scaffold) with generic fallback
- `generateGsdBootstrap()` — produces `.gsd/PROJECT.md`, `.gsd/REQUIREMENTS.md`, `.gsd/preferences.md`, and initial milestone directory matching this repo's own `.gsd/` structure (GSD v2.28.0, per D041)

**Relevant installed skills:** None specific — this is Node.js server code using built-in `node:child_process` and `node:fs`.

**Key decisions:**
- D041: Use this repo's own `.gsd/` structure as the reference for generated GSD files
- D043: Shell out to `gh` CLI and `git` via `node:child_process execFile`, not Octokit
- D044: Workspace root configurable via `LUMON_WORKSPACE_ROOT` env var, defaulting to parent of Lumon repo directory

## Steps

1. **Create `server/provisioning.js` with module structure.** Export `preview()`, `provision()`, `getStatus()`. Create in-memory provisioning state tracker (Map keyed by projectId, same pattern as `server/pipeline.js`). Define the provisioning step sequence: `['repo-create', 'clone', 'artifact-write', 'gsd-init', 'commit-push']`. Define workspace root resolution: `process.env.LUMON_WORKSPACE_ROOT || path.resolve(__dirname, '../../')`.

2. **Implement CLI helpers and `preview()`.** Write `execGh(args)` and `execGit(args, options)` wrappers around `execFile` from `node:child_process` (promisified). `preview()` takes projectId and an artifacts array, resolves the repo name (from project name/id, slugified), computes workspace path, builds the file manifest (artifact files + GSD files), and returns `{ repoName, repoFullName, workspacePath, engineChoice, files: [{ path, description }], steps }` — no side effects.

3. **Implement `formatArtifactToMarkdown(artifact)`.** Create a type-dispatch map for the 9 artifact types. Each formatter extracts the relevant fields from `artifact.content` and produces readable markdown with section headers. For example, `viability_analysis` should have sections like `## Market Analysis`, `## Technical Feasibility`, `## Risk Assessment`; `naming_candidates` should list candidates with scoring; `architecture_outline` should have `## Overview`, `## Components`, `## Stack Decisions`. Include a `formatGenericArtifact()` fallback that renders any unknown type as a YAML-ish key-value block under the artifact type header. If content is a string, render it directly. If content is an object, render each top-level key as a section.

4. **Implement `generateGsdBootstrap()`.** This function takes `{ projectName, description, engineChoice, requirements, milestoneContext }` and returns an array of `{ relativePath, content }` objects. Files to generate:
   - `.gsd/PROJECT.md` — project name, description, current state, architecture notes (match format of this repo's `.gsd/PROJECT.md`)
   - `.gsd/REQUIREMENTS.md` — requirements header with any requirements derived from the dossier artifacts (or a placeholder section)
   - `.gsd/preferences.md` — GSD preferences including `execution_engine: claude|codex` and `autonomous_mode: guided`
   - `.gsd/milestones/M001/M001-ROADMAP.md` — initial milestone placeholder derived from project context
   - `.gsd/STATE.md` — initial GSD state file

5. **Implement `provision()` and write tests.** `provision()` creates provisioning state for the project, then executes each step in sequence: (1) `gh repo create <name> --private --clone --description "..."` in the workspace root dir, (2) verify clone directory exists, (3) write formatted artifact files to `docs/dossier/` in the cloned repo, (4) write GSD bootstrap files to `.gsd/` in the cloned repo, (5) `git add . && git commit -m "..." && git push`. Each step updates the provisioning state with `{ status: 'running'|'complete'|'failed', startedAt, completedAt, error }`. On any step failure, mark the provisioning as failed and stop. Write comprehensive tests in `server/__tests__/provisioning.test.js` with mocked `execFile` (vi.mock `node:child_process`): verify preview returns expected structure, verify provision calls CLI in correct order with correct args, verify each artifact type produces markdown with expected sections, verify GSD bootstrap file content matches expected format, verify step tracking updates correctly, verify failure at any step stops execution and records error.

## Must-Haves

- [ ] `preview()` returns complete provisioning plan without side effects
- [ ] `provision()` executes 5-step sequence with step-level tracking
- [ ] `formatArtifactToMarkdown()` handles all 9 artifact types with readable section headers
- [ ] `generateGsdBootstrap()` produces PROJECT.md, REQUIREMENTS.md, preferences.md, initial milestone, and STATE.md matching this repo's `.gsd/` format
- [ ] `execGh()` and `execGit()` properly wrap `execFile` with error handling
- [ ] `getStatus()` returns current provisioning state
- [ ] Workspace root configurable via `LUMON_WORKSPACE_ROOT` env var
- [ ] All tests pass with mocked CLI calls

## Verification

- `npx vitest run server/__tests__/provisioning.test.js` — all provisioning service tests pass
- Preview returns `{ repoName, workspacePath, engineChoice, files[], steps[] }`
- Provision calls `gh repo create` then `git clone`, then writes files, then `git add/commit/push`
- Each of the 9 artifact types produces markdown with `#` headers and readable content
- GSD bootstrap `PROJECT.md` has `# Project`, `## What This Is`, `## Current State` sections
- GSD `preferences.md` contains `execution_engine: claude` or `codex` based on project engine choice
- Step-level provisioning state tracks `status`, `startedAt`, `completedAt`, `error` per step

## Observability Impact

- Signals added: `[provisioning]` prefixed console logs for each step execution and completion
- How a future agent inspects this: `getStatus(projectId)` returns step-level state with timestamps and errors
- Failure state exposed: failed step name, error message, partial completion state (which steps completed before failure)

## Inputs

- `server/artifacts.js` — `getByProject(projectId)` and `getByProjectAndStage(projectId, stageKey)` for reading approved artifacts
- `.gsd/PROJECT.md` — reference format for generated GSD PROJECT.md
- `.gsd/REQUIREMENTS.md` — reference format for generated GSD REQUIREMENTS.md
- D041 (this repo's `.gsd/` as reference), D043 (shell out to gh/git), D044 (workspace root env var)
- The 9 artifact types and their content shapes: viability_analysis, business_plan, tech_research, naming_candidates, domain_signals, trademark_signals, architecture_outline, specification, prototype_scaffold
- Engine choice is either `"claude"` or `"codex"` (from model.js `VALID_ENGINE_CHOICES`)

## Expected Output

- `server/provisioning.js` — complete provisioning service module (~300-400 lines) exporting `preview`, `provision`, `getStatus`, `formatArtifactToMarkdown`, `generateGsdBootstrap`
- `server/__tests__/provisioning.test.js` — comprehensive test file (~200-300 lines) with mocked CLI and artifact data covering preview, provision steps, all 9 artifact formatters, GSD bootstrap, and error handling
