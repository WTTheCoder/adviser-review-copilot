import {
  decisionMutationResultSchema,
  reviewResponseSchema,
  type ReviewResponse
} from "@client-review-prep/shared";

export type ParsedDecisionResponse =
  | {
      kind: "review";
      review: ReviewResponse;
    }
  | {
      kind: "refreshRequired";
      message: string;
    };

export const parseDecisionResponse = (payload: unknown): ParsedDecisionResponse => {
  const review = reviewResponseSchema.safeParse(payload);
  if (review.success) {
    return {
      kind: "review",
      review: review.data
    };
  }

  const decisionResult = decisionMutationResultSchema.parse(payload);
  if (decisionResult.refreshRequired) {
    return {
      kind: "refreshRequired",
      message: decisionResult.message
    };
  }

  return {
    kind: "review",
    review: decisionResult.review
  };
};
