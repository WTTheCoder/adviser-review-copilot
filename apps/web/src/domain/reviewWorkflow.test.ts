import { describe, expect, it } from "vitest";
import {
  getPrepareButtonLabel,
  hasPreparedReviewWorkspaceData,
  getPrimaryExtractionWarning,
  getReviewPhaseForDisplay,
  getReviewStatusLabel
} from "./reviewWorkflow.js";
import type { ReviewResponse } from "@client-review-prep/shared";

describe("review workflow labels", () => {
  it("starts with ready-state labels", () => {
    expect(getReviewStatusLabel("ready")).toBe("Ready to prepare");
    expect(getPrepareButtonLabel("ready")).toBe("Prepare Client Review");
  });

  it("keeps active preparation distinct from ready state", () => {
    expect(getReviewStatusLabel("preparing")).toBe("Preparation in progress");
    expect(getPrepareButtonLabel("preparing")).toBe("Preparing review...");
  });

  it("uses completed review copy after preparation finishes", () => {
    expect(getReviewStatusLabel("prepared")).toBe("Ready for adviser review");
    expect(getPrepareButtonLabel("prepared")).toBe("Re-run Preparation");
  });

  it("uses the ReviewResponse status as display source of truth outside preparation", () => {
    expect(
      getReviewPhaseForDisplay("ready", "Ready for adviser review")
    ).toBe("prepared");
    expect(
      getReviewPhaseForDisplay("prepared", "Preparation in progress")
    ).toBe("ready");
  });

  it("uses prepared workspace data when status still reads in progress", () => {
    expect(
      getReviewPhaseForDisplay("ready", "Preparation in progress", true)
    ).toBe("prepared");
  });

  it("preserves the preparing phase while a preparation mutation is in flight", () => {
    expect(
      getReviewPhaseForDisplay("preparing", "Ready for adviser review")
    ).toBe("preparing");
  });

  it("detects prepared workspace data from supported ReviewResponse content", () => {
    const baseReview = {
      client: {
        id: "demo-alex-taylor",
        name: "Alex Taylor",
        adviserName: "Jordan Lee",
        reviewYear: 2026,
        reviewStatus: "Preparation in progress"
      },
      summaryMetrics: [],
      sourceRecords: [],
      clientFacts: [],
      meaningfulChanges: [],
      adviserActions: [],
      workflowTrace: []
    } satisfies ReviewResponse;

    expect(hasPreparedReviewWorkspaceData(baseReview)).toBe(false);
    expect(
      hasPreparedReviewWorkspaceData({
        ...baseReview,
        adviserActions: [
          {
            id: "confirm-address",
            factId: "fact-address",
            title: "Confirm address",
            detail: "Confirm the address candidate.",
            status: "Needs confirmation",
            lifecycleStatus: "NEEDS_CONFIRMATION",
            primaryDecision: "CONFIRM",
            secondaryDecision: "LEAVE_UNVERIFIED",
            primaryLabel: "Confirm",
            secondaryLabel: "Leave unverified",
            latestDecision: null,
            decisionHistory: []
          }
        ]
      })
    ).toBe(true);
    expect(
      hasPreparedReviewWorkspaceData({
        ...baseReview,
        workflowTrace: [
          {
            label: "Prepared review",
            status: "COMPLETE",
            detail: null
          }
        ]
      })
    ).toBe(true);
  });

  it("surfaces the first extraction warning without inventing candidate copy", () => {
    expect(
      getPrimaryExtractionWarning([
        "RISK_PROFILE candidate omitted: conflicting evidence also supports the current official value",
        "Secondary diagnostic"
      ])
    ).toBe(
      "RISK_PROFILE candidate omitted: conflicting evidence also supports the current official value"
    );
    expect(getPrimaryExtractionWarning([])).toBeNull();
    expect(getPrimaryExtractionWarning(null)).toBeNull();
  });
});
