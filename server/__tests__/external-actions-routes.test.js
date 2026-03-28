import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import app from "../index.js";
import * as externalActions from "../external-actions.js";
import * as artifacts from "../artifacts.js";

beforeEach(() => {
  externalActions.clear();
  artifacts.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/external-actions/request", () => {
  it("creates a pending action and returns 201", async () => {
    const res = await request(app)
      .post("/api/external-actions/request")
      .send({
        projectId: "proj-1",
        type: "domain-purchase",
        params: { domain: "example.com", cost: 899 },
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      projectId: "proj-1",
      type: "domain-purchase",
      status: "pending",
      params: { domain: "example.com", cost: 899 },
    });
    expect(res.body.id).toBeDefined();
  });

  it("rejects with 400 when projectId is missing", async () => {
    const res = await request(app)
      .post("/api/external-actions/request")
      .send({ type: "domain-purchase" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Missing required");
  });

  it("rejects with 400 when domain artifact has simulated engine (D052 guard)", async () => {
    // Seed a domain_signals artifact with simulated engine metadata
    artifacts.create({
      projectId: "proj-sim",
      stageKey: "plan",
      type: "domain_signals",
      content: { signals: [] },
      metadata: { engine: "n8n-plan-domain-v1-simulated" },
    });

    const res = await request(app)
      .post("/api/external-actions/request")
      .send({
        projectId: "proj-sim",
        type: "domain-purchase",
        params: { domain: "simulated.com", cost: 899 },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Simulated data rejected");
    expect(res.body.reason).toContain("simulated engine");
  });

  it("allows domain-purchase when artifact engine is not simulated", async () => {
    artifacts.create({
      projectId: "proj-real",
      stageKey: "plan",
      type: "domain_signals",
      content: { signals: [] },
      metadata: { engine: "n8n-plan-domain-v1" },
    });

    const res = await request(app)
      .post("/api/external-actions/request")
      .send({
        projectId: "proj-real",
        type: "domain-purchase",
        params: { domain: "real.com", cost: 899 },
      });

    expect(res.status).toBe(201);
  });
});

describe("POST /api/external-actions/confirm/:actionId", () => {
  it("confirms a pending action and returns 200", async () => {
    const action = externalActions.requestAction({
      projectId: "proj-1",
      type: "domain-purchase",
      params: {},
    });

    const res = await request(app)
      .post(`/api/external-actions/confirm/${action.id}`)
      .send({ projectId: "proj-1" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("confirmed");
    expect(res.body.confirmedAt).toBeDefined();
  });

  it("rejects with 400 when projectId is missing", async () => {
    const res = await request(app)
      .post("/api/external-actions/confirm/some-id")
      .send({});

    expect(res.status).toBe(400);
  });
});

describe("POST /api/external-actions/cancel/:actionId", () => {
  it("cancels a pending action and returns 200", async () => {
    const action = externalActions.requestAction({
      projectId: "proj-1",
      type: "domain-purchase",
      params: {},
    });

    const res = await request(app)
      .post(`/api/external-actions/cancel/${action.id}`)
      .send({ projectId: "proj-1" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
  });
});

describe("POST /api/external-actions/execute/:actionId — THE GATE", () => {
  it("returns 403 when action is not confirmed (THE GATE)", async () => {
    const action = externalActions.requestAction({
      projectId: "proj-1",
      type: "domain-purchase",
      params: { domain: "example.com", cost: 899 },
    });

    const res = await request(app)
      .post(`/api/external-actions/execute/${action.id}`)
      .send({ projectId: "proj-1" });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Execution rejected");
    expect(res.body.reason).toContain("must be 'confirmed'");
  });

  it("returns 200 when action is confirmed (with mocked provider)", async () => {
    const action = externalActions.requestAction({
      projectId: "proj-1",
      type: "domain-purchase",
      params: { domain: "example.com", cost: 899 },
    });
    externalActions.confirmAction({ projectId: "proj-1", actionId: action.id });

    // Mock the Porkbun purchaseDomain to avoid real HTTP calls
    const porkbun = await import("../providers/porkbun.js");
    vi.spyOn(porkbun, "purchaseDomain").mockResolvedValue({
      status: "SUCCESS",
      domain: "example.com",
      cost: 899,
      orderId: "ord-123",
      balance: 5000,
    });

    const res = await request(app)
      .post(`/api/external-actions/execute/${action.id}`)
      .send({ projectId: "proj-1" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("completed");
    expect(res.body.result).toMatchObject({
      status: "SUCCESS",
      domain: "example.com",
      orderId: "ord-123",
    });
  });

  it("returns 404 when action does not exist", async () => {
    const res = await request(app)
      .post("/api/external-actions/execute/nonexistent")
      .send({ projectId: "proj-1" });

    expect(res.status).toBe(404);
  });
});

describe("GET /api/external-actions/status/:projectId", () => {
  it("returns all actions for a project", async () => {
    externalActions.requestAction({
      projectId: "proj-1",
      type: "domain-purchase",
      params: { domain: "a.com" },
    });
    externalActions.requestAction({
      projectId: "proj-1",
      type: "domain-purchase",
      params: { domain: "b.com" },
    });

    const res = await request(app).get(
      "/api/external-actions/status/proj-1",
    );

    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe("proj-1");
    expect(res.body.actions).toHaveLength(2);
  });

  it("returns empty array when no actions exist", async () => {
    const res = await request(app).get(
      "/api/external-actions/status/proj-empty",
    );

    expect(res.status).toBe(200);
    expect(res.body.actions).toHaveLength(0);
  });
});

describe("GET /api/external-actions/action/:actionId", () => {
  it("returns a single action by id", async () => {
    const action = externalActions.requestAction({
      projectId: "proj-1",
      type: "domain-purchase",
      params: { domain: "test.com" },
    });

    const res = await request(app).get(
      `/api/external-actions/action/${action.id}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(action.id);
    expect(res.body.params.domain).toBe("test.com");
  });

  it("returns 404 for unknown action id", async () => {
    const res = await request(app).get(
      "/api/external-actions/action/nonexistent",
    );

    expect(res.status).toBe(404);
  });
});
