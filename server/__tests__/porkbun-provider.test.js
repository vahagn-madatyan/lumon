import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  purchaseDomain,
  checkAvailability,
  _resetRateLimit,
} from "../providers/porkbun.js";

// Mock the global fetch so we never make real HTTP calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  _resetRateLimit();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("purchaseDomain", () => {
  it("returns domain + orderId on successful purchase", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "SUCCESS",
        domain: "example.com",
        cost: 899,
        orderId: "ord-12345",
        balance: 50000,
      }),
    });

    const result = await purchaseDomain({
      domain: "example.com",
      cost: 899,
      apiKey: "pk1_test",
      apiSecret: "sk1_test",
    });

    expect(result).toMatchObject({
      status: "SUCCESS",
      domain: "example.com",
      orderId: "ord-12345",
      balance: 50000,
    });

    // Verify correct endpoint and body shape
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.porkbun.com/api/json/v3/domain/create/example.com",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );

    // Verify the body includes agreeToTerms and cost in pennies
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody).toMatchObject({
      apikey: "pk1_test",
      secretapikey: "sk1_test",
      cost: 899,
      agreeToTerms: "yes",
    });
  });

  it("throws DOMAIN_TAKEN error when domain is already registered", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ERROR",
        message: "Domain is not available for registration",
      }),
    });

    try {
      await purchaseDomain({
        domain: "taken.com",
        cost: 899,
        apiKey: "pk1_test",
        apiSecret: "sk1_test",
      });
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err.message).toContain("Domain is not available");
      expect(err.code).toBe("DOMAIN_TAKEN");
    }
  });

  it("throws INSUFFICIENT_FUNDS error when balance is too low", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ERROR",
        message: "Insufficient funds in account balance",
      }),
    });

    try {
      await purchaseDomain({
        domain: "expensive.com",
        cost: 999999,
        apiKey: "pk1_test",
        apiSecret: "sk1_test",
      });
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err.message).toContain("Insufficient funds");
      expect(err.code).toBe("INSUFFICIENT_FUNDS");
    }
  });

  it("throws AUTH_FAILURE error when API key is invalid", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        status: "ERROR",
        message: "Invalid API key or unauthorized",
      }),
    });

    try {
      await purchaseDomain({
        domain: "example.com",
        cost: 899,
        apiKey: "bad-key",
        apiSecret: "bad-secret",
      });
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err.message).toContain("Invalid API key");
      expect(err.code).toBe("AUTH_FAILURE");
    }
  });

  it("throws AUTH_FAILURE when credentials are missing", async () => {
    await expect(
      purchaseDomain({
        domain: "example.com",
        cost: 899,
        apiKey: null,
        apiSecret: null,
      }),
    ).rejects.toThrow("Porkbun credentials not configured");
  });
});

describe("checkAvailability", () => {
  it("returns parsed availability data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "SUCCESS",
        avail: true,
        pricing: {
          registration: "8.99",
          renewal: "9.99",
        },
      }),
    });

    const result = await checkAvailability("example.com", {
      apiKey: "pk1_test",
      apiSecret: "sk1_test",
    });

    expect(result).toMatchObject({
      status: "SUCCESS",
      avail: true,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.porkbun.com/api/json/v3/domain/checkDomain/example.com",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws AUTH_FAILURE when credentials are missing", async () => {
    await expect(
      checkAvailability("example.com", { apiKey: null, apiSecret: null }),
    ).rejects.toThrow("Porkbun credentials not configured");
  });
});
