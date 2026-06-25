import {
  DecisionType,
  LifecycleStatus,
  SourceRecordType,
  WorkflowRunStatus
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { ClientOperationCoordinator } from "./clientOperationCoordinator.js";
import type {
  Prisma,
  PrismaClient,
  WorkflowStepStatus
} from "@prisma/client";
import {
  uploadSourceMetadataSchema,
  type AdviserDecisionPayload,
  type ClientFactDto,
  type DocumentUploadResult,
  type ReviewResponse,
  type SourceRecordDto
} from "@client-review-prep/shared";
import { createLegacyCrmAdapter } from "../legacy/legacyCrmAdapter.js";
import { DEMO_CLIENT_ID, seedDemoData, workflowSteps } from "../demo/seedDemoData.js";
import {
  applyDecisionToFact,
  isDecisionAllowedForFact
} from "./decisionRules.js";
import {
  decodeDecisionCandidateValue,
  encodeDecisionNote
} from "./decisionNoteCodec.js";

export type ExtractedCandidateProjection = {
  field: "ADDRESS" | "RISK_PROFILE" | "FINANCIAL_GOAL" | "EMPLOYMENT" | "ANNUAL_INCOME" | "SUPERANNUATION";
  proposedValue: string;
  applicationStatus:
    | "NEEDS_CONFIRMATION"
    | "REQUIRES_ADVISER_APPROVAL"
    | "CANDIDATE_REVIEW";
  sourceRecordId: string;
  observedDate: string;
};

export class DecisionConflictError extends Error {
  constructor() {
    super("DECISION_CONFLICT");
    this.name = "DecisionConflictError";
  }
}

export class ClientMutationConflictError extends Error {
  constructor() {
    super("CLIENT_MUTATION_CONFLICT");
    this.name = "ClientMutationConflictError";
  }
}

export class InvalidDecisionForFactError extends Error {
  constructor() {
    super("INVALID_DECISION_FOR_FACT");
    this.name = "InvalidDecisionForFactError";
  }
}

export type ReviewServiceHooks = {
  afterDecisionFactRead?: () => Promise<void>;
  beforeDecisionAuditWrite?: () => Promise<void>;
  beforePreparationCommit?: () => Promise<void>;
  afterPreparationWorkflowRunWrite?: () => Promise<void>;
  beforeCandidateProjectionWrite?: () => Promise<void>;
  beforeResetCommit?: () => Promise<void>;
};

export type PreparedWorkflowStep = {
  label: string;
  status: WorkflowStepStatus;
  detail?: string | null;
};

const meaningfulChanges = [
  "Employer changed from ABC Mining to New Energy Ltd",
  "Annual income increased from AUD 110,000 to AUD 135,000",
  "Superannuation increased from AUD 125,000 to AUD 174,000",
  "Home-buying timeframe changed from five years to two years"
];

const unresolvedReviewStatuses = new Set<LifecycleStatus>([
  LifecycleStatus.NEEDS_CONFIRMATION,
  LifecycleStatus.REQUIRES_ADVISER_APPROVAL
]);

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);

const lifecycleLabel = (status: LifecycleStatus) => {
  switch (status) {
    case LifecycleStatus.CURRENT:
      return "Current";
    case LifecycleStatus.SUPERSEDED:
      return "Superseded";
    case LifecycleStatus.NEEDS_CONFIRMATION:
      return "Needs confirmation";
    case LifecycleStatus.REQUIRES_ADVISER_APPROVAL:
      return "Requires adviser approval";
  }
};

const currentLabelForField = (field: string) => {
  if (field === "Address") {
    return "Current official value";
  }

  if (field === "Risk profile") {
    return "Official value";
  }

  return "Current";
};

const uploadContentSchema = {
  is: (content: unknown): content is {
    lines: string[];
    upload: NonNullable<SourceRecordDto["upload"]>;
  } =>
    typeof content === "object" &&
    content !== null &&
    Array.isArray((content as { lines?: unknown }).lines) &&
    (content as { lines: unknown[] }).lines.every(
      (line) => typeof line === "string"
    ) &&
    typeof (content as { upload?: unknown }).upload === "object" &&
    (content as { upload?: unknown }).upload !== null
};

const contentToLines = (content: unknown): string[] => {
  if (Array.isArray(content) && content.every((line) => typeof line === "string")) {
    return content;
  }

  if (uploadContentSchema.is(content)) {
    return content.lines;
  }

  return [];
};

const contentToUpload = (content: unknown): SourceRecordDto["upload"] => {
  if (uploadContentSchema.is(content)) {
    return content.upload;
  }

  return null;
};

const toUtcDate = (calendarDate: string) =>
  new Date(`${calendarDate}T00:00:00.000Z`);

const fieldProjectionTargets = {
  ADDRESS: {
    factId: "fact-address",
    status: LifecycleStatus.NEEDS_CONFIRMATION,
    confidence: "Medium",
    explanation: (candidate: string) =>
      `The ${candidate} address remains a candidate fact from the latest extraction because it was not verified. The official address stays unchanged until an adviser confirms the change.`
  },
  RISK_PROFILE: {
    factId: "fact-risk-profile",
    status: LifecycleStatus.REQUIRES_ADVISER_APPROVAL,
    confidence: "Medium",
    explanation: (candidate: string) =>
      `The ${candidate} risk-profile candidate came from the latest extraction and requires adviser approval before use. The official risk profile stays unchanged until reviewed.`
  }
} as const;

const clearCandidateExplanation = (field: string) =>
  `No ${field.toLowerCase()} candidate was extracted in the latest preparation run. The official value remains unchanged.`;

type LegacyAdapter = ReturnType<typeof createLegacyCrmAdapter>;

export type FactForReview = {
  id: string;
  field: string;
  officialValue: string;
  candidateValue: string | null;
  previousValue: string | null;
  sourceRecordId: string;
  observedAt: Date;
  confidence: string;
  lifecycleStatus: LifecycleStatus;
  explanation: string;
  sourceRecord: {
    title: string;
  };
  adviserDecisions: Array<{
    decisionType: DecisionType;
    note: string | null;
    createdAt: Date;
  }>;
};

export const mapFactToDto = (fact: FactForReview): ClientFactDto => ({
  id: fact.id,
  field: fact.field,
  currentLabel: currentLabelForField(fact.field),
  currentValue: fact.officialValue,
  officialValue: fact.officialValue,
  candidateValue: fact.candidateValue,
  previousValue: fact.previousValue,
  sourceRecordId: fact.sourceRecordId,
  sourceDocument: fact.sourceRecord.title,
  observedAt: fact.observedAt.toISOString(),
  observedDate: formatDate(fact.observedAt),
  confidence:
    fact.confidence === "High" || fact.confidence === "Medium"
      ? fact.confidence
      : "Low",
  lifecycleStatus: fact.lifecycleStatus,
  status: lifecycleLabel(fact.lifecycleStatus),
  memoryExplanation: fact.explanation
});

export const buildMeaningfulChanges = (facts: readonly FactForReview[]) => [
  ...meaningfulChanges,
  ...facts
    .filter((fact) => fact.candidateValue !== null)
    .map(
      (fact) =>
        `${fact.field} candidate: ${fact.officialValue} to ${fact.candidateValue}`
    )
];

export const countUnresolvedReviewItems = (facts: readonly FactForReview[]) =>
  facts.filter((fact) => unresolvedReviewStatuses.has(fact.lifecycleStatus)).length;

export const shouldIncludeAdviserAction = (fact: FactForReview) =>
  ["fact-address", "fact-risk-profile"].includes(fact.id) &&
  (fact.candidateValue !== null || fact.adviserDecisions[0] !== undefined);

export const buildSummaryMetrics = (
  facts: readonly FactForReview[],
  changes: readonly string[]
) => [
  { value: String(facts.length + 6), label: "Facts reviewed" },
  { value: String(changes.length), label: "Meaningful changes" },
  { value: String(countUnresolvedReviewItems(facts)), label: "Items needing confirmation" }
];

export const createReviewService = (
  client: PrismaClient,
  clientOperations = new ClientOperationCoordinator(),
  hooks: ReviewServiceHooks = {}
) => {
  const legacyAdapter = createLegacyCrmAdapter(client);

  const buildReviewResponse = async (
    clientId: string,
    adapter: LegacyAdapter = legacyAdapter
  ): Promise<ReviewResponse> => {
    const [legacyClient, sourceRecords, facts, latestWorkflowRun] =
      await Promise.all([
        adapter.getLegacyClientRecord(clientId),
        adapter.getLegacySourceRecords(clientId),
        adapter.getLegacyFacts(clientId),
        client.workflowRun.findFirst({
          where: { clientId },
          include: { steps: { orderBy: { sequence: "asc" } } },
          orderBy: { startedAt: "desc" }
        })
      ]);

    if (!legacyClient) {
      throw new Error("CLIENT_NOT_FOUND");
    }

    const sourceRecordDtos: SourceRecordDto[] = sourceRecords.map((record) => ({
      id: record.id,
      type: record.type,
      title: record.title,
      observedAt: record.observedAt.toISOString(),
      observedDate: formatDate(record.observedAt),
      summary: record.summary,
      content: contentToLines(record.content),
      lifecycleStatus: record.lifecycleStatus,
      upload: contentToUpload(record.content)
    }));

    const factDtos: ClientFactDto[] = facts.map(mapFactToDto);
    const meaningfulChangeItems = buildMeaningfulChanges(facts);

    const actionFacts = facts.filter(shouldIncludeAdviserAction);

    return {
      client: {
        id: legacyClient.id,
        name: legacyClient.name,
        adviserName: legacyClient.adviserName,
        reviewYear: legacyClient.reviewYear,
        reviewStatus: legacyClient.reviewStatus
      },
      summaryMetrics: buildSummaryMetrics(facts, meaningfulChangeItems),
      sourceRecords: sourceRecordDtos,
      clientFacts: factDtos,
      meaningfulChanges: meaningfulChangeItems,
      adviserActions: actionFacts.map((fact) => {
        const latestDecision = fact.adviserDecisions[0] ?? null;
        const isAddress = fact.id === "fact-address";
        return {
          id: isAddress ? "confirm-address" : "review-risk-profile",
          factId: fact.id,
          title: isAddress
            ? "Confirm whether Alex has moved to Subiaco"
            : "Review the possible change from Balanced to a growth-oriented risk approach",
          detail: isAddress
            ? "Meeting note mentions Subiaco, but the address has not been verified."
            : "This is a high-impact attribute and needs adviser approval before use.",
          status: lifecycleLabel(fact.lifecycleStatus),
          lifecycleStatus: fact.lifecycleStatus,
          primaryDecision: isAddress ? DecisionType.CONFIRM : DecisionType.APPROVE,
          secondaryDecision: isAddress
            ? DecisionType.LEAVE_UNVERIFIED
            : DecisionType.KEEP_CURRENT,
          primaryLabel: isAddress ? "Confirm" : "Approve",
          secondaryLabel: isAddress ? "Leave unverified" : "Keep current",
          latestDecision: latestDecision
            ? {
                decision: latestDecision.decisionType,
                note: latestDecision.note,
                candidateValue: decodeDecisionCandidateValue(
                  latestDecision.note
                ),
                createdAt: latestDecision.createdAt.toISOString()
              }
            : null
        };
      }),
      workflowTrace:
        latestWorkflowRun?.steps.map((step) => ({
          label: step.label,
          status: step.status,
          detail: step.detail
        })) ?? []
    };
  };

  const captureClientMutationEpoch = async (clientId: string) => {
    const clientRecord = await client.client.findUnique({
      where: { id: clientId },
      select: { mutationEpoch: true }
    });

    if (!clientRecord) {
      throw new Error("CLIENT_NOT_FOUND");
    }

    return clientRecord.mutationEpoch;
  };

  const lockClientMutationEpoch = async (
    transaction: Prisma.TransactionClient,
    clientId: string,
    expectedMutationEpoch: number,
    data: Prisma.ClientUpdateManyMutationInput = {}
  ) => {
    const locked = await transaction.client.updateMany({
      where: {
        id: clientId,
        mutationEpoch: expectedMutationEpoch
      },
      data: {
        mutationEpoch: expectedMutationEpoch,
        ...data
      }
    });

    if (locked.count !== 1) {
      throw new ClientMutationConflictError();
    }
  };

  const applyCandidateProjectionInTransaction = async (
    transaction: Prisma.TransactionClient,
    clientId: string,
    candidates: readonly ExtractedCandidateProjection[]
  ) => {
    const supportedCandidates = candidates.filter(
      (candidate) =>
        candidate.field === "ADDRESS" || candidate.field === "RISK_PROFILE"
    );
    const candidatesByField = new Map(
      supportedCandidates.map((candidate) => [candidate.field, candidate])
    );
    const sourceRecord = await transaction.sourceRecord.findFirst({
      where: {
        clientId,
        type: SourceRecordType.ADVISER_MEETING_NOTE
      },
      orderBy: { observedAt: "desc" }
    });
    const facts = await transaction.clientFact.findMany({
      where: {
        clientId,
        id: {
          in: Object.values(fieldProjectionTargets).map(
            (target) => target.factId
          )
        }
      },
      include: {
        adviserDecisions: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    await hooks.beforeCandidateProjectionWrite?.();

    for (const fact of facts) {
      const field =
        fact.id === fieldProjectionTargets.ADDRESS.factId
          ? "ADDRESS"
          : "RISK_PROFILE";
      const target = fieldProjectionTargets[field];
      const candidate = candidatesByField.get(field);
      const latestDecision = fact.adviserDecisions[0] ?? null;
      const candidateObservedAt = candidate
        ? toUtcDate(candidate.observedDate)
        : null;
      const decisionIsNewerThanEvidence =
        latestDecision && candidateObservedAt
          ? latestDecision.createdAt >= candidateObservedAt
          : false;

      if (decisionIsNewerThanEvidence) {
        continue;
      }

      const nextCandidateValue = candidate?.proposedValue ?? null;
      const nextLifecycleStatus = candidate
        ? target.status
        : LifecycleStatus.CURRENT;
      const nextSourceRecordId = candidate
        ? candidate.sourceRecordId
        : sourceRecord?.id ?? fact.sourceRecordId;
      const decisionStateChanged =
        fact.candidateValue !== nextCandidateValue ||
        fact.lifecycleStatus !== nextLifecycleStatus ||
        (candidate !== undefined &&
          fact.sourceRecordId !== nextSourceRecordId);

      const updated = await transaction.clientFact.updateMany({
        where: {
          id: fact.id,
          clientId,
          revision: fact.revision,
          officialValue: fact.officialValue,
          candidateValue: fact.candidateValue,
          lifecycleStatus: fact.lifecycleStatus
        },
        data: {
          candidateValue: nextCandidateValue,
          lifecycleStatus: nextLifecycleStatus,
          confidence: candidate ? target.confidence : "Low",
          sourceRecordId: nextSourceRecordId,
          observedAt:
            candidateObservedAt ?? sourceRecord?.observedAt ?? fact.observedAt,
          explanation: candidate
            ? target.explanation(candidate.proposedValue)
            : clearCandidateExplanation(fact.field),
          ...(decisionStateChanged
            ? { revision: { increment: 1 } }
            : {})
        }
      });

      if (updated.count !== 1) {
        throw new ClientMutationConflictError();
      }
    }
  };

  const commitPreparedReview = async (input: {
    clientId: string;
    expectedMutationEpoch: number;
    skillName: string;
    skillVersion: string | null;
    candidates: readonly ExtractedCandidateProjection[];
    workflowSteps: readonly PreparedWorkflowStep[];
  }) => {
    await hooks.beforePreparationCommit?.();

    await clientOperations.runClientMutation(input.clientId, () =>
      client.$transaction(async (transaction) => {
        await lockClientMutationEpoch(
          transaction,
          input.clientId,
          input.expectedMutationEpoch,
          { reviewStatus: "Ready for adviser review" }
        );

        const versionSuffix = input.skillVersion
          ? `-v${input.skillVersion}`
          : "";
        const run = await transaction.workflowRun.create({
          data: {
            id: `workflow-${input.clientId}-${input.skillName}${versionSuffix}-${randomUUID()}`,
            clientId: input.clientId,
            status: WorkflowRunStatus.PREPARED,
            completedAt: new Date()
          }
        });

        await hooks.afterPreparationWorkflowRunWrite?.();
        await applyCandidateProjectionInTransaction(
          transaction,
          input.clientId,
          input.candidates
        );
        await transaction.workflowStep.createMany({
          data: input.workflowSteps.map((step, index) => ({
            id: `${run.id}-step-${index + 1}`,
            workflowRunId: run.id,
            sequence: index + 1,
            label: step.label,
            status: step.status,
            detail: step.detail ?? null
          }))
        });
      })
    );

    return buildReviewResponse(input.clientId);
  };

  const prepareReview = async (clientId: string) => {
    const expectedMutationEpoch = await captureClientMutationEpoch(clientId);
    return commitPreparedReview({
      clientId,
      expectedMutationEpoch,
      skillName: "prepare-annual-review",
      skillVersion: "legacy",
      candidates: [],
      workflowSteps: workflowSteps.map((step) => ({
        ...step,
        detail:
          step.status === "ESCALATED"
            ? "Address and risk-profile changes need adviser review."
            : null
      }))
    });
  };

  const recordDecision = async (
    clientId: string,
    factId: string,
    payload: AdviserDecisionPayload
  ) => {
    await client.$transaction(async (transaction) => {
      const [clientRecord, fact] = await Promise.all([
        transaction.client.findUnique({
          where: { id: clientId },
          select: { mutationEpoch: true }
        }),
        transaction.clientFact.findFirst({
          where: { id: factId, clientId }
        })
      ]);

      if (!clientRecord || !fact) {
        throw new Error("FACT_NOT_FOUND");
      }

      if (!isDecisionAllowedForFact(fact, payload.decision)) {
        throw new InvalidDecisionForFactError();
      }

      await hooks.afterDecisionFactRead?.();
      try {
        await lockClientMutationEpoch(
          transaction,
          clientId,
          clientRecord.mutationEpoch
        );
      } catch (error) {
        if (error instanceof ClientMutationConflictError) {
          throw new DecisionConflictError();
        }
        throw error;
      }

      const note = encodeDecisionNote(
        payload.note ??
          `Local demo decision: ${payload.decision}. No production CRM was updated.`,
        fact.candidateValue
      );
      const factUpdate = applyDecisionToFact(fact, payload.decision);
      const updated = await transaction.clientFact.updateMany({
        where: {
          id: factId,
          clientId,
          revision: fact.revision,
          officialValue: fact.officialValue,
          candidateValue: fact.candidateValue,
          lifecycleStatus: fact.lifecycleStatus
        },
        data: {
          ...factUpdate,
          revision: { increment: 1 }
        }
      });

      if (updated.count !== 1) {
        throw new DecisionConflictError();
      }

      await transaction.adviserDecision.create({
        data: {
          id: `decision-${factId}-${payload.decision}-${Date.now()}`,
          clientId,
          factId,
          decisionType: payload.decision,
          note
        }
      });

      await hooks.beforeDecisionAuditWrite?.();

      const run = await transaction.workflowRun.create({
        data: {
          id: `workflow-${clientId}-apply-adviser-decision-v1-${Date.now()}`,
          clientId,
          status: WorkflowRunStatus.PREPARED,
          completedAt: new Date()
        }
      });
      const decisionSteps = [
        "Skill selected: apply-adviser-decision",
        "Skill input validated",
        "Adviser decision persisted through controlled tool",
        "Fact state reconciled after adviser decision",
        "Skill output validated",
        "Skill completed: apply-adviser-decision"
      ];
      await transaction.workflowStep.createMany({
        data: decisionSteps.map((label, index) => ({
          id: `${run.id}-step-${index + 1}`,
          workflowRunId: run.id,
          sequence: index + 1,
          label,
          status: "COMPLETE"
        }))
      });
    });

    return buildReviewResponse(clientId);
  };

  const persistUploadedSourceRecord = async (input: {
    documentType: "TEXT" | "PDF";
    clientId: string;
    expectedMutationEpoch: number;
    observedDate: string;
    sourceType: "ADVISER_MEETING_NOTE";
    safeFilename: string;
    mediaType: string;
    text: string;
    characterCount: number;
    byteCount: number;
    originalByteCount: number;
    pageCount?: number;
    parser?: {
      name: "unpdf";
      version: string;
    };
    warnings?: string[];
  }): Promise<DocumentUploadResult> => {
    const uploadedAt = new Date();
    const sourceRecordId = `source-upload-${input.clientId}-${uploadedAt.getTime()}`;
    const upload = uploadSourceMetadataSchema.parse({
      origin: "UPLOAD" as const,
      documentType: input.documentType,
      safeFilename: input.safeFilename,
      mediaType: input.mediaType,
      characterCount: input.characterCount,
      byteCount: input.byteCount,
      originalByteCount: input.originalByteCount,
      ...(input.pageCount ? { pageCount: input.pageCount } : {}),
      ...(input.parser ? { parser: input.parser } : {}),
      uploadedAt: uploadedAt.toISOString()
    });
    const lines = input.text.split("\n");

    await client.$transaction(async (transaction) => {
      await lockClientMutationEpoch(
        transaction,
        input.clientId,
        input.expectedMutationEpoch
      );
      await transaction.sourceRecord.create({
        data: {
          id: sourceRecordId,
          clientId: input.clientId,
          type: SourceRecordType.ADVISER_MEETING_NOTE,
          title: `Uploaded: ${input.safeFilename}`,
          observedAt: toUtcDate(input.observedDate),
          summary:
            input.documentType === "PDF"
              ? `Uploaded text-based PDF (${input.pageCount ?? 0} pages, ${input.characterCount} extracted characters).`
              : `Uploaded text document (${input.characterCount} characters).`,
          content: {
            lines,
            upload
          },
          lifecycleStatus: LifecycleStatus.CURRENT
        }
      });
    });

    return {
      status: "stored",
      sourceRecord: {
        id: sourceRecordId,
        clientId: input.clientId,
        type: input.sourceType,
        title: `Uploaded: ${input.safeFilename}`,
        observedDate: input.observedDate,
        upload
      },
      safeFilename: input.safeFilename,
      characterCount: input.characterCount,
      byteCount: input.byteCount,
      originalByteCount: input.originalByteCount,
      ...(input.pageCount ? { pageCount: input.pageCount } : {}),
      ingestionStatus: "validated"
    };
  };

  const createUploadedSourceRecord = async (
    input: Parameters<typeof persistUploadedSourceRecord>[0]
  ) =>
    clientOperations.commitIfCurrentGeneration(input.clientId, () =>
      persistUploadedSourceRecord(input)
    );

  const applyExtractedCandidateProjection = async (
    clientId: string,
    candidates: readonly ExtractedCandidateProjection[]
  ) => {
    const expectedMutationEpoch = await captureClientMutationEpoch(clientId);

    await client.$transaction(async (transaction) => {
      await lockClientMutationEpoch(
        transaction,
        clientId,
        expectedMutationEpoch
      );
      await applyCandidateProjectionInTransaction(
        transaction,
        clientId,
        candidates
      );
    });
  };

  const resetDemo = async () => {
    await client.$transaction(async (transaction) => {
      await seedDemoData(transaction);
      await hooks.beforeResetCommit?.();
    });
    return buildReviewResponse(DEMO_CLIENT_ID);
  };

  return {
    mutationCoordinator: clientOperations,
    buildReviewResponse,
    prepareReview,
    captureClientMutationEpoch,
    commitPreparedReview,
    applyExtractedCandidateProjection,
    createUploadedSourceRecord,
    recordDecision,
    resetDemo
  };
};
