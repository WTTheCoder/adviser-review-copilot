import { describe, expect, it } from "vitest";
import { candidateFactExtractionResultSchema } from "./candidateFactSchemas.js";

const validResult = {
  providerMode: "mock",
  model: null,
  candidateFacts: [
    {
      field: "ADDRESS",
      proposedValue: "Subiaco",
      confidence: "MEDIUM",
      evidence: "may have moved to Subiaco",
      requiresHumanReview: true
    }
  ],
  warnings: [],
  metadata: {
    durationMs: 0,
    sourceTextLength: 42,
    candidateCount: 1
  }
};

describe("candidate fact extraction schemas", () => {
  it("accepts a valid candidate result", () => {
    expect(candidateFactExtractionResultSchema.parse(validResult)).toEqual(
      validResult
    );
  });

  it("rejects unsupported fields", () => {
    expect(() =>
      candidateFactExtractionResultSchema.parse({
        ...validResult,
        candidateFacts: [{ ...validResult.candidateFacts[0], field: "SECRET" }]
      })
    ).toThrow();
  });

  it("rejects too many candidates", () => {
    expect(() =>
      candidateFactExtractionResultSchema.parse({
        ...validResult,
        candidateFacts: Array.from({ length: 11 }, () => validResult.candidateFacts[0])
      })
    ).toThrow();
  });

  it("rejects excessive evidence and extra properties", () => {
    expect(() =>
      candidateFactExtractionResultSchema.parse({
        ...validResult,
        candidateFacts: [
          {
            ...validResult.candidateFacts[0],
            evidence: "x".repeat(241),
            extra: "not allowed"
          }
        ]
      })
    ).toThrow();
  });

  it("rejects model-controlled source record IDs", () => {
    expect(() =>
      candidateFactExtractionResultSchema.parse({
        ...validResult,
        candidateFacts: [
          {
            ...validResult.candidateFacts[0],
            sourceRecordId: "source-annual-review"
          }
        ]
      })
    ).toThrow();
  });

  it("rejects model-controlled observed dates", () => {
    expect(() =>
      candidateFactExtractionResultSchema.parse({
        ...validResult,
        candidateFacts: [
          {
            ...validResult.candidateFacts[0],
            observedDate: "2099-01-01"
          }
        ]
      })
    ).toThrow();
  });
});
