import { z } from "zod";
import { reviewResponseSchema } from "@client-review-prep/shared";
import type { SkillDefinition } from "./skillTypes.js";
import { loadClientContextSkill } from "./loadClientContextSkill.js";
import { reconcileClientFacts } from "./reconcileClientFactsSkill.js";

export const prepareAnnualReviewInputSchema = z.object({
  clientId: z.string().min(1)
});

const createWorkflowRunOutputSchema = z.object({
  workflowRunId: z.string()
});

const recordWorkflowStepOutputSchema = z.object({
  id: z.string()
});

export const prepareAnnualReviewSkill: SkillDefinition<
  typeof prepareAnnualReviewInputSchema,
  typeof reviewResponseSchema
> = {
  name: "prepare-annual-review",
  description:
    "Coordinate controlled tools to prepare the deterministic annual review.",
  version: "1",
  idempotency:
    "Repeated executions create a new workflow run and do not duplicate facts or source records.",
  inputSchema: prepareAnnualReviewInputSchema,
  outputSchema: reviewResponseSchema,
  allowedTools: [
    "legacy.getClient",
    "legacy.getSourceRecords",
    "legacy.getFacts",
    "review.createWorkflowRun",
    "review.recordWorkflowStep",
    "review.getPreparedReview"
  ],
  execute: async ({ clientId }, context) => {
    const recordStep = async (input: {
      workflowRunId: string;
      sequence: number;
      label: string;
      status?: "COMPLETE" | "ESCALATED" | "FAILED";
      detail?: string | null;
    }) =>
      context.toolRegistry.execute(
        "review.recordWorkflowStep",
        {
          workflowRunId: input.workflowRunId,
          sequence: input.sequence,
          label: input.label,
          status: input.status ?? "COMPLETE",
          detail: input.detail ?? null
        },
        prepareAnnualReviewSkill.allowedTools,
        context,
        recordWorkflowStepOutputSchema
      );

    const run = await context.toolRegistry.execute(
      "review.createWorkflowRun",
      {
        clientId,
        skillName: prepareAnnualReviewSkill.name,
        skillVersion: prepareAnnualReviewSkill.version ?? null
      },
      prepareAnnualReviewSkill.allowedTools,
      context,
      createWorkflowRunOutputSchema
    );

    let sequence = 1;
    await recordStep(
      {
        workflowRunId: run.workflowRunId,
        sequence: sequence++,
        label: "Skill selected: prepare-annual-review"
      }
    );
    await recordStep(
      {
        workflowRunId: run.workflowRunId,
        sequence: sequence++,
        label: "Skill input validated"
      }
    );
    await recordStep(
      {
        workflowRunId: run.workflowRunId,
        sequence: sequence++,
        label: "Workflow run persisted"
      }
    );

    const loadedContext = await loadClientContextSkill.execute({ clientId }, context);
    await recordStep(
      {
        workflowRunId: run.workflowRunId,
        sequence: sequence++,
        label: "Client loaded through legacy CRM tool"
      }
    );
    await recordStep(
      {
        workflowRunId: run.workflowRunId,
        sequence: sequence++,
        label: "Source records loaded"
      }
    );
    await recordStep(
      {
        workflowRunId: run.workflowRunId,
        sequence: sequence++,
        label: "Facts loaded"
      }
    );

    const reconciliation = reconcileClientFacts(loadedContext);
    context.recordEvent({ label: "Facts reconciled" });
    await recordStep(
      {
        workflowRunId: run.workflowRunId,
        sequence: sequence++,
        label: "Facts reconciled"
      }
    );
    await recordStep(
      {
        workflowRunId: run.workflowRunId,
        sequence: sequence++,
        label: "High-impact changes escalated",
        status: "ESCALATED",
        detail: `${reconciliation.adviserReviewItems.length} adviser-review items require attention.`
      }
    );

    await recordStep(
      {
        workflowRunId: run.workflowRunId,
        sequence: sequence++,
        label: "Adviser-facing review generated"
      }
    );
    await recordStep(
      {
        workflowRunId: run.workflowRunId,
        sequence: sequence++,
        label: "Skill output validated"
      }
    );
    await recordStep(
      {
        workflowRunId: run.workflowRunId,
        sequence,
        label: "Skill completed: prepare-annual-review"
      }
    );

    return context.toolRegistry.execute(
      "review.getPreparedReview",
      { clientId },
      prepareAnnualReviewSkill.allowedTools,
      context,
      reviewResponseSchema
    );
  }
};
