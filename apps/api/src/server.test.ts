import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "@client-review-prep/shared";
import { createServer } from "./server.js";

describe("GET /health", () => {
  it("returns the health response contract", async () => {
    const server = await createServer();

    try {
      const response = await server.inject({
        method: "GET",
        url: "/health"
      });

      expect(response.statusCode).toBe(200);
      expect(healthResponseSchema.parse(response.json())).toEqual({
        status: "ok",
        service: "client-review-prep-api"
      });
    } finally {
      await server.close();
    }
  });
});
