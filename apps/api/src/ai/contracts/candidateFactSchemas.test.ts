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
      sourceRecordId: "source-meeting-note",
      observedDate: "2026-06-04",
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

  it.each(["2026-06-04", "2024-02-29"])(
    "accepts valid calendar date %s",
    (observedDate) => {
      expect(
        candidateFactExtractionResultSchema.parse({
          ...validResult,
          candidateFacts: [{ ...validResult.candidateFacts[0], observedDate }]
        }).candidateFacts[0]?.observedDate
      ).toBe(observedDate);
    }
  );

  it.each(["2026-99-99", "2026-02-31", "2025-02-29"])(
    "rejects impossible calendar date %s",
    (observedDate) => {
      expect(() =>
        candidateFactExtractionResultSchema.parse({
          ...validResult,
          candidateFacts: [{ ...validResult.candidateFacts[0], observedDate }]
        })
      ).toThrow();
    }
  );
});
