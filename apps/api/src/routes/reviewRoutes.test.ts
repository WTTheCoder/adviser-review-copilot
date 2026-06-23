import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { ReviewResponse } from "@client-review-prep/shared";
import { registerReviewRoutes } from "./reviewRoutes.js";

const review: ReviewResponse = {
  client: {
    id: "demo-alex-taylor",
    name: "Alex Taylor",
    adviserName: "Jordan Lee",
    reviewYear: 2026,
    reviewStatus: "Ready for adviser review"
  },
  summaryMetrics: [],
  sourceRecords: [],
  clientFacts: [],
  meaningfulChanges: [],
  adviserActions: [],
  workflowTrace: []
};

const createTestServer = async () => {
  const server = Fastify({ logger: false });
  const service = {
    buildReviewResponse: vi.fn(async () => review),
    prepareReview: vi.fn(async () => review),
    recordDecision: vi.fn(async () => review),
    resetDemo: vi.fn(async () => review)
  };
  await registerReviewRoutes(server, service as never);
  return { server, service };
};

describe("review routes", () => {
  it("returns the expected fictional client", async () => {
    const { server } = await createTestServer();
    const response = await server.inject("/api/clients/demo-alex-taylor/review");

    expect(response.statusCode).toBe(200);
    expect(response.json().client.name).toBe("Alex Taylor");
    await server.close();
  });

  it("prepares a review through the service", async () => {
    const { server, service } = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/clients/demo-alex-taylor/prepare-review"
    });

    expect(response.statusCode).toBe(200);
    expect(service.prepareReview).toHaveBeenCalledWith("demo-alex-taylor");
    await server.close();
  });

  it("rejects invalid decision payloads", async () => {
    const { server } = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/clients/demo-alex-taylor/facts/fact-address/decision",
      payload: { decision: "BAD_DECISION" }
    });

    expect(response.statusCode).toBe(400);
    await server.close();
  });

  it("resets the demo through the service", async () => {
    const { server, service } = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/demo/reset"
    });

    expect(response.statusCode).toBe(200);
    expect(service.resetDemo).toHaveBeenCalledOnce();
    await server.close();
  });
});
