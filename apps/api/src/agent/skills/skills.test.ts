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
import {
  createLegacyCrmTools,
  type LegacyCrmToolAdapter
} from "../tools/legacyCrmTools.js";
import {
  createReviewTools,
  type ReviewToolService
} from "../tools/reviewTools.js";

const review: ReviewResponse = {
  client: {
    id: "demo-alex-taylor",
    name: "Alex Taylor",
    adviserName: "Jordan Lee",
    reviewYear: 2026,
    reviewStatus: "Ready for adviser review"
  },
  summaryMetrics: [],
  sourceRecords: [],
  clientFacts: [],
  meaningfulChanges: [],
  adviserActions: [],
  workflowTrace: []
};

const createHarness = () => {
  const skillRegistry = new SkillRegistry();
  const toolRegistry = new ToolRegistry();
  const workflowSteps: Array<{
    label: string;
    status: "COMPLETE" | "ESCALATED" | "FAILED";
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
    getLegacySourceRecords: async () => [],
    getLegacyFacts: async () => []
  } satisfies LegacyCrmToolAdapter;

  const reviewService = {
    createWorkflowRun: async () => ({ id: "workflow-1" }),
    recordWorkflowStep: async (
      input: Parameters<ReviewToolService["recordWorkflowStep"]>[0]
    ) => {
      workflowSteps.push({ label: input.label, status: input.status });
      return { id: `step-${workflowSteps.length}` };
    },
    buildReviewResponse: async () => ({
      ...review,
      workflowTrace: workflowSteps.map((step) => ({
        label: step.label,
        status: step.status,
        detail: null
      }))
    }),
    recordDecision: async () => review
  } satisfies ReviewToolService;

  for (const tool of [
    ...createLegacyCrmTools(legacyAdapter),
    ...createReviewTools(reviewService)
  ]) {
    toolRegistry.register(tool);
  }

  return {
    harness: new ExecutionHarness(skillRegistry, toolRegistry),
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
});
