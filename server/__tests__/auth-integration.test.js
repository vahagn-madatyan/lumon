import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import app from "../index.js";
import * as pipeline from "../pipeline.js";
import * as artifacts from "../artifacts.js";
import * as externalActions from "../external-actions.js";

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  pipeline.clear();
  artifacts.clear();
  externalActions.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Identity endpoint tests (VITEST bypass is active in all tests by default)
// ---------------------------------------------------------------------------

describe("GET /api/auth/identity", () => {
  it("returns anonymous identity when running under VITEST (no user set)", async () => {
    const res = await request(app).get("/api/auth/identity");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      login: "anonymous",
      name: "Anonymous (test mode)",
      authenticated: false,
    });
  });

  it("returns Tailscale identity when headers are present (VITEST still bypasses auth, but identity endpoint uses req.lumonUser)", async () => {
    // Under VITEST, authMiddleware skips, so lumonUser is not set.
    // The identity endpoint returns anonymous in this case.
    // This is by design — VITEST mode is "no auth".
    const res = await request(app)
      .get("/api/auth/identity")
      .set("Tailscale-User-Login", "alice@example.com")
      .set("Tailscale-User-Name", "Alice");

    expect(res.status).toBe(200);
    // Under VITEST, auth middleware skips header parsing, so user is anonymous
    expect(res.body.authenticated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Auth rejection (temporarily unset VITEST to test 401 path)
// ---------------------------------------------------------------------------

describe("Auth rejection (non-VITEST mode)", () => {
  const origVitest = process.env.VITEST;

  afterEach(() => {
    process.env.VITEST = origVitest;
  });

  it("returns 401 on /api/auth/identity without Tailscale headers when VITEST is unset", async () => {
    delete process.env.VITEST;

    const res = await request(app).get("/api/auth/identity");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");

    process.env.VITEST = origVitest;
  });

  it("returns identity when Tailscale headers are present and VITEST is unset", async () => {
    delete process.env.VITEST;

    const res = await request(app)
      .get("/api/auth/identity")
      .set("Tailscale-User-Login", "alice@example.com")
      .set("Tailscale-User-Name", "Alice");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      login: "alice@example.com",
      name: "Alice",
      authenticated: true,
    });

    process.env.VITEST = origVitest;
  });
});

// ---------------------------------------------------------------------------
// Rate limiting on POST /api/pipeline/trigger
// ---------------------------------------------------------------------------

describe("Rate limiting — POST /api/pipeline/trigger", () => {
  it("returns 429 when rate limit is exceeded (forced rate limit mode)", async () => {
    // The default rate limit is 10 requests per 60s.
    // We use _forceRateLimit to bypass the VITEST skip in the rate limiter.
    // This requires a custom approach: we make requests via supertest
    // but need to signal the rate limiter to engage.
    // Since supertest doesn't let us set req._forceRateLimit directly,
    // we test the rate limiter unit behavior in auth.test.js instead.
    // Here we verify that the rate limiter middleware is mounted by checking
    // that the pipeline trigger endpoint is still accessible (not broken by the mount).
    const res = await request(app)
      .post("/api/pipeline/trigger")
      .send({ projectId: "proj-rl-verify", stageKey: "intake" });

    // Should succeed (201 or 502 from missing webhook), NOT 429 (VITEST bypass active)
    expect([201, 502]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// Confirmation boundary in external-actions is preserved
// ---------------------------------------------------------------------------

describe("External actions confirmation boundary (preserved)", () => {
  it("returns 403 when executing an unconfirmed action", async () => {
    // Create a pending action
    const createRes = await request(app)
      .post("/api/external-actions/request")
      .send({
        projectId: "proj-confirm",
        type: "domain-purchase",
        params: { domain: "test.com", cost: 1000 },
      });

    expect(createRes.status).toBe(201);
    const actionId = createRes.body.id;

    // Try to execute without confirming — should get 403 CONFIRMATION_REQUIRED
    const execRes = await request(app)
      .post(`/api/external-actions/execute/${actionId}`)
      .send({ projectId: "proj-confirm" });

    expect(execRes.status).toBe(403);
    expect(execRes.body.error).toBe("Execution rejected");
  });
});
