import {
  LifecycleStatus,
  SourceRecordType,
  WorkflowRunStatus,
  WorkflowStepStatus
} from "@prisma/client";
import type { Prisma } from "@prisma/client";

export const DEMO_CLIENT_ID = "demo-alex-taylor";

const sourceRecords = [
  {
    id: "source-legacy-crm",
    type: SourceRecordType.LEGACY_CRM,
    title: "Legacy CRM Record",
    observedAt: new Date("2023-05-10T00:00:00.000Z"),
    summary: "Original CRM profile used as historical baseline.",
    lifecycleStatus: LifecycleStatus.SUPERSEDED,
    content: [
      "Employer: ABC Mining",
      "Annual income: AUD 110,000",
      "Superannuation balance: AUD 125,000",
      "Address: East Perth",
      "Financial goal: Buy a home within five years",
      "Risk profile: Balanced"
    ]
  },
  {
    id: "source-annual-review",
    type: SourceRecordType.ANNUAL_REVIEW,
    title: "Annual Review",
    observedAt: new Date("2025-11-16T00:00:00.000Z"),
    summary: "Verified annual-review record replacing several older CRM facts.",
    lifecycleStatus: LifecycleStatus.CURRENT,
    content: [
      "Employer: New Energy Ltd",
      "Annual income: AUD 135,000",
      "Superannuation balance: AUD 174,000",
      "Financial goal: Buy a home within two years",
      "Risk profile remains Balanced"
    ]
  },
  {
    id: "source-meeting-note",
    type: SourceRecordType.ADVISER_MEETING_NOTE,
    title: "Adviser Meeting Note",
    observedAt: new Date("2026-06-04T00:00:00.000Z"),
    summary: "Recent adviser note containing candidate changes for review.",
    lifecycleStatus: LifecycleStatus.CURRENT,
    content: [
      "Alex is considering a more growth-oriented investment approach.",
      "Alex may have moved to Subiaco, but the address has not been confirmed.",
      "The home purchase remains a near-term priority."
    ]
  }
] as const;

const facts = [
  {
    id: "fact-employment",
    field: "Employment",
    officialValue: "New Energy Ltd",
    previousValue: "ABC Mining",
    sourceRecordId: "source-annual-review",
    observedAt: new Date("2025-11-16T00:00:00.000Z"),
    officialSourceRecordId: "source-annual-review",
    officialObservedAt: new Date("2025-11-16T00:00:00.000Z"),
    previousSourceRecordId: "source-legacy-crm",
    previousObservedAt: new Date("2023-05-10T00:00:00.000Z"),
    confidence: "High",
    lifecycleStatus: LifecycleStatus.CURRENT,
    explanation:
      "The newer verified employment record replaced the 2023 CRM value. The older employer remains in history but is no longer used as the current client state."
  },
  {
    id: "fact-annual-income",
    field: "Annual income",
    officialValue: "AUD 135,000",
    previousValue: "AUD 110,000",
    sourceRecordId: "source-annual-review",
    observedAt: new Date("2025-11-16T00:00:00.000Z"),
    officialSourceRecordId: "source-annual-review",
    officialObservedAt: new Date("2025-11-16T00:00:00.000Z"),
    previousSourceRecordId: "source-legacy-crm",
    previousObservedAt: new Date("2023-05-10T00:00:00.000Z"),
    confidence: "High",
    lifecycleStatus: LifecycleStatus.CURRENT,
    explanation:
      "The newer verified income record replaced the 2023 CRM value. The earlier income remains available as historical context for the annual review."
  },
  {
    id: "fact-superannuation",
    field: "Superannuation",
    officialValue: "AUD 174,000",
    previousValue: "AUD 125,000",
    sourceRecordId: "source-annual-review",
    observedAt: new Date("2025-11-16T00:00:00.000Z"),
    officialSourceRecordId: "source-annual-review",
    officialObservedAt: new Date("2025-11-16T00:00:00.000Z"),
    previousSourceRecordId: "source-legacy-crm",
    previousObservedAt: new Date("2023-05-10T00:00:00.000Z"),
    confidence: "High",
    lifecycleStatus: LifecycleStatus.CURRENT,
    explanation:
      "The 2025 annual review provides the current superannuation balance while the 2023 CRM value is retained as superseded history."
  },
  {
    id: "fact-address",
    field: "Address",
    officialValue: "East Perth",
    candidateValue: "Subiaco",
    sourceRecordId: "source-annual-review",
    observedAt: new Date("2025-11-16T00:00:00.000Z"),
    officialSourceRecordId: "source-annual-review",
    officialObservedAt: new Date("2025-11-16T00:00:00.000Z"),
    candidateSourceRecordId: "source-meeting-note",
    candidateObservedAt: new Date("2026-06-04T00:00:00.000Z"),
    candidateEvidence: "Alex may have moved to Subiaco, but the address has not been confirmed.",
    confidence: "Medium",
    lifecycleStatus: LifecycleStatus.NEEDS_CONFIRMATION,
    explanation:
      "The Subiaco address remains a candidate fact because it was not verified. East Perth stays as the official value until an adviser confirms the change."
  },
  {
    id: "fact-financial-goal",
    field: "Financial goal",
    officialValue: "Buy a home within two years",
    previousValue: "Buy a home within five years",
    sourceRecordId: "source-annual-review",
    observedAt: new Date("2025-11-16T00:00:00.000Z"),
    officialSourceRecordId: "source-annual-review",
    officialObservedAt: new Date("2025-11-16T00:00:00.000Z"),
    previousSourceRecordId: "source-legacy-crm",
    previousObservedAt: new Date("2023-05-10T00:00:00.000Z"),
    confidence: "High",
    lifecycleStatus: LifecycleStatus.CURRENT,
    explanation:
      "The 2025 annual review shortened the home-buying timeframe. The earlier five-year goal is retained as superseded historical context."
  },
  {
    id: "fact-risk-profile",
    field: "Risk profile",
    officialValue: "Balanced",
    candidateValue: "Growth-oriented",
    sourceRecordId: "source-annual-review",
    observedAt: new Date("2025-11-16T00:00:00.000Z"),
    officialSourceRecordId: "source-annual-review",
    officialObservedAt: new Date("2025-11-16T00:00:00.000Z"),
    candidateSourceRecordId: "source-meeting-note",
    candidateObservedAt: new Date("2026-06-04T00:00:00.000Z"),
    candidateEvidence:
      "Alex is considering a more growth-oriented investment approach.",
    confidence: "Medium",
    lifecycleStatus: LifecycleStatus.REQUIRES_ADVISER_APPROVAL,
    explanation:
      "The risk-profile change requires adviser approval because it is a high-impact client attribute. The Balanced profile remains official until reviewed."
  }
] as const;

export const workflowSteps = [
  { label: "Loaded legacy CRM record", status: WorkflowStepStatus.COMPLETE },
  { label: "Read 2025 annual review", status: WorkflowStepStatus.COMPLETE },
  { label: "Read 2026 adviser meeting note", status: WorkflowStepStatus.COMPLETE },
  { label: "Extracted candidate facts", status: WorkflowStepStatus.COMPLETE },
  { label: "Validated structured data", status: WorkflowStepStatus.COMPLETE },
  {
    label: "Reconciled current and historical facts",
    status: WorkflowStepStatus.COMPLETE
  },
  {
    label: "Escalated high-impact changes for adviser review",
    status: WorkflowStepStatus.ESCALATED
  },
  {
    label: "Generated annual-review preparation brief",
    status: WorkflowStepStatus.COMPLETE
  }
] as const;

const upsertDemoClient = async (client: Prisma.TransactionClient) => {
  const existingClient = await client.client.findUnique({
    where: { id: DEMO_CLIENT_ID },
    select: { id: true }
  });

  if (existingClient) {
    await client.client.update({
      where: { id: DEMO_CLIENT_ID },
      data: {
        name: "Alex Taylor",
        adviserName: "Jordan Bennett",
        reviewYear: 2026,
        reviewStatus: "Preparation in progress",
        mutationEpoch: { increment: 1 }
      }
    });
  } else {
    await client.client.create({
      data: {
        id: DEMO_CLIENT_ID,
        name: "Alex Taylor",
        adviserName: "Jordan Bennett",
        reviewYear: 2026,
        reviewStatus: "Preparation in progress",
        mutationEpoch: 0
      }
    });
  }
};

const clearDemoReviewData = async (client: Prisma.TransactionClient) => {
  await client.adviserDecision.deleteMany({
    where: { clientId: DEMO_CLIENT_ID }
  });
  await client.workflowRun.deleteMany({
    where: { clientId: DEMO_CLIENT_ID }
  });
  await client.clientFact.deleteMany({
    where: { clientId: DEMO_CLIENT_ID }
  });
  await client.sourceRecord.deleteMany({
    where: { clientId: DEMO_CLIENT_ID }
  });
};

const seedSourceRecords = async (client: Prisma.TransactionClient) => {
  for (const sourceRecord of sourceRecords) {
    await client.sourceRecord.create({
      data: {
        ...sourceRecord,
        clientId: DEMO_CLIENT_ID,
        content: [...sourceRecord.content]
      }
    });
  }
};

export const seedDemoBaselineFacts = async (
  client: Prisma.TransactionClient
) => {
  for (const fact of facts) {
    await client.clientFact.create({
      data: {
        ...fact,
        candidateValue: null,
        candidateSourceRecordId: null,
        candidateObservedAt: null,
        candidateEvidence: null,
        lifecycleStatus: LifecycleStatus.CURRENT,
        confidence:
          fact.id === "fact-address" || fact.id === "fact-risk-profile"
            ? "High"
            : fact.confidence,
        explanation:
          fact.id === "fact-address"
            ? "East Perth remains the official address until a newer source is reviewed."
            : fact.id === "fact-risk-profile"
            ? "Balanced remains the official risk profile until a newer source is reviewed."
            : fact.explanation,
        clientId: DEMO_CLIENT_ID
      }
    });
  }
};

export const seedUnpreparedDemoData = async (
  client: Prisma.TransactionClient
) => {
  await upsertDemoClient(client);
  await clearDemoReviewData(client);
  await seedSourceRecords(client);
};

export const seedDemoData = async (client: Prisma.TransactionClient) => {
  await upsertDemoClient(client);
  await clearDemoReviewData(client);
  await seedSourceRecords(client);

  for (const fact of facts) {
    await client.clientFact.create({
      data: {
        candidateValue: null,
        previousValue: null,
        ...fact,
        clientId: DEMO_CLIENT_ID
      }
    });
  }

  const workflowRun = await client.workflowRun.create({
    data: {
      id: "workflow-seeded-alex-2026",
      clientId: DEMO_CLIENT_ID,
      status: WorkflowRunStatus.PREPARED,
      completedAt: new Date("2026-06-04T00:05:00.000Z")
    }
  });

  await client.workflowStep.createMany({
    data: workflowSteps.map((step, index) => ({
      id: `workflow-seeded-step-${index + 1}`,
      workflowRunId: workflowRun.id,
      sequence: index + 1,
      label: step.label,
      status: step.status,
      detail:
        step.status === WorkflowStepStatus.ESCALATED
          ? "Address and risk-profile changes need adviser review."
          : null
    }))
  });
};
