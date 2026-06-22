import { describe, expect, it } from "vitest";
import { demoClientReview } from "../data/demoReview.js";
import {
  createInitialReviewWorkflow,
  getPrepareButtonLabel,
  getReviewStatusLabel,
  markReviewPrepared,
  startReviewPreparation,
  updateActionDecision
} from "./reviewWorkflow.js";

describe("review workflow", () => {
  it("starts in a ready state", () => {
    expect(createInitialReviewWorkflow().phase).toBe("ready");
  });

  it("preparing the review reveals the summary results", () => {
    const prepared = markReviewPrepared(
      startReviewPreparation(createInitialReviewWorkflow())
    );

    expect(prepared.phase).toBe("prepared");
    expect(demoClientReview.summaryMetrics).toEqual([
      { value: "12", label: "Facts reviewed" },
      { value: "4", label: "Meaningful changes" },
      { value: "2", label: "Items needing confirmation" }
    ]);
  });

  it("uses completed review copy after preparation finishes", () => {
    const prepared = markReviewPrepared(createInitialReviewWorkflow());

    expect(getReviewStatusLabel(prepared.phase)).toBe("Ready for adviser review");
    expect(getPrepareButtonLabel(prepared.phase)).toBe("Re-run Preparation");
  });

  it("keeps high-impact facts review-required before local approval", () => {
    const riskProfile = demoClientReview.clientFacts.find(
      (fact) => fact.id === "risk-profile"
    );

    expect(riskProfile?.status).toBe("Requires adviser approval");
  });

  it("stores adviser action decisions in local workflow state", () => {
    const workflow = updateActionDecision(
      createInitialReviewWorkflow(),
      "review-risk-profile",
      "approved"
    );

    expect(workflow.actionDecisions["review-risk-profile"]).toBe("approved");
    expect(workflow.actionDecisions["confirm-address"]).toBe("pending");
  });
});
