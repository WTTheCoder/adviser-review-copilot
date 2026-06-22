import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "./index.js";

describe("healthResponseSchema", () => {
  it("accepts the API health response contract", () => {
    const result = healthResponseSchema.parse({
      status: "ok",
      service: "client-review-prep-api"
    });

    expect(result).toEqual({
      status: "ok",
      service: "client-review-prep-api"
    });
  });
});
