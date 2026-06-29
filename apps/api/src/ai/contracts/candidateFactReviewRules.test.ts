import { describe, expect, it } from "vitest";
import {
  attachTrustedCandidateProvenance,
  classifyCandidateFacts
} from "./candidateFactReviewRules.js";
import type {
  CandidateFact,
  TrustedCandidateFact
} from "./candidateFactSchemas.js";

const createCandidate = (
  field: CandidateFact["field"],
  proposedValue: string
): TrustedCandidateFact => ({
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

  it.each([
    "Alex does not want to move to High Growth.",
    "Alex is not considering changing to High Growth.",
    "Alex considered High Growth but decided to remain Balanced."
  ])("omits rejected risk-profile evidence before projection: %s", (evidence) => {
    expect(
      classifyCandidateFacts([
        {
          ...createCandidate("RISK_PROFILE", "High Growth"),
          evidence
        }
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

  it("attaches trusted provenance to extracted candidates", () => {
    expect(
      attachTrustedCandidateProvenance(
        [createCandidate("ADDRESS", "Subiaco")],
        {
          sourceRecordId: "source-current-note",
          observedDate: "2026-06-05"
        }
      )[0]
    ).toMatchObject({
      sourceRecordId: "source-current-note",
      observedDate: "2026-06-05"
    });
  });

  it("overwrites forged source IDs and future dates before classification", () => {
    const forgedCandidate = {
      field: "ADDRESS",
      proposedValue: "Subiaco",
      confidence: "HIGH",
      evidence: "Supported by note",
      requiresHumanReview: false,
      sourceRecordId: "source-annual-review",
      observedDate: "2099-01-01"
    } as CandidateFact;

    const enriched = attachTrustedCandidateProvenance([forgedCandidate], {
      sourceRecordId: "source-current-upload",
      observedDate: "2026-06-04"
    });

    expect(enriched[0]).toMatchObject({
      sourceRecordId: "source-current-upload",
      observedDate: "2026-06-04"
    });
    expect(classifyCandidateFacts(enriched)[0]).toMatchObject({
      sourceRecordId: "source-current-upload",
      observedDate: "2026-06-04"
    });
  });
});
