import { describe, expect, it } from "vitest";
import {
  adviserDecisionPayloadSchema,
  healthResponseSchema,
  reviewResponseSchema
} from "./index.js";

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

describe("adviserDecisionPayloadSchema", () => {
  it("accepts supported adviser decisions", () => {
    expect(
      adviserDecisionPayloadSchema.parse({
        decision: "CONFIRM",
        note: "Confirmed during the local demo."
      })
    ).toEqual({
      decision: "CONFIRM",
      note: "Confirmed during the local demo."
    });
  });
});

describe("reviewResponseSchema", () => {
  it("validates the minimum review response shape", () => {
    expect(
      reviewResponseSchema.safeParse({
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
      }).success
    ).toBe(true);
  });
});
