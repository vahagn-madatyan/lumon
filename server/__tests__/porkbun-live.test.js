import { describe, it, expect } from "vitest";

/**
 * Live Porkbun API integration test.
 *
 * Gated behind PORKBUN_LIVE_TEST env var — skipped entirely when not set.
 * Requires PORKBUN_API_KEY and PORKBUN_API_SECRET to be configured in the environment.
 *
 * Usage:
 *   PORKBUN_LIVE_TEST=1 PORKBUN_API_KEY=pk1_xxx PORKBUN_API_SECRET=sk1_xxx npx vitest run server/__tests__/porkbun-live.test.js
 */

describe.skipIf(!process.env.PORKBUN_LIVE_TEST)("Porkbun Live API", () => {
  const apiKey = process.env.PORKBUN_API_KEY;
  const apiSecret = process.env.PORKBUN_API_SECRET;

  it("ping endpoint confirms API connectivity", async () => {
    const response = await fetch("https://api.porkbun.com/api/json/v3/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: apiKey,
        secretapikey: apiSecret,
      }),
    });

    const data = await response.json();
    expect(response.ok).toBe(true);
    expect(data.status).toBe("SUCCESS");
    expect(typeof data.yourIp).toBe("string");
  });

  it("checkDomain returns expected response shape for example.com", async () => {
    const response = await fetch(
      "https://api.porkbun.com/api/json/v3/domain/checkDomain/example.com",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apikey: apiKey,
          secretapikey: apiSecret,
        }),
      }
    );

    const data = await response.json();
    expect(response.ok).toBe(true);
    expect(data.status).toBe("SUCCESS");
    expect(typeof data.avail).toBe("string");
    expect(typeof data.price).toBe("string");
  });

  it("checkDomain response includes pricing fields", async () => {
    const response = await fetch(
      "https://api.porkbun.com/api/json/v3/domain/checkDomain/example.com",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apikey: apiKey,
          secretapikey: apiSecret,
        }),
      }
    );

    const data = await response.json();
    expect(data.status).toBe("SUCCESS");
    // price, renewalPrice, and regularPrice should be present as strings
    expect(typeof data.price).toBe("string");
    // These may or may not be present depending on the domain, but if present they should be strings
    if (data.renewalPrice !== undefined) {
      expect(typeof data.renewalPrice).toBe("string");
    }
    if (data.regularPrice !== undefined) {
      expect(typeof data.regularPrice).toBe("string");
    }
  });
});
