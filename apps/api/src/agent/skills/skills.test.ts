import { DecisionType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { ReviewResponse } from "@client-review-prep/shared";
import { ExecutionHarness } from "../harness/executionHarness.js";
import { SkillRegistry } from "../registry/skillRegistry.js";
import { applyAdviserDecisionSkill } from "./applyAdviserDecisionSkill.js";
import { loadClientContextSkill } from "./loadClientContextSkill.js";
import { prepareAnnualReviewSkill } from "./prepareAnnualReviewSkill.js";
import { reviewResponseSchema } from "@client-review-prep/shared";
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
import { MockCandidateFactExtractor } from "../../ai/providers/mockCandidateFactExtractor.js";
import type {
  CandidateFact,
  CandidateFactExtractionResult
} from "../../ai/contracts/candidateFactSchemas.js";
import type { CandidateFactExtractor } from "../../ai/contracts/candidateFactExtractor.js";

const createCandidateFact = (
  field: CandidateFact["field"],
  proposedValue: string
): CandidateFact => ({
  field,
  proposedValue,
  confidence: "MEDIUM",
  evidence: `Evidence for ${proposedValue}`,
  sourceRecordId: "source-meeting-note",
  observedDate: "2026-06-04",
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

const createReview = (): ReviewResponse => ({
  client: {
    id: "demo-alex-taylor",
    name: "Alex Taylor",
    adviserName: "Jordan Lee",
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
      sourceRecordId: "source-meeting-note",
      sourceDocument: "Adviser Meeting Note",
      observedAt: "2026-06-04T00:00:00.000Z",
      observedDate: "4 June 2026",
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
      sourceRecordId: "source-meeting-note",
      sourceDocument: "Adviser Meeting Note",
      observedAt: "2026-06-04T00:00:00.000Z",
      observedDate: "4 June 2026",
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
  extractor: CandidateFactExtractor = new MockCandidateFactExtractor()
) => {
  const skillRegistry = new SkillRegistry();
  const toolRegistry = new ToolRegistry();
  const review = createReview();
  const workflowSteps: Array<{
    label: string;
    status: "COMPLETE" | "ESCALATED" | "FAILED";
    detail: string | null;
  }> = [];

  skillRegistry.register(loadClientContextSkill);
  skillRegistry.register(prepareAnnualReviewSkill);
  skillRegistry.register(applyAdviserDecisionSkill);

  const legacyAdapter = {
    getLegacyClientRecord: async () => ({
      id: "demo-alex-taylor",
      name: "Alex Taylor",
      adviserName: "Jordan Lee",
      reviewYear: 2026,
      reviewStatus: "Preparation in progress",
      createdAt: new Date(),
      updatedAt: new Date()
    }),
    getLegacySourceRecords: async () => [
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
    ],
    getLegacyFacts: async () => []
  } satisfies LegacyCrmToolAdapter;

  const reviewService = {
    createWorkflowRun: async () => ({ id: "workflow-1" }),
    recordWorkflowStep: async (
      input: Parameters<ReviewToolService["recordWorkflowStep"]>[0]
    ) => {
      workflowSteps.push({
        label: input.label,
        status: input.status,
        detail: input.detail ?? null
      });
      return { id: `step-${workflowSteps.length}` };
    },
    applyExtractedCandidateProjection: async (_clientId, candidates) => {
      const address = review.clientFacts.find((fact) => fact.id === "fact-address");
      const risk = review.clientFacts.find(
        (fact) => fact.id === "fact-risk-profile"
      );
      const extractedAddress = candidates.find(
        (candidate) => candidate.field === "ADDRESS"
      );
      const extractedRisk = candidates.find(
        (candidate) => candidate.field === "RISK_PROFILE"
      );

      if (address) {
        address.candidateValue = extractedAddress?.proposedValue ?? null;
        address.lifecycleStatus = extractedAddress
          ? "NEEDS_CONFIRMATION"
          : "CURRENT";
        address.status = extractedAddress ? "Needs confirmation" : "Current";
      }

      if (risk) {
        risk.candidateValue = extractedRisk?.proposedValue ?? null;
        risk.lifecycleStatus = extractedRisk
          ? "REQUIRES_ADVISER_APPROVAL"
          : "CURRENT";
        risk.status = extractedRisk ? "Requires adviser approval" : "Current";
      }
    },
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
        fact.officialValue = fact.candidateValue ?? fact.officialValue;
        fact.currentValue = fact.officialValue;
        fact.candidateValue = null;
        fact.lifecycleStatus = "CURRENT";
        fact.status = "Current";
      }

      if (fact && payload.decision === DecisionType.APPROVE) {
        fact.previousValue = fact.officialValue;
        fact.officialValue = fact.candidateValue ?? fact.officialValue;
        fact.currentValue = fact.officialValue;
        fact.candidateValue = null;
        fact.lifecycleStatus = "CURRENT";
        fact.status = "Current";
      }

      if (
        fact &&
        (payload.decision === DecisionType.LEAVE_UNVERIFIED ||
          payload.decision === DecisionType.KEEP_CURRENT)
      ) {
        fact.candidateValue = null;
        fact.lifecycleStatus = "CURRENT";
        fact.status = "Current";
      }

      return {
        ...review,
        summaryMetrics: buildSummaryMetrics(review),
        workflowTrace: review.workflowTrace
      };
    }
  } satisfies ReviewToolService;

  for (const tool of [
    ...createAiExtractionTools(extractor),
    ...createLegacyCrmTools(legacyAdapter),
    ...createReviewTools(reviewService)
  ]) {
    toolRegistry.register(tool);
  }

  return {
    harness: new ExecutionHarness(skillRegistry, toolRegistry),
    review,
    workflowSteps
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
        ? JSON.stringify(result.output.clientFacts).includes(freeFormPhrase)
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
            step.label.includes("Unsupported extracted candidates omitted")
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
