import { describe, expect, it } from "vitest";
import {
  canonicalRiskProfiles,
  classifyRiskProfileEvidence,
  classifyRiskProfileIntent,
  normalizeRiskProfileCandidate
} from "./riskProfile.js";

const normalize = (proposedValue: string, evidence = proposedValue) =>
  normalizeRiskProfileCandidate({ proposedValue, evidence });

describe("risk profile normalization", () => {
  it("uses one canonical value set", () => {
    expect(canonicalRiskProfiles).toEqual([
      "Conservative",
      "Balanced",
      "Growth-oriented",
      "High Growth"
    ]);
  });

  it.each([
    ["Growth-oriented", "Growth-oriented"],
    ["growth-oriented", "Growth-oriented"],
    ["GROWTH-ORIENTED", "Growth-oriented"],
    ["More growth-oriented investment approach", "Growth-oriented"],
    ["Aggressive growth", "High Growth"],
    ["More aggressive growth strategy", "High Growth"],
    ["High Growth", "High Growth"],
    ["HIGH GROWTH", "High Growth"],
    ["balanced", "Balanced"],
    ["moderate", "Balanced"],
    ["more conservative", "Conservative"]
  ])("normalizes %s to %s", (proposedValue, expected) => {
    expect(normalize(proposedValue)).toBe(expected);
  });

  it.each([
    "does not want a growth-oriented approach",
    "less growth-oriented",
    "not High Growth",
    "does not want High Growth"
  ])("does not map negated growth statement %s", (evidence) => {
    expect(normalize("Growth-oriented", evidence)).toBeNull();
  });

  it("does not turn retained Balanced evidence into a growth candidate", () => {
    expect(
      normalize(
        "Growth-oriented",
        "Alex asked about growth assets but wants to remain Balanced."
      )
    ).toBeNull();
  });

  it("does not normalize unsupported free-form phrases", () => {
    expect(normalize("Dynamic risk appetite")).toBeNull();
  });

  it.each([
    ["Alex expressed interest in High Growth.", "SUPPORTED"],
    ["Alex may move to High Growth.", "REVIEWABLE"],
    ["Alex does not want to move to High Growth.", "REJECTED"],
    ["Alex wants to remain Balanced.", "REJECTED"],
    [
      "Alex considered High Growth but decided to remain Balanced.",
      "REJECTED"
    ]
  ] as const)("classifies sentence intent for %s", (evidence, expected) => {
    expect(
      classifyRiskProfileIntent(evidence)
    ).toBe(expected);
  });

  it.each([
    [
      [{ proposedValue: "High Growth", evidence: "Alex prefers High Growth." }],
      "SUPPORTED",
      "High Growth"
    ],
    [
      [{ proposedValue: "High Growth", evidence: "Alex may prefer High Growth." }],
      "REVIEWABLE",
      "High Growth"
    ],
    [
      [
        {
          proposedValue: null,
          evidence: "Alex wants to remain Balanced."
        }
      ],
      "REJECTED",
      null
    ],
    [
      [
        {
          proposedValue: "High Growth",
          evidence: "Alex may prefer High Growth."
        },
        {
          proposedValue: null,
          evidence: "Alex wants to stay Balanced."
        }
      ],
      "CONTRADICTORY",
      null
    ],
    [
      [
        {
          proposedValue: "High Growth",
          evidence: "Alex expressed interest in High Growth."
        },
        {
          proposedValue: null,
          evidence: "Alex is not comfortable with High Growth."
        }
      ],
      "CONTRADICTORY",
      null
    ],
    [
      [
        {
          proposedValue: "High Growth",
          evidence: "Alex is considering High Growth."
        },
        {
          proposedValue: "Conservative",
          evidence: "Alex is also considering Conservative."
        }
      ],
      "CONTRADICTORY",
      null
    ],
    [
      [
        {
          proposedValue: null,
          evidence: "Alex currently has a Balanced profile."
        },
        {
          proposedValue: "High Growth",
          evidence: "Alex may prefer High Growth."
        }
      ],
      "REVIEWABLE",
      "High Growth"
    ],
    [
      [
        {
          proposedValue: "High Growth",
          evidence: "Alex may prefer High Growth."
        },
        {
          proposedValue: "High Growth",
          evidence: "Alex expressed interest in High Growth."
        }
      ],
      "REVIEWABLE",
      "High Growth"
    ]
  ] as const)(
    "aggregates source evidence as %s",
    (items, expectedIntent, expectedCandidate) => {
      expect(classifyRiskProfileEvidence(items)).toMatchObject({
        intent: expectedIntent,
        candidate: expectedCandidate
      });
    }
  );
});
