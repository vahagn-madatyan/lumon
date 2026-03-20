import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  preview,
  provision,
  getStatus,
  clear,
  formatArtifactToMarkdown,
  generateGsdBootstrap,
  execGh,
  execGit,
  repoExists,
  checkGhAvailability,
  _setExecFile,
  _resetExecFile,
  _setWorkspaceRoot,
  _resetWorkspaceRoot,
} from "../provisioning.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_WORKSPACE = path.join(__dirname, ".tmp-provisioning-test");

function makeArtifact(type, content = {}, overrides = {}) {
  return {
    id: `art-${type}`,
    projectId: "test-proj",
    stageKey: "research",
    type,
    content,
    metadata: {},
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Track calls to the mock execFile. */
let execFileCalls = [];

/**
 * Install a mock execFile that records calls and delegates to a handler.
 * @param {Function} handler — (cmd, args, opts) => { stdout, stderr } | throws
 */
function installMockExecFile(handler) {
  execFileCalls = [];
  _setExecFile(async (cmd, args, opts) => {
    execFileCalls.push({ cmd, args, opts });
    return handler(cmd, args, opts);
  });
}

/** Install a mock that creates the workspace dir on clone and succeeds for everything. */
function installCloneSuccessMock(repoDir) {
  installMockExecFile((cmd, args) => {
    if (cmd === "gh" && args.includes("clone")) {
      fs.mkdirSync(repoDir, { recursive: true });
    }
    return { stdout: "", stderr: "" };
  });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  clear();
  execFileCalls = [];
  fs.mkdirSync(TMP_WORKSPACE, { recursive: true });
  _setWorkspaceRoot(TMP_WORKSPACE);
});

afterEach(() => {
  clear();
  _resetExecFile();
  _resetWorkspaceRoot();
  try {
    fs.rmSync(TMP_WORKSPACE, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

// ===================================================================
// execGh / execGit
// ===================================================================

describe("execGh", () => {
  it("calls gh with correct args", async () => {
    installMockExecFile((cmd, args) => {
      expect(cmd).toBe("gh");
      expect(args).toEqual(["repo", "create", "test-repo", "--private"]);
      return { stdout: "done", stderr: "" };
    });

    const result = await execGh(["repo", "create", "test-repo", "--private"]);
    expect(result.stdout).toBe("done");
    expect(execFileCalls).toHaveLength(1);
  });

  it("throws with descriptive error when gh fails", async () => {
    installMockExecFile(() => {
      throw Object.assign(new Error("not authenticated"), { stderr: "not authenticated" });
    });
    await expect(execGh(["repo", "create"])).rejects.toThrow("[provisioning] gh repo create failed");
  });
});

describe("execGit", () => {
  it("calls git with correct args and options", async () => {
    installMockExecFile((cmd, args, opts) => {
      expect(cmd).toBe("git");
      expect(args).toEqual(["add", "."]);
      expect(opts.cwd).toBe("/tmp");
      return { stdout: "", stderr: "" };
    });

    await execGit(["add", "."], { cwd: "/tmp" });
    expect(execFileCalls).toHaveLength(1);
  });

  it("throws with descriptive error when git fails", async () => {
    installMockExecFile(() => {
      throw Object.assign(new Error("not a git repository"), { stderr: "not a git repository" });
    });
    await expect(execGit(["push"])).rejects.toThrow("[provisioning] git push failed");
  });
});

// ===================================================================
// formatArtifactToMarkdown — all 9 types
// ===================================================================

describe("formatArtifactToMarkdown", () => {
  it("returns empty string for null artifact", () => {
    expect(formatArtifactToMarkdown(null)).toBe("");
  });

  it("returns empty string for null content", () => {
    expect(formatArtifactToMarkdown({ type: "viability_analysis", content: null })).toBe("");
  });

  describe("viability_analysis", () => {
    it("produces markdown with expected sections", () => {
      const md = formatArtifactToMarkdown(makeArtifact("viability_analysis", {
        marketAssessment: "Strong market demand for AI tools.",
        technicalFeasibility: "Feasible with existing tech stack.",
        riskFactors: ["Market saturation", { description: "Regulatory uncertainty" }],
        recommendation: "Proceed with caution.",
      }));
      expect(md).toContain("# Viability Analysis");
      expect(md).toContain("## Market Assessment");
      expect(md).toContain("## Technical Feasibility");
      expect(md).toContain("## Risk Assessment");
      expect(md).toContain("## Recommendation");
      expect(md).toContain("Market saturation");
      expect(md).toContain("Regulatory uncertainty");
    });
  });

  describe("business_plan", () => {
    it("produces markdown with expected sections", () => {
      const md = formatArtifactToMarkdown(makeArtifact("business_plan", {
        targetAudience: "Indie developers",
        pricingPosture: "Freemium with pro tier",
        featurePhases: [
          { name: "MVP", description: "Core features" },
          { name: "Growth", description: "Advanced features" },
        ],
        revenueModel: "Subscription-based SaaS",
        recommendation: "Launch MVP first.",
      }));
      expect(md).toContain("# Business Plan");
      expect(md).toContain("## Target Audience");
      expect(md).toContain("## Pricing Posture");
      expect(md).toContain("## Feature Phases");
      expect(md).toContain("### MVP");
      expect(md).toContain("### Growth");
      expect(md).toContain("## Revenue Model");
      expect(md).toContain("## Recommendation");
    });
  });

  describe("tech_research", () => {
    it("produces markdown with approaches, scores, and tradeoffs", () => {
      const md = formatArtifactToMarkdown(makeArtifact("tech_research", {
        approaches: [
          { name: "Next.js", score: 8, description: "Full-stack", pros: ["SSR", "DX"], cons: ["Vendor lock-in"] },
          { name: "Remix", score: 7, description: "Web standards" },
        ],
        tradeoffs: "SSR vs CSR performance",
        recommendation: "Use Next.js for SSR.",
      }));
      expect(md).toContain("# Technical Research");
      expect(md).toContain("## Approaches");
      expect(md).toContain("### Next.js");
      expect(md).toContain("**Score:** 8/10");
      expect(md).toContain("**Pros:** SSR, DX");
      expect(md).toContain("**Cons:** Vendor lock-in");
      expect(md).toContain("## Tradeoffs");
      expect(md).toContain("## Recommendation");
    });
  });

  describe("naming_candidates", () => {
    it("produces markdown with candidates list", () => {
      const md = formatArtifactToMarkdown(makeArtifact("naming_candidates", {
        methodology: "Brainstorming session",
        candidates: [
          { name: "Acme", rationale: "Classic", domainHint: "acme.com", styleTags: ["retro", "bold"] },
          { name: "Nova", rationale: "Fresh" },
        ],
      }));
      expect(md).toContain("# Naming Candidates");
      expect(md).toContain("## Methodology");
      expect(md).toContain("## Candidates");
      expect(md).toContain("### 1. Acme");
      expect(md).toContain("### 2. Nova");
      expect(md).toContain("**Domain hint:** acme.com");
      expect(md).toContain("**Tags:** retro, bold");
    });
  });

  describe("domain_signals", () => {
    it("produces markdown with availability table", () => {
      const md = formatArtifactToMarkdown(makeArtifact("domain_signals", {
        selectedName: "Acme",
        disclaimer: "Advisory only.",
        signals: [
          { domain: "acme.com", status: "taken", price: null },
          { domain: "acme.io", status: "available", price: "$12/yr" },
        ],
      }));
      expect(md).toContain("# Domain Signals");
      expect(md).toContain("**Selected name:** Acme");
      expect(md).toContain("Advisory only.");
      expect(md).toContain("## Availability");
      expect(md).toContain("acme.com");
      expect(md).toContain("acme.io");
      expect(md).toContain("available");
    });
  });

  describe("trademark_signals", () => {
    it("produces markdown with signals table", () => {
      const md = formatArtifactToMarkdown(makeArtifact("trademark_signals", {
        selectedName: "Acme",
        disclaimer: "Not legal advice.",
        signals: [
          { mark: "ACME", status: "live", class: "9", owner: "Acme Corp" },
        ],
      }));
      expect(md).toContain("# Trademark Signals");
      expect(md).toContain("**Selected name:** Acme");
      expect(md).toContain("Not legal advice.");
      expect(md).toContain("## Signals");
      expect(md).toContain("ACME");
      expect(md).toContain("live");
      expect(md).toContain("Acme Corp");
    });
  });

  describe("architecture_outline", () => {
    it("produces markdown with overview, components, and stack decisions", () => {
      const md = formatArtifactToMarkdown(makeArtifact("architecture_outline", {
        systemOverview: "Monorepo with API and web client.",
        components: [
          { name: "API Server", technology: "Express", responsibility: "REST endpoints" },
          { name: "Web Client", technology: "React", responsibility: "UI rendering" },
        ],
        dataFlow: "REST over HTTPS",
        deploymentModel: "Docker Compose",
        recommendation: "Use monorepo approach.",
      }));
      expect(md).toContain("# Architecture Outline");
      expect(md).toContain("## Overview");
      expect(md).toContain("## Components");
      expect(md).toContain("### API Server");
      expect(md).toContain("**Technology:** Express");
      expect(md).toContain("## Data Flow");
      expect(md).toContain("## Deployment Model");
      expect(md).toContain("## Stack Decisions");
    });
  });

  describe("specification", () => {
    it("produces markdown with functional reqs, NFRs, and APIs", () => {
      const md = formatArtifactToMarkdown(makeArtifact("specification", {
        functionalRequirements: [
          { id: "FR-001", title: "User Login", priority: "high", description: "OAuth2 flow" },
        ],
        nonFunctionalRequirements: [
          { category: "Performance", requirement: "< 200ms response", metric: "p95 latency" },
        ],
        apiContracts: [
          { method: "POST", endpoint: "/api/auth/login", description: "Login endpoint" },
        ],
        recommendation: "Prioritize auth first.",
      }));
      expect(md).toContain("# Specification");
      expect(md).toContain("## Functional Requirements");
      expect(md).toContain("**FR-001** User Login [high]");
      expect(md).toContain("## Non-Functional Requirements");
      expect(md).toContain("**Performance:**");
      expect(md).toContain("## API Contracts");
      expect(md).toContain("`POST /api/auth/login`");
      expect(md).toContain("## Recommendation");
    });
  });

  describe("prototype_scaffold", () => {
    it("produces markdown with structure, entry points, and deps", () => {
      const md = formatArtifactToMarkdown(makeArtifact("prototype_scaffold", {
        projectStructure: "src/\n  index.js\n  app.js",
        entryPoints: [{ file: "src/index.js", purpose: "Application entry" }],
        dependencies: [
          { name: "express", version: "4.18.0", purpose: "HTTP server" },
        ],
        setupInstructions: "npm install\nnpm start",
        recommendation: "Start with index.js.",
      }));
      expect(md).toContain("# Prototype Scaffold");
      expect(md).toContain("## Project Structure");
      expect(md).toContain("src/");
      expect(md).toContain("## Entry Points");
      expect(md).toContain("**src/index.js**");
      expect(md).toContain("## Dependencies");
      expect(md).toContain("**express** (4.18.0)");
      expect(md).toContain("## Setup Instructions");
      expect(md).toContain("## Recommendation");
    });
  });

  describe("generic fallback", () => {
    it("renders unknown type with key-value sections from object content", () => {
      const md = formatArtifactToMarkdown(makeArtifact("custom_analysis", {
        summary: "Everything looks good",
        details: "Detailed breakdown here",
      }));
      expect(md).toContain("# custom_analysis");
      expect(md).toContain("## Summary");
      expect(md).toContain("Everything looks good");
      expect(md).toContain("## Details");
    });

    it("renders string content directly", () => {
      const md = formatArtifactToMarkdown({
        type: "notes",
        content: "Just some raw notes",
      });
      expect(md).toContain("# notes");
      expect(md).toContain("Just some raw notes");
    });
  });
});

// ===================================================================
// generateGsdBootstrap
// ===================================================================

describe("generateGsdBootstrap", () => {
  it("returns 5 bootstrap files", () => {
    const files = generateGsdBootstrap({ projectName: "TestApp" });
    expect(files).toHaveLength(5);
    const paths = files.map((f) => f.relativePath);
    expect(paths).toContain(".gsd/PROJECT.md");
    expect(paths).toContain(".gsd/REQUIREMENTS.md");
    expect(paths).toContain(".gsd/preferences.md");
    expect(paths).toContain(".gsd/STATE.md");
    expect(paths).toContain(".gsd/milestones/M001/M001-ROADMAP.md");
  });

  it("PROJECT.md has expected sections", () => {
    const files = generateGsdBootstrap({ projectName: "MyProject", description: "A cool tool" });
    const project = files.find((f) => f.relativePath === ".gsd/PROJECT.md");
    expect(project.content).toContain("# Project");
    expect(project.content).toContain("## What This Is");
    expect(project.content).toContain("MyProject");
    expect(project.content).toContain("A cool tool");
    expect(project.content).toContain("## Current State");
    expect(project.content).toContain("## Milestone Sequence");
  });

  it("preferences.md contains engine choice", () => {
    const files = generateGsdBootstrap({ projectName: "X", engineChoice: "codex" });
    const prefs = files.find((f) => f.relativePath === ".gsd/preferences.md");
    expect(prefs.content).toContain("execution_engine: codex");
    expect(prefs.content).toContain("autonomous_mode: guided");
  });

  it("defaults engine to claude", () => {
    const files = generateGsdBootstrap({ projectName: "X" });
    const prefs = files.find((f) => f.relativePath === ".gsd/preferences.md");
    expect(prefs.content).toContain("execution_engine: claude");
  });

  it("REQUIREMENTS.md includes provided requirements", () => {
    const files = generateGsdBootstrap({
      projectName: "X",
      requirements: [
        { id: "R001", title: "Must support OAuth" },
        { id: "R002", title: "Must be fast" },
      ],
    });
    const reqs = files.find((f) => f.relativePath === ".gsd/REQUIREMENTS.md");
    expect(reqs.content).toContain("R001");
    expect(reqs.content).toContain("Must support OAuth");
    expect(reqs.content).toContain("R002");
    expect(reqs.content).toContain("Must be fast");
  });

  it("REQUIREMENTS.md has placeholder when no requirements given", () => {
    const files = generateGsdBootstrap({ projectName: "X" });
    const reqs = files.find((f) => f.relativePath === ".gsd/REQUIREMENTS.md");
    expect(reqs.content).toContain("# Requirements");
    expect(reqs.content).toContain("R001");
  });

  it("STATE.md has expected GSD structure", () => {
    const files = generateGsdBootstrap({ projectName: "X" });
    const state = files.find((f) => f.relativePath === ".gsd/STATE.md");
    expect(state.content).toContain("# GSD State");
    expect(state.content).toContain("**Active Milestone:**");
    expect(state.content).toContain("## Milestone Registry");
  });

  it("M001-ROADMAP.md has milestone structure", () => {
    const files = generateGsdBootstrap({ projectName: "X", milestoneContext: "Build core API" });
    const roadmap = files.find((f) => f.relativePath === ".gsd/milestones/M001/M001-ROADMAP.md");
    expect(roadmap.content).toContain("# M001: Initial Build");
    expect(roadmap.content).toContain("Build core API");
    expect(roadmap.content).toContain("## Success Criteria");
    expect(roadmap.content).toContain("## Key Risks");
  });
});

// ===================================================================
// preview
// ===================================================================

describe("preview", () => {
  it("returns expected plan structure without side effects", () => {
    const arts = [
      makeArtifact("viability_analysis", { marketAssessment: "Good" }),
      makeArtifact("business_plan", { targetAudience: "Devs" }),
    ];

    const plan = preview("test-proj", {
      name: "My Cool App",
      engineChoice: "codex",
      artifacts: arts,
    });

    expect(plan.repoName).toBe("my-cool-app");
    expect(plan.engineChoice).toBe("codex");
    expect(plan.workspacePath).toContain("my-cool-app");
    expect(plan.steps).toEqual([
      "repo-create", "clone", "artifact-write", "gsd-init", "commit-push",
    ]);

    // Should have artifact files + GSD bootstrap files
    const artifactFiles = plan.files.filter((f) => f.path.startsWith("docs/dossier/"));
    expect(artifactFiles).toHaveLength(2);
    expect(artifactFiles[0].path).toBe("docs/dossier/viability_analysis.md");

    const gsdFiles = plan.files.filter((f) => f.path.startsWith(".gsd/"));
    expect(gsdFiles).toHaveLength(5);
  });

  it("handles empty artifacts list", () => {
    const plan = preview("empty-proj", { name: "Empty", artifacts: [] });
    expect(plan.files.filter((f) => f.path.startsWith("docs/dossier/"))).toHaveLength(0);
    expect(plan.files.filter((f) => f.path.startsWith(".gsd/"))).toHaveLength(5);
  });

  it("slugifies project name into repo name", () => {
    const plan = preview("proj", { name: "My Great App!!!", artifacts: [] });
    expect(plan.repoName).toBe("my-great-app");
  });

  it("defaults engine to claude", () => {
    const plan = preview("proj", { name: "X", artifacts: [] });
    expect(plan.engineChoice).toBe("claude");
  });
});

// ===================================================================
// provision — step execution and tracking
// ===================================================================

describe("provision", () => {
  it("executes all 5 steps in order on success", async () => {
    const repoDir = path.join(TMP_WORKSPACE, "test-app");
    installCloneSuccessMock(repoDir);

    const result = await provision("proj-1", {
      name: "Test App",
      engineChoice: "claude",
      artifacts: [makeArtifact("viability_analysis", { marketAssessment: "Strong" })],
    });

    expect(result.status).toBe("complete");
    expect(result.completedAt).toBeTruthy();
    expect(result.error).toBeNull();

    for (const step of result.steps) {
      expect(step.status).toBe("complete");
      expect(step.startedAt).toBeTruthy();
      expect(step.completedAt).toBeTruthy();
      expect(step.error).toBeNull();
    }
  });

  it("calls gh repo create with correct args", async () => {
    const repoDir = path.join(TMP_WORKSPACE, "test-app");
    installCloneSuccessMock(repoDir);

    await provision("proj-1", {
      name: "Test App",
      description: "A test project",
      artifacts: [],
    });

    const createCall = execFileCalls.find(
      (c) => c.cmd === "gh" && c.args.includes("repo") && c.args.includes("create"),
    );
    expect(createCall).toBeTruthy();
    expect(createCall.args).toContain("test-app");
    expect(createCall.args).toContain("--private");
    expect(createCall.args).toContain("--description");
  });

  it("calls git add, commit, push in sequence", async () => {
    const repoDir = path.join(TMP_WORKSPACE, "test-app");
    installCloneSuccessMock(repoDir);

    await provision("proj-1", { name: "Test App", artifacts: [] });

    const gitCalls = execFileCalls.filter((c) => c.cmd === "git");
    expect(gitCalls.some((c) => c.args[0] === "add")).toBe(true);
    expect(gitCalls.some((c) => c.args[0] === "commit")).toBe(true);
    expect(gitCalls.some((c) => c.args[0] === "push")).toBe(true);

    const addIdx = gitCalls.findIndex((c) => c.args[0] === "add");
    const commitIdx = gitCalls.findIndex((c) => c.args[0] === "commit");
    const pushIdx = gitCalls.findIndex((c) => c.args[0] === "push");
    expect(addIdx).toBeLessThan(commitIdx);
    expect(commitIdx).toBeLessThan(pushIdx);
  });

  it("writes artifact files to docs/dossier/", async () => {
    const repoDir = path.join(TMP_WORKSPACE, "test-app");
    installCloneSuccessMock(repoDir);

    await provision("proj-1", {
      name: "Test App",
      artifacts: [
        makeArtifact("viability_analysis", { marketAssessment: "Strong demand" }),
        makeArtifact("business_plan", { targetAudience: "Developers" }),
      ],
    });

    const dossierDir = path.join(repoDir, "docs", "dossier");
    expect(fs.existsSync(dossierDir)).toBe(true);
    expect(fs.existsSync(path.join(dossierDir, "viability_analysis.md"))).toBe(true);
    expect(fs.existsSync(path.join(dossierDir, "business_plan.md"))).toBe(true);

    const vaMd = fs.readFileSync(path.join(dossierDir, "viability_analysis.md"), "utf-8");
    expect(vaMd).toContain("# Viability Analysis");
    expect(vaMd).toContain("Strong demand");
  });

  it("writes GSD bootstrap files", async () => {
    const repoDir = path.join(TMP_WORKSPACE, "test-app");
    installCloneSuccessMock(repoDir);

    await provision("proj-1", {
      name: "Test App",
      engineChoice: "codex",
      artifacts: [],
    });

    expect(fs.existsSync(path.join(repoDir, ".gsd", "PROJECT.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, ".gsd", "REQUIREMENTS.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, ".gsd", "preferences.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, ".gsd", "STATE.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, ".gsd", "milestones", "M001", "M001-ROADMAP.md"))).toBe(true);

    const prefs = fs.readFileSync(path.join(repoDir, ".gsd", "preferences.md"), "utf-8");
    expect(prefs).toContain("execution_engine: codex");
  });

  it("stops on first failed step and records error", async () => {
    installMockExecFile((cmd) => {
      if (cmd === "gh") {
        throw Object.assign(new Error("auth required"), { stderr: "auth required" });
      }
      return { stdout: "", stderr: "" };
    });

    const result = await provision("proj-fail", {
      name: "Fail App",
      artifacts: [],
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("repo-create");

    expect(result.steps[0].status).toBe("failed");
    expect(result.steps[0].error).toBeTruthy();

    for (let i = 1; i < result.steps.length; i++) {
      expect(result.steps[i].status).toBe("pending");
    }
  });

  it("records failure at clone step when it fails", async () => {
    installMockExecFile((cmd, args) => {
      if (cmd === "gh" && args.includes("clone")) {
        throw Object.assign(new Error("clone failed"), { stderr: "clone failed" });
      }
      return { stdout: "", stderr: "" };
    });

    const result = await provision("proj-clone-fail", {
      name: "Clone Fail",
      artifacts: [],
    });

    expect(result.status).toBe("failed");
    expect(result.steps[0].status).toBe("complete"); // repo-create ok
    expect(result.steps[1].status).toBe("failed");   // clone failed
    expect(result.steps[2].status).toBe("pending");   // artifact-write never ran
  });
});

// ===================================================================
// getStatus
// ===================================================================

describe("getStatus", () => {
  it("returns null for unknown project", () => {
    expect(getStatus("nonexistent")).toBeNull();
  });

  it("returns provisioning state after provision starts", async () => {
    installMockExecFile(() => {
      throw Object.assign(new Error("fail"), { stderr: "fail" });
    });

    await provision("status-test", { name: "Status Test", artifacts: [] });

    const status = getStatus("status-test");
    expect(status).not.toBeNull();
    expect(status.projectId).toBe("status-test");
    expect(status.status).toBe("failed");
    expect(status.steps).toHaveLength(5);
  });

  it("tracks step-level timestamps", async () => {
    installMockExecFile(() => {
      throw Object.assign(new Error("fail"), { stderr: "fail" });
    });

    await provision("ts-test", { name: "TS Test", artifacts: [] });

    const status = getStatus("ts-test");
    const firstStep = status.steps[0];
    expect(firstStep.startedAt).toBeTruthy();
    expect(firstStep.completedAt).toBeTruthy();
  });
});

// ===================================================================
// clear
// ===================================================================

describe("clear", () => {
  it("removes all provisioning state", async () => {
    installMockExecFile(() => {
      throw Object.assign(new Error("fail"), { stderr: "fail" });
    });

    await provision("clear-test", { name: "Clear", artifacts: [] });
    expect(getStatus("clear-test")).not.toBeNull();

    clear();
    expect(getStatus("clear-test")).toBeNull();
  });
});

// ===================================================================
// repoExists
// ===================================================================

describe("repoExists", () => {
  it("returns { exists: true, url } when repo exists", async () => {
    installMockExecFile((cmd, args) => {
      if (cmd === "gh" && args.includes("view")) {
        return { stdout: JSON.stringify({ url: "https://github.com/user/my-repo" }), stderr: "" };
      }
      return { stdout: "", stderr: "" };
    });

    const result = await repoExists("my-repo");
    expect(result.exists).toBe(true);
    expect(result.url).toBe("https://github.com/user/my-repo");
  });

  it("returns { exists: false } when repo does not exist", async () => {
    installMockExecFile(() => {
      throw Object.assign(new Error("not found"), { stderr: "Could not resolve to a Repository" });
    });

    const result = await repoExists("nonexistent-repo");
    expect(result.exists).toBe(false);
    expect(result.url).toBeUndefined();
  });

  it("returns { exists: false } and logs on unexpected errors", async () => {
    installMockExecFile(() => {
      throw Object.assign(new Error("network error"), { stderr: "network error" });
    });

    const result = await repoExists("bad-repo");
    expect(result.exists).toBe(false);
  });
});

// ===================================================================
// checkGhAvailability
// ===================================================================

describe("checkGhAvailability", () => {
  it("returns { available: true, version } when gh is installed", async () => {
    installMockExecFile((cmd) => {
      if (cmd === "gh") {
        return { stdout: "gh version 2.50.0 (2026-01-15)\nhttps://github.com/cli/cli/releases/tag/v2.50.0", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    });

    const result = await checkGhAvailability();
    expect(result.available).toBe(true);
    expect(result.version).toBe("2.50.0");
  });

  it("returns { available: false, error } when gh is not installed", async () => {
    installMockExecFile(() => {
      throw Object.assign(new Error("command not found: gh"), { stderr: "command not found: gh" });
    });

    const result = await checkGhAvailability();
    expect(result.available).toBe(false);
    expect(result.error).toContain("command not found");
  });
});

// ===================================================================
// Idempotent retry — provision after partial failure
// ===================================================================

describe("idempotent retry", () => {
  it("skips repo-create when repo already exists and skips clone when workspace has .git", async () => {
    const repoDir = path.join(TMP_WORKSPACE, "test-app");
    // Pre-create workspace with .git to simulate prior partial success
    fs.mkdirSync(path.join(repoDir, ".git"), { recursive: true });

    const stepUpdates = [];
    installMockExecFile((cmd, args) => {
      // repoExists check — repo already exists
      if (cmd === "gh" && args.includes("view") && args.includes("--json")) {
        return { stdout: JSON.stringify({ url: "https://github.com/user/test-app" }), stderr: "" };
      }
      // Everything else succeeds
      return { stdout: "", stderr: "" };
    });

    const result = await provision("retry-proj", {
      name: "Test App",
      artifacts: [],
      onStepUpdate: (step, status) => stepUpdates.push({ step, status }),
    });

    expect(result.status).toBe("complete");

    // repo-create should be skipped
    const repoStep = result.steps.find((s) => s.name === "repo-create");
    expect(repoStep.status).toBe("skipped");

    // clone should be skipped (workspace .git exists)
    const cloneStep = result.steps.find((s) => s.name === "clone");
    expect(cloneStep.status).toBe("skipped");

    // Remaining steps should complete
    expect(result.steps.find((s) => s.name === "artifact-write").status).toBe("complete");
    expect(result.steps.find((s) => s.name === "gsd-init").status).toBe("complete");
    expect(result.steps.find((s) => s.name === "commit-push").status).toBe("complete");

    // onStepUpdate should have been called with "skipped"
    expect(stepUpdates.some((u) => u.step === "repo-create" && u.status === "skipped")).toBe(true);
    expect(stepUpdates.some((u) => u.step === "clone" && u.status === "skipped")).toBe(true);
  });

  it("commit-push treats 'nothing to commit' as success", async () => {
    const repoDir = path.join(TMP_WORKSPACE, "test-app");
    installMockExecFile((cmd, args) => {
      // repoExists: doesn't exist
      if (cmd === "gh" && args.includes("view") && args.includes("--json")) {
        throw Object.assign(new Error("not found"), { stderr: "Could not resolve to a Repository" });
      }
      // clone: create workspace dir
      if (cmd === "gh" && args.includes("clone")) {
        fs.mkdirSync(repoDir, { recursive: true });
        return { stdout: "", stderr: "" };
      }
      // git commit: nothing to commit
      if (cmd === "git" && args[0] === "commit") {
        throw Object.assign(new Error("nothing to commit"), {
          stderr: "nothing to commit, working tree clean",
        });
      }
      return { stdout: "", stderr: "" };
    });

    const result = await provision("nothing-commit", {
      name: "Test App",
      artifacts: [],
    });

    expect(result.status).toBe("complete");
    expect(result.steps.find((s) => s.name === "commit-push").status).toBe("complete");
  });

  it("allows retry after previous failure (status='failed')", async () => {
    // First run: fail at clone
    installMockExecFile((cmd, args) => {
      if (cmd === "gh" && args.includes("view") && args.includes("--json")) {
        throw Object.assign(new Error("not found"), { stderr: "not found" });
      }
      if (cmd === "gh" && args.includes("clone")) {
        throw Object.assign(new Error("clone failed"), { stderr: "clone failed" });
      }
      return { stdout: "", stderr: "" };
    });

    const firstResult = await provision("retry-after-fail", {
      name: "Test App",
      artifacts: [],
    });
    expect(firstResult.status).toBe("failed");

    // Second run: repo now exists, clone succeeds
    const repoDir = path.join(TMP_WORKSPACE, "test-app");
    installMockExecFile((cmd, args) => {
      if (cmd === "gh" && args.includes("view") && args.includes("--json")) {
        return { stdout: JSON.stringify({ url: "https://github.com/user/test-app" }), stderr: "" };
      }
      if (cmd === "gh" && args.includes("clone")) {
        fs.mkdirSync(repoDir, { recursive: true });
        return { stdout: "", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    });

    const secondResult = await provision("retry-after-fail", {
      name: "Test App",
      artifacts: [],
    });
    expect(secondResult.status).toBe("complete");
    expect(secondResult.steps.find((s) => s.name === "repo-create").status).toBe("skipped");
  });
});

// ===================================================================
// Concurrency guard
// ===================================================================

describe("concurrency guard", () => {
  it("rejects provision when status is 'running'", async () => {
    // Start a provision that never finishes
    let resolveProvision;
    installMockExecFile((cmd, args) => {
      if (cmd === "gh" && args.includes("view") && args.includes("--json")) {
        throw Object.assign(new Error("not found"), { stderr: "not found" });
      }
      if (cmd === "gh" && args.includes("create")) {
        // Block forever until we manually resolve
        return new Promise((resolve) => {
          resolveProvision = resolve;
        });
      }
      return { stdout: "", stderr: "" };
    });

    // Start first provision (don't await — it blocks)
    const firstPromise = provision("concurrent-proj", {
      name: "Test App",
      artifacts: [],
    });

    // Wait a tick for the record to be created
    await new Promise((r) => setTimeout(r, 50));

    // Second attempt should throw
    await expect(
      provision("concurrent-proj", { name: "Test App", artifacts: [] }),
    ).rejects.toThrow("Provisioning already in progress for concurrent-proj");

    // Clean up: resolve the stuck provision
    if (resolveProvision) resolveProvision({ stdout: "", stderr: "" });
    await firstPromise.catch(() => {}); // swallow any errors
  });
});

// ===================================================================
// Enriched provisioning record
// ===================================================================

describe("enriched provisioning record", () => {
  it("includes repoUrl, workspacePath, and repoName on completed record", async () => {
    const repoDir = path.join(TMP_WORKSPACE, "test-app");
    installMockExecFile((cmd, args) => {
      if (cmd === "gh" && args.includes("view") && args.includes("--json")) {
        // First call: doesn't exist, second call (after create): exists
        if (execFileCalls.length <= 1) {
          throw Object.assign(new Error("not found"), { stderr: "not found" });
        }
        return { stdout: JSON.stringify({ url: "https://github.com/user/test-app" }), stderr: "" };
      }
      if (cmd === "gh" && args.includes("clone")) {
        fs.mkdirSync(repoDir, { recursive: true });
      }
      return { stdout: "", stderr: "" };
    });

    const result = await provision("enriched-proj", {
      name: "Test App",
      artifacts: [],
    });

    expect(result.repoName).toBe("test-app");
    expect(result.workspacePath).toContain("test-app");
    expect(result.repoUrl).toBe("https://github.com/user/test-app");

    // Also verify via getStatus
    const status = getStatus("enriched-proj");
    expect(status.repoName).toBe("test-app");
    expect(status.workspacePath).toContain("test-app");
    expect(status.repoUrl).toBe("https://github.com/user/test-app");
  });

  it("includes repoUrl from skipped repo-create when repo already exists", async () => {
    const repoDir = path.join(TMP_WORKSPACE, "test-app");
    installMockExecFile((cmd, args) => {
      if (cmd === "gh" && args.includes("view") && args.includes("--json")) {
        return { stdout: JSON.stringify({ url: "https://github.com/user/test-app" }), stderr: "" };
      }
      if (cmd === "gh" && args.includes("clone")) {
        fs.mkdirSync(repoDir, { recursive: true });
      }
      return { stdout: "", stderr: "" };
    });

    const result = await provision("enriched-skip-proj", {
      name: "Test App",
      artifacts: [],
    });

    expect(result.repoUrl).toBe("https://github.com/user/test-app");
    expect(result.steps.find((s) => s.name === "repo-create").status).toBe("skipped");
  });
});

// ===================================================================
// Step error messages with guidance
// ===================================================================

describe("step error guidance", () => {
  it("includes actionable guidance in repo-create failure message", async () => {
    installMockExecFile((cmd, args) => {
      if (cmd === "gh" && args.includes("view") && args.includes("--json")) {
        throw Object.assign(new Error("not found"), { stderr: "not found" });
      }
      if (cmd === "gh" && args.includes("create")) {
        throw Object.assign(new Error("already exists"), { stderr: "already exists" });
      }
      return { stdout: "", stderr: "" };
    });

    const result = await provision("guidance-proj", {
      name: "Test App",
      artifacts: [],
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("repo-create");
    expect(result.error).toContain("Delete the existing repo or choose a different name");
  });

  it("includes actionable guidance in clone failure message", async () => {
    installMockExecFile((cmd, args) => {
      if (cmd === "gh" && args.includes("view") && args.includes("--json")) {
        throw Object.assign(new Error("not found"), { stderr: "not found" });
      }
      if (cmd === "gh" && args.includes("clone")) {
        throw Object.assign(new Error("access denied"), { stderr: "access denied" });
      }
      return { stdout: "", stderr: "" };
    });

    const result = await provision("guidance-clone-proj", {
      name: "Test App",
      artifacts: [],
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("clone");
    expect(result.error).toContain("Check that the repo exists and you have access");
  });
});
