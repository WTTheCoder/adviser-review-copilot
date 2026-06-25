import { describe, expect, it } from "vitest";
import { createDecisionSubmissionLock } from "./decisionSubmissionLock.js";

describe("decision submission lock", () => {
  it("prevents duplicate submissions while a decision is pending", () => {
    const lock = createDecisionSubmissionLock();

    expect(lock.tryStart("fact-address")).toBe(true);
    expect(lock.tryStart("fact-address")).toBe(false);
    expect(lock.tryStart("fact-risk-profile")).toBe(false);
  });

  it("allows a pending action to be retried after completion or failure", () => {
    const lock = createDecisionSubmissionLock();

    expect(lock.tryStart("fact-address")).toBe(true);
    lock.finish("fact-address");
    expect(lock.tryStart("fact-address")).toBe(true);
  });
});
