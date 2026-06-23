import { DecisionType, LifecycleStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  applyDecisionToFact,
  isDecisionAllowedForFact
} from "./decisionRules.js";

describe("decision rules", () => {
  it("persists Address CONFIRM as the new official value", () => {
    expect(
      applyDecisionToFact(
        {
          id: "fact-address",
          officialValue: "East Perth",
          candidateValue: "Subiaco",
          lifecycleStatus: LifecycleStatus.NEEDS_CONFIRMATION
        },
        DecisionType.CONFIRM
      )
    ).toEqual({
      officialValue: "Subiaco",
      previousValue: "East Perth",
      candidateValue: null,
      lifecycleStatus: LifecycleStatus.CURRENT
    });
  });

  it("moves East Perth to previous value for Address CONFIRM", () => {
    const update = applyDecisionToFact(
      {
        id: "fact-address",
        officialValue: "East Perth",
        candidateValue: "Subiaco",
        lifecycleStatus: LifecycleStatus.NEEDS_CONFIRMATION
      },
      DecisionType.CONFIRM
    );

    expect(update.previousValue).toBe("East Perth");
  });

  it("promotes Growth-oriented for Risk profile APPROVE", () => {
    expect(
      applyDecisionToFact(
        {
          id: "fact-risk-profile",
          officialValue: "Balanced",
          candidateValue: "Growth-oriented",
          lifecycleStatus: LifecycleStatus.REQUIRES_ADVISER_APPROVAL
        },
        DecisionType.APPROVE
      )
    ).toEqual({
      officialValue: "Growth-oriented",
      previousValue: "Balanced",
      candidateValue: null,
      lifecycleStatus: LifecycleStatus.CURRENT
    });
  });

  it("moves Balanced to previous value for Risk profile APPROVE", () => {
    const update = applyDecisionToFact(
      {
        id: "fact-risk-profile",
        officialValue: "Balanced",
        candidateValue: "Growth-oriented",
        lifecycleStatus: LifecycleStatus.REQUIRES_ADVISER_APPROVAL
      },
      DecisionType.APPROVE
    );

    expect(update.previousValue).toBe("Balanced");
  });

  it("keeps East Perth for Address LEAVE_UNVERIFIED", () => {
    expect(
      applyDecisionToFact(
        {
          id: "fact-address",
          officialValue: "East Perth",
          candidateValue: "Subiaco",
          lifecycleStatus: LifecycleStatus.NEEDS_CONFIRMATION
        },
        DecisionType.LEAVE_UNVERIFIED
      )
    ).toEqual({
      officialValue: "East Perth",
      previousValue: null,
      candidateValue: null,
      lifecycleStatus: LifecycleStatus.CURRENT
    });
  });

  it("keeps Balanced for Risk profile KEEP_CURRENT", () => {
    expect(
      applyDecisionToFact(
        {
          id: "fact-risk-profile",
          officialValue: "Balanced",
          candidateValue: "Growth-oriented",
          lifecycleStatus: LifecycleStatus.REQUIRES_ADVISER_APPROVAL
        },
        DecisionType.KEEP_CURRENT
      )
    ).toEqual({
      officialValue: "Balanced",
      previousValue: null,
      candidateValue: null,
      lifecycleStatus: LifecycleStatus.CURRENT
    });
  });

  it("rejects invalid decision combinations", () => {
    expect(isDecisionAllowedForFact("fact-address", DecisionType.APPROVE)).toBe(
      false
    );
  });
});
