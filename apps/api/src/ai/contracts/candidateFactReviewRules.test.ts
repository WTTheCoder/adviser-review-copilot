import { describe, expect, it } from "vitest";
import { classifyCandidateFacts } from "./candidateFactReviewRules.js";
import type { CandidateFact } from "./candidateFactSchemas.js";

const createCandidate = (
  field: CandidateFact["field"],
  proposedValue: string
): CandidateFact => ({
  field,
  proposedValue,
  confidence: "HIGH",
  evidence: "Supported by note",
  sourceRecordId: "source-meeting-note",
  observedDate: "2026-06-04",
  requiresHumanReview: false
});

describe("candidate fact review rules", () => {
  it("keeps address candidates pending confirmation", () => {
    expect(
      classifyCandidateFacts([createCandidate("ADDRESS", "Subiaco")])[0]
    ).toMatchObject({
      applicationStatus: "NEEDS_CONFIRMATION",
      requiresHumanReview: true
    });
  });

  it("keeps risk-profile candidates pending adviser approval", () => {
    expect(
      classifyCandidateFacts([
        createCandidate("RISK_PROFILE", "Growth-oriented")
      ])[0]
    ).toMatchObject({
      applicationStatus: "REQUIRES_ADVISER_APPROVAL",
      requiresHumanReview: true
    });
  });

  it("normalizes risk-profile candidates before adviser approval", () => {
    expect(
      classifyCandidateFacts([
        createCandidate(
          "RISK_PROFILE",
          "More growth-oriented investment approach"
        )
      ])[0]
    ).toMatchObject({
      proposedValue: "Growth-oriented",
      applicationStatus: "REQUIRES_ADVISER_APPROVAL"
    });
  });

  it("omits unsupported risk-profile phrases before projection", () => {
    expect(
      classifyCandidateFacts([
        createCandidate("RISK_PROFILE", "Dynamic risk appetite")
      ])
    ).toEqual([]);
  });

  it("overrides model-provided human-review flags", () => {
    expect(
      classifyCandidateFacts([
        createCandidate("FINANCIAL_GOAL", "Near-term home purchase")
      ])[0]?.requiresHumanReview
    ).toBe(true);
  });
});
