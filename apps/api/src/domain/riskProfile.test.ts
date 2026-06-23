import { describe, expect, it } from "vitest";
import {
  canonicalRiskProfiles,
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
    ["High Growth", "High Growth"],
    ["balanced", "Balanced"],
    ["moderate", "Balanced"],
    ["more conservative", "Conservative"]
  ])("normalizes %s to %s", (proposedValue, expected) => {
    expect(normalize(proposedValue)).toBe(expected);
  });

  it.each([
    "does not want a growth-oriented approach",
    "less growth-oriented",
    "not High Growth"
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
});
