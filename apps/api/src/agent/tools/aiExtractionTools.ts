import { z } from "zod";
import {
  candidateFactExtractionResultSchema,
  supportedCandidateFieldSchema
} from "../../ai/contracts/candidateFactSchemas.js";
import type {
  CandidateFactExtractionInput,
  CandidateFactExtractor
} from "../../ai/contracts/candidateFactExtractor.js";
import { MockCandidateFactExtractor } from "../../ai/providers/mockCandidateFactExtractor.js";
import { AiError, toSafeAiError } from "../../ai/errors/aiErrors.js";
import { calendarDateSchema } from "../../ai/contracts/calendarDateSchema.js";
import type { ToolDefinition } from "./toolTypes.js";

const extractionInputSchema = z
  .object({
    clientId: z.string().min(1),
    clientDisplayName: z.string().min(1),
    sourceRecordId: z.string().min(1),
    sourceType: z.enum(["ADVISER_MEETING_NOTE", "UPLOADED_PDF"]),
    observedDate: calendarDateSchema,
    meetingNoteText: z.string().min(1).max(4000),
    supportedFields: z.array(supportedCandidateFieldSchema).nonempty()
  })
  .strict();

const extractionOutputSchema = candidateFactExtractionResultSchema;

export const createAiExtractionTools = (
  extractor: CandidateFactExtractor,
  fallbackExtractor: CandidateFactExtractor = new MockCandidateFactExtractor()
) => {
  const extractCandidateFacts: ToolDefinition<
    typeof extractionInputSchema,
    typeof extractionOutputSchema
  > = {
    name: "ai.extractCandidateFacts",
    description:
      "Extract candidate facts from untrusted meeting-note text through the controlled model boundary.",
    inputSchema: extractionInputSchema,
    outputSchema: extractionOutputSchema,
    risk: "MEDIUM",
    execute: async (input: CandidateFactExtractionInput, context) => {
      try {
        const result = await extractor.extract(input);
        context.recordEvent({
          label: "Candidate facts extracted through model boundary",
          detail: `${result.providerMode} produced ${result.candidateFacts.length} candidate facts.`
        });
        return result;
      } catch (error) {
        const safeError = toSafeAiError(error);

        if (safeError.code === "AI_INPUT_TOO_LARGE") {
          throw new AiError("AI_INPUT_TOO_LARGE");
        }

        const fallback = await fallbackExtractor.extract(input);
        const result = candidateFactExtractionResultSchema.parse({
          ...fallback,
          warnings: [
            ...fallback.warnings,
            "OpenAI extraction was unavailable. Mock extraction was used."
          ]
        });
        context.recordEvent({
          label: "Candidate extraction fell back to mock provider",
          status: "ESCALATED",
          detail: safeError.code
        });
        return result;
      }
    }
  };

  return [extractCandidateFacts] as const;
};
