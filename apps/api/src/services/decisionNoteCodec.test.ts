import { describe, expect, it } from "vitest";
import {
  decodeDecisionCandidateValue,
  encodeDecisionNote
} from "./decisionNoteCodec.js";

describe("decision note codec", () => {
  it("round-trips the candidate value without changing the visible note", () => {
    const encoded = encodeDecisionNote(
      "Adviser approved the change.",
      "High Growth"
    );

    expect(encoded).toContain("Adviser approved the change.");
    expect(decodeDecisionCandidateValue(encoded)).toBe("High Growth");
  });

  it("uses the application-appended marker when visible note text contains one", () => {
    const encoded = encodeDecisionNote(
      "Quoted text: Candidate value at decision: Balanced",
      "Growth-oriented"
    );

    expect(decodeDecisionCandidateValue(encoded)).toBe("Growth-oriented");
  });

  it("returns null for legacy, empty, or candidate-free notes", () => {
    expect(decodeDecisionCandidateValue("Legacy adviser note")).toBeNull();
    expect(decodeDecisionCandidateValue(null)).toBeNull();
    expect(decodeDecisionCandidateValue(encodeDecisionNote("Note", null))).toBeNull();
  });
});
