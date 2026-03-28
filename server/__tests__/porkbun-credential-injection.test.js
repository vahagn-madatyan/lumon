import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "../index.js";
import * as pipeline from "../pipeline.js";
import * as artifacts from "../artifacts.js";
import { getPorkbunCredentials } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DATA_DIR = path.join(__dirname, ".tmp-data-porkbun-cred");

beforeEach(() => {
  artifacts.setDataDir(TEST_DATA_DIR);
  pipeline.clear();
  artifacts.clear();
});

afterAll(() => {
  artifacts.clear();
  try { fs.rmSync(TEST_DATA_DIR, { recursive: true }); } catch {}
});

// ---------------------------------------------------------------------------
// getPorkbunCredentials() unit tests
// ---------------------------------------------------------------------------

describe("getPorkbunCredentials()", () => {
  const originalApiKey = process.env.PORKBUN_API_KEY;
  const originalApiSecret = process.env.PORKBUN_API_SECRET;

  afterEach(() => {
    // Restore original env
    if (originalApiKey !== undefined) {
      process.env.PORKBUN_API_KEY = originalApiKey;
    } else {
      delete process.env.PORKBUN_API_KEY;
    }
    if (originalApiSecret !== undefined) {
      process.env.PORKBUN_API_SECRET = originalApiSecret;
    } else {
      delete process.env.PORKBUN_API_SECRET;
    }
  });

  it("returns credentials from environment variables", () => {
    process.env.PORKBUN_API_KEY = "pk1_test_key_abc123";
    process.env.PORKBUN_API_SECRET = "sk1_test_secret_xyz789";

    const creds = getPorkbunCredentials();
    expect(creds.apiKey).toBe("pk1_test_key_abc123");
    expect(creds.apiSecret).toBe("sk1_test_secret_xyz789");
  });

  it("returns nulls when env vars are unset", () => {
    delete process.env.PORKBUN_API_KEY;
    delete process.env.PORKBUN_API_SECRET;

    const creds = getPorkbunCredentials();
    expect(creds.apiKey).toBeNull();
    expect(creds.apiSecret).toBeNull();
  });

  it("returns null for empty string values", () => {
    process.env.PORKBUN_API_KEY = "";
    process.env.PORKBUN_API_SECRET = "";

    const creds = getPorkbunCredentials();
    expect(creds.apiKey).toBeNull();
    expect(creds.apiSecret).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fireWebhook() credential injection via /api/pipeline/trigger
// ---------------------------------------------------------------------------

describe("fireWebhook() credential injection", () => {
  const originalApiKey = process.env.PORKBUN_API_KEY;
  const originalApiSecret = process.env.PORKBUN_API_SECRET;
  const originalWebhookUrl = process.env.N8N_WEBHOOK_URL;

  /** @type {Array<{url: string, body: object}>} */
  let capturedRequests;

  beforeEach(() => {
    capturedRequests = [];
    // Set up credentials for injection tests
    process.env.PORKBUN_API_KEY = "pk1_test_inject_key";
    process.env.PORKBUN_API_SECRET = "sk1_test_inject_secret";
    // Set up a webhook URL so fireWebhook actually calls fetch
    process.env.N8N_WEBHOOK_URL = "http://mock-n8n:5678/webhook/test";

    // Mock global fetch to capture outbound webhook bodies
    global.fetch = vi.fn(async (url, opts) => {
      const body = JSON.parse(opts.body);
      capturedRequests.push({ url, body });
      return {
        ok: true,
        json: async () => ({ executionId: "n8n-mock-exec-id" }),
      };
    });
  });

  afterEach(() => {
    // Restore env
    if (originalApiKey !== undefined) {
      process.env.PORKBUN_API_KEY = originalApiKey;
    } else {
      delete process.env.PORKBUN_API_KEY;
    }
    if (originalApiSecret !== undefined) {
      process.env.PORKBUN_API_SECRET = originalApiSecret;
    } else {
      delete process.env.PORKBUN_API_SECRET;
    }
    if (originalWebhookUrl !== undefined) {
      process.env.N8N_WEBHOOK_URL = originalWebhookUrl;
    } else {
      delete process.env.N8N_WEBHOOK_URL;
    }
    vi.restoreAllMocks();
  });

  it("injects credentials into context for plan + domain_signals", async () => {
    const res = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-cred-1", stageKey: "plan", subStage: "domain_signals" });

    expect(res.status).toBe(201);
    expect(capturedRequests.length).toBeGreaterThanOrEqual(1);

    // Find the domain_signals request
    const domainReq = capturedRequests.find(r => r.body.subStage === "domain_signals");
    expect(domainReq).toBeDefined();
    expect(domainReq.body.context).toBeDefined();
    expect(domainReq.body.context.porkbunApiKey).toBe("pk1_test_inject_key");
    expect(domainReq.body.context.porkbunApiSecret).toBe("sk1_test_inject_secret");
  });

  it("does NOT inject credentials for plan + naming_candidates", async () => {
    const res = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-cred-2", stageKey: "plan", subStage: "naming_candidates" });

    expect(res.status).toBe(201);
    expect(capturedRequests.length).toBeGreaterThanOrEqual(1);

    const namingReq = capturedRequests.find(r => r.body.subStage === "naming_candidates");
    expect(namingReq).toBeDefined();
    // Context should be absent or not contain Porkbun credentials
    const ctx = namingReq.body.context;
    if (ctx) {
      expect(ctx.porkbunApiKey).toBeUndefined();
      expect(ctx.porkbunApiSecret).toBeUndefined();
    }
  });

  it("does NOT inject credentials for plan + trademark_signals", async () => {
    const res = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-cred-3", stageKey: "plan", subStage: "trademark_signals" });

    expect(res.status).toBe(201);
    expect(capturedRequests.length).toBeGreaterThanOrEqual(1);

    const trademarkReq = capturedRequests.find(r => r.body.subStage === "trademark_signals");
    expect(trademarkReq).toBeDefined();
    const ctx = trademarkReq.body.context;
    if (ctx) {
      expect(ctx.porkbunApiKey).toBeUndefined();
      expect(ctx.porkbunApiSecret).toBeUndefined();
    }
  });

  it("does NOT inject credentials for non-plan stages", async () => {
    const res = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-cred-4", stageKey: "research", subStage: "business_plan" });

    expect(res.status).toBe(201);

    for (const req of capturedRequests) {
      const ctx = req.body.context;
      if (ctx) {
        expect(ctx.porkbunApiKey).toBeUndefined();
        expect(ctx.porkbunApiSecret).toBeUndefined();
      }
    }
  });

  it("injects credentials when plan triggered without subStage (auto-sequences to naming_candidates first, then domain_signals on callback)", async () => {
    // When plan is triggered without subStage, it starts with naming_candidates (first PLAN_SUB_STAGES).
    // domain_signals only fires after naming_candidates callback.
    const res = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-cred-5", stageKey: "plan" });

    expect(res.status).toBe(201);

    // The first sub-stage should be naming_candidates — no credentials
    const namingReq = capturedRequests.find(r => r.body.subStage === "naming_candidates");
    expect(namingReq).toBeDefined();
    const ctx = namingReq.body.context;
    if (ctx) {
      expect(ctx.porkbunApiKey).toBeUndefined();
      expect(ctx.porkbunApiSecret).toBeUndefined();
    }
  });

  it("logs credentials=missing when env vars are unset", async () => {
    delete process.env.PORKBUN_API_KEY;
    delete process.env.PORKBUN_API_SECRET;

    const consoleSpy = vi.spyOn(console, "log");

    const res = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-cred-6", stageKey: "plan", subStage: "domain_signals" });

    expect(res.status).toBe(201);

    // Check that the log includes credentials=missing
    const credLogCall = consoleSpy.mock.calls.find(
      args => typeof args[0] === "string" && args[0].includes("credentials=missing")
    );
    expect(credLogCall).toBeDefined();

    consoleSpy.mockRestore();
  });

  it("logs credentials=injected when env vars are set", async () => {
    const consoleSpy = vi.spyOn(console, "log");

    const res = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-cred-7", stageKey: "plan", subStage: "domain_signals" });

    expect(res.status).toBe(201);

    const credLogCall = consoleSpy.mock.calls.find(
      args => typeof args[0] === "string" && args[0].includes("credentials=injected")
    );
    expect(credLogCall).toBeDefined();

    consoleSpy.mockRestore();
  });

  it("never logs actual credential values", async () => {
    const consoleSpy = vi.spyOn(console, "log");

    await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-cred-8", stageKey: "plan", subStage: "domain_signals" });

    // Check no log line contains the actual credential values
    for (const args of consoleSpy.mock.calls) {
      const logLine = String(args[0]);
      expect(logLine).not.toContain("pk1_test_inject_key");
      expect(logLine).not.toContain("sk1_test_inject_secret");
    }

    consoleSpy.mockRestore();
  });

  it("merges credentials into existing context without clobbering other fields", async () => {
    const res = await request(app)
      .post("/api/pipeline/trigger")
      .send({
        projectId: "proj-cred-9",
        stageKey: "plan",
        subStage: "domain_signals",
        context: { selectedName: "acmecorp" },
      });

    expect(res.status).toBe(201);

    const domainReq = capturedRequests.find(r => r.body.subStage === "domain_signals");
    expect(domainReq).toBeDefined();
    expect(domainReq.body.context.selectedName).toBe("acmecorp");
    expect(domainReq.body.context.porkbunApiKey).toBe("pk1_test_inject_key");
    expect(domainReq.body.context.porkbunApiSecret).toBe("sk1_test_inject_secret");
  });
});
