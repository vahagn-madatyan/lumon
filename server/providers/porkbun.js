// ---------------------------------------------------------------------------
// Porkbun API provider — domain purchase and availability
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.porkbun.com/api/json/v3";

/** Minimum interval between API calls (ms) — Porkbun rate limit: 1 per 10s */
const RATE_LIMIT_MS = 10_000;
let lastCallAt = 0;

/**
 * Enforce rate limiting by delaying until the interval has elapsed.
 */
async function enforceRateLimit() {
  const now = Date.now();
  const elapsed = now - lastCallAt;
  if (elapsed < RATE_LIMIT_MS) {
    const waitMs = RATE_LIMIT_MS - elapsed;
    console.log(`[external-actions] porkbun rate-limit: waiting ${waitMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastCallAt = Date.now();
}

/**
 * Internal POST helper — sends JSON to Porkbun API and parses the response.
 * Never logs credentials.
 * @param {string} endpoint — relative path appended to BASE_URL
 * @param {object} body
 * @returns {Promise<object>}
 */
async function post(endpoint, body) {
  await enforceRateLimit();

  const url = `${BASE_URL}${endpoint}`;
  console.log(`[external-actions] porkbun POST ${endpoint} credentials=${body.apikey ? "injected" : "missing"}`);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (data.status === "ERROR" || !res.ok) {
    const errMsg = data.message || `HTTP ${res.status}`;
    throw classifyError(errMsg);
  }

  return data;
}

/**
 * Classify a Porkbun error message into a structured error with a `code` field.
 * @param {string} message
 * @returns {Error}
 */
function classifyError(message) {
  const lowerMsg = (message || "").toLowerCase();

  let code = "PORKBUN_UNKNOWN";
  if (lowerMsg.includes("domain is not available") || lowerMsg.includes("already registered") || lowerMsg.includes("not available")) {
    code = "DOMAIN_TAKEN";
  } else if (lowerMsg.includes("insufficient") || lowerMsg.includes("balance") || lowerMsg.includes("funds")) {
    code = "INSUFFICIENT_FUNDS";
  } else if (lowerMsg.includes("invalid api key") || lowerMsg.includes("authentication") || lowerMsg.includes("unauthorized")) {
    code = "AUTH_FAILURE";
  }

  const err = new Error(message);
  err.code = code;
  return err;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check domain availability via Porkbun.
 * @param {string} domain — e.g. "example.com"
 * @param {{ apiKey: string, apiSecret: string }} credentials
 * @returns {Promise<object>} — parsed availability response
 */
export async function checkAvailability(domain, { apiKey, apiSecret }) {
  if (!apiKey || !apiSecret) {
    throw Object.assign(new Error("Porkbun credentials not configured"), {
      code: "AUTH_FAILURE",
    });
  }

  const data = await post(`/domain/checkDomain/${domain}`, {
    apikey: apiKey,
    secretapikey: apiSecret,
  });

  return data;
}

/**
 * Purchase a domain via Porkbun.
 *
 * Uses `POST /domain/create/{domain}` with cost in **pennies** (integer)
 * and `agreeToTerms: "yes"` — as required by the Porkbun API.
 *
 * @param {{ domain: string, cost: number, apiKey: string, apiSecret: string }} opts
 * @returns {Promise<{ status: string, domain: string, cost: number, orderId: string|number, balance: number|string }>}
 */
export async function purchaseDomain({ domain, cost, apiKey, apiSecret }) {
  if (!apiKey || !apiSecret) {
    throw Object.assign(new Error("Porkbun credentials not configured"), {
      code: "AUTH_FAILURE",
    });
  }

  const data = await post(`/domain/create/${domain}`, {
    apikey: apiKey,
    secretapikey: apiSecret,
    cost: cost,              // pennies (integer)
    agreeToTerms: "yes",
  });

  return {
    status: data.status,
    domain: data.domain ?? domain,
    cost: data.cost ?? cost,
    orderId: data.orderId ?? null,
    balance: data.balance ?? null,
  };
}

/**
 * Reset rate-limit state. Used by tests.
 */
export function _resetRateLimit() {
  lastCallAt = 0;
}
