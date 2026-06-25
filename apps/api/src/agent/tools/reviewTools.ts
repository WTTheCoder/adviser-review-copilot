import { z } from "zod";
import {
  adviserDecisionPayloadSchema,
  documentUploadResultSchema,
  reviewResponseSchema
} from "@client-review-prep/shared";
import { calendarDateSchema } from "../../ai/contracts/calendarDateSchema.js";
import { ExecutionError } from "../harness/executionErrors.js";
import type { ToolDefinition } from "./toolTypes.js";
import type { createReviewService } from "../../services/reviewService.js";
import {
  ClientMutationConflictError,
  DecisionConflictError,
  InvalidDecisionForFactError
} from "../../services/reviewService.js";
import {
  extractedPdfUploadSchema,
  validatedTextUploadSchema
} from "./documentTools.js";

export type ReviewToolService = Pick<
  ReturnType<typeof createReviewService>,
  | "captureClientMutationEpoch"
  | "commitPreparedReview"
  | "createUploadedSourceRecord"
  | "buildReviewResponse"
  | "recordDecision"
>;

const captureClientMutationEpochInputSchema = z.object({
  clientId: z.string().min(1)
});

const captureClientMutationEpochOutputSchema = z.object({
  mutationEpoch: z.number().int().nonnegative()
});

const preparedWorkflowStepSchema = z.object({
  label: z.string().min(1),
  status: z.enum(["COMPLETE", "ESCALATED", "FAILED"]),
  detail: z.string().nullable().optional()
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

const commitPreparedReviewInputSchema = z.object({
  clientId: z.string().min(1),
  expectedMutationEpoch: z.number().int().nonnegative(),
  skillName: z.string().min(1),
  skillVersion: z.string().nullable(),
  candidates: z.array(extractedCandidateProjectionSchema).max(10),
  workflowSteps: z.array(preparedWorkflowStepSchema).min(1).max(30)
});

const applyDecisionInputSchema = z.object({
  clientId: z.string().min(1),
  factId: z.string().min(1),
  payload: adviserDecisionPayloadSchema
});

export const createReviewTools = (
  reviewService: ReviewToolService
) => {
  const captureClientMutationEpoch: ToolDefinition<
    typeof captureClientMutationEpochInputSchema,
    typeof captureClientMutationEpochOutputSchema
  > = {
    name: "review.captureClientMutationEpoch",
    description:
      "Capture the durable client mutation epoch before long-running computation.",
    inputSchema: captureClientMutationEpochInputSchema,
    outputSchema: captureClientMutationEpochOutputSchema,
    risk: "LOW",
    execute: async ({ clientId }) => ({
      mutationEpoch:
        await reviewService.captureClientMutationEpoch(clientId)
    })
  };

  const commitPreparedReview: ToolDefinition<
    typeof commitPreparedReviewInputSchema,
    typeof reviewResponseSchema
  > = {
    name: "review.commitPreparedReview",
    description:
      "Atomically persist candidate projection and the mandatory preparation workflow trace.",
    inputSchema: commitPreparedReviewInputSchema,
    outputSchema: reviewResponseSchema,
    risk: "MEDIUM",
    execute: async (input, context) => {
      try {
        const review = await reviewService.commitPreparedReview({
          ...input,
          workflowSteps: input.workflowSteps.map((step) => ({
            label: step.label,
            status: step.status,
            detail: step.detail ?? null
          }))
        });
        context.recordEvent({
          label: "Prepared review committed atomically"
        });
        return review;
      } catch (error) {
        if (error instanceof ClientMutationConflictError) {
          throw new ExecutionError("CLIENT_MUTATION_INVALIDATED");
        }
        throw error;
      }
    }
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

  const applyDecision: ToolDefinition<
    typeof applyDecisionInputSchema,
    typeof reviewResponseSchema
  > = {
    name: "review.applyDecision",
    description: "Persist an adviser decision using deterministic domain rules.",
    inputSchema: applyDecisionInputSchema,
    outputSchema: reviewResponseSchema,
    risk: "HIGH",
    execute: async ({ clientId, factId, payload }) => {
      try {
        return await reviewService.recordDecision(clientId, factId, payload);
      } catch (error) {
        if (error instanceof InvalidDecisionForFactError) {
          throw new ExecutionError("INVALID_ADVISER_DECISION");
        }
        if (error instanceof DecisionConflictError) {
          throw new ExecutionError("DECISION_CONFLICT");
        }
        throw error;
      }
    }
  };

  const uploadPersistenceInputSchema = z.discriminatedUnion("documentType", [
    validatedTextUploadSchema.extend({
      expectedMutationEpoch: z.number().int().nonnegative()
    }),
    extractedPdfUploadSchema.extend({
      expectedMutationEpoch: z.number().int().nonnegative()
    })
  ]);

  const createUploadedSourceRecord: ToolDefinition<
    typeof uploadPersistenceInputSchema,
    typeof documentUploadResultSchema
  > = {
    name: "review.createUploadedSourceRecord",
    description:
      "Persist validated normalized document text and safe upload metadata.",
    inputSchema: uploadPersistenceInputSchema,
    outputSchema: documentUploadResultSchema,
    risk: "MEDIUM",
    execute: async (input) => {
      try {
        return await reviewService.createUploadedSourceRecord(input);
      } catch (error) {
        if (error instanceof ClientMutationConflictError) {
          throw new ExecutionError("CLIENT_MUTATION_INVALIDATED");
        }
        throw error;
      }
    }
  };

  return [
    captureClientMutationEpoch,
    commitPreparedReview,
    createUploadedSourceRecord,
    getPreparedReview,
    applyDecision
  ] as const;
};
