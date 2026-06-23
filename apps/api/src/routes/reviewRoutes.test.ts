import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { ReviewResponse } from "@client-review-prep/shared";
import {
  registerReviewRoutes,
  type ReviewRouteDependencies,
  type ReviewRouteHarness,
  type ReviewRouteService
} from "./reviewRoutes.js";

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
    resetDemo: vi.fn(async () => review)
  } satisfies ReviewRouteService;
  const harness = {
    execute: vi.fn<ReviewRouteHarness["execute"]>(
      async (skillName) => ({
        ok: true,
        output: review,
        metadata: {
          skillName,
          skillVersion: "1",
          status: "SUCCEEDED",
          events: []
        }
      })
    )
  } satisfies ReviewRouteHarness;
  const dependencies = {
    reviewService: service,
    harness
  } satisfies ReviewRouteDependencies;
  await registerReviewRoutes(server, dependencies);
  return { server, service, harness };
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
    const { server, harness } = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/clients/demo-alex-taylor/prepare-review"
    });

    expect(response.statusCode).toBe(200);
    expect(harness.execute).toHaveBeenCalledWith(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      expect.anything(),
      "demo-alex-taylor"
    );
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

  it("saves a decision through the fixed apply-adviser-decision skill", async () => {
    const { server, harness } = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/clients/demo-alex-taylor/facts/fact-address/decision",
      payload: { decision: "CONFIRM" }
    });

    expect(response.statusCode).toBe(200);
    expect(harness.execute).toHaveBeenCalledWith(
      "apply-adviser-decision",
      {
        clientId: "demo-alex-taylor",
        factId: "fact-address",
        payload: { decision: "CONFIRM" }
      },
      expect.anything(),
      "demo-alex-taylor"
    );
    await server.close();
  });

  it("does not expose an arbitrary public skill execution endpoint", async () => {
    const { server } = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/skills/prepare-annual-review"
    });

    expect(response.statusCode).toBe(404);
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
