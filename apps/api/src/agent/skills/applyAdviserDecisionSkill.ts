import { z } from "zod";
import {
  adviserDecisionPayloadSchema,
  reviewResponseSchema
} from "@client-review-prep/shared";
import type { SkillDefinition } from "./skillTypes.js";

export const applyAdviserDecisionInputSchema = z.object({
  clientId: z.string().min(1),
  factId: z.string().min(1),
  payload: adviserDecisionPayloadSchema
});

export const applyAdviserDecisionSkill: SkillDefinition<
  typeof applyAdviserDecisionInputSchema,
  typeof reviewResponseSchema
> = {
  name: "apply-adviser-decision",
  description:
    "Persist an adviser decision through controlled tools and existing domain rules.",
  version: "1",
  inputSchema: applyAdviserDecisionInputSchema,
  outputSchema: reviewResponseSchema,
  allowedTools: [
    "review.applyDecision"
  ],
  execute: async ({ clientId, factId, payload }, context) => {
    return context.toolRegistry.execute(
      "review.applyDecision",
      { clientId, factId, payload },
      applyAdviserDecisionSkill.allowedTools,
      context,
      reviewResponseSchema
    );
  }
};
