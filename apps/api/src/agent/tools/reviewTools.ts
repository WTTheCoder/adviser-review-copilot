import { z } from "zod";
import {
  adviserDecisionPayloadSchema,
  documentUploadResultSchema,
  reviewResponseSchema
} from "@client-review-prep/shared";
import { calendarDateSchema } from "../../ai/contracts/calendarDateSchema.js";
import type { ToolDefinition } from "./toolTypes.js";
import type { createReviewService } from "../../services/reviewService.js";

export type ReviewToolService = Pick<
  ReturnType<typeof createReviewService>,
  | "createWorkflowRun"
  | "recordWorkflowStep"
  | "applyExtractedCandidateProjection"
  | "createUploadedSourceRecord"
  | "buildReviewResponse"
  | "recordDecision"
>;

const createWorkflowRunInputSchema = z.object({
  clientId: z.string().min(1),
  skillName: z.string().min(1),
  skillVersion: z.string().nullable()
});

const createWorkflowRunOutputSchema = z.object({
  workflowRunId: z.string()
});

const recordWorkflowStepInputSchema = z.object({
  workflowRunId: z.string(),
  sequence: z.number().int().positive(),
  label: z.string().min(1),
  status: z.enum(["COMPLETE", "ESCALATED", "FAILED"]),
  detail: z.string().nullable().optional()
});

const recordWorkflowStepOutputSchema = z.object({
  id: z.string()
});

const getPreparedReviewInputSchema = z.object({
  clientId: z.string().min(1)
});

const extractedCandidateProjectionSchema = z.object({
  field: z.enum([
    "ADDRESS",
    "RISK_PROFILE",
    "FINANCIAL_GOAL",
    "EMPLOYMENT",
    "ANNUAL_INCOME",
    "SUPERANNUATION"
  ]),
  proposedValue: z.string().min(1).max(160),
  applicationStatus: z.enum([
    "NEEDS_CONFIRMATION",
    "REQUIRES_ADVISER_APPROVAL",
    "CANDIDATE_REVIEW"
  ]),
  sourceRecordId: z.string().min(1).max(80),
  observedDate: calendarDateSchema
});

const applyExtractedCandidateProjectionInputSchema = z.object({
  clientId: z.string().min(1),
  candidates: z.array(extractedCandidateProjectionSchema).max(10)
});

const applyExtractedCandidateProjectionOutputSchema = z.object({
  applied: z.boolean()
});

const applyDecisionInputSchema = z.object({
  clientId: z.string().min(1),
  factId: z.string().min(1),
  payload: adviserDecisionPayloadSchema
});

const createUploadedSourceRecordInputSchema = z
  .object({
    clientId: z.string().min(1).max(80),
    observedDate: calendarDateSchema,
    sourceType: z.literal("ADVISER_MEETING_NOTE"),
    safeFilename: z.string().min(1).max(120),
    mediaType: z.string().min(1).max(120),
    text: z.string().min(1),
    characterCount: z.number().int().positive(),
    byteCount: z.number().int().positive()
  })
  .strict();

export const createReviewTools = (
  reviewService: ReviewToolService
) => {
  const createWorkflowRun: ToolDefinition<
    typeof createWorkflowRunInputSchema,
    typeof createWorkflowRunOutputSchema
  > = {
    name: "review.createWorkflowRun",
    description: "Create a persisted workflow run for a controlled skill execution.",
    inputSchema: createWorkflowRunInputSchema,
    outputSchema: createWorkflowRunOutputSchema,
    risk: "MEDIUM",
    execute: async ({ clientId, skillName, skillVersion }, context) => {
      const run = await reviewService.createWorkflowRun(
        clientId,
        skillName,
        skillVersion
      );
      context.recordEvent({
        label: "Workflow run persisted",
        detail: `Skill ${skillName}${skillVersion ? ` v${skillVersion}` : ""}`
      });
      return { workflowRunId: run.id };
    }
  };

  const recordWorkflowStep: ToolDefinition<
    typeof recordWorkflowStepInputSchema,
    typeof recordWorkflowStepOutputSchema
  > = {
    name: "review.recordWorkflowStep",
    description: "Persist an ordered workflow/audit step for the current run.",
    inputSchema: recordWorkflowStepInputSchema,
    outputSchema: recordWorkflowStepOutputSchema,
    risk: "LOW",
    execute: async (input) =>
      reviewService.recordWorkflowStep({
        workflowRunId: input.workflowRunId,
        sequence: input.sequence,
        label: input.label,
        status: input.status,
        detail: input.detail ?? null
      })
  };

  const getPreparedReview: ToolDefinition<
    typeof getPreparedReviewInputSchema,
    typeof reviewResponseSchema
  > = {
    name: "review.getPreparedReview",
    description: "Read the adviser-facing prepared review response.",
    inputSchema: getPreparedReviewInputSchema,
    outputSchema: reviewResponseSchema,
    risk: "LOW",
    execute: async ({ clientId }) => reviewService.buildReviewResponse(clientId)
  };

  const applyExtractedCandidateProjection: ToolDefinition<
    typeof applyExtractedCandidateProjectionInputSchema,
    typeof applyExtractedCandidateProjectionOutputSchema
  > = {
    name: "review.applyExtractedCandidateProjection",
    description:
      "Replace the current preparation candidate projection using deterministic application rules.",
    inputSchema: applyExtractedCandidateProjectionInputSchema,
    outputSchema: applyExtractedCandidateProjectionOutputSchema,
    risk: "MEDIUM",
    execute: async ({ clientId, candidates }) => {
      await reviewService.applyExtractedCandidateProjection(clientId, candidates);
      return { applied: true };
    }
  };

  const applyDecision: ToolDefinition<
    typeof applyDecisionInputSchema,
    typeof reviewResponseSchema
  > = {
    name: "review.applyDecision",
    description: "Persist an adviser decision using deterministic domain rules.",
    inputSchema: applyDecisionInputSchema,
    outputSchema: reviewResponseSchema,
    risk: "HIGH",
    execute: async ({ clientId, factId, payload }) =>
      reviewService.recordDecision(clientId, factId, payload)
  };

  const createUploadedSourceRecord: ToolDefinition<
    typeof createUploadedSourceRecordInputSchema,
    typeof documentUploadResultSchema
  > = {
    name: "review.createUploadedSourceRecord",
    description: "Persist a validated text upload as a source record.",
    inputSchema: createUploadedSourceRecordInputSchema,
    outputSchema: documentUploadResultSchema,
    risk: "MEDIUM",
    execute: async (input) => reviewService.createUploadedSourceRecord(input)
  };

  return [
    createWorkflowRun,
    recordWorkflowStep,
    applyExtractedCandidateProjection,
    createUploadedSourceRecord,
    getPreparedReview,
    applyDecision
  ] as const;
};
