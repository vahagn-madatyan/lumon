import { Router } from "express";
import { AUTH_CONFIG } from "../config.js";
import { logEvent } from "../audit.js";

// ---------------------------------------------------------------------------
// Auth middleware — gates all requests behind Tailscale identity headers
// ---------------------------------------------------------------------------

/**
 * Express middleware that enforces Tailscale identity headers on every request.
 *
 * Bypass order:
 * 1. VITEST env → skip entirely (tests run without identity)
 * 2. LUMON_DEV_MODE → set a synthetic dev identity on req.lumonUser
 * 3. Tailscale-User-Login header → set real identity on req.lumonUser
 * 4. Otherwise → 401
 *
 * Sets `req.lumonUser = { login, name }` on success.
 */
export function authMiddleware(req, res, next) {
  // 1. Test bypass — VITEST is set by vitest runner
  if (process.env.VITEST) {
    return next();
  }

  // 2. Dev-mode bypass — synthetic identity
  if (AUTH_CONFIG.devMode) {
    req.lumonUser = { login: "dev@lumon.local", name: "Dev Operator" };
    return next();
  }

  // 3. Tailscale headers
  const login = req.headers["tailscale-user-login"];
  if (!login || login.trim() === "") {
    // Log rejection — wrap in try/catch so logEvent failures don't prevent 401
    try {
      const projectId = req.body?.projectId || req.params?.projectId || "unknown";
      logEvent(projectId, "auth-rejected", {
        reason: "missing-tailscale-identity",
        ip: req.ip,
        path: req.path,
        method: req.method,
      });
    } catch {
      // logEvent failure must not prevent the 401 response
    }

    return res.status(401).json({
      error: "Unauthorized",
      reason: "Tailscale-User-Login header is required",
    });
  }

  const name = req.headers["tailscale-user-name"] || login;
  req.lumonUser = { login, name };
  return next();
}

// ---------------------------------------------------------------------------
// Rate limiter factory — in-memory sliding-window per IP
// ---------------------------------------------------------------------------

/**
 * Create an Express middleware that rate-limits requests using a sliding
 * window algorithm. Each unique IP gets its own window of timestamps.
 *
 * In VITEST mode, rate limiting is bypassed to avoid cross-test interference.
 *
 * @param {number} maxRequests — max requests allowed within the window
 * @param {number} windowMs — window size in milliseconds
 * @returns {import("express").RequestHandler}
 */
export function createRateLimiter(maxRequests, windowMs) {
  /** @type {Map<string, number[]>} ip → array of request timestamps */
  const windows = new Map();

  /** Allow tests to reset state without re-creating the middleware */
  const middleware = (req, res, next) => {
    // Skip rate limiting in test mode to avoid cross-test state pollution
    if (process.env.VITEST && !req._forceRateLimit) {
      return next();
    }

    try {
      const key = req.ip || "unknown";
      const now = Date.now();
      const cutoff = now - windowMs;

      // Get or create the window for this IP
      let timestamps = windows.get(key);
      if (!timestamps) {
        timestamps = [];
        windows.set(key, timestamps);
      }

      // Slide the window: remove expired timestamps
      const filtered = timestamps.filter((t) => t > cutoff);
      windows.set(key, filtered);

      if (filtered.length >= maxRequests) {
        return res.status(429).json({
          error: "Too Many Requests",
          reason: `Rate limit exceeded: ${maxRequests} requests per ${windowMs / 1000}s`,
          retryAfterMs: filtered[0] + windowMs - now,
        });
      }

      // Record this request
      filtered.push(now);
      return next();
    } catch {
      // Fail open — rate limiter errors should not block requests
      return next();
    }
  };

  /** Reset internal state — useful for isolated test scenarios */
  middleware._reset = () => windows.clear();

  return middleware;
}

// ---------------------------------------------------------------------------
// Auth identity router — GET /identity
// ---------------------------------------------------------------------------

export const authRouter = Router();

/**
 * GET /api/auth/identity
 * Returns the current operator's identity from req.lumonUser.
 * If no identity is set (test bypass), returns a placeholder.
 */
authRouter.get("/identity", (req, res) => {
  if (req.lumonUser) {
    return res.json({
      login: req.lumonUser.login,
      name: req.lumonUser.name,
      authenticated: true,
    });
  }

  // VITEST bypass — no user set, return anonymous
  return res.json({
    login: "anonymous",
    name: "Anonymous (test mode)",
    authenticated: false,
  });
});
