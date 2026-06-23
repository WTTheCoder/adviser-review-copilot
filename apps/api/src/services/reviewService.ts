import {
  DecisionType,
  LifecycleStatus,
  WorkflowRunStatus
} from "@prisma/client";
import type { PrismaClient, WorkflowStepStatus } from "@prisma/client";
import type {
  AdviserDecisionPayload,
  ClientFactDto,
  ReviewResponse,
  SourceRecordDto
} from "@client-review-prep/shared";
import { createLegacyCrmAdapter } from "../legacy/legacyCrmAdapter.js";
import { DEMO_CLIENT_ID, seedDemoData, workflowSteps } from "../demo/seedDemoData.js";
import {
  applyDecisionToFact,
  isDecisionAllowedForFact
} from "./decisionRules.js";

const meaningfulChanges = [
  "Employer changed from ABC Mining to New Energy Ltd",
  "Annual income increased from AUD 110,000 to AUD 135,000",
  "Superannuation increased from AUD 125,000 to AUD 174,000",
  "Home-buying timeframe changed from five years to two years"
];

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

const contentToLines = (content: unknown): string[] =>
  Array.isArray(content) && content.every((line) => typeof line === "string")
    ? content
    : [];

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

export const createReviewService = (client: PrismaClient) => {
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
      lifecycleStatus: record.lifecycleStatus
    }));

    const factDtos: ClientFactDto[] = facts.map(mapFactToDto);

    const actionFacts = facts.filter((fact) =>
      ["fact-address", "fact-risk-profile"].includes(fact.id)
    );

    return {
      client: {
        id: legacyClient.id,
        name: legacyClient.name,
        adviserName: legacyClient.adviserName,
        reviewYear: legacyClient.reviewYear,
        reviewStatus: legacyClient.reviewStatus
      },
      summaryMetrics: [
        { value: "12", label: "Facts reviewed" },
        { value: "4", label: "Meaningful changes" },
        { value: "2", label: "Items needing confirmation" }
      ],
      sourceRecords: sourceRecordDtos,
      clientFacts: factDtos,
      meaningfulChanges,
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

  const prepareReview = async (clientId: string) => {
    await client.$transaction(async (transaction) => {
      await transaction.workflowRun.deleteMany({ where: { clientId } });
      await transaction.client.update({
        where: { id: clientId },
        data: { reviewStatus: "Ready for adviser review" }
      });
      const run = await transaction.workflowRun.create({
        data: {
          id: `workflow-${clientId}-${Date.now()}`,
          clientId,
          status: WorkflowRunStatus.PREPARED,
          completedAt: new Date()
        }
      });
      await transaction.workflowStep.createMany({
        data: workflowSteps.map((step, index) => ({
          id: `${run.id}-step-${index + 1}`,
          workflowRunId: run.id,
          sequence: index + 1,
          label: step.label,
          status: step.status,
          detail:
            step.status === "ESCALATED"
              ? "Address and risk-profile changes need adviser review."
              : null
        }))
      });
    });

    return buildReviewResponse(clientId);
  };

  const createWorkflowRun = async (
    clientId: string,
    skillName: string,
    skillVersion: string | null
  ) => {
    const versionSuffix = skillVersion ? `-v${skillVersion}` : "";
    await client.client.update({
      where: { id: clientId },
      data: { reviewStatus: "Ready for adviser review" }
    });

    return client.workflowRun.create({
      data: {
        id: `workflow-${clientId}-${skillName}${versionSuffix}-${Date.now()}`,
        clientId,
        status: WorkflowRunStatus.PREPARED,
        completedAt: new Date()
      },
      select: {
        id: true
      }
    });
  };

  const recordWorkflowStep = async (input: {
    workflowRunId: string;
    sequence: number;
    label: string;
    status: WorkflowStepStatus;
    detail?: string | null;
  }) =>
    client.workflowStep.create({
      data: {
        id: `${input.workflowRunId}-step-${input.sequence}`,
        workflowRunId: input.workflowRunId,
        sequence: input.sequence,
        label: input.label,
        status: input.status,
        detail: input.detail ?? null
      },
      select: {
        id: true
      }
    });

  const recordDecision = async (
    clientId: string,
    factId: string,
    payload: AdviserDecisionPayload
  ) => {
    const fact = await client.clientFact.findFirst({
      where: { id: factId, clientId }
    });

    if (!fact) {
      throw new Error("FACT_NOT_FOUND");
    }

    if (!isDecisionAllowedForFact(fact.id, payload.decision)) {
      throw new Error("INVALID_DECISION_FOR_FACT");
    }

    await client.$transaction(async (transaction) => {
      const note =
        payload.note ??
        `Local demo decision: ${payload.decision}. No production CRM was updated.`;

      await transaction.adviserDecision.create({
        data: {
          id: `decision-${factId}-${payload.decision}-${Date.now()}`,
          clientId,
          factId,
          decisionType: payload.decision,
          note
        }
      });

      const factUpdate = applyDecisionToFact(fact, payload.decision);
      await transaction.clientFact.update({
        where: { id: factId },
        data: factUpdate
      });
    });

    return buildReviewResponse(clientId);
  };

  const resetDemo = async () => {
    await seedDemoData(client);
    return buildReviewResponse(DEMO_CLIENT_ID);
  };

  return {
    buildReviewResponse,
    prepareReview,
    createWorkflowRun,
    recordWorkflowStep,
    recordDecision,
    resetDemo
  };
};
