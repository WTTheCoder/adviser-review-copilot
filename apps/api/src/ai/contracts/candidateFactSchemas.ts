import { z } from "zod";
import { calendarDateSchema } from "./calendarDateSchema.js";

export const supportedCandidateFieldSchema = z.enum([
  "ADDRESS",
  "RISK_PROFILE",
  "FINANCIAL_GOAL",
  "EMPLOYMENT",
  "ANNUAL_INCOME",
  "SUPERANNUATION"
]).describe("Supported candidate fact field. This is not a lifecycle status or official-state mutation.");

export const candidateFactConfidenceSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const candidateFactSchema = z
  .object({
    field: supportedCandidateFieldSchema,
    proposedValue: z.string().trim().min(1).max(160).describe(
      "Evidence-backed proposed candidate value. It is not verified, approved, adopted, or official."
    ),
    confidence: candidateFactConfidenceSchema.describe(
      "Confidence in the source evidence for extraction, not suitability for automatic use."
    ),
    evidence: z.string().trim().min(1).max(240).describe(
      "Short quote or paraphrase from the source text supporting the candidate, preserving uncertainty."
    ),
    sourceRecordId: z.string().trim().min(1).max(80),
    observedDate: calendarDateSchema,
    requiresHumanReview: z.boolean().describe(
      "True when the candidate is uncertain, unverified, high impact, or otherwise needs adviser review."
    ),
    reason: z.string().trim().max(240).nullable().optional().describe(
      "Optional extraction rationale. Do not use this to set lifecycle status or official state."
    )
  })
  .strict();

const modelCandidateFactSchema = candidateFactSchema.extend({
  reason: z.string().trim().max(240).nullable()
});

export const candidateFactExtractionResultSchema = z
  .object({
    providerMode: z.enum(["mock", "openai"]),
    model: z.string().trim().min(1).max(120).nullable(),
    candidateFacts: z.array(candidateFactSchema).max(10),
    warnings: z.array(z.string().trim().min(1).max(240)).max(5),
    metadata: z
      .object({
        durationMs: z.number().int().nonnegative(),
        sourceTextLength: z.number().int().nonnegative(),
        candidateCount: z.number().int().nonnegative().max(10)
      })
      .strict()
  })
  .strict();

export const modelCandidateFactExtractionSchema = z
  .object({
    candidateFacts: z.array(modelCandidateFactSchema).max(10),
    warnings: z.array(z.string().trim().min(1).max(240)).max(5)
  })
  .strict();

export type SupportedCandidateField = z.infer<
  typeof supportedCandidateFieldSchema
>;
export type CandidateFact = z.infer<typeof candidateFactSchema>;
export type CandidateFactExtractionResult = z.infer<
  typeof candidateFactExtractionResultSchema
>;

export const MAX_MEETING_NOTE_CHARS = 4000;
export const MAX_CANDIDATE_FACTS = 10;
export const MAX_EVIDENCE_CHARS = 240;
export const MAX_PROPOSED_VALUE_CHARS = 160;
