import { createAgentRuntime } from "../agent/createAgentRuntime.js";
import { prisma } from "../db/prisma.js";
import { createReviewService } from "../services/reviewService.js";
import type { ReviewRouteDependencies } from "../routes/reviewRoutes.js";

export type ApplicationRuntime = {
  reviewRoutes: ReviewRouteDependencies;
};

export const createApplicationRuntime = (): ApplicationRuntime => {
  const reviewService = createReviewService(prisma);
  const { harness } = createAgentRuntime(prisma, reviewService);

  return {
    reviewRoutes: {
      reviewService,
      harness
    }
  };
};
