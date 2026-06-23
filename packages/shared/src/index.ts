import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("client-review-prep-api")
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const lifecycleStatusSchema = z.enum([
  "CURRENT",
  "SUPERSEDED",
  "NEEDS_CONFIRMATION",
  "REQUIRES_ADVISER_APPROVAL"
]);

export const decisionTypeSchema = z.enum([
  "CONFIRM",
  "LEAVE_UNVERIFIED",
  "APPROVE",
  "KEEP_CURRENT"
]);

export const workflowStepStatusSchema = z.enum(["COMPLETE", "ESCALATED", "FAILED"]);

export const confidenceSchema = z.enum(["High", "Medium", "Low"]);

export const extractionMetadataSchema = z.object({
  providerMode: z.enum(["mock", "openai"]),
  model: z.string().nullable(),
  candidateCount: z.number().int().nonnegative().max(10),
  warnings: z.array(z.string())
});

export const adviserDecisionPayloadSchema = z.object({
  decision: decisionTypeSchema,
  note: z.string().max(500).optional()
});

export const sourceRecordSchema = z.object({
  id: z.string(),
  type: z.enum(["LEGACY_CRM", "ANNUAL_REVIEW", "ADVISER_MEETING_NOTE"]),
  title: z.string(),
  observedAt: z.string(),
  observedDate: z.string(),
  summary: z.string(),
  content: z.array(z.string()),
  lifecycleStatus: lifecycleStatusSchema
});

export const clientFactSchema = z.object({
  id: z.string(),
  field: z.string(),
  currentLabel: z.string(),
  currentValue: z.string(),
  officialValue: z.string(),
  candidateValue: z.string().nullable(),
  previousValue: z.string().nullable(),
  sourceRecordId: z.string(),
  sourceDocument: z.string(),
  observedAt: z.string(),
  observedDate: z.string(),
  confidence: confidenceSchema,
  lifecycleStatus: lifecycleStatusSchema,
  status: z.string(),
  memoryExplanation: z.string()
});

export const adviserActionSchema = z.object({
  id: z.enum(["confirm-address", "review-risk-profile"]),
  factId: z.string(),
  title: z.string(),
  detail: z.string(),
  status: z.string(),
  lifecycleStatus: lifecycleStatusSchema,
  primaryDecision: decisionTypeSchema,
  secondaryDecision: decisionTypeSchema,
  primaryLabel: z.string(),
  secondaryLabel: z.string(),
  latestDecision: z
    .object({
      decision: decisionTypeSchema,
      note: z.string().nullable(),
      createdAt: z.string()
    })
    .nullable()
});

export const reviewResponseSchema = z.object({
  client: z.object({
    id: z.string(),
    name: z.string(),
    adviserName: z.string(),
    reviewYear: z.number(),
    reviewStatus: z.string()
  }),
  summaryMetrics: z.array(
    z.object({
      value: z.string(),
      label: z.string()
    })
  ),
  sourceRecords: z.array(sourceRecordSchema),
  clientFacts: z.array(clientFactSchema),
  meaningfulChanges: z.array(z.string()),
  adviserActions: z.array(adviserActionSchema),
  workflowTrace: z.array(
    z.object({
      label: z.string(),
      status: workflowStepStatusSchema,
      detail: z.string().nullable()
    })
  ),
  executionMetadata: z
    .object({
      skillName: z.string(),
      skillVersion: z.string().nullable(),
      status: z.enum(["SUCCEEDED", "FAILED"])
    })
    .optional(),
  extractionMetadata: extractionMetadataSchema.optional()
});

export type LifecycleStatus = z.infer<typeof lifecycleStatusSchema>;
export type DecisionType = z.infer<typeof decisionTypeSchema>;
export type AdviserDecisionPayload = z.infer<
  typeof adviserDecisionPayloadSchema
>;
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;
export type SourceRecordDto = z.infer<typeof sourceRecordSchema>;
export type ClientFactDto = z.infer<typeof clientFactSchema>;
export type AdviserActionDto = z.infer<typeof adviserActionSchema>;
export type ExtractionMetadata = z.infer<typeof extractionMetadataSchema>;
