import { z } from "zod";
import { reviewResponseSchema } from "@client-review-prep/shared";
import { candidateFactExtractionResultSchema } from "../../ai/contracts/candidateFactSchemas.js";
import { classifyCandidateFactsWithDiagnostics } from "../../ai/contracts/candidateFactReviewRules.js";
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

const supportedFields = [
  "ADDRESS",
  "RISK_PROFILE",
  "FINANCIAL_GOAL",
  "EMPLOYMENT",
  "ANNUAL_INCOME",
  "SUPERANNUATION"
] as const;

const extractionTraceLabel = (extraction: {
  providerMode: "mock" | "openai";
  model: string | null;
  warnings: readonly string[];
}) => {
  if (
    extraction.warnings.some((warning) =>
      warning.includes("Mock extraction was used")
    )
  ) {
    return "Extraction: Mock fallback";
  }

  return extraction.providerMode === "openai"
    ? `Extraction: OpenAI - ${extraction.model ?? "configured model"}`
    : "Extraction: Mock";
};

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
    "ai.extractCandidateFacts",
    "review.createWorkflowRun",
    "review.recordWorkflowStep",
    "review.applyExtractedCandidateProjection",
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

    const meetingNote = loadedContext.sourceRecords.find(
      (record) => record.type === "ADVISER_MEETING_NOTE"
    );
    const extraction = meetingNote
      ? await context.toolRegistry.execute(
          "ai.extractCandidateFacts",
          {
            clientId,
            clientDisplayName: loadedContext.client.name,
            sourceRecordId: meetingNote.id,
            sourceType: "ADVISER_MEETING_NOTE",
            observedDate: meetingNote.observedAt.slice(0, 10),
            meetingNoteText: meetingNote.content.join("\n"),
            supportedFields
          },
          prepareAnnualReviewSkill.allowedTools,
          context,
          candidateFactExtractionResultSchema
        )
      : candidateFactExtractionResultSchema.parse({
          providerMode: "mock",
          model: null,
          candidateFacts: [],
          warnings: ["No adviser meeting note was available for extraction."],
          metadata: {
            durationMs: 0,
            sourceTextLength: 0,
            candidateCount: 0
          }
        });
    await recordStep(
      {
        workflowRunId: run.workflowRunId,
        sequence: sequence++,
        label: "Candidate facts extracted through controlled model boundary",
        detail: `${extractionTraceLabel(extraction)}. ${extraction.candidateFacts.length} candidate facts.`
      }
    );
    await recordStep(
      {
        workflowRunId: run.workflowRunId,
        sequence: sequence++,
        label: "Validated structured extraction output"
      }
    );
    const classification = classifyCandidateFactsWithDiagnostics(
      extraction.candidateFacts
    );
    const classifiedCandidates = classification.classifications;
    if (classification.warnings.length > 0) {
      await recordStep(
        {
          workflowRunId: run.workflowRunId,
          sequence: sequence++,
          label: "Unsupported extracted candidates omitted",
          status: "ESCALATED",
          detail: classification.warnings.join(" ")
        }
      );
    }
    await context.toolRegistry.execute(
      "review.applyExtractedCandidateProjection",
      {
        clientId,
        candidates: classifiedCandidates.map((candidate) => ({
          field: candidate.field,
          proposedValue: candidate.proposedValue,
          applicationStatus: candidate.applicationStatus,
          sourceRecordId: candidate.sourceRecordId,
          observedDate: candidate.observedDate
        }))
      },
      prepareAnnualReviewSkill.allowedTools,
      context,
      z.object({ applied: z.boolean() })
    );
    context.recordEvent({
      label: "Application rules classified extracted candidates",
      detail: `${classifiedCandidates.length} candidates require deterministic review handling.`
    });

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

    const review = await context.toolRegistry.execute(
      "review.getPreparedReview",
      { clientId },
      prepareAnnualReviewSkill.allowedTools,
      context,
      reviewResponseSchema
    );

    return {
      ...review,
      extractionMetadata: {
        providerMode: extraction.providerMode,
        model: extraction.model,
        candidateCount: extraction.candidateFacts.length,
        warnings: extraction.warnings
      }
    };
  }
};
