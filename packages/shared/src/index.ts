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
export const executionEventStatusSchema = z.enum([
  "STARTED",
  "COMPLETE",
  "ESCALATED",
  "FAILED"
]);

export const executionEventSchema = z
  .object({
    sequence: z.number().int().positive(),
    label: z.string(),
    status: executionEventStatusSchema,
    detail: z.string().nullable(),
    timestamp: z.string()
  })
  .strict();

export const executionMetadataSchema = z
  .object({
    skillName: z.string(),
    skillVersion: z.string().nullable(),
    status: z.enum(["SUCCEEDED", "FAILED"])
  })
  .strict();

export const executionTraceMetadataSchema = executionMetadataSchema
  .extend({
    events: z.array(executionEventSchema)
  })
  .strict();

export const confidenceSchema = z.enum(["High", "Medium", "Low"]);

export const allowedUploadExtensions = [".txt", ".md"] as const;
export const allowedUploadMediaTypes = [
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/octet-stream"
] as const;
export const maxUploadBytes = 256 * 1024;
export const maxUploadCharacters = 256 * 1024;
export const maxUploadFilenameLength = 120;

export const calendarDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [yearPart, monthPart, dayPart] = value.split("-");
    const year = Number(yearPart);
    const month = Number(monthPart);
    const day = Number(dayPart);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Must be a valid calendar date");

export const documentUploadRequestSchema = z
  .object({
    clientId: z.string().min(1).max(80),
    observedDate: calendarDateStringSchema,
    sourceType: z.literal("ADVISER_MEETING_NOTE"),
    originalFilename: z.string().min(1).max(260),
    mediaType: z.string().min(1).max(120),
    sizeBytes: z.number().int().nonnegative(),
    text: z.string().max(maxUploadCharacters)
  })
  .strict();

export const uploadSourceMetadataSchema = z
  .object({
    origin: z.literal("UPLOAD"),
    safeFilename: z.string().min(1).max(maxUploadFilenameLength),
    mediaType: z.enum(allowedUploadMediaTypes),
    characterCount: z.number().int().positive().max(maxUploadCharacters),
    byteCount: z.number().int().positive().max(maxUploadBytes),
    uploadedAt: z.string()
  })
  .strict();

export const documentUploadResultSchema = z
  .object({
    status: z.literal("stored"),
    sourceRecord: z.object({
      id: z.string(),
      clientId: z.string(),
      type: z.literal("ADVISER_MEETING_NOTE"),
      title: z.string(),
      observedDate: z.string(),
      upload: uploadSourceMetadataSchema
    }),
    safeFilename: z.string(),
    characterCount: z.number().int().positive(),
    byteCount: z.number().int().positive().max(maxUploadBytes),
    ingestionStatus: z.literal("validated")
  })
  .strict();

export const documentUploadResponseSchema = documentUploadResultSchema
  .extend({
    executionMetadata: executionTraceMetadataSchema
  })
  .strict();

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
  lifecycleStatus: lifecycleStatusSchema,
  upload: uploadSourceMetadataSchema.nullable().optional()
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
  executionMetadata: executionMetadataSchema.optional(),
  extractionMetadata: extractionMetadataSchema.optional()
});

export type LifecycleStatus = z.infer<typeof lifecycleStatusSchema>;
export type DecisionType = z.infer<typeof decisionTypeSchema>;
export type ExecutionEventStatus = z.infer<typeof executionEventStatusSchema>;
export type ExecutionEvent = z.infer<typeof executionEventSchema>;
export type ExecutionMetadata = z.infer<typeof executionMetadataSchema>;
export type ExecutionTraceMetadata = z.infer<typeof executionTraceMetadataSchema>;
export type AdviserDecisionPayload = z.infer<
  typeof adviserDecisionPayloadSchema
>;
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;
export type SourceRecordDto = z.infer<typeof sourceRecordSchema>;
export type ClientFactDto = z.infer<typeof clientFactSchema>;
export type AdviserActionDto = z.infer<typeof adviserActionSchema>;
export type ExtractionMetadata = z.infer<typeof extractionMetadataSchema>;
export type DocumentUploadRequest = z.infer<typeof documentUploadRequestSchema>;
export type DocumentUploadResult = z.infer<typeof documentUploadResultSchema>;
export type DocumentUploadResponse = z.infer<typeof documentUploadResponseSchema>;
