export type ReviewPhase = "ready" | "preparing" | "prepared";

export const getReviewStatusLabel = (phase: ReviewPhase): string =>
  phase === "prepared" ? "Ready for adviser review" : "Preparation in progress";

export const getPrepareButtonLabel = (phase: ReviewPhase): string => {
  if (phase === "preparing") {
    return "Preparing review...";
  }

  return phase === "prepared" ? "Re-run Preparation" : "Prepare Client Review";
};

export const getPrimaryExtractionWarning = (
  warnings: readonly string[] | null | undefined
) => warnings?.[0] ?? null;
