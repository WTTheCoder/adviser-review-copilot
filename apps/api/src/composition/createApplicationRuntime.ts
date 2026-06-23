import { createAgentRuntime } from "../agent/createAgentRuntime.js";
import { loadAiConfig } from "../ai/config/aiConfig.js";
import { createCandidateFactExtractor } from "../ai/providers/createCandidateFactExtractor.js";
import { prisma } from "../db/prisma.js";
import { createReviewService } from "../services/reviewService.js";
import type { ReviewRouteDependencies } from "../routes/reviewRoutes.js";

export type ApplicationRuntime = {
  reviewRoutes: ReviewRouteDependencies;
};

export const createApplicationRuntime = (): ApplicationRuntime => {
  const reviewService = createReviewService(prisma);
  const aiConfig = loadAiConfig();
  const candidateFactExtractor = createCandidateFactExtractor(aiConfig);
  const { harness } = createAgentRuntime(
    prisma,
    reviewService,
    candidateFactExtractor
  );

  return {
    reviewRoutes: {
      reviewService,
      harness
    }
  };
};
