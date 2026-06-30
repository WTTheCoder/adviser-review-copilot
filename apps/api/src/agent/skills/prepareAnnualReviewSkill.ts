import { z } from "zod";
import { reviewResponseSchema } from "@client-review-prep/shared";
import {
  candidateFactExtractionResultSchema,
  MAX_MEETING_NOTE_CHARS
} from "../../ai/contracts/candidateFactSchemas.js";
import {
  attachTrustedCandidateProvenance,
  reconcileCandidateFactsWithDiagnostics
} from "../../ai/contracts/candidateFactReviewRules.js";
import type { SkillDefinition } from "./skillTypes.js";
import { loadClientContextSkill } from "./loadClientContextSkill.js";
import { reconcileClientFacts } from "./reconcileClientFactsSkill.js";
import { selectRelevantSources } from "../../services/sourceRetrievalPolicy.js";

export const prepareAnnualReviewInputSchema = z.object({
  clientId: z.string().min(1)
});

const mutationEpochOutputSchema = z.object({
  mutationEpoch: z.number().int().nonnegative()
});

const supportedFields = [
  "ADDRESS",
  "RISK_PROFILE",
  "FINANCIAL_GOAL",
  "EMPLOYMENT",
  "ANNUAL_INCOME",
  "SUPERANNUATION"
] as const;

const supportedFieldForFact = (fact: {
  id: string;
  field: string;
}): (typeof supportedFields)[number] | null => {
  if (fact.id === "fact-address" || fact.field === "Address") {
    return "ADDRESS";
  }

  if (fact.id === "fact-risk-profile" || fact.field === "Risk profile") {
    return "RISK_PROFILE";
  }

  if (fact.field === "Financial goal") {
    return "FINANCIAL_GOAL";
  }

  if (fact.field === "Employment") {
    return "EMPLOYMENT";
  }

  if (fact.field === "Annual income") {
    return "ANNUAL_INCOME";
  }

  if (fact.field === "Superannuation") {
    return "SUPERANNUATION";
  }

  return null;
};

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

const sourceTypeFor = (source: {
  upload?: { mediaType: string } | null | undefined;
}) =>
  source.upload?.mediaType === "application/pdf"
    ? "UPLOADED_PDF"
    : "ADVISER_MEETING_NOTE";

const retrievalTraceDetail = (
  consideredCount: number,
  selectedSources: ReturnType<typeof selectRelevantSources>
) => {
  const selected = selectedSources
    .map(
      (item) =>
        `${item.source.id} (${item.relevantFields.join(", ")}; ${item.reasons.join("; ")})`
    )
    .join(" | ");
  const fallbackUsed = selectedSources.some((source) => source.fallback);

  return [
    `Considered ${consideredCount} source records.`,
    `Selected ${selectedSources.length}${selected ? `: ${selected}` : "."}`,
    fallbackUsed ? "Fallback source selection used." : "Deterministic field hints matched."
  ].join(" ");
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
    "review.captureClientMutationEpoch",
    "review.commitPreparedReview"
  ],
  execute: async ({ clientId }, context) => {
    const preparedWorkflowSteps: Array<{
      label: string;
      status: "COMPLETE" | "ESCALATED" | "FAILED";
      detail: string | null;
    }> = [];
    const recordStep = async (input: {
      workflowRunId: string;
      sequence: number;
      label: string;
      status?: "COMPLETE" | "ESCALATED" | "FAILED";
      detail?: string | null;
    }) => {
      preparedWorkflowSteps.push({
        label: input.label,
        status: input.status ?? "COMPLETE",
        detail: input.detail ?? null
      });
    };

    const epoch = await context.toolRegistry.execute(
      "review.captureClientMutationEpoch",
      {
        clientId
      },
      prepareAnnualReviewSkill.allowedTools,
      context,
      mutationEpochOutputSchema
    );
    const run = { workflowRunId: "pending-atomic-commit" };

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

    const selectedSources = selectRelevantSources(
      loadedContext.sourceRecords,
      supportedFields
    );
    const retrievalDetail = retrievalTraceDetail(
      loadedContext.sourceRecords.length,
      selectedSources
    );
    context.recordEvent({
      label: "Bounded source context retrieved",
      detail: retrievalDetail
    });
    await recordStep(
      {
        workflowRunId: run.workflowRunId,
        sequence: sequence++,
        label: "Bounded source context retrieved",
        detail: retrievalDetail
      }
    );

    const extractionResults = await Promise.all(
      selectedSources.map(async (selected) => {
        const sourceText = selected.source.content
          .join("\n")
          .slice(0, MAX_MEETING_NOTE_CHARS);

        if (sourceText.length === 0) {
          return {
            selected,
            extraction: candidateFactExtractionResultSchema.parse({
              providerMode: "mock",
              model: null,
              candidateFacts: [],
              warnings: [`Selected source ${selected.source.id} had no extractable text.`],
              metadata: {
                durationMs: 0,
                sourceTextLength: 0,
                candidateCount: 0
              }
            })
          };
        }

        return {
          selected,
          extraction: await context.toolRegistry.execute(
            "ai.extractCandidateFacts",
            {
              clientId,
              clientDisplayName: loadedContext.client.name,
              sourceRecordId: selected.source.id,
              sourceType: sourceTypeFor(selected.source),
              observedDate: selected.source.observedAt.slice(0, 10),
              meetingNoteText: sourceText,
              supportedFields: selected.relevantFields
            },
            prepareAnnualReviewSkill.allowedTools,
            context,
            candidateFactExtractionResultSchema
          )
        };
      })
    );
    const extractionWarnings =
      extractionResults.length > 0
        ? extractionResults.flatMap((result) => result.extraction.warnings)
        : ["No relevant source was available for extraction."];
    const extractedCandidateCount = extractionResults.reduce(
      (total, result) => total + result.extraction.candidateFacts.length,
      0
    );
    const providerMode: "mock" | "openai" = extractionResults.some(
      (result) => result.extraction.providerMode === "openai"
    )
      ? "openai"
      : "mock";
    const extraction = {
      providerMode,
      model:
        extractionResults.find((result) => result.extraction.model !== null)
          ?.extraction.model ?? null,
      warnings: extractionWarnings,
      candidateFacts: extractionResults.flatMap(
        (result) => result.extraction.candidateFacts
      )
    };
    await recordStep(
      {
        workflowRunId: run.workflowRunId,
        sequence: sequence++,
        label: "Candidate facts extracted through controlled model boundary",
        detail: `${extractionTraceLabel(extraction)}. ${selectedSources.length} source(s), ${extractedCandidateCount} candidate facts.`
      }
    );
    await recordStep(
      {
        workflowRunId: run.workflowRunId,
        sequence: sequence++,
        label: "Validated structured extraction output"
      }
    );
    const trustedCandidates = extractionResults.flatMap((result) =>
      attachTrustedCandidateProvenance(result.extraction.candidateFacts, {
        sourceRecordId: result.selected.source.id,
        observedDate: result.selected.source.observedAt.slice(0, 10)
      })
    );
    const classification = reconcileCandidateFactsWithDiagnostics(
      trustedCandidates,
      loadedContext.existingFacts.flatMap((fact) => {
        const field = supportedFieldForFact(fact);

        return field
          ? [
              {
                field,
                officialValue: fact.officialValue,
                officialObservedAt: fact.officialObservedAt
              }
            ]
          : [];
      })
    );
    const classifiedCandidates = classification.classifications;
    if (classification.warnings.length > 0) {
      await recordStep(
        {
          workflowRunId: run.workflowRunId,
          sequence: sequence++,
          label: "Extracted candidates reconciled with official facts",
          status: "ESCALATED",
          detail: classification.warnings.join(" ")
        }
      );
    }
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
      "review.commitPreparedReview",
      {
        clientId,
        expectedMutationEpoch: epoch.mutationEpoch,
        skillName: prepareAnnualReviewSkill.name,
        skillVersion: prepareAnnualReviewSkill.version ?? null,
        candidates: classifiedCandidates.map((candidate) => ({
          field: candidate.field,
          proposedValue: candidate.proposedValue,
          evidence: candidate.evidence,
          applicationStatus: candidate.applicationStatus,
          sourceRecordId: candidate.sourceRecordId,
          observedDate: candidate.observedDate
        })),
        workflowSteps: preparedWorkflowSteps
      },
      prepareAnnualReviewSkill.allowedTools,
      context,
      reviewResponseSchema
    );

    return {
      ...review,
      extractionMetadata: {
        providerMode: extraction.providerMode,
        model: extraction.model,
        candidateCount: extractedCandidateCount,
        warnings: [...extraction.warnings, ...classification.warnings]
      }
    };
  }
};
