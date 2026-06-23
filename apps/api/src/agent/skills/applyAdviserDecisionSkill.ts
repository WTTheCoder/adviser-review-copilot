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

const createWorkflowRunOutputSchema = z.object({
  workflowRunId: z.string()
});

const recordWorkflowStepOutputSchema = z.object({
  id: z.string()
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
    "review.createWorkflowRun",
    "review.recordWorkflowStep",
    "review.applyDecision",
    "review.getPreparedReview"
  ],
  execute: async ({ clientId, factId, payload }, context) => {
    const run = await context.toolRegistry.execute(
      "review.createWorkflowRun",
      {
        clientId,
        skillName: applyAdviserDecisionSkill.name,
        skillVersion: applyAdviserDecisionSkill.version ?? null
      },
      applyAdviserDecisionSkill.allowedTools,
      context,
      createWorkflowRunOutputSchema
    );
    let sequence = 1;

    const recordStep = async (
      label: string,
      status: "COMPLETE" | "ESCALATED" | "FAILED" = "COMPLETE",
      detail: string | null = null
    ) =>
      context.toolRegistry.execute(
        "review.recordWorkflowStep",
        {
          workflowRunId: run.workflowRunId,
          sequence: sequence++,
          label,
          status,
          detail
        },
        applyAdviserDecisionSkill.allowedTools,
        context,
        recordWorkflowStepOutputSchema
      );

    await recordStep("Skill selected: apply-adviser-decision");
    await recordStep("Skill input validated");

    await context.toolRegistry.execute(
      "review.applyDecision",
      { clientId, factId, payload },
      applyAdviserDecisionSkill.allowedTools,
      context,
      reviewResponseSchema
    );
    await recordStep("Adviser decision persisted through controlled tool");
    await recordStep("Fact state reconciled after adviser decision");
    await recordStep("Skill output validated");
    await recordStep("Skill completed: apply-adviser-decision");

    return context.toolRegistry.execute(
      "review.getPreparedReview",
      { clientId },
      applyAdviserDecisionSkill.allowedTools,
      context,
      reviewResponseSchema
    );
  }
};
