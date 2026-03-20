/**
 * Live integration test for provisioning against real GitHub.
 *
 * Guarded by LIVE_INTEGRATION env var — skipped in normal test runs.
 * Requires an authenticated `gh` CLI session.
 *
 * Creates a real repo, provisions it with artifacts and GSD files,
 * verifies workspace files, tests idempotent retry, and cleans up.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  provision,
  getStatus,
  clear,
  checkGhAvailability,
  _setWorkspaceRoot,
  _resetWorkspaceRoot,
} from "../provisioning.js";

const execFileAsync = promisify(execFileCb);

// ---------------------------------------------------------------------------
// Suite-level config
// ---------------------------------------------------------------------------

const projectId = "live-test-proj";
let repoName;
let tmpDir;

// ---------------------------------------------------------------------------
// Guard: skip entire suite unless LIVE_INTEGRATION is set
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.LIVE_INTEGRATION)("provisioning — live integration", () => {
  // ------------------------------------------------------------------
  // beforeAll: verify gh auth, set up temp workspace
  // ------------------------------------------------------------------

  beforeAll(async () => {
    // Check gh CLI availability
    const ghStatus = await checkGhAvailability();
    if (!ghStatus.available) {
      console.log("[live-test] gh CLI not available, skipping suite");
      return; // vitest will skip remaining tests
    }

    // Check gh auth status via real execFile
    try {
      await execFileAsync("gh", ["auth", "status"], { maxBuffer: 1024 * 1024 });
    } catch (err) {
      console.log(`[live-test] gh not authenticated: ${err.stderr || err.message}`);
      // Skip the suite by making the setup incomplete — tests will fail fast
      return;
    }

    // Generate unique repo name to avoid collisions
    repoName = `lumon-test-${Date.now()}`;
    console.log(`[live-test] using repo name: ${repoName}`);

    // Create temp workspace directory
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumon-live-test-"));
    _setWorkspaceRoot(tmpDir);
    console.log(`[live-test] workspace root: ${tmpDir}`);
  }, 30_000);

  // ------------------------------------------------------------------
  // afterAll: cleanup — delete repo and remove temp dir
  // ------------------------------------------------------------------

  afterAll(async () => {
    // Delete remote repo
    if (repoName) {
      try {
        await execFileAsync("gh", ["repo", "delete", repoName, "--yes"], {
          maxBuffer: 1024 * 1024,
        });
        console.log(`[live-test] deleted repo: ${repoName}`);
      } catch (err) {
        console.error(`[live-test] cleanup: failed to delete repo ${repoName}: ${err.stderr || err.message}`);
      }
    }

    // Remove temp workspace directory
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        console.log(`[live-test] removed temp dir: ${tmpDir}`);
      } catch (err) {
        console.error(`[live-test] cleanup: failed to remove tmpDir: ${err.message}`);
      }
    }

    clear();
    _resetWorkspaceRoot();
  }, 30_000);

  // ------------------------------------------------------------------
  // Test 1: provisions a real GitHub repo with artifacts and GSD files
  // ------------------------------------------------------------------

  it("provisions a real GitHub repo with artifacts and GSD files", async () => {
    const artifacts = [
      {
        id: "art-va",
        projectId,
        stageKey: "research",
        type: "viability_analysis",
        content: {
          marketAssessment: "Test market assessment for live integration.",
          technicalFeasibility: "Technically feasible.",
          riskFactors: ["Integration test risk"],
          recommendation: "Proceed with testing.",
        },
        metadata: {},
        createdAt: new Date().toISOString(),
      },
      {
        id: "art-bp",
        projectId,
        stageKey: "research",
        type: "business_plan",
        content: {
          targetAudience: "Developers testing Lumon",
          pricingPosture: "Free for testing",
          revenueModel: "N/A — test artifact",
          recommendation: "This is a test artifact.",
        },
        metadata: {},
        createdAt: new Date().toISOString(),
      },
    ];

    const result = await provision(projectId, {
      name: repoName,
      engineChoice: "claude",
      artifacts,
    });

    // Overall status
    expect(result.status).toBe("complete");

    // All 5 steps should be complete
    for (const step of result.steps) {
      expect(step.status).toBe("complete");
    }

    // Enriched record fields
    expect(typeof result.repoUrl).toBe("string");
    expect(result.repoUrl).toContain(repoName);
    expect(typeof result.workspacePath).toBe("string");
    expect(result.repoName).toBe(repoName);

    // Verify workspace files exist on disk
    const ws = result.workspacePath;
    expect(fs.existsSync(path.join(ws, "docs", "dossier", "viability_analysis.md"))).toBe(true);
    expect(fs.existsSync(path.join(ws, "docs", "dossier", "business_plan.md"))).toBe(true);
    expect(fs.existsSync(path.join(ws, ".gsd", "PROJECT.md"))).toBe(true);
    expect(fs.existsSync(path.join(ws, ".gsd", "REQUIREMENTS.md"))).toBe(true);
    expect(fs.existsSync(path.join(ws, ".gsd", "preferences.md"))).toBe(true);

    // Read an artifact file and verify markdown heading
    const vaMd = fs.readFileSync(
      path.join(ws, "docs", "dossier", "viability_analysis.md"),
      "utf-8",
    );
    expect(vaMd).toContain("# Viability Analysis");
    expect(vaMd).toContain("Test market assessment for live integration.");

    // Also verify via getStatus
    const status = getStatus(projectId);
    expect(status.repoUrl).toContain(repoName);
    expect(status.workspacePath).toBe(ws);
    expect(status.repoName).toBe(repoName);
  }, 120_000);

  // ------------------------------------------------------------------
  // Test 2: retrying after success skips existing steps
  // ------------------------------------------------------------------

  it("retrying after success skips existing steps", async () => {
    // Clear in-memory state to simulate server restart
    clear();

    const artifacts = [
      {
        id: "art-va",
        projectId,
        stageKey: "research",
        type: "viability_analysis",
        content: {
          marketAssessment: "Test market assessment for live integration.",
          recommendation: "Proceed with testing.",
        },
        metadata: {},
        createdAt: new Date().toISOString(),
      },
    ];

    const result = await provision(projectId, {
      name: repoName,
      engineChoice: "claude",
      artifacts,
    });

    expect(result.status).toBe("complete");

    // repo-create should be skipped (repo already exists from test 1)
    const repoStep = result.steps.find((s) => s.name === "repo-create");
    expect(repoStep.status).toBe("skipped");

    // clone should be skipped (workspace already has .git from test 1)
    const cloneStep = result.steps.find((s) => s.name === "clone");
    expect(cloneStep.status).toBe("skipped");

    // Remaining steps should complete (overwrite is fine)
    expect(result.steps.find((s) => s.name === "artifact-write").status).toBe("complete");
    expect(result.steps.find((s) => s.name === "gsd-init").status).toBe("complete");
    // commit-push may be "complete" (if files changed) or handle nothing-to-commit
    const pushStep = result.steps.find((s) => s.name === "commit-push");
    expect(pushStep.status).toBe("complete");
  }, 120_000);
});
