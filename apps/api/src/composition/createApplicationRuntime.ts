import { createAgentRuntime } from "../agent/createAgentRuntime.js";
import { loadAiConfig } from "../ai/config/aiConfig.js";
import { createCandidateFactExtractor } from "../ai/providers/createCandidateFactExtractor.js";
import { prisma } from "../db/prisma.js";
import { createReviewService } from "../services/reviewService.js";
import type { ReviewRouteDependencies } from "../routes/reviewRoutes.js";
import { ClientOperationCoordinator } from "../services/clientOperationCoordinator.js";

export type ApplicationRuntime = {
  reviewRoutes: ReviewRouteDependencies;
};

export const createApplicationRuntime = (): ApplicationRuntime => {
  const clientOperations = new ClientOperationCoordinator();
  const reviewService = createReviewService(prisma, clientOperations);
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
      harness,
      clientOperations
    }
  };
};
