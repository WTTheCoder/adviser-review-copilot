import { DecisionType } from "@prisma/client";
import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import type { ReviewResponse } from "@client-review-prep/shared";
import { ExecutionHarness } from "../harness/executionHarness.js";
import { SkillRegistry } from "../registry/skillRegistry.js";
import { applyAdviserDecisionSkill } from "./applyAdviserDecisionSkill.js";
import { ingestClientDocumentSkill } from "./ingestClientDocumentSkill.js";
import { loadClientContextSkill } from "./loadClientContextSkill.js";
import { prepareAnnualReviewSkill } from "./prepareAnnualReviewSkill.js";
import {
  documentUploadResultSchema,
  reviewResponseSchema
} from "@client-review-prep/shared";
import { ToolRegistry } from "../tools/toolRegistry.js";
import { createAiExtractionTools } from "../tools/aiExtractionTools.js";
import {
  createLegacyCrmTools,
  type LegacyCrmToolAdapter
} from "../tools/legacyCrmTools.js";
import {
  createReviewTools,
  type ReviewToolService
} from "../tools/reviewTools.js";
import type { FactForReview } from "../../services/reviewService.js";
import { createDocumentTools } from "../tools/documentTools.js";
import { MockCandidateFactExtractor } from "../../ai/providers/mockCandidateFactExtractor.js";
import { AiError } from "../../ai/errors/aiErrors.js";
import type {
  CandidateFact,
  CandidateFactExtractionResult
} from "../../ai/contracts/candidateFactSchemas.js";
import type {
  CandidateFactExtractionInput,
  CandidateFactExtractor
} from "../../ai/contracts/candidateFactExtractor.js";
import {
  createPdfTextExtractor,
  type PdfParserAdapter
} from "../../documents/pdfUpload.js";

const createCandidateFact = (
  field: CandidateFact["field"],
  proposedValue: string
): CandidateFact => ({
  field,
  proposedValue,
  confidence: "MEDIUM",
  evidence: `Evidence for ${proposedValue}`,
  requiresHumanReview: true
});

const createExtractionResult = (
  candidateFacts: CandidateFact[],
  providerMode: "mock" | "openai" = "mock"
): CandidateFactExtractionResult => ({
  providerMode,
  model: providerMode === "openai" ? "example-model" : null,
  candidateFacts,
  warnings: [],
  metadata: {
    durationMs: 1,
    sourceTextLength: 120,
    candidateCount: candidateFacts.length
  }
});

const syntheticPdfBase64 =
  "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA1IDAgUiA+PiA+PiAvQ29udGVudHMgNCAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCAxNjYgPj4Kc3RyZWFtCkJUIC9GMSAxMCBUZiA3MiA3MjAgVGQKKEFsZXggbWF5IGhhdmUgbW92ZWQgdG8gSm9vbmRhbHVwLCBidXQgdGhlIGFkZHJlc3MgaGFzIG5vdCBiZWVuIGNvbmZpcm1lZC4pIFRqCjAgLTE4IFRkIChBbGV4IGlzIGNvbnNpZGVyaW5nIGEgSGlnaCBHcm93dGggcmlzayBwcm9maWxlLikgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8IC9UeXBlIC9Gb250IC9TdWJ0eXBlIC9UeXBlMSAvQmFzZUZvbnQgL0hlbHZldGljYSA+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjQxIDAwMDAwIG4gCjAwMDAwMDA0NTggMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA2IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgo1MjgKJSVFT0Y=";

const buildSummaryMetrics = (review: ReviewResponse) => {
  const unresolved = review.clientFacts.filter((fact) =>
    ["NEEDS_CONFIRMATION", "REQUIRES_ADVISER_APPROVAL"].includes(
      fact.lifecycleStatus
    )
  ).length;
  const candidateChanges = review.clientFacts.filter(
    (fact) => fact.candidateValue !== null
  ).length;

  return [
    { value: String(review.clientFacts.length + 6), label: "Facts reviewed" },
    { value: String(4 + candidateChanges), label: "Meaningful changes" },
    { value: String(unresolved), label: "Items needing confirmation" }
  ];
};

const metricValue = (review: ReviewResponse, label: string) =>
  review.summaryMetrics.find((metric) => metric.label === label)?.value;

type LegacySourceRecord = Awaited<
  ReturnType<LegacyCrmToolAdapter["getLegacySourceRecords"]>
>[number];

const defaultLegacySourceRecords = (): LegacySourceRecord[] => [
  {
    id: "source-meeting-note",
    type: "ADVISER_MEETING_NOTE",
    title: "Adviser Meeting Note",
    observedAt: new Date("2026-06-04T00:00:00.000Z"),
    summary: "Recent adviser note containing candidate changes for review.",
    content: [
      "Alex is considering a more growth-oriented investment approach.",
      "Alex may have moved to Subiaco, but the address has not been confirmed.",
      "The home purchase remains a near-term priority."
    ],
    lifecycleStatus: "CURRENT"
  }
];

const createLegacySourceRecord = (
  overrides: Partial<LegacySourceRecord>
): LegacySourceRecord => ({
  ...defaultLegacySourceRecords()[0],
  ...overrides
}) as LegacySourceRecord;

const legacyFactsForReview = (review: ReviewResponse): FactForReview[] =>
  review.clientFacts.map((fact) => ({
    id: fact.id,
    field: fact.field,
    officialValue: fact.officialValue,
    candidateValue: fact.candidateValue,
    previousValue: fact.previousValue,
    sourceRecordId: fact.sourceRecordId,
    observedAt: new Date(fact.observedAt),
    officialSourceRecordId: fact.officialSourceRecordId,
    officialObservedAt: new Date(fact.officialObservedAt),
    previousSourceRecordId: fact.previousSourceRecordId,
    previousObservedAt: fact.previousObservedAt
      ? new Date(fact.previousObservedAt)
      : null,
    candidateSourceRecordId: fact.candidateSourceRecordId,
    candidateObservedAt: fact.candidateObservedAt
      ? new Date(fact.candidateObservedAt)
      : null,
    candidateEvidence: fact.candidateEvidence,
    confidence: fact.confidence,
    lifecycleStatus: fact.lifecycleStatus,
    explanation: fact.memoryExplanation,
    officialSourceRecord: {
      title: fact.officialSourceDocument
    },
    previousSourceRecord: fact.previousSourceDocument
      ? {
          title: fact.previousSourceDocument
        }
      : null,
    candidateSourceRecord: fact.candidateSourceDocument
      ? {
          title: fact.candidateSourceDocument
        }
      : null,
    adviserDecisions: []
  }));

const createReview = (): ReviewResponse => ({
  client: {
    id: "demo-alex-taylor",
    name: "Alex Taylor",
    adviserName: "Jordan Bennett",
    reviewYear: 2026,
    reviewStatus: "Ready for adviser review"
  },
  summaryMetrics: [],
  sourceRecords: [],
  clientFacts: [
    {
      id: "fact-address",
      field: "Address",
      currentLabel: "Current official value",
      currentValue: "East Perth",
      officialValue: "East Perth",
      candidateValue: "Subiaco",
      previousValue: null,
      sourceRecordId: "source-annual-review",
      sourceDocument: "Annual Review",
      observedAt: "2025-11-16T00:00:00.000Z",
      observedDate: "16 November 2025",
      officialSourceRecordId: "source-annual-review",
      officialSourceDocument: "Annual Review",
      officialObservedAt: "2025-11-16T00:00:00.000Z",
      officialObservedDate: "16 November 2025",
      previousSourceRecordId: null,
      previousSourceDocument: null,
      previousObservedAt: null,
      previousObservedDate: null,
      candidateSourceRecordId: "source-meeting-note",
      candidateSourceDocument: "Adviser Meeting Note",
      candidateObservedAt: "2026-06-04T00:00:00.000Z",
      candidateObservedDate: "4 June 2026",
      candidateEvidence:
        "Alex may have moved to Subiaco, but the address has not been confirmed.",
      confidence: "Medium",
      lifecycleStatus: "NEEDS_CONFIRMATION",
      status: "Needs confirmation",
      memoryExplanation: "Address candidate"
    },
    {
      id: "fact-risk-profile",
      field: "Risk profile",
      currentLabel: "Official value",
      currentValue: "Balanced",
      officialValue: "Balanced",
      candidateValue: "Growth-oriented",
      previousValue: null,
      sourceRecordId: "source-annual-review",
      sourceDocument: "Annual Review",
      observedAt: "2025-11-16T00:00:00.000Z",
      observedDate: "16 November 2025",
      officialSourceRecordId: "source-annual-review",
      officialSourceDocument: "Annual Review",
      officialObservedAt: "2025-11-16T00:00:00.000Z",
      officialObservedDate: "16 November 2025",
      previousSourceRecordId: null,
      previousSourceDocument: null,
      previousObservedAt: null,
      previousObservedDate: null,
      candidateSourceRecordId: "source-meeting-note",
      candidateSourceDocument: "Adviser Meeting Note",
      candidateObservedAt: "2026-06-04T00:00:00.000Z",
      candidateObservedDate: "4 June 2026",
      candidateEvidence:
        "Alex is considering a more growth-oriented investment approach.",
      confidence: "Medium",
      lifecycleStatus: "REQUIRES_ADVISER_APPROVAL",
      status: "Requires adviser approval",
      memoryExplanation: "Risk candidate"
    }
  ],
  meaningfulChanges: [],
  adviserActions: [
    {
      id: "confirm-address",
      factId: "fact-address",
      title: "Confirm whether Alex has moved",
      detail: "Meeting note mentions an address change.",
      status: "Current",
      lifecycleStatus: "CURRENT",
      primaryDecision: DecisionType.CONFIRM,
      secondaryDecision: DecisionType.LEAVE_UNVERIFIED,
      primaryLabel: "Confirm",
      secondaryLabel: "Leave unverified",
      latestDecision: null
    },
    {
      id: "review-risk-profile",
      factId: "fact-risk-profile",
      title: "Review risk profile",
      detail: "Risk profile changes need approval.",
      status: "Current",
      lifecycleStatus: "CURRENT",
      primaryDecision: DecisionType.APPROVE,
      secondaryDecision: DecisionType.KEEP_CURRENT,
      primaryLabel: "Approve",
      secondaryLabel: "Keep current",
      latestDecision: null
    }
  ],
  workflowTrace: []
});

const createHarness = (
  extractor: CandidateFactExtractor = new MockCandidateFactExtractor(),
  pdfParserAdapter?: PdfParserAdapter,
  sourceRecords: LegacySourceRecord[] = defaultLegacySourceRecords()
) => {
  const skillRegistry = new SkillRegistry();
  const toolRegistry = new ToolRegistry();
  const review = createReview();
  const workflowSteps: Array<{
    label: string;
    status: "COMPLETE" | "ESCALATED" | "FAILED";
    detail: string | null;
  }> = [];
  const committedCandidates: Array<{
    field: string;
    proposedValue: string;
    evidence: string;
    applicationStatus: string;
    sourceRecordId: string;
    observedDate: string;
  }> = [];

  skillRegistry.register(loadClientContextSkill);
  skillRegistry.register(prepareAnnualReviewSkill);
  skillRegistry.register(applyAdviserDecisionSkill);
  skillRegistry.register(ingestClientDocumentSkill);

  const legacyAdapter = {
    getLegacyClientRecord: async () => ({
      id: "demo-alex-taylor",
      name: "Alex Taylor",
      adviserName: "Jordan Bennett",
      reviewYear: 2026,
      reviewStatus: "Preparation in progress",
      createdAt: new Date(),
      updatedAt: new Date()
    }),
    getLegacySourceRecords: async () => sourceRecords,
    getLegacyFacts: async () => legacyFactsForReview(review)
  } satisfies LegacyCrmToolAdapter;

  const reviewService = {
    captureClientMutationEpoch: async () => 0,
    commitPreparedReview: async (input) => {
      committedCandidates.splice(
        0,
        committedCandidates.length,
        ...input.candidates
      );
      workflowSteps.splice(
        0,
        workflowSteps.length,
        ...input.workflowSteps.map((step) => ({
          label: step.label,
          status: step.status,
          detail: step.detail ?? null
        }))
      );
      const address = review.clientFacts.find((fact) => fact.id === "fact-address");
      const risk = review.clientFacts.find(
        (fact) => fact.id === "fact-risk-profile"
      );
      const extractedAddress = input.candidates.find(
        (candidate) => candidate.field === "ADDRESS"
      );
      const extractedRisk = input.candidates.find(
        (candidate) => candidate.field === "RISK_PROFILE"
      );

      if (address) {
        address.candidateValue = extractedAddress?.proposedValue ?? null;
        address.candidateSourceRecordId = extractedAddress?.sourceRecordId ?? null;
        address.candidateSourceDocument = extractedAddress
          ? "Adviser Meeting Note"
          : null;
        address.candidateObservedAt = extractedAddress
          ? `${extractedAddress.observedDate}T00:00:00.000Z`
          : null;
        address.candidateObservedDate = extractedAddress
          ? "4 June 2026"
          : null;
        address.candidateEvidence = extractedAddress?.evidence ?? null;
        address.lifecycleStatus = extractedAddress
          ? "NEEDS_CONFIRMATION"
          : "CURRENT";
        address.status = extractedAddress ? "Needs confirmation" : "Current";
      }

      if (risk) {
        risk.candidateValue = extractedRisk?.proposedValue ?? null;
        risk.candidateSourceRecordId = extractedRisk?.sourceRecordId ?? null;
        risk.candidateSourceDocument = extractedRisk
          ? "Adviser Meeting Note"
          : null;
        risk.candidateObservedAt = extractedRisk
          ? `${extractedRisk.observedDate}T00:00:00.000Z`
          : null;
        risk.candidateObservedDate = extractedRisk
          ? "4 June 2026"
          : null;
        risk.candidateEvidence = extractedRisk?.evidence ?? null;
        risk.lifecycleStatus = extractedRisk
          ? "REQUIRES_ADVISER_APPROVAL"
          : "CURRENT";
        risk.status = extractedRisk ? "Requires adviser approval" : "Current";
      }

      return {
        ...review,
        summaryMetrics: buildSummaryMetrics(review),
        workflowTrace: workflowSteps
      };
    },
    createUploadedSourceRecord: async (input) => ({
      status: "stored",
      sourceRecord: {
        id: "source-upload-test",
        clientId: input.clientId,
        type: "ADVISER_MEETING_NOTE",
        title: `Uploaded: ${input.safeFilename}`,
        observedDate: input.observedDate,
        upload: {
          origin: "UPLOAD",
          documentType: input.documentType,
          safeFilename: input.safeFilename,
          mediaType:
            input.documentType === "PDF" ? "application/pdf" : "text/plain",
          characterCount: input.characterCount,
          byteCount: input.byteCount,
          originalByteCount: input.originalByteCount,
          ...(input.documentType === "PDF"
            ? {
                pageCount: input.pageCount,
                parser: input.parser
              }
            : {}),
          uploadedAt: "2026-06-04T00:00:00.000Z"
        }
      },
      safeFilename: input.safeFilename,
      characterCount: input.characterCount,
      byteCount: input.byteCount,
      originalByteCount: input.originalByteCount,
      ...(input.documentType === "PDF"
        ? { pageCount: input.pageCount }
        : {}),
      ingestionStatus: "validated"
    }),
    buildReviewResponse: async () => ({
      ...review,
      summaryMetrics: buildSummaryMetrics(review),
      workflowTrace: workflowSteps.map((step) => ({
        label: step.label,
        status: step.status,
        detail: step.detail
      }))
    }),
    recordDecision: async (_clientId, factId, payload) => {
      const fact = review.clientFacts.find((item) => item.id === factId);

      if (fact && payload.decision === DecisionType.CONFIRM) {
        fact.previousValue = fact.officialValue;
        fact.previousSourceRecordId = fact.officialSourceRecordId;
        fact.previousSourceDocument = fact.officialSourceDocument;
        fact.previousObservedAt = fact.officialObservedAt;
        fact.previousObservedDate = fact.officialObservedDate;
        fact.officialValue = fact.candidateValue ?? fact.officialValue;
        fact.currentValue = fact.officialValue;
        fact.officialSourceRecordId =
          fact.candidateSourceRecordId ?? fact.officialSourceRecordId;
        fact.officialSourceDocument =
          fact.candidateSourceDocument ?? fact.officialSourceDocument;
        fact.officialObservedAt =
          fact.candidateObservedAt ?? fact.officialObservedAt;
        fact.officialObservedDate =
          fact.candidateObservedDate ?? fact.officialObservedDate;
        fact.sourceRecordId = fact.officialSourceRecordId;
        fact.sourceDocument = fact.officialSourceDocument;
        fact.observedAt = fact.officialObservedAt;
        fact.observedDate = fact.officialObservedDate;
        fact.candidateValue = null;
        fact.candidateSourceRecordId = null;
        fact.candidateSourceDocument = null;
        fact.candidateObservedAt = null;
        fact.candidateObservedDate = null;
        fact.candidateEvidence = null;
        fact.lifecycleStatus = "CURRENT";
        fact.status = "Current";
      }

      if (fact && payload.decision === DecisionType.APPROVE) {
        fact.previousValue = fact.officialValue;
        fact.previousSourceRecordId = fact.officialSourceRecordId;
        fact.previousSourceDocument = fact.officialSourceDocument;
        fact.previousObservedAt = fact.officialObservedAt;
        fact.previousObservedDate = fact.officialObservedDate;
        fact.officialValue = fact.candidateValue ?? fact.officialValue;
        fact.currentValue = fact.officialValue;
        fact.officialSourceRecordId =
          fact.candidateSourceRecordId ?? fact.officialSourceRecordId;
        fact.officialSourceDocument =
          fact.candidateSourceDocument ?? fact.officialSourceDocument;
        fact.officialObservedAt =
          fact.candidateObservedAt ?? fact.officialObservedAt;
        fact.officialObservedDate =
          fact.candidateObservedDate ?? fact.officialObservedDate;
        fact.sourceRecordId = fact.officialSourceRecordId;
        fact.sourceDocument = fact.officialSourceDocument;
        fact.observedAt = fact.officialObservedAt;
        fact.observedDate = fact.officialObservedDate;
        fact.candidateValue = null;
        fact.candidateSourceRecordId = null;
        fact.candidateSourceDocument = null;
        fact.candidateObservedAt = null;
        fact.candidateObservedDate = null;
        fact.candidateEvidence = null;
        fact.lifecycleStatus = "CURRENT";
        fact.status = "Current";
      }

      if (
        fact &&
        (payload.decision === DecisionType.LEAVE_UNVERIFIED ||
          payload.decision === DecisionType.KEEP_CURRENT)
      ) {
        fact.candidateValue = null;
        fact.candidateSourceRecordId = null;
        fact.candidateSourceDocument = null;
        fact.candidateObservedAt = null;
        fact.candidateObservedDate = null;
        fact.candidateEvidence = null;
        fact.lifecycleStatus = "CURRENT";
        fact.status = "Current";
      }

      workflowSteps.splice(
        0,
        workflowSteps.length,
        ...[
          "Skill selected: apply-adviser-decision",
          "Skill input validated",
          "Adviser decision persisted through controlled tool",
          "Fact state reconciled after adviser decision",
          "Skill output validated",
          "Skill completed: apply-adviser-decision"
        ].map((label) => ({
          label,
          status: "COMPLETE" as const,
          detail: null
        }))
      );

      return {
        committed: true,
        refreshRequired: false,
        message: null,
        review: {
        ...review,
        summaryMetrics: buildSummaryMetrics(review),
        workflowTrace: workflowSteps
        }
      };
    }
  } satisfies ReviewToolService;

  for (const tool of [
    ...createDocumentTools(
      pdfParserAdapter
        ? {
            extractPdfText: createPdfTextExtractor(
              pdfParserAdapter,
              5
            ).extract
          }
        : undefined
    ),
    ...createAiExtractionTools(extractor),
    ...createLegacyCrmTools(legacyAdapter),
    ...createReviewTools(reviewService)
  ]) {
    toolRegistry.register(tool);
  }

  return {
    harness: new ExecutionHarness(skillRegistry, toolRegistry),
    review,
    workflowSteps,
    committedCandidates
  };
};

describe("required skills", () => {
  it("load-client-context returns the seeded client context", async () => {
    const { harness } = createHarness();
    const result = await harness.execute(
      "load-client-context",
      { clientId: "demo-alex-taylor" },
      loadClientContextSkill.outputSchema,
      "demo-alex-taylor"
    );

    expect(result.ok).toBe(true);
    expect(result.ok ? result.output.client.name : null).toBe("Alex Taylor");
  });

  it("prepare-annual-review returns Alex Taylor's review", async () => {
    const { harness, workflowSteps } = createHarness();
    const result = await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema,
      "demo-alex-taylor"
    );

    expect(result.ok).toBe(true);
    expect(result.ok ? result.output.client.name : null).toBe("Alex Taylor");
    expect(
      result.ok
        ? result.metadata.events.some((event) =>
            event.label.includes("Skill completed")
          )
        : false
    ).toBe(true);
    expect(workflowSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Candidate facts extracted through controlled model boundary",
          status: "COMPLETE"
        }),
        expect.objectContaining({
          label: "High-impact changes escalated",
          status: "ESCALATED"
        }),
        expect.objectContaining({
          label: "Skill completed: prepare-annual-review",
          status: "COMPLETE"
        })
      ])
    );
    expect(result.ok ? result.output.adviserActions.map((action) => action.id) : []).toEqual([
      "confirm-address",
      "review-risk-profile"
    ]);
    expect(
      workflowSteps.find((step) => step.label === "Bounded source context retrieved")
        ?.detail
    ).toContain("source-meeting-note");
    expect(
      workflowSteps.find((step) => step.label === "Bounded source context retrieved")
        ?.detail
    ).not.toContain("Subiaco");
    expect(result.ok ? result.output : {}).not.toHaveProperty("retrievalMetadata");
  });

  it("preparation does not blindly extract from the first meeting note", async () => {
    const calls: CandidateFactExtractionInput[] = [];
    const { harness } = createHarness(
      {
        extract: async (input) => {
          calls.push(input);
          return createExtractionResult([]);
        }
      },
      undefined,
      [
        createLegacySourceRecord({
          id: "source-first-general-note",
          observedAt: new Date("2026-06-05T00:00:00.000Z"),
          content: ["Alex discussed general administration."]
        }),
        createLegacySourceRecord({
          id: "source-relevant-address-note",
          observedAt: new Date("2026-06-04T00:00:00.000Z"),
          content: ["Alex may have moved to Fremantle."]
        })
      ]
    );

    await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema,
      "demo-alex-taylor"
    );

    expect(calls.map((call) => call.sourceRecordId)).toEqual([
      "source-relevant-address-note"
    ]);
  });

  it("extracts each selected source with bounded source text", async () => {
    const calls: CandidateFactExtractionInput[] = [];
    const longAddressText = `Alex may have moved to Joondalup. ${"x".repeat(5000)}`;
    const { harness } = createHarness(
      {
        extract: async (input) => {
          calls.push(input);
          return createExtractionResult([]);
        }
      },
      undefined,
      [
        createLegacySourceRecord({
          id: "source-long-address",
          content: [longAddressText]
        }),
        createLegacySourceRecord({
          id: "source-risk",
          content: ["Alex is considering High Growth."]
        })
      ]
    );

    await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema,
      "demo-alex-taylor"
    );

    expect(calls.map((call) => call.sourceRecordId).sort()).toEqual([
      "source-long-address",
      "source-risk"
    ]);
    expect(calls.every((call) => call.meetingNoteText.length <= 4000)).toBe(true);
  });

  it("keeps trusted provenance source-specific across selected sources", async () => {
    const { harness, committedCandidates } = createHarness(
      {
        extract: async (input) =>
          createExtractionResult(
            input.sourceRecordId === "source-address"
              ? [createCandidateFact("ADDRESS", "Fremantle")]
              : [createCandidateFact("RISK_PROFILE", "High Growth")]
          )
      },
      undefined,
      [
        createLegacySourceRecord({
          id: "source-address",
          observedAt: new Date("2026-06-05T00:00:00.000Z"),
          content: ["Alex may have moved to Fremantle."]
        }),
        createLegacySourceRecord({
          id: "source-risk",
          observedAt: new Date("2026-06-06T00:00:00.000Z"),
          content: ["Alex is considering High Growth."]
        })
      ]
    );

    await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema,
      "demo-alex-taylor"
    );

    expect(committedCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "ADDRESS",
          sourceRecordId: "source-address",
          observedDate: "2026-06-05"
        }),
        expect.objectContaining({
          field: "RISK_PROFILE",
          sourceRecordId: "source-risk",
          observedDate: "2026-06-06"
        })
      ])
    );
  });

  it("reconciles selected source assertions together and withholds contradictions", async () => {
    const { harness, committedCandidates } = createHarness(
      {
        extract: async (input) =>
          createExtractionResult([
            input.sourceRecordId === "source-risk-change"
              ? {
                  ...createCandidateFact("RISK_PROFILE", "High Growth"),
                  evidence: "Alex is considering High Growth."
                }
              : {
                  ...createCandidateFact("RISK_PROFILE", "Balanced"),
                  evidence: "Alex decided to remain Balanced."
                }
          ])
      },
      undefined,
      [
        createLegacySourceRecord({
          id: "source-risk-change",
          observedAt: new Date("2026-06-06T00:00:00.000Z"),
          content: ["Alex is considering High Growth."]
        }),
        createLegacySourceRecord({
          id: "source-risk-current",
          observedAt: new Date("2026-06-06T00:00:00.000Z"),
          content: ["Alex decided to remain Balanced."]
        })
      ]
    );

    const result = await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema,
      "demo-alex-taylor"
    );
    const risk = result.ok
      ? result.output.clientFacts.find((fact) => fact.id === "fact-risk-profile")
      : null;

    expect(risk?.candidateValue).toBeNull();
    expect(committedCandidates).toEqual([]);
    expect(
      result.ok ? result.output.extractionMetadata?.warnings.join(" ") : ""
    ).toContain("conflicting evidence also supports the current official value");
  });

  it("keeps a fresh risk contradiction in bounded retrieval and reconciles selected assertions together", async () => {
    const calls: CandidateFactExtractionInput[] = [];
    const broadContent = (label: string) => [
      `${label}: Alex moved to Subiaco.`,
      "Alex is considering High Growth.",
      "The home purchase goal remains active.",
      "Employer changed to New Energy Ltd.",
      "Annual income increased."
    ];
    const { harness, committedCandidates } = createHarness(
      {
        extract: async (input) => {
          calls.push(input);

          return createExtractionResult([
            input.sourceRecordId === "source-new-risk-current"
              ? {
                  ...createCandidateFact("RISK_PROFILE", "Balanced"),
                  evidence: "Alex has decided to remain Balanced."
                }
              : {
                  ...createCandidateFact("RISK_PROFILE", "High Growth"),
                  evidence: "Alex is considering High Growth."
                }
          ]);
        }
      },
      undefined,
      [
        createLegacySourceRecord({
          id: "source-broad-a",
          observedAt: new Date("2026-06-01T00:00:00.000Z"),
          content: broadContent("A")
        }),
        createLegacySourceRecord({
          id: "source-broad-b",
          observedAt: new Date("2026-06-02T00:00:00.000Z"),
          content: broadContent("B")
        }),
        createLegacySourceRecord({
          id: "source-broad-c",
          observedAt: new Date("2026-06-03T00:00:00.000Z"),
          content: broadContent("C")
        }),
        createLegacySourceRecord({
          id: "source-new-risk-current",
          observedAt: new Date("2026-06-04T00:00:00.000Z"),
          content: ["Alex has decided to remain Balanced."]
        })
      ]
    );

    const result = await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema,
      "demo-alex-taylor"
    );
    const risk = result.ok
      ? result.output.clientFacts.find((fact) => fact.id === "fact-risk-profile")
      : null;

    expect(calls.map((call) => call.sourceRecordId)).toContain(
      "source-new-risk-current"
    );
    expect(calls).toHaveLength(3);
    expect(risk?.candidateValue).toBeNull();
    expect(committedCandidates).toEqual([]);
    expect(
      result.ok ? result.output.extractionMetadata?.warnings.join(" ") : ""
    ).toContain("conflicting evidence also supports the current official value");
  });

  it("returns safe empty extraction metadata when no eligible source exists", async () => {
    const calls: CandidateFactExtractionInput[] = [];
    const { harness, committedCandidates } = createHarness(
      {
        extract: async (input) => {
          calls.push(input);
          return createExtractionResult([]);
        }
      },
      undefined,
      []
    );

    const result = await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema,
      "demo-alex-taylor"
    );

    expect(result.ok).toBe(true);
    expect(calls).toEqual([]);
    expect(committedCandidates).toEqual([]);
    expect(
      result.ok ? result.output.extractionMetadata?.warnings : []
    ).toContain("No relevant source was available for extraction.");
  });

  it("does not create unsupported candidates for a selected source with empty content", async () => {
    const calls: CandidateFactExtractionInput[] = [];
    const { harness, committedCandidates } = createHarness(
      {
        extract: async (input) => {
          calls.push(input);
          return createExtractionResult([
            createCandidateFact("RISK_PROFILE", "High Growth")
          ]);
        }
      },
      undefined,
      [
        createLegacySourceRecord({
          id: "source-empty-risk",
          title: "Risk profile note",
          summary: "Risk profile discussed.",
          content: []
        })
      ]
    );

    const result = await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema,
      "demo-alex-taylor"
    );

    expect(result.ok).toBe(true);
    expect(calls).toEqual([]);
    expect(committedCandidates).toEqual([]);
    expect(
      result.ok ? result.output.extractionMetadata?.warnings.join(" ") : ""
    ).toContain("Selected source source-empty-risk had no extractable text.");
  });

  it("prevents the preparation commit when one selected extraction fails", async () => {
    const calls: CandidateFactExtractionInput[] = [];
    const { harness, committedCandidates, review } = createHarness(
      {
        extract: async (input) => {
          calls.push(input);
          if (input.sourceRecordId === "source-risk-failure") {
            throw new AiError("AI_INPUT_TOO_LARGE");
          }

          return createExtractionResult([
            createCandidateFact("ADDRESS", "Fremantle")
          ]);
        }
      },
      undefined,
      [
        createLegacySourceRecord({
          id: "source-address-success",
          content: ["Alex moved to Fremantle."]
        }),
        createLegacySourceRecord({
          id: "source-risk-failure",
          content: ["Alex is considering High Growth."]
        })
      ]
    );
    const originalAddressCandidate = review.clientFacts.find(
      (fact) => fact.id === "fact-address"
    )?.candidateValue;

    const result = await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema,
      "demo-alex-taylor"
    );

    expect(result.ok).toBe(false);
    expect(calls.map((call) => call.sourceRecordId).sort()).toEqual([
      "source-address-success",
      "source-risk-failure"
    ]);
    expect(committedCandidates).toEqual([]);
    expect(
      review.clientFacts.find((fact) => fact.id === "fact-address")
        ?.candidateValue
    ).toBe(originalAddressCandidate);
  });

  it("ingest-client-document validates and stores one text upload without leaking document text in the trace", async () => {
    const { harness } = createHarness();
    const uploadedText =
      "Alex may have moved to Fremantle, but the address has not been confirmed.";
    const result = await harness.execute(
      "ingest-client-document",
      {
        clientId: "demo-alex-taylor",
        observedDate: "2026-06-04",
        sourceType: "ADVISER_MEETING_NOTE",
        originalFilename: "client-note.txt",
        mediaType: "text/plain",
        sizeBytes: uploadedText.length,
        documentType: "TEXT",
        text: uploadedText
      },
      documentUploadResultSchema,
      "demo-alex-taylor"
    );

    expect(result.ok).toBe(true);
    expect(result.ok ? result.output.safeFilename : null).toBe("client-note.txt");
    expect(result.ok ? result.output.ingestionStatus : null).toBe("validated");
    expect(result.ok ? result.output.sourceRecord.upload.origin : null).toBe(
      "UPLOAD"
    );
    expect(result.metadata.events.map((event) => event.label)).toEqual([
      "Skill selected: ingest-client-document",
      "Skill input validated",
      "Tool invoked: review.captureClientMutationEpoch",
      "Upload metadata validated",
      "Tool invoked: document.validateTextUpload",
      "Text upload validated",
      "Filename sanitized",
      "File size validated",
      "UTF-8 text decoded",
      "Document content validated",
      "Tool invoked: review.createUploadedSourceRecord",
      "Source record persisted",
      "Skill output validated",
      "Skill completed: ingest-client-document"
    ]);
    expect(JSON.stringify(result.metadata.events)).not.toContain(uploadedText);
    expect(JSON.stringify(result.metadata.events)).not.toContain("C:\\Users");
  });

  it("ingest-client-document validates, extracts, and stores a PDF through allowlisted tools", async () => {
    const { harness } = createHarness();
    const result = await harness.execute(
      "ingest-client-document",
      {
        clientId: "demo-alex-taylor",
        observedDate: "2026-06-04",
        sourceType: "ADVISER_MEETING_NOTE",
        originalFilename: "alex-review.pdf",
        mediaType: "application/pdf",
        sizeBytes: 650,
        documentType: "PDF",
        base64Data: syntheticPdfBase64
      },
      documentUploadResultSchema,
      "demo-alex-taylor"
    );

    expect(result.ok).toBe(true);
    expect(result.ok ? result.output.sourceRecord.upload.mediaType : null).toBe(
      "application/pdf"
    );
    expect(result.ok ? result.output.pageCount : null).toBe(1);
    expect(result.metadata.events.map((event) => event.label)).toEqual(
      expect.arrayContaining([
        "Tool invoked: document.validatePdfUpload",
        "PDF signature validated",
        "PDF size validated",
        "Tool invoked: document.extractPdfText",
        "PDF text extraction started",
        "PDF page limit validated",
        "Extracted PDF text validated",
        "Source record persisted"
      ])
    );
    expect(JSON.stringify(result.metadata.events)).not.toContain(
      syntheticPdfBase64
    );
    expect(JSON.stringify(result.metadata.events)).not.toContain(
      "Alex may have moved to Joondalup"
    );
  });

  it("ingest-client-document rejects invalid upload input before tool execution", async () => {
    const { harness } = createHarness();
    const result = await harness.execute(
      "ingest-client-document",
      {
        clientId: "demo-alex-taylor",
        observedDate: "2026-02-31",
        sourceType: "ADVISER_MEETING_NOTE",
        originalFilename: "client-note.pdf",
        mediaType: "application/pdf",
        sizeBytes: 12,
        documentType: "PDF",
        base64Data: "bm90IGFjY2VwdGVk"
      },
      documentUploadResultSchema,
      "demo-alex-taylor"
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("INVALID_SKILL_INPUT");
    expect(result.metadata.events.map((event) => event.label)).not.toContain(
      "Tool invoked: document.validateTextUpload"
    );
  });

  it("does not persist a source record when PDF parsing fails", async () => {
    const { harness } = createHarness();
    const corruptPdf = Buffer.from("%PDF-1.4\ncorrupt", "ascii").toString(
      "base64"
    );
    const result = await harness.execute(
      "ingest-client-document",
      {
        clientId: "demo-alex-taylor",
        observedDate: "2026-06-04",
        sourceType: "ADVISER_MEETING_NOTE",
        originalFilename: "corrupt.pdf",
        mediaType: "application/pdf",
        sizeBytes: 16,
        documentType: "PDF",
        base64Data: corruptPdf
      },
      documentUploadResultSchema,
      "demo-alex-taylor"
    );
    const labels = result.metadata.events.map((event) => event.label);

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("PDF_PARSE_FAILED");
    expect(labels).toContain("Tool invoked: document.extractPdfText");
    expect(labels).not.toContain(
      "Tool invoked: review.createUploadedSourceRecord"
    );
    expect(labels).not.toContain("Source record persisted");
  });

  it("does not persist a source record when PDF parsing times out", async () => {
    const { harness } = createHarness(
      new MockCandidateFactExtractor(),
      {
        load: async () => new Promise(() => undefined)
      }
    );
    const result = await harness.execute(
      "ingest-client-document",
      {
        clientId: "demo-alex-taylor",
        observedDate: "2026-06-04",
        sourceType: "ADVISER_MEETING_NOTE",
        originalFilename: "slow.pdf",
        mediaType: "application/pdf",
        sizeBytes: 650,
        documentType: "PDF",
        base64Data: syntheticPdfBase64
      },
      documentUploadResultSchema,
      "demo-alex-taylor"
    );
    const labels = result.metadata.events.map((event) => event.label);

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("PDF_PARSE_TIMEOUT");
    expect(labels).toContain("PDF text extraction started");
    expect(labels).not.toContain(
      "Tool invoked: review.createUploadedSourceRecord"
    );
    expect(labels).not.toContain("Source record persisted");
    expect(JSON.stringify(result.metadata.events)).not.toContain(
      syntheticPdfBase64
    );
  });

  it("ingest-client-document rejects invalid upload tool output", async () => {
    const { review } = createHarness();
    const toolRegistry = new ToolRegistry();
    const skillRegistry = new SkillRegistry();
    skillRegistry.register(ingestClientDocumentSkill);
    for (const tool of createDocumentTools()) {
      toolRegistry.register(tool);
    }
    const invalidUploadResponse = {
      status: "stored",
      sourceRecord: {
        id: "source-upload-test",
        clientId: "demo-alex-taylor",
        type: "ADVISER_MEETING_NOTE",
        title: "Uploaded: note.txt",
        observedDate: "2026-06-04",
        upload: {
          origin: "UPLOAD",
          safeFilename: "note.txt",
              mediaType: "application/pdf",
              characterCount: 10,
              byteCount: 10,
              uploadedAt: "2026-06-04T00:00:00.000Z"
            }
          },
          safeFilename: "note.txt",
          characterCount: 10,
          byteCount: 10,
          ingestionStatus: "validated"
        } as unknown as Awaited<
      ReturnType<ReviewToolService["createUploadedSourceRecord"]>
    >;
    const invalidToolOutputService = {
      captureClientMutationEpoch: async () => 0,
      commitPreparedReview: async () => review,
      createUploadedSourceRecord: async () => invalidUploadResponse,
      buildReviewResponse: async () => review,
      recordDecision: async () => {
        throw new Error("Not used");
      }
    } satisfies ReviewToolService;

    for (const tool of createReviewTools(invalidToolOutputService)) {
      toolRegistry.register(tool);
    }

    const invalidOutputHarness = new ExecutionHarness(skillRegistry, toolRegistry);
    const result = await invalidOutputHarness.execute(
      "ingest-client-document",
      {
        clientId: "demo-alex-taylor",
        observedDate: "2026-06-04",
        sourceType: "ADVISER_MEETING_NOTE",
        originalFilename: "note.txt",
        mediaType: "text/plain",
        sizeBytes: 10,
        documentType: "TEXT",
        text: "Valid text"
      },
      documentUploadResultSchema,
      "demo-alex-taylor"
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("INVALID_TOOL_OUTPUT");
  });

  it("maps different extracted candidates into the adviser-facing review", async () => {
    const { harness } = createHarness({
      extract: async () =>
        createExtractionResult([
          createCandidateFact("ADDRESS", "Fremantle"),
          createCandidateFact("RISK_PROFILE", "Conservative")
        ])
    });

    const result = await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema,
      "demo-alex-taylor"
    );

    expect(result.ok).toBe(true);
    const facts = result.ok ? result.output.clientFacts : [];
    const address = facts.find((fact) => fact.id === "fact-address");
    const risk = facts.find((fact) => fact.id === "fact-risk-profile");

    expect(address?.officialValue).toBe("East Perth");
    expect(address?.candidateValue).toBe("Fremantle");
    expect(address?.lifecycleStatus).toBe("NEEDS_CONFIRMATION");
    expect(risk?.officialValue).toBe("Balanced");
    expect(risk?.candidateValue).toBe("Conservative");
    expect(risk?.lifecycleStatus).toBe("REQUIRES_ADVISER_APPROVAL");
    expect(result.ok ? result.output.extractionMetadata?.candidateCount : null).toBe(2);
    expect(result.ok ? metricValue(result.output, "Items needing confirmation") : null).toBe("2");
    expect(result.ok ? metricValue(result.output, "Meaningful changes") : null).toBe("6");
  });

  it("maps OpenAI-shaped human-review candidates into unresolved review items", async () => {
    const { harness } = createHarness({
      extract: async () =>
        createExtractionResult(
          [
            createCandidateFact("ADDRESS", "Subiaco"),
            createCandidateFact("RISK_PROFILE", "Growth-oriented")
          ],
          "openai"
        )
    });

    const result = await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema,
      "demo-alex-taylor"
    );

    expect(result.ok).toBe(true);
    const facts = result.ok ? result.output.clientFacts : [];
    const address = facts.find((fact) => fact.id === "fact-address");
    const risk = facts.find((fact) => fact.id === "fact-risk-profile");

    expect(address?.officialValue).toBe("East Perth");
    expect(address?.candidateValue).toBe("Subiaco");
    expect(address?.lifecycleStatus).toBe("NEEDS_CONFIRMATION");
    expect(risk?.officialValue).toBe("Balanced");
    expect(risk?.candidateValue).toBe("Growth-oriented");
    expect(risk?.lifecycleStatus).toBe("REQUIRES_ADVISER_APPROVAL");
    expect(result.ok ? result.output.extractionMetadata?.providerMode : null).toBe(
      "openai"
    );
    expect(result.ok ? metricValue(result.output, "Items needing confirmation") : null).toBe("2");
  });

  it("projects High Growth as an unresolved candidate with final metrics", async () => {
    const { harness } = createHarness({
      extract: async () =>
        createExtractionResult([
          createCandidateFact("ADDRESS", "Joondalup"),
          createCandidateFact("RISK_PROFILE", "High Growth")
        ])
    });

    const result = await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema,
      "demo-alex-taylor"
    );
    const risk = result.ok
      ? result.output.clientFacts.find((fact) => fact.id === "fact-risk-profile")
      : null;

    expect(risk).toMatchObject({
      officialValue: "Balanced",
      candidateValue: "High Growth",
      previousValue: null,
      lifecycleStatus: "REQUIRES_ADVISER_APPROVAL",
      sourceRecordId: "source-annual-review",
      candidateSourceRecordId: "source-meeting-note"
    });
    expect(
      result.ok
        ? metricValue(result.output, "Meaningful changes")
        : null
    ).toBe("6");
    expect(
      result.ok
        ? metricValue(result.output, "Items needing confirmation")
        : null
    ).toBe("2");
  });

  it("withholds live contradictory risk-profile evidence instead of projecting a candidate", async () => {
    const { harness } = createHarness({
      extract: async () =>
        createExtractionResult(
          [
            {
              ...createCandidateFact("RISK_PROFILE", "High Growth"),
              evidence: "Alex is considering High Growth."
            },
            {
              ...createCandidateFact("RISK_PROFILE", "Balanced"),
              evidence: "Alex has decided to remain Balanced."
            }
          ],
          "openai"
        )
    });

    const result = await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema,
      "demo-alex-taylor"
    );
    const risk = result.ok
      ? result.output.clientFacts.find((fact) => fact.id === "fact-risk-profile")
      : null;

    expect(risk?.officialValue).toBe("Balanced");
    expect(risk?.candidateValue).toBeNull();
    expect(risk?.lifecycleStatus).toBe("CURRENT");
    expect(
      result.ok ? result.output.extractionMetadata?.warnings.join(" ") : ""
    ).toContain("conflicting evidence also supports the current official value");
    expect(
      result.ok
        ? result.output.workflowTrace.some((step) =>
            step.label.includes("Extracted candidates reconciled with official facts")
          )
        : false
    ).toBe(true);
  });

  it("merges duplicate live assertions before projecting a supported candidate", async () => {
    const { harness } = createHarness({
      extract: async () =>
        createExtractionResult(
          [
            {
              ...createCandidateFact("RISK_PROFILE", "High Growth"),
              evidence: "Client may move to High Growth."
            },
            {
              ...createCandidateFact("RISK_PROFILE", "High Growth"),
              evidence: "Client is considering High Growth."
            }
          ],
          "openai"
        )
    });

    const result = await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema,
      "demo-alex-taylor"
    );
    const risk = result.ok
      ? result.output.clientFacts.find((fact) => fact.id === "fact-risk-profile")
      : null;

    expect(risk).toMatchObject({
      officialValue: "Balanced",
      candidateValue: "High Growth",
      candidateEvidence:
        "Client is considering High Growth. | Client may move to High Growth.",
      lifecycleStatus: "REQUIRES_ADVISER_APPROVAL"
    });
    expect(result.ok ? result.output.extractionMetadata?.warnings : null).toEqual([]);
  });

  it("resolves Joondalup and High Growth with existing metric semantics", async () => {
    const { harness } = createHarness({
      extract: async () =>
        createExtractionResult([
          createCandidateFact("ADDRESS", "Joondalup"),
          createCandidateFact("RISK_PROFILE", "High Growth")
        ])
    });

    await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema
    );
    const confirmed = await harness.execute(
      "apply-adviser-decision",
      {
        clientId: "demo-alex-taylor",
        factId: "fact-address",
        payload: { decision: DecisionType.CONFIRM }
      },
      reviewResponseSchema
    );
    expect(
      confirmed.ok
        ? metricValue(confirmed.output, "Meaningful changes")
        : null
    ).toBe("5");
    expect(
      confirmed.ok
        ? metricValue(confirmed.output, "Items needing confirmation")
        : null
    ).toBe("1");

    const approved = await harness.execute(
      "apply-adviser-decision",
      {
        clientId: "demo-alex-taylor",
        factId: "fact-risk-profile",
        payload: { decision: DecisionType.APPROVE }
      },
      reviewResponseSchema
    );
    const risk = approved.ok
      ? approved.output.clientFacts.find((fact) => fact.id === "fact-risk-profile")
      : null;

    expect(risk).toMatchObject({
      officialValue: "High Growth",
      previousValue: "Balanced",
      candidateValue: null,
      lifecycleStatus: "CURRENT"
    });
    expect(
      approved.ok
        ? metricValue(approved.output, "Meaningful changes")
        : null
    ).toBe("4");
    expect(
      approved.ok
        ? metricValue(approved.output, "Items needing confirmation")
        : null
    ).toBe("0");
  });

  it("KEEP_CURRENT retains Balanced and clears High Growth", async () => {
    const { harness } = createHarness({
      extract: async () =>
        createExtractionResult([
          createCandidateFact("RISK_PROFILE", "High Growth")
        ])
    });

    await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema
    );
    const kept = await harness.execute(
      "apply-adviser-decision",
      {
        clientId: "demo-alex-taylor",
        factId: "fact-risk-profile",
        payload: { decision: DecisionType.KEEP_CURRENT }
      },
      reviewResponseSchema
    );
    const risk = kept.ok
      ? kept.output.clientFacts.find((fact) => fact.id === "fact-risk-profile")
      : null;

    expect(risk).toMatchObject({
      officialValue: "Balanced",
      previousValue: null,
      candidateValue: null,
      lifecycleStatus: "CURRENT"
    });
  });

  it("normalizes free-form live risk-profile candidates before projection", async () => {
    const freeFormPhrase = "More growth-oriented investment approach";
    const { harness } = createHarness({
      extract: async () =>
        createExtractionResult(
          [createCandidateFact("RISK_PROFILE", freeFormPhrase)],
          "openai"
        )
    });

    const result = await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema,
      "demo-alex-taylor"
    );
    const risk = result.ok
      ? result.output.clientFacts.find((fact) => fact.id === "fact-risk-profile")
      : null;

    expect(risk?.officialValue).toBe("Balanced");
    expect(risk?.candidateValue).toBe("Growth-oriented");
    expect(risk?.lifecycleStatus).toBe("REQUIRES_ADVISER_APPROVAL");
    expect(
      result.ok
        ? result.output.clientFacts.some(
            (fact) => fact.candidateValue === freeFormPhrase
          )
        : true
    ).toBe(false);
  });

  it("omits unsupported risk-profile text instead of persisting arbitrary values", async () => {
    const unsupportedPhrase = "Dynamic risk appetite";
    const { harness } = createHarness({
      extract: async () =>
        createExtractionResult(
          [createCandidateFact("RISK_PROFILE", unsupportedPhrase)],
          "openai"
        )
    });

    const result = await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema,
      "demo-alex-taylor"
    );
    const risk = result.ok
      ? result.output.clientFacts.find((fact) => fact.id === "fact-risk-profile")
      : null;

    expect(risk?.officialValue).toBe("Balanced");
    expect(risk?.candidateValue).toBeNull();
    expect(risk?.lifecycleStatus).toBe("CURRENT");
    expect(
      result.ok
        ? JSON.stringify(result.output.clientFacts).includes(unsupportedPhrase)
        : true
    ).toBe(false);
    expect(
      result.ok
        ? result.output.workflowTrace.some((step) =>
            step.label.includes("Extracted candidates reconciled with official facts")
          )
        : false
    ).toBe(true);
  });

  it("clears seeded candidate values when extraction returns no candidates", async () => {
    const { harness } = createHarness({
      extract: async () => createExtractionResult([])
    });

    const result = await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema,
      "demo-alex-taylor"
    );

    expect(result.ok).toBe(true);
    const facts = result.ok ? result.output.clientFacts : [];
    expect(facts.find((fact) => fact.id === "fact-address")?.candidateValue).toBeNull();
    expect(
      facts.find((fact) => fact.id === "fact-risk-profile")?.candidateValue
    ).toBeNull();
    expect(facts.find((fact) => fact.id === "fact-address")?.officialValue).toBe(
      "East Perth"
    );
    expect(
      facts.find((fact) => fact.id === "fact-risk-profile")?.officialValue
    ).toBe("Balanced");
    expect(result.ok ? result.output.extractionMetadata?.candidateCount : null).toBe(0);
    expect(result.ok ? metricValue(result.output, "Items needing confirmation") : null).toBe("0");
    expect(result.ok ? metricValue(result.output, "Meaningful changes") : null).toBe("4");
    expect(
      result.ok
        ? result.output.workflowTrace.some((step) =>
            step.detail?.includes("0 candidate facts")
          )
        : false
    ).toBe(true);
  });

  it("reports one unresolved item when extraction returns one candidate", async () => {
    const { harness } = createHarness({
      extract: async () =>
        createExtractionResult([createCandidateFact("ADDRESS", "Subiaco")])
    });

    const result = await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema,
      "demo-alex-taylor"
    );

    expect(result.ok ? metricValue(result.output, "Items needing confirmation") : null).toBe("1");
    expect(result.ok ? metricValue(result.output, "Meaningful changes") : null).toBe("5");
  });

  it("keeps repeated extraction stable without duplicate effective candidate state", async () => {
    const { harness } = createHarness({
      extract: async () =>
        createExtractionResult([
          createCandidateFact("ADDRESS", "Fremantle"),
          createCandidateFact("RISK_PROFILE", "Conservative")
        ])
    });

    const first = await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema
    );
    const second = await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema
    );

    expect(first.ok && second.ok ? second.output.clientFacts.length : 0).toBe(
      first.ok ? first.output.clientFacts.length : 0
    );
    expect(
      second.ok
        ? second.output.clientFacts.filter((fact) => fact.id === "fact-address")
            .length
        : 0
    ).toBe(1);
    expect(
      second.ok
        ? second.output.clientFacts.find((fact) => fact.id === "fact-address")
            ?.candidateValue
        : null
    ).toBe("Fremantle");
  });

  it("deliberately replaces the preparation projection when extraction changes", async () => {
    const candidates = [
      createCandidateFact("ADDRESS", "Fremantle"),
      createCandidateFact("RISK_PROFILE", "Conservative")
    ];
    const { harness } = createHarness({
      extract: async () => createExtractionResult(candidates)
    });

    await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema
    );
    candidates[0] = createCandidateFact("ADDRESS", "West Perth");
    const changed = await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema
    );

    expect(
      changed.ok
        ? changed.output.clientFacts.find((fact) => fact.id === "fact-address")
            ?.candidateValue
        : null
    ).toBe("West Perth");
  });

  it("repeated preparation is safe and returns stable review identity", async () => {
    const { harness } = createHarness();
    const first = await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema
    );
    const second = await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema
    );

    expect(first.ok && second.ok ? second.output.client.id : null).toBe(
      "demo-alex-taylor"
    );
  });

  it.each([
    DecisionType.CONFIRM,
    DecisionType.LEAVE_UNVERIFIED,
    DecisionType.APPROVE,
    DecisionType.KEEP_CURRENT
  ])("apply-adviser-decision preserves %s behaviour through the decision tool", async (decision) => {
    const factId =
      decision === DecisionType.CONFIRM ||
      decision === DecisionType.LEAVE_UNVERIFIED
        ? "fact-address"
        : "fact-risk-profile";
    const { harness } = createHarness();
    const result = await harness.execute(
      "apply-adviser-decision",
      {
        clientId: "demo-alex-taylor",
        factId,
        payload: { decision }
      },
      reviewResponseSchema
    );

    expect(result.ok).toBe(true);
    expect(result.ok ? result.output.workflowTrace.at(-1)?.label : null).toBe(
      "Skill completed: apply-adviser-decision"
    );
  });

  it.each([
    [DecisionType.CONFIRM, "fact-address"],
    [DecisionType.LEAVE_UNVERIFIED, "fact-address"],
    [DecisionType.APPROVE, "fact-risk-profile"],
    [DecisionType.KEEP_CURRENT, "fact-risk-profile"]
  ])(
    "keeps adviser decision %s compatible after extraction projection",
    async (decision, factId) => {
      const { harness } = createHarness({
        extract: async () =>
          createExtractionResult([
            createCandidateFact("ADDRESS", "Fremantle"),
            createCandidateFact("RISK_PROFILE", "Conservative")
          ])
      });

      await harness.execute(
        "prepare-annual-review",
        { clientId: "demo-alex-taylor" },
        reviewResponseSchema
      );
      const result = await harness.execute(
        "apply-adviser-decision",
        {
          clientId: "demo-alex-taylor",
          factId,
          payload: { decision }
        },
        reviewResponseSchema
      );

      expect(result.ok).toBe(true);
    }
  );

  it("reports zero unresolved items after CONFIRM and APPROVE resolve candidates", async () => {
    const { harness } = createHarness({
      extract: async () =>
        createExtractionResult([
          createCandidateFact("ADDRESS", "Subiaco"),
          createCandidateFact("RISK_PROFILE", "Growth-oriented")
        ])
    });

    await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema
    );
    await harness.execute(
      "apply-adviser-decision",
      {
        clientId: "demo-alex-taylor",
        factId: "fact-address",
        payload: { decision: DecisionType.CONFIRM }
      },
      reviewResponseSchema
    );
    const approved = await harness.execute(
      "apply-adviser-decision",
      {
        clientId: "demo-alex-taylor",
        factId: "fact-risk-profile",
        payload: { decision: DecisionType.APPROVE }
      },
      reviewResponseSchema
    );

    expect(approved.ok ? metricValue(approved.output, "Items needing confirmation") : null).toBe("0");
  });

  it("reports zero unresolved items after LEAVE_UNVERIFIED and KEEP_CURRENT resolve candidates", async () => {
    const { harness } = createHarness({
      extract: async () =>
        createExtractionResult([
          createCandidateFact("ADDRESS", "Subiaco"),
          createCandidateFact("RISK_PROFILE", "Growth-oriented")
        ])
    });

    await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema
    );
    await harness.execute(
      "apply-adviser-decision",
      {
        clientId: "demo-alex-taylor",
        factId: "fact-address",
        payload: { decision: DecisionType.LEAVE_UNVERIFIED }
      },
      reviewResponseSchema
    );
    const kept = await harness.execute(
      "apply-adviser-decision",
      {
        clientId: "demo-alex-taylor",
        factId: "fact-risk-profile",
        payload: { decision: DecisionType.KEEP_CURRENT }
      },
      reviewResponseSchema
    );

    expect(kept.ok ? metricValue(kept.output, "Items needing confirmation") : null).toBe("0");
  });

  it("APPROVE promotes the normalized risk-profile value", async () => {
    const { harness } = createHarness({
      extract: async () =>
        createExtractionResult([
          createCandidateFact(
            "RISK_PROFILE",
            "More growth-oriented investment approach"
          )
        ])
    });

    await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema
    );
    const approved = await harness.execute(
      "apply-adviser-decision",
      {
        clientId: "demo-alex-taylor",
        factId: "fact-risk-profile",
        payload: { decision: DecisionType.APPROVE }
      },
      reviewResponseSchema
    );
    const risk = approved.ok
      ? approved.output.clientFacts.find((fact) => fact.id === "fact-risk-profile")
      : null;

    expect(risk?.officialValue).toBe("Growth-oriented");
    expect(risk?.previousValue).toBe("Balanced");
    expect(risk?.candidateValue).toBeNull();
  });

  it("KEEP_CURRENT retains the official risk profile after normalization", async () => {
    const { harness } = createHarness({
      extract: async () =>
        createExtractionResult([
          createCandidateFact(
            "RISK_PROFILE",
            "More growth-oriented investment approach"
          )
        ])
    });

    await harness.execute(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      reviewResponseSchema
    );
    const kept = await harness.execute(
      "apply-adviser-decision",
      {
        clientId: "demo-alex-taylor",
        factId: "fact-risk-profile",
        payload: { decision: DecisionType.KEEP_CURRENT }
      },
      reviewResponseSchema
    );
    const risk = kept.ok
      ? kept.output.clientFacts.find((fact) => fact.id === "fact-risk-profile")
      : null;

    expect(risk?.officialValue).toBe("Balanced");
    expect(risk?.previousValue).toBeNull();
    expect(risk?.candidateValue).toBeNull();
  });
});
