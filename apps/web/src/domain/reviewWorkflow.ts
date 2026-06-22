import type { ActionDecision, AdviserActionId } from "../types/demo.js";

export type ReviewPhase = "ready" | "preparing" | "prepared";

export type ReviewWorkflowState = {
  phase: ReviewPhase;
  actionDecisions: Record<AdviserActionId, ActionDecision>;
};

export const createInitialReviewWorkflow = (): ReviewWorkflowState => ({
  phase: "ready",
  actionDecisions: {
    "confirm-address": "pending",
    "review-risk-profile": "pending"
  }
});

export const startReviewPreparation = (
  workflow: ReviewWorkflowState
): ReviewWorkflowState => ({
  ...workflow,
  phase: "preparing"
});

export const markReviewPrepared = (
  workflow: ReviewWorkflowState
): ReviewWorkflowState => ({
  ...workflow,
  phase: "prepared"
});

export const getReviewStatusLabel = (phase: ReviewPhase): string =>
  phase === "prepared" ? "Ready for adviser review" : "Preparation in progress";

export const getPrepareButtonLabel = (phase: ReviewPhase): string => {
  if (phase === "preparing") {
    return "Preparing review...";
  }

  return phase === "prepared" ? "Re-run Preparation" : "Prepare Client Review";
};

export const updateActionDecision = (
  workflow: ReviewWorkflowState,
  actionId: AdviserActionId,
  decision: ActionDecision
): ReviewWorkflowState => ({
  ...workflow,
  actionDecisions: {
    ...workflow.actionDecisions,
    [actionId]: decision
  }
});
