import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { authMiddleware, createRateLimiter } from "../middleware/auth.js";

// ---------------------------------------------------------------------------
// Helpers — minimal Express-like req/res/next objects
// ---------------------------------------------------------------------------

function makeReq(overrides = {}) {
  return {
    headers: {},
    body: {},
    params: {},
    ip: "127.0.0.1",
    path: "/test",
    method: "GET",
    ...overrides,
  };
}

function makeRes() {
  const res = {
    statusCode: 200,
    _body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res._body = body;
      return res;
    },
  };
  return res;
}

// ---------------------------------------------------------------------------
// authMiddleware tests
// ---------------------------------------------------------------------------

describe("authMiddleware", () => {
  const origVitest = process.env.VITEST;

  afterEach(() => {
    process.env.VITEST = origVitest;
    vi.restoreAllMocks();
  });

  it("bypasses auth when VITEST is set and calls next without setting lumonUser", () => {
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.lumonUser).toBeUndefined();
  });

  it("sets lumonUser from Tailscale headers when present", () => {
    delete process.env.VITEST;

    const req = makeReq({
      headers: {
        "tailscale-user-login": "alice@example.com",
        "tailscale-user-name": "Alice",
      },
    });
    const res = makeRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.lumonUser).toEqual({
      login: "alice@example.com",
      name: "Alice",
      source: "tailscale",
    });

    process.env.VITEST = origVitest;
  });

  it("uses login as name when Tailscale-User-Name header is missing", () => {
    delete process.env.VITEST;

    const req = makeReq({
      headers: {
        "tailscale-user-login": "bob@example.com",
      },
    });
    const res = makeRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.lumonUser).toEqual({
      login: "bob@example.com",
      name: "bob@example.com",
      source: "tailscale",
    });

    process.env.VITEST = origVitest;
  });

  it("falls back to local identity when no Tailscale headers are present", () => {
    delete process.env.VITEST;

    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.lumonUser).toEqual({
      login: "operator@local",
      name: "Local Operator",
      source: "local",
    });

    process.env.VITEST = origVitest;
  });

  it("falls back to local identity when Tailscale header is empty", () => {
    delete process.env.VITEST;

    const req = makeReq({
      headers: { "tailscale-user-login": "" },
    });
    const res = makeRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.lumonUser.source).toBe("local");

    process.env.VITEST = origVitest;
  });

  it("falls back to local identity when Tailscale header is whitespace only", () => {
    delete process.env.VITEST;

    const req = makeReq({
      headers: { "tailscale-user-login": "   " },
    });
    const res = makeRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.lumonUser.source).toBe("local");

    process.env.VITEST = origVitest;
  });
});

// ---------------------------------------------------------------------------
// createRateLimiter tests
// ---------------------------------------------------------------------------

describe("createRateLimiter", () => {
  it("allows requests under the limit", () => {
    const limiter = createRateLimiter(3, 60_000);
    const req = makeReq({ _forceRateLimit: true });
    const res = makeRes();

    for (let i = 0; i < 3; i++) {
      const next = vi.fn();
      limiter(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    }
  });

  it("returns 429 when limit is exceeded", () => {
    const limiter = createRateLimiter(2, 60_000);
    const req = makeReq({ _forceRateLimit: true });

    for (let i = 0; i < 2; i++) {
      const res = makeRes();
      const next = vi.fn();
      limiter(req, res, next);
      expect(next).toHaveBeenCalled();
    }

    const res = makeRes();
    const next = vi.fn();
    limiter(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res._body.error).toBe("Too Many Requests");
    expect(res._body).toHaveProperty("retryAfterMs");
  });

  it("allows at exactly maxRequests (boundary)", () => {
    const limiter = createRateLimiter(3, 60_000);
    const req = makeReq({ _forceRateLimit: true });

    for (let i = 0; i < 3; i++) {
      const res = makeRes();
      const next = vi.fn();
      limiter(req, res, next);
      expect(next).toHaveBeenCalled();
    }

    const res = makeRes();
    const next = vi.fn();
    limiter(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
  });

  it("allows requests again after window expires", async () => {
    const limiter = createRateLimiter(1, 50);
    const req = makeReq({ _forceRateLimit: true });

    const res1 = makeRes();
    const next1 = vi.fn();
    limiter(req, res1, next1);
    expect(next1).toHaveBeenCalled();

    const res2 = makeRes();
    const next2 = vi.fn();
    limiter(req, res2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(res2.statusCode).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 60));

    const res3 = makeRes();
    const next3 = vi.fn();
    limiter(req, res3, next3);
    expect(next3).toHaveBeenCalled();
  });

  it("tracks different IPs independently", () => {
    const limiter = createRateLimiter(1, 60_000);

    const req1 = makeReq({ ip: "10.0.0.1", _forceRateLimit: true });
    const req2 = makeReq({ ip: "10.0.0.2", _forceRateLimit: true });

    const next1 = vi.fn();
    limiter(req1, makeRes(), next1);
    expect(next1).toHaveBeenCalled();

    const next2 = vi.fn();
    limiter(req2, makeRes(), next2);
    expect(next2).toHaveBeenCalled();

    const next3 = vi.fn();
    const res3 = makeRes();
    limiter(req1, res3, next3);
    expect(next3).not.toHaveBeenCalled();
    expect(res3.statusCode).toBe(429);

    const next4 = vi.fn();
    const res4 = makeRes();
    limiter(req2, res4, next4);
    expect(next4).not.toHaveBeenCalled();
    expect(res4.statusCode).toBe(429);
  });

  it("bypasses rate limiting when VITEST is set and _forceRateLimit is not", () => {
    const limiter = createRateLimiter(1, 60_000);
    const req = makeReq();

    for (let i = 0; i < 5; i++) {
      const res = makeRes();
      const next = vi.fn();
      limiter(req, res, next);
      expect(next).toHaveBeenCalled();
    }
  });
});
