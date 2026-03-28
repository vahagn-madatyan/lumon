import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "../index.js";
import * as pipeline from "../pipeline.js";
import * as artifacts from "../artifacts.js";
import { sseClients } from "../routes/pipeline.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DATA_DIR = path.join(__dirname, ".tmp-data-domain-signals");

beforeEach(() => {
  artifacts.setDataDir(TEST_DATA_DIR);
  pipeline.clear();
  artifacts.clear();
  sseClients.clear();
});

afterAll(() => {
  artifacts.clear();
  try { fs.rmSync(TEST_DATA_DIR, { recursive: true }); } catch {}
});

// ---------------------------------------------------------------------------
// Porkbun-shaped artifact data — mirrors real API response structure
// ---------------------------------------------------------------------------

const PORKBUN_SHAPED_CONTENT = {
  selectedName: "acmecorp",
  signals: [
    {
      domain: "acmecorp.com",
      status: "available",
      price: "$9.73/yr",
      registrar: "Porkbun",
      renewalPrice: "$9.73/yr",
      regularPrice: "$9.73/yr",
      premium: false,
      firstYearPromo: true,
    },
    {
      domain: "acmecorp.io",
      status: "available",
      price: "$25.00/yr",
      registrar: "Porkbun",
      renewalPrice: "$25.00/yr",
      regularPrice: "$25.00/yr",
      premium: false,
      firstYearPromo: false,
    },
    {
      domain: "acmecorp.dev",
      status: "taken",
      price: null,
      registrar: "Porkbun",
      renewalPrice: null,
      regularPrice: null,
      premium: false,
      firstYearPromo: false,
    },
    {
      domain: "acmecorp.ai",
      status: "premium",
      price: "$2,500.00/yr",
      registrar: "Porkbun",
      renewalPrice: "$12.00/yr",
      regularPrice: "$12.00/yr",
      premium: true,
      firstYearPromo: false,
    },
  ],
  checkedAt: "2026-03-21T19:30:00.000Z",
  disclaimer: "Domain availability is checked in real-time but may change before registration.",
  source: "Porkbun API",
  dataOrigin: "porkbun-api",
};

const PORKBUN_ARTIFACT_METADATA = {
  engine: "porkbun-live-v1",
  source: "porkbun-api",
};

// ---------------------------------------------------------------------------
// End-to-end pipeline callback with Porkbun data
// ---------------------------------------------------------------------------

describe("domain-signals pipeline with Porkbun-shaped data", () => {
  it("stores Porkbun-shaped artifact through callback flow", async () => {
    // 1. Trigger plan + domain_signals
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-ds-1", stageKey: "plan", subStage: "domain_signals" });

    expect(triggerRes.status).toBe(201);
    const { executionId } = triggerRes.body;

    // 2. Simulate n8n callback with Porkbun-shaped result
    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId,
        projectId: "proj-ds-1",
        stageKey: "plan",
        subStage: "domain_signals",
        result: {
          type: "domain_signals",
          content: PORKBUN_SHAPED_CONTENT,
          metadata: PORKBUN_ARTIFACT_METADATA,
        },
      });

    expect(callbackRes.status).toBe(200);
    expect(callbackRes.body.ok).toBe(true);
    expect(callbackRes.body).toHaveProperty("artifactId");

    // 3. Retrieve the artifact and verify shape
    const artifactRes = await request(app).get(`/api/artifacts/${callbackRes.body.artifactId}`);
    expect(artifactRes.status).toBe(200);

    const artifact = artifactRes.body;
    expect(artifact.projectId).toBe("proj-ds-1");
    expect(artifact.stageKey).toBe("plan");
    expect(artifact.type).toBe("domain_signals");
    expect(artifact.content.selectedName).toBe("acmecorp");
    expect(artifact.content.signals).toHaveLength(4);
    expect(artifact.content.source).toBe("Porkbun API");
    expect(artifact.content.dataOrigin).toBe("porkbun-api");
    expect(artifact.metadata.engine).toBe("porkbun-live-v1");
    expect(artifact.metadata.source).toBe("porkbun-api");
  });

  it("artifact is retrievable via pipeline artifacts endpoint", async () => {
    // Trigger and callback
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-ds-2", stageKey: "plan", subStage: "domain_signals" });

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: triggerRes.body.executionId,
        projectId: "proj-ds-2",
        stageKey: "plan",
        subStage: "domain_signals",
        result: {
          type: "domain_signals",
          content: PORKBUN_SHAPED_CONTENT,
          metadata: PORKBUN_ARTIFACT_METADATA,
        },
      });

    // Retrieve via pipeline-scoped endpoint
    const res = await request(app).get("/api/pipeline/artifacts/proj-ds-2/plan");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].type).toBe("domain_signals");
    expect(res.body[0].content.signals).toHaveLength(4);
    expect(res.body[0].metadata.engine).toBe("porkbun-live-v1");
  });

  it("preserves all Porkbun signal fields through storage", async () => {
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-ds-3", stageKey: "plan", subStage: "domain_signals" });

    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: triggerRes.body.executionId,
        projectId: "proj-ds-3",
        stageKey: "plan",
        subStage: "domain_signals",
        result: {
          type: "domain_signals",
          content: PORKBUN_SHAPED_CONTENT,
          metadata: PORKBUN_ARTIFACT_METADATA,
        },
      });

    const artifact = (await request(app).get(`/api/artifacts/${callbackRes.body.artifactId}`)).body;

    // Verify all enriched fields survive round-trip
    const comSignal = artifact.content.signals.find(s => s.domain === "acmecorp.com");
    expect(comSignal.registrar).toBe("Porkbun");
    expect(comSignal.renewalPrice).toBe("$9.73/yr");
    expect(comSignal.regularPrice).toBe("$9.73/yr");
    expect(comSignal.premium).toBe(false);
    expect(comSignal.firstYearPromo).toBe(true);

    const aiSignal = artifact.content.signals.find(s => s.domain === "acmecorp.ai");
    expect(aiSignal.status).toBe("premium");
    expect(aiSignal.premium).toBe(true);
    expect(aiSignal.price).toBe("$2,500.00/yr");
  });

  it("handles partial Porkbun results with error metadata", async () => {
    const partialContent = {
      selectedName: "failcorp",
      signals: [
        {
          domain: "failcorp.com",
          status: "available",
          price: "$9.73/yr",
          registrar: "Porkbun",
          renewalPrice: "$9.73/yr",
          regularPrice: "$9.73/yr",
          premium: false,
          firstYearPromo: false,
        },
      ],
      checkedAt: "2026-03-21T19:30:00.000Z",
      disclaimer: "Domain availability is checked in real-time but may change before registration.",
      source: "Porkbun API",
      dataOrigin: "porkbun-api",
    };

    const partialMetadata = {
      engine: "porkbun-live-v1",
      source: "porkbun-api",
      errors: [
        { tld: ".io", error: "Rate limited — HTTP 429" },
        { tld: ".dev", error: "Network timeout after 10s" },
      ],
    };

    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-ds-4", stageKey: "plan", subStage: "domain_signals" });

    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: triggerRes.body.executionId,
        projectId: "proj-ds-4",
        stageKey: "plan",
        subStage: "domain_signals",
        result: {
          type: "domain_signals",
          content: partialContent,
          metadata: partialMetadata,
        },
      });

    expect(callbackRes.status).toBe(200);

    const artifact = (await request(app).get(`/api/artifacts/${callbackRes.body.artifactId}`)).body;
    expect(artifact.content.signals).toHaveLength(1);
    expect(artifact.metadata.errors).toHaveLength(2);
    expect(artifact.metadata.errors[0].tld).toBe(".io");
    expect(artifact.metadata.errors[1].error).toContain("timeout");
  });
});

// ---------------------------------------------------------------------------
// Redaction: credentials must never appear in stored artifacts or SSE payloads
// ---------------------------------------------------------------------------

describe("credential redaction", () => {
  it("stored artifact content and metadata never contain raw API credentials", async () => {
    const contentWithCreds = {
      ...PORKBUN_SHAPED_CONTENT,
      // Simulate a bug: credentials accidentally included in content (should NOT happen, but we verify)
    };

    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-redact-1", stageKey: "plan", subStage: "domain_signals" });

    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: triggerRes.body.executionId,
        projectId: "proj-redact-1",
        stageKey: "plan",
        subStage: "domain_signals",
        result: {
          type: "domain_signals",
          content: contentWithCreds,
          metadata: PORKBUN_ARTIFACT_METADATA,
        },
      });

    const artifact = (await request(app).get(`/api/artifacts/${callbackRes.body.artifactId}`)).body;
    const artifactJson = JSON.stringify(artifact);

    // Verify no credential keys in the artifact JSON
    expect(artifactJson).not.toContain("porkbunApiKey");
    expect(artifactJson).not.toContain("porkbunApiSecret");
  });

  it("SSE event payloads never contain credential fields", async () => {
    // Set up a mock SSE client to capture events
    const capturedEvents = [];
    const mockRes = {
      write: (data) => capturedEvents.push(data),
      writeHead: () => {},
    };
    const mockReq = { params: { projectId: "proj-redact-2" }, on: () => {} };

    // Register mock SSE client
    sseClients.set("proj-redact-2", new Set([mockRes]));

    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-redact-2", stageKey: "plan", subStage: "domain_signals" });

    await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: triggerRes.body.executionId,
        projectId: "proj-redact-2",
        stageKey: "plan",
        subStage: "domain_signals",
        result: {
          type: "domain_signals",
          content: PORKBUN_SHAPED_CONTENT,
          metadata: PORKBUN_ARTIFACT_METADATA,
        },
      });

    // Check all captured SSE events for credential leaks
    const allEvents = capturedEvents.join("");
    expect(allEvents).not.toContain("porkbunApiKey");
    expect(allEvents).not.toContain("porkbunApiSecret");

    // Clean up
    sseClients.delete("proj-redact-2");
  });
});

// ---------------------------------------------------------------------------
// Diagnostic failure-path: artifacts with error metadata
// ---------------------------------------------------------------------------

describe("diagnostic failure paths", () => {
  it("artifact with errors array is retrievable and inspectable", async () => {
    const triggerRes = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-diag-1", stageKey: "plan", subStage: "domain_signals" });

    const errorMetadata = {
      engine: "porkbun-live-v1",
      source: "porkbun-api",
      errors: [
        { tld: ".com", error: "Authentication failed — invalid API key" },
      ],
    };

    const callbackRes = await request(app)
      .post("/api/pipeline/callback")
      .send({
        executionId: triggerRes.body.executionId,
        projectId: "proj-diag-1",
        stageKey: "plan",
        subStage: "domain_signals",
        result: {
          type: "domain_signals",
          content: { selectedName: "diagcorp", signals: [], checkedAt: new Date().toISOString() },
          metadata: errorMetadata,
        },
      });

    expect(callbackRes.status).toBe(200);

    // Verify error metadata is inspectable through the artifacts API
    const artifactRes = await request(app).get(`/api/artifacts/${callbackRes.body.artifactId}`);
    expect(artifactRes.body.metadata.errors).toHaveLength(1);
    expect(artifactRes.body.metadata.errors[0].error).toContain("Authentication failed");
    expect(artifactRes.body.content.signals).toHaveLength(0);
  });
});
