import { createLegacyCrmAdapter } from "../legacy/legacyCrmAdapter.js";
import type { createReviewService } from "../services/reviewService.js";
import { ExecutionHarness } from "./harness/executionHarness.js";
import { SkillRegistry } from "./registry/skillRegistry.js";
import { applyAdviserDecisionSkill } from "./skills/applyAdviserDecisionSkill.js";
import { loadClientContextSkill } from "./skills/loadClientContextSkill.js";
import { prepareAnnualReviewSkill } from "./skills/prepareAnnualReviewSkill.js";
import { reconcileClientFactsSkill } from "./skills/reconcileClientFactsSkill.js";
import { createLegacyCrmTools } from "./tools/legacyCrmTools.js";
import { createReviewTools } from "./tools/reviewTools.js";
import { createAiExtractionTools } from "./tools/aiExtractionTools.js";
import { ToolRegistry } from "./tools/toolRegistry.js";
import type { PrismaClient } from "@prisma/client";
import type { CandidateFactExtractor } from "../ai/contracts/candidateFactExtractor.js";
import { MockCandidateFactExtractor } from "../ai/providers/mockCandidateFactExtractor.js";

export const createAgentRuntime = (
  prisma: PrismaClient,
  reviewService: ReturnType<typeof createReviewService>,
  candidateFactExtractor: CandidateFactExtractor = new MockCandidateFactExtractor()
) => {
  const skillRegistry = new SkillRegistry();
  const toolRegistry = new ToolRegistry();

  for (const skill of [
    loadClientContextSkill,
    reconcileClientFactsSkill,
    prepareAnnualReviewSkill,
    applyAdviserDecisionSkill
  ]) {
    skillRegistry.register(skill);
  }

  const legacyAdapter = createLegacyCrmAdapter(prisma);
  for (const tool of [
    ...createLegacyCrmTools(legacyAdapter),
    ...createReviewTools(reviewService),
    ...createAiExtractionTools(candidateFactExtractor)
  ]) {
    toolRegistry.register(tool);
  }

  return {
    harness: new ExecutionHarness(skillRegistry, toolRegistry),
    skillRegistry,
    toolRegistry
  };
};
