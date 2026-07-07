import type { ClientReviewData, ClientFact } from "../types/demo.js";

export const adviserViews = ["dashboard", "my-actions", "client-review"] as const;

export type AdviserView = (typeof adviserViews)[number];

const viewHashes: Record<AdviserView, string> = {
  dashboard: "#overview",
  "my-actions": "#my-actions",
  "client-review": "#client-review"
};

const hashViews = new Map<string, AdviserView>(
  Object.entries(viewHashes).map(([view, hash]) => [hash, view as AdviserView])
);

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

export const hashForAdviserView = (view: AdviserView): string =>
  viewHashes[view];

export const adviserViewFromHash = (
  hash: string | null | undefined
): AdviserView => hashViews.get(hash ?? "") ?? "dashboard";

export const canonicalHashForAdviserHash = (
  hash: string | null | undefined
): string => hashForAdviserView(adviserViewFromHash(hash));
