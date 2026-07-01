import { describe, expect, it } from "vitest";
import {
  attachTrustedCandidateProvenance,
  classifyCandidateFacts,
  reconcileCandidateFactsWithDiagnostics
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

  it("merges equivalent duplicate assertions deterministically", () => {
    const result = reconcileCandidateFactsWithDiagnostics(
      [
        {
          ...createCandidate("RISK_PROFILE", "High Growth"),
          evidence: "Client may move to High Growth.",
          observedDate: "2026-06-20"
        },
        {
          ...createCandidate("RISK_PROFILE", "High Growth"),
          evidence: "Client is considering High Growth.",
          observedDate: "2026-06-20"
        }
      ],
      [
        {
          field: "RISK_PROFILE",
          officialValue: "Balanced",
          officialObservedAt: "2026-06-01T00:00:00.000Z"
        }
      ]
    );

    expect(result.warnings).toEqual([]);
    expect(result.classifications).toEqual([
      expect.objectContaining({
        field: "RISK_PROFILE",
        proposedValue: "High Growth",
        evidence:
          "Client is considering High Growth. | Client may move to High Growth."
      })
    ]);
  });

  it("uses newer provenance when duplicate assertions normalize to the same value", () => {
    const result = reconcileCandidateFactsWithDiagnostics(
      [
        {
          ...createCandidate("ADDRESS", "subiaco"),
          sourceRecordId: "source-meeting-note",
          observedDate: "2026-06-04",
          evidence: "Older meeting note says Subiaco."
        },
        {
          ...createCandidate("ADDRESS", "Subiaco"),
          sourceRecordId: "source-upload-pdf",
          observedDate: "2026-06-13",
          evidence: "Newer uploaded PDF says Subiaco."
        }
      ],
      [
        {
          field: "ADDRESS",
          officialValue: "East Perth",
          officialObservedAt: "2026-06-01T00:00:00.000Z"
        }
      ]
    );

    expect(result.warnings).toEqual([]);
    expect(result.classifications).toEqual([
      expect.objectContaining({
        field: "ADDRESS",
        proposedValue: "Subiaco",
        sourceRecordId: "source-upload-pdf",
        observedDate: "2026-06-13",
        evidence:
          "Newer uploaded PDF says Subiaco. | Older meeting note says Subiaco."
      })
    ]);
  });

  it("uses higher confidence when duplicate assertions have the same date", () => {
    const result = reconcileCandidateFactsWithDiagnostics(
      [
        {
          ...createCandidate("RISK_PROFILE", "Growth-oriented"),
          confidence: "LOW",
          sourceRecordId: "source-upload-a",
          observedDate: "2026-06-13",
          evidence: "Low confidence growth-oriented evidence."
        },
        {
          ...createCandidate(
            "RISK_PROFILE",
            "More growth-oriented investment approach"
          ),
          confidence: "HIGH",
          sourceRecordId: "source-upload-b",
          observedDate: "2026-06-13",
          evidence: "Alex is considering a growth-oriented approach."
        }
      ],
      [
        {
          field: "RISK_PROFILE",
          officialValue: "Balanced",
          officialObservedAt: "2026-06-01T00:00:00.000Z"
        }
      ]
    );

    expect(result.warnings).toEqual([]);
    expect(result.classifications[0]).toMatchObject({
      field: "RISK_PROFILE",
      proposedValue: "Growth-oriented",
      sourceRecordId: "source-upload-b",
      observedDate: "2026-06-13"
    });
  });

  it("uses stable source ID ordering for complete duplicate assertion ties", () => {
    const result = reconcileCandidateFactsWithDiagnostics(
      [
        {
          ...createCandidate("ADDRESS", "Subiaco"),
          confidence: "MEDIUM",
          sourceRecordId: "source-upload-b",
          observedDate: "2026-06-13",
          evidence: "Source B says Subiaco."
        },
        {
          ...createCandidate("ADDRESS", "subiaco"),
          confidence: "MEDIUM",
          sourceRecordId: "source-upload-a",
          observedDate: "2026-06-13",
          evidence: "Source A says Subiaco."
        }
      ],
      [
        {
          field: "ADDRESS",
          officialValue: "East Perth",
          officialObservedAt: "2026-06-01T00:00:00.000Z"
        }
      ]
    );

    expect(result.warnings).toEqual([]);
    expect(result.classifications[0]).toMatchObject({
      field: "ADDRESS",
      proposedValue: "Subiaco",
      sourceRecordId: "source-upload-a",
      observedDate: "2026-06-13"
    });
  });

  it("withholds conflicting risk-profile assertions instead of choosing by order", () => {
    const result = reconcileCandidateFactsWithDiagnostics(
      [
        {
          ...createCandidate("RISK_PROFILE", "High Growth"),
          evidence: "Alex is considering High Growth.",
          observedDate: "2026-06-20"
        },
        {
          ...createCandidate("RISK_PROFILE", "Balanced"),
          evidence: "Alex has decided to remain Balanced.",
          observedDate: "2026-06-20"
        }
      ],
      [
        {
          field: "RISK_PROFILE",
          officialValue: "Balanced",
          officialObservedAt: "2026-06-01T00:00:00.000Z"
        }
      ]
    );

    expect(result.classifications).toEqual([]);
    expect(result.warnings.join(" ")).toContain(
      "conflicting evidence also supports the current official value"
    );
  });

  it("withholds mutually conflicting proposed values", () => {
    const result = reconcileCandidateFactsWithDiagnostics(
      [
        {
          ...createCandidate("RISK_PROFILE", "High Growth"),
          observedDate: "2026-06-20"
        },
        {
          ...createCandidate("RISK_PROFILE", "Conservative"),
          observedDate: "2026-06-20"
        }
      ],
      [
        {
          field: "RISK_PROFILE",
          officialValue: "Balanced",
          officialObservedAt: "2026-06-01T00:00:00.000Z"
        }
      ]
    );

    expect(result.classifications).toEqual([]);
    expect(result.warnings.join(" ")).toContain(
      "multiple proposed values conflict"
    );
  });

  it("withholds candidate evidence older than official provenance", () => {
    const result = reconcileCandidateFactsWithDiagnostics(
      [
        {
          ...createCandidate("ADDRESS", "Joondalup"),
          observedDate: "2026-06-01"
        }
      ],
      [
        {
          field: "ADDRESS",
          officialValue: "East Perth",
          officialObservedAt: "2026-06-20T00:00:00.000Z"
        }
      ]
    );

    expect(result.classifications).toEqual([]);
    expect(result.warnings.join(" ")).toContain(
      "source is older than the current official source"
    );
  });

  it("allows candidate evidence newer than official provenance", () => {
    const result = reconcileCandidateFactsWithDiagnostics(
      [
        {
          ...createCandidate("ADDRESS", "Joondalup"),
          observedDate: "2026-06-20"
        }
      ],
      [
        {
          field: "ADDRESS",
          officialValue: "East Perth",
          officialObservedAt: "2026-06-01T00:00:00.000Z"
        }
      ]
    );

    expect(result.warnings).toEqual([]);
    expect(result.classifications[0]).toMatchObject({
      field: "ADDRESS",
      proposedValue: "Joondalup"
    });
  });

  it("withholds equal-date conflicting evidence", () => {
    const result = reconcileCandidateFactsWithDiagnostics(
      [createCandidate("ADDRESS", "Joondalup")],
      [
        {
          field: "ADDRESS",
          officialValue: "East Perth",
          officialObservedAt: "2026-06-04T00:00:00.000Z"
        }
      ]
    );

    expect(result.classifications).toEqual([]);
    expect(result.warnings.join(" ")).toContain(
      "conflicts with official value on the same source date"
    );
  });

  it("ignores equal-date same-value evidence without churn", () => {
    const result = reconcileCandidateFactsWithDiagnostics(
      [createCandidate("ADDRESS", "East Perth")],
      [
        {
          field: "ADDRESS",
          officialValue: "East Perth",
          officialObservedAt: "2026-06-04T00:00:00.000Z"
        }
      ]
    );

    expect(result).toEqual({
      classifications: [],
      warnings: []
    });
  });

  it("withholds candidates when freshness cannot be established", () => {
    const result = reconcileCandidateFactsWithDiagnostics(
      [
        {
          ...createCandidate("ADDRESS", "Joondalup"),
          observedDate: ""
        }
      ],
      [
        {
          field: "ADDRESS",
          officialValue: "East Perth",
          officialObservedAt: null
        }
      ]
    );

    expect(result.classifications).toEqual([]);
    expect(result.warnings.join(" ")).toContain("source freshness is unclear");
  });
});
