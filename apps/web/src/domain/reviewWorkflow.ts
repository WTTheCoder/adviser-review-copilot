import type { ReviewResponse } from "@client-review-prep/shared";

export type ReviewPhase = "ready" | "preparing" | "prepared";

export const getReviewStatusLabel = (phase: ReviewPhase): string =>
  phase === "prepared"
    ? "Ready for adviser review"
    : phase === "preparing"
      ? "Preparation in progress"
      : "Ready to prepare";

export const getReviewPhaseForDisplay = (
  phase: ReviewPhase,
  reviewStatus: string | null | undefined,
  hasPreparedWorkspaceData = false
): ReviewPhase => {
  if (phase === "preparing") {
    return "preparing";
  }

  return reviewStatus === "Ready for adviser review" || hasPreparedWorkspaceData
    ? "prepared"
    : "ready";
};

export const hasPreparedReviewWorkspaceData = (
  review: ReviewResponse | null
): boolean =>
  review !== null &&
  (review.adviserActions.length > 0 ||
    review.workflowTrace.length > 0 ||
    review.executionMetadata !== undefined);

export const getPrepareButtonLabel = (phase: ReviewPhase): string => {
  if (phase === "preparing") {
    return "Preparing review...";
  }

  return phase === "prepared" ? "Re-run Preparation" : "Prepare Client Review";
};

export const getPrimaryExtractionWarning = (
  warnings: readonly string[] | null | undefined
) => warnings?.[0] ?? null;
