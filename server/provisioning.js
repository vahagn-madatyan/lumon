import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as artifacts from "./artifacts.js";

let execFileAsync = promisify(execFileCb);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Replace the internal execFile implementation. Used by tests.
 * @param {Function} fn — promisified execFile replacement
 */
export function _setExecFile(fn) {
  execFileAsync = fn;
}

/** Reset to the real execFile. Used by test teardown. */
export function _resetExecFile() {
  execFileAsync = promisify(execFileCb);
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PROVISIONING_STEPS = [
  "repo-create",
  "clone",
  "artifact-write",
  "gsd-init",
  "commit-push",
];

let WORKSPACE_ROOT =
  process.env.LUMON_WORKSPACE_ROOT || path.resolve(__dirname, "../../");

/**
 * Override workspace root. Used by tests.
 * @param {string} dir
 */
export function _setWorkspaceRoot(dir) {
  WORKSPACE_ROOT = dir;
}

/** Reset workspace root to default. */
export function _resetWorkspaceRoot() {
  WORKSPACE_ROOT = process.env.LUMON_WORKSPACE_ROOT || path.resolve(__dirname, "../../");
}

// ---------------------------------------------------------------------------
// In-memory provisioning state
// ---------------------------------------------------------------------------

/** @type {Map<string, object>} projectId → provisioning record */
const provisioningState = new Map();

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

/**
 * Run a `gh` CLI command.
 * @param {string[]} args
 * @param {object} [options] - execFile options (cwd, env, etc.)
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
export async function execGh(args, options = {}) {
  try {
    const result = await execFileAsync("gh", args, {
      maxBuffer: 10 * 1024 * 1024,
      ...options,
    });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (err) {
    const message = err.stderr || err.message || "gh command failed";
    throw new Error(`[provisioning] gh ${args.join(" ")} failed: ${message}`);
  }
}

/**
 * Run a `git` command.
 * @param {string[]} args
 * @param {object} [options] - execFile options (cwd, env, etc.)
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
export async function execGit(args, options = {}) {
  try {
    const result = await execFileAsync("git", args, {
      maxBuffer: 10 * 1024 * 1024,
      ...options,
    });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (err) {
    const message = err.stderr || err.message || "git command failed";
    throw new Error(`[provisioning] git ${args.join(" ")} failed: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Slug / name helpers
// ---------------------------------------------------------------------------

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}

// ---------------------------------------------------------------------------
// Artifact-to-Markdown formatters
// ---------------------------------------------------------------------------

function renderValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((v) => `- ${typeof v === "string" ? v : JSON.stringify(v)}`).join("\n");
  return JSON.stringify(value, null, 2);
}

function section(heading, content) {
  if (content == null || content === "") return "";
  return `## ${heading}\n\n${renderValue(content)}\n`;
}

function formatViabilityAnalysis(content) {
  const parts = [`# Viability Analysis\n`];
  parts.push(section("Market Assessment", content.marketAssessment));
  parts.push(section("Technical Feasibility", content.technicalFeasibility));
  if (content.riskFactors) {
    const risks = Array.isArray(content.riskFactors)
      ? content.riskFactors.map((r) => `- ${typeof r === "string" ? r : r.description ?? JSON.stringify(r)}`).join("\n")
      : renderValue(content.riskFactors);
    parts.push(section("Risk Assessment", risks));
  }
  parts.push(section("Recommendation", content.recommendation));
  return parts.filter(Boolean).join("\n");
}

function formatBusinessPlan(content) {
  const parts = [`# Business Plan\n`];
  parts.push(section("Target Audience", content.targetAudience));
  parts.push(section("Pricing Posture", content.pricingPosture));
  if (content.featurePhases) {
    const phases = Array.isArray(content.featurePhases)
      ? content.featurePhases.map((p, i) => `### ${p.name ?? `Phase ${i + 1}`}\n\n${p.description ?? JSON.stringify(p)}`).join("\n\n")
      : renderValue(content.featurePhases);
    parts.push(section("Feature Phases", phases));
  }
  parts.push(section("Revenue Model", content.revenueModel));
  parts.push(section("Recommendation", content.recommendation));
  return parts.filter(Boolean).join("\n");
}

function formatTechResearch(content) {
  const parts = [`# Technical Research\n`];
  if (Array.isArray(content.approaches) && content.approaches.length > 0) {
    const approachLines = content.approaches.map((a, i) => {
      const lines = [`### ${a.name ?? `Approach ${i + 1}`}`];
      if (a.score != null) lines.push(`\n**Score:** ${a.score}/10`);
      if (a.description) lines.push(`\n${a.description}`);
      if (a.pros) lines.push(`\n**Pros:** ${Array.isArray(a.pros) ? a.pros.join(", ") : a.pros}`);
      if (a.cons) lines.push(`\n**Cons:** ${Array.isArray(a.cons) ? a.cons.join(", ") : a.cons}`);
      return lines.join("");
    }).join("\n\n");
    parts.push(section("Approaches", approachLines));
  }
  parts.push(section("Tradeoffs", content.tradeoffs));
  parts.push(section("Recommendation", content.recommendation));
  return parts.filter(Boolean).join("\n");
}

function formatNamingCandidates(content) {
  const parts = [`# Naming Candidates\n`];
  parts.push(section("Methodology", content.methodology));
  if (Array.isArray(content.candidates) && content.candidates.length > 0) {
    const candidateLines = content.candidates.map((c, i) => {
      const lines = [`### ${i + 1}. ${c.name}`];
      if (c.rationale) lines.push(`\n${c.rationale}`);
      if (c.domainHint) lines.push(`\n**Domain hint:** ${c.domainHint}`);
      if (Array.isArray(c.styleTags) && c.styleTags.length > 0) {
        lines.push(`\n**Tags:** ${c.styleTags.join(", ")}`);
      }
      return lines.join("");
    }).join("\n\n");
    parts.push(section("Candidates", candidateLines));
  }
  return parts.filter(Boolean).join("\n");
}

function formatDomainSignals(content) {
  const parts = [`# Domain Signals\n`];
  if (content.selectedName) parts.push(`**Selected name:** ${content.selectedName}\n`);
  if (content.disclaimer) parts.push(`> ${content.disclaimer}\n`);
  if (Array.isArray(content.signals) && content.signals.length > 0) {
    const header = "| Domain | Status | Price |\n|--------|--------|-------|";
    const rows = content.signals.map((s) =>
      `| ${s.domain ?? "—"} | ${s.status ?? "—"} | ${s.price ?? "—"} |`
    ).join("\n");
    parts.push(section("Availability", `${header}\n${rows}`));
  }
  return parts.filter(Boolean).join("\n");
}

function formatTrademarkSignals(content) {
  const parts = [`# Trademark Signals\n`];
  if (content.selectedName) parts.push(`**Selected name:** ${content.selectedName}\n`);
  if (content.disclaimer) parts.push(`> ${content.disclaimer}\n`);
  if (Array.isArray(content.signals) && content.signals.length > 0) {
    const header = "| Mark | Status | Class | Owner |\n|------|--------|-------|-------|";
    const rows = content.signals.map((s) =>
      `| ${s.mark ?? "—"} | ${s.status ?? "—"} | ${s.class ?? "—"} | ${s.owner ?? "—"} |`
    ).join("\n");
    parts.push(section("Signals", `${header}\n${rows}`));
  }
  return parts.filter(Boolean).join("\n");
}

function formatArchitectureOutline(content) {
  const parts = [`# Architecture Outline\n`];
  parts.push(section("Overview", content.systemOverview));
  if (Array.isArray(content.components) && content.components.length > 0) {
    const compLines = content.components.map((c) => {
      const lines = [`### ${c.name}`];
      if (c.technology) lines.push(`\n**Technology:** ${c.technology}`);
      if (c.responsibility) lines.push(`\n${c.responsibility}`);
      return lines.join("");
    }).join("\n\n");
    parts.push(section("Components", compLines));
  }
  parts.push(section("Data Flow", content.dataFlow));
  parts.push(section("Deployment Model", content.deploymentModel));
  parts.push(section("Stack Decisions", content.recommendation));
  return parts.filter(Boolean).join("\n");
}

function formatSpecification(content) {
  const parts = [`# Specification\n`];
  if (Array.isArray(content.functionalRequirements) && content.functionalRequirements.length > 0) {
    const reqLines = content.functionalRequirements.map((r) => {
      const lines = [`- **${r.id ?? "REQ"}** ${r.title ?? ""}`.trim()];
      if (r.priority) lines[0] += ` [${r.priority}]`;
      if (r.description) lines.push(`  ${r.description}`);
      return lines.join("\n");
    }).join("\n");
    parts.push(section("Functional Requirements", reqLines));
  }
  if (Array.isArray(content.nonFunctionalRequirements) && content.nonFunctionalRequirements.length > 0) {
    const nfrLines = content.nonFunctionalRequirements.map((n) => {
      const lines = [`- **${n.category ?? "NFR"}:** ${n.requirement ?? ""}`];
      if (n.metric) lines.push(`  Metric: ${n.metric}`);
      return lines.join("\n");
    }).join("\n");
    parts.push(section("Non-Functional Requirements", nfrLines));
  }
  if (Array.isArray(content.apiContracts) && content.apiContracts.length > 0) {
    const apiLines = content.apiContracts.map((a) =>
      `- \`${a.method ?? "GET"} ${a.endpoint ?? "/"}\` — ${a.description ?? ""}`
    ).join("\n");
    parts.push(section("API Contracts", apiLines));
  }
  parts.push(section("Recommendation", content.recommendation));
  return parts.filter(Boolean).join("\n");
}

function formatPrototypeScaffold(content) {
  const parts = [`# Prototype Scaffold\n`];
  if (content.projectStructure) {
    parts.push(section("Project Structure", `\`\`\`\n${content.projectStructure}\n\`\`\``));
  }
  if (Array.isArray(content.entryPoints) && content.entryPoints.length > 0) {
    const epLines = content.entryPoints.map((ep) =>
      `- **${ep.file}** — ${ep.purpose ?? ""}`
    ).join("\n");
    parts.push(section("Entry Points", epLines));
  }
  if (Array.isArray(content.dependencies) && content.dependencies.length > 0) {
    const depLines = content.dependencies.map((d) => {
      let line = `- **${d.name}**`;
      if (d.version) line += ` (${d.version})`;
      if (d.purpose) line += ` — ${d.purpose}`;
      return line;
    }).join("\n");
    parts.push(section("Dependencies", depLines));
  }
  if (content.setupInstructions) {
    parts.push(section("Setup Instructions", `\`\`\`\n${content.setupInstructions}\n\`\`\``));
  }
  parts.push(section("Recommendation", content.recommendation));
  return parts.filter(Boolean).join("\n");
}

/** Fallback formatter for unknown artifact types. */
function formatGenericArtifact(content, type) {
  const parts = [`# ${type ?? "Artifact"}\n`];
  if (typeof content === "string") {
    parts.push(content);
  } else if (content && typeof content === "object") {
    for (const [key, value] of Object.entries(content)) {
      parts.push(section(key.charAt(0).toUpperCase() + key.slice(1), value));
    }
  }
  return parts.filter(Boolean).join("\n");
}

const TYPE_FORMATTERS = {
  viability_analysis: formatViabilityAnalysis,
  business_plan: formatBusinessPlan,
  tech_research: formatTechResearch,
  naming_candidates: formatNamingCandidates,
  domain_signals: formatDomainSignals,
  trademark_signals: formatTrademarkSignals,
  architecture_outline: formatArchitectureOutline,
  specification: formatSpecification,
  prototype_scaffold: formatPrototypeScaffold,
};

/**
 * Format an artifact to readable markdown.
 * @param {{ type: string, content: any }} artifact
 * @returns {string} Markdown content
 */
export function formatArtifactToMarkdown(artifact) {
  if (!artifact) return "";
  const content = artifact.content;
  if (content == null) return "";

  const formatter = TYPE_FORMATTERS[artifact.type];
  if (formatter && typeof content === "object") {
    return formatter(content);
  }
  return formatGenericArtifact(content, artifact.type);
}

// ---------------------------------------------------------------------------
// GSD bootstrap file generator
// ---------------------------------------------------------------------------

/**
 * Generate GSD bootstrap files for a new project repo.
 * @param {{ projectName: string, description?: string, engineChoice?: string, requirements?: object[], milestoneContext?: string }} params
 * @returns {{ relativePath: string, content: string }[]}
 */
export function generateGsdBootstrap({
  projectName,
  description = "",
  engineChoice = "claude",
  requirements = [],
  milestoneContext = "",
} = {}) {
  const engine = engineChoice === "codex" ? "codex" : "claude";
  const engineLabel = engine === "codex" ? "Codex CLI" : "Claude Code";
  const now = new Date().toISOString().split("T")[0];

  // --- PROJECT.md ---
  const projectMd = `# Project

## What This Is

${projectName}${description ? ` — ${description}` : ""}

## Current State

- Project bootstrapped from Lumon mission control on ${now}.
- Execution engine: ${engineLabel}.
- GSD workspace initialized with dossier artifacts from the Lumon discovery pipeline.

## Architecture / Key Patterns

Architecture and technical direction documented in \`docs/dossier/\` artifacts produced during the Lumon pre-build pipeline.

## Milestone Sequence

- [ ] M001: Initial Build — ${milestoneContext || `First build milestone for ${projectName}.`}
`;

  // --- REQUIREMENTS.md ---
  let requirementsList = "";
  if (requirements.length > 0) {
    requirementsList = requirements
      .map((r, i) => {
        const id = r.id || `R${String(i + 1).padStart(3, "0")}`;
        return `### ${id} - ${r.title || r.description || "Requirement"}\n- Status: active\n- Source: lumon-dossier`;
      })
      .join("\n\n");
  } else {
    requirementsList = `### R001 - Initial requirements to be derived from dossier artifacts\n- Status: active\n- Source: lumon-dossier\n- Notes: Review docs/dossier/ artifacts to extract concrete requirements.`;
  }

  const requirementsMd = `# Requirements

## Active

${requirementsList}

## Validated

_No requirements validated yet._

## Traceability

| ID | Status | Owner | Proof |
|---|---|---|---|
| R001 | active | M001 | unmapped |
`;

  // --- preferences.md ---
  const preferencesMd = `# GSD Preferences

execution_engine: ${engine}
autonomous_mode: guided
unique_milestone_ids: false
`;

  // --- STATE.md ---
  const stateMd = `# GSD State

**Active Milestone:** M001: Initial Build
**Active Slice:** (none)
**Phase:** planning

## Milestone Registry
- 🔄 **M001:** Initial Build

## Recent Decisions
- None recorded

## Blockers
- None

## Next Action
Plan the first slice for M001.
`;

  // --- M001 ROADMAP ---
  const roadmapMd = `# M001: Initial Build

**Vision:** ${milestoneContext || `Deliver the first working build of ${projectName}.`}

## Success Criteria

- Core functionality operational and testable.
- Architecture decisions documented.
- Test coverage established for critical paths.

## Key Risks / Unknowns

- Requirements derived from Lumon dossier may need refinement during build.
- Technical approach from research phase needs validation against implementation.

## Proof Strategy

- Contract verification through tests and build checks.
- Integration verification through manual testing.

## Verification Classes

- Contract verification: unit and integration tests.
- Integration verification: end-to-end build and run verification.
`;

  return [
    { relativePath: ".gsd/PROJECT.md", content: projectMd },
    { relativePath: ".gsd/REQUIREMENTS.md", content: requirementsMd },
    { relativePath: ".gsd/preferences.md", content: preferencesMd },
    { relativePath: ".gsd/STATE.md", content: stateMd },
    { relativePath: ".gsd/milestones/M001/M001-ROADMAP.md", content: roadmapMd },
  ];
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

/**
 * Build a provisioning plan without side effects.
 * @param {string} projectId
 * @param {{ name?: string, description?: string, engineChoice?: string, artifacts?: object[] }} options
 * @returns {{ repoName: string, repoFullName: string, workspacePath: string, engineChoice: string, files: { path: string, description: string }[], steps: string[] }}
 */
export function preview(projectId, options = {}) {
  const projectArtifacts = options.artifacts ?? artifacts.getByProject(projectId);
  const projectName = options.name || projectId;
  const engineChoice = options.engineChoice || "claude";
  const repoName = slugify(projectName);
  const workspacePath = path.join(WORKSPACE_ROOT, repoName);

  const files = [];

  // Artifact files
  for (const artifact of projectArtifacts) {
    const filename = `${artifact.type}.md`;
    files.push({
      path: `docs/dossier/${filename}`,
      description: `${artifact.type} artifact formatted as markdown`,
    });
  }

  // GSD bootstrap files
  const gsdFiles = generateGsdBootstrap({
    projectName,
    description: options.description,
    engineChoice,
  });
  for (const gsdFile of gsdFiles) {
    files.push({
      path: gsdFile.relativePath,
      description: `GSD bootstrap: ${path.basename(gsdFile.relativePath)}`,
    });
  }

  return {
    repoName,
    repoFullName: repoName,
    workspacePath,
    engineChoice,
    files,
    steps: [...PROVISIONING_STEPS],
  };
}

// ---------------------------------------------------------------------------
// Provisioning state management
// ---------------------------------------------------------------------------

function createProvisioningRecord(projectId) {
  return {
    projectId,
    status: "running",
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
    steps: PROVISIONING_STEPS.map((name) => ({
      name,
      status: "pending",
      startedAt: null,
      completedAt: null,
      error: null,
    })),
  };
}

function updateStep(record, stepName, updates) {
  const step = record.steps.find((s) => s.name === stepName);
  if (step) Object.assign(step, updates);
  return step;
}

/**
 * Get current provisioning state for a project.
 * @param {string} projectId
 * @returns {object|null}
 */
export function getStatus(projectId) {
  return provisioningState.get(projectId) ?? null;
}

/**
 * Clear all provisioning state. Used for test cleanup.
 */
export function clear() {
  provisioningState.clear();
}

// ---------------------------------------------------------------------------
// Provision (full execution)
// ---------------------------------------------------------------------------

/**
 * Execute the full provisioning sequence for a project.
 * @param {string} projectId
 * @param {{ name?: string, description?: string, engineChoice?: string, artifacts?: object[], ghOwner?: string }} options
 * @returns {Promise<object>} The final provisioning record
 */
export async function provision(projectId, options = {}) {
  const projectName = options.name || projectId;
  const engineChoice = options.engineChoice || "claude";
  const description = options.description || "";
  const projectArtifacts = options.artifacts ?? artifacts.getByProject(projectId);
  const repoName = slugify(projectName);
  const workspacePath = path.join(WORKSPACE_ROOT, repoName);

  const record = createProvisioningRecord(projectId);
  provisioningState.set(projectId, record);

  const runStep = async (stepName, fn) => {
    updateStep(record, stepName, {
      status: "running",
      startedAt: new Date().toISOString(),
    });
    console.log(`[provisioning] ${stepName} started for ${projectId}`);

    try {
      await fn();
      updateStep(record, stepName, {
        status: "complete",
        completedAt: new Date().toISOString(),
      });
      console.log(`[provisioning] ${stepName} complete for ${projectId}`);
    } catch (err) {
      updateStep(record, stepName, {
        status: "failed",
        completedAt: new Date().toISOString(),
        error: err.message,
      });
      record.status = "failed";
      record.error = `Step '${stepName}' failed: ${err.message}`;
      record.completedAt = new Date().toISOString();
      console.error(`[provisioning] ${stepName} failed for ${projectId}: ${err.message}`);
      throw err;
    }
  };

  try {
    // Step 1: Create GitHub repo
    await runStep("repo-create", async () => {
      await execGh([
        "repo", "create", repoName,
        "--private",
        "--description", description || `${projectName} — provisioned by Lumon`,
      ]);
    });

    // Step 2: Clone the repo
    await runStep("clone", async () => {
      await execGh(["repo", "clone", repoName, workspacePath]);
    });

    // Step 3: Write artifact files
    await runStep("artifact-write", async () => {
      const dossierDir = path.join(workspacePath, "docs", "dossier");
      fs.mkdirSync(dossierDir, { recursive: true });

      for (const artifact of projectArtifacts) {
        const markdown = formatArtifactToMarkdown(artifact);
        const filename = `${artifact.type}.md`;
        fs.writeFileSync(path.join(dossierDir, filename), markdown, "utf-8");
      }
    });

    // Step 4: Write GSD bootstrap files
    await runStep("gsd-init", async () => {
      const gsdFiles = generateGsdBootstrap({
        projectName,
        description,
        engineChoice,
      });

      for (const file of gsdFiles) {
        const fullPath = path.join(workspacePath, file.relativePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, file.content, "utf-8");
      }
    });

    // Step 5: Commit and push
    await runStep("commit-push", async () => {
      const gitOpts = { cwd: workspacePath };
      await execGit(["add", "."], gitOpts);
      await execGit(
        ["commit", "-m", `Initial provisioning from Lumon\n\nProject: ${projectName}\nEngine: ${engineChoice}`],
        gitOpts,
      );
      await execGit(["push", "-u", "origin", "main"], gitOpts);
    });

    record.status = "complete";
    record.completedAt = new Date().toISOString();
    console.log(`[provisioning] provisioning complete for ${projectId}`);
  } catch {
    // Error already recorded in runStep — just stop execution
  }

  return record;
}
