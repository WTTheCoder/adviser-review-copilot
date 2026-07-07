import type { ClientReviewData, ClientFact } from "../types/demo.js";

export const adviserViews = ["dashboard", "my-actions", "client-review"] as const;

export type AdviserView = (typeof adviserViews)[number];

export type ClientReviewOpenState = {
  activeView: Extract<AdviserView, "client-review">;
  selectedFact: ClientFact | null;
};

export const openClientReviewState = (
  review: ClientReviewData | null,
  factId?: string
): ClientReviewOpenState => ({
  activeView: "client-review",
  selectedFact:
    factId && review
      ? review.clientFacts.find((fact) => fact.id === factId) ?? null
      : null
});
