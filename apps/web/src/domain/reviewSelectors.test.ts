import { describe, expect, it } from "vitest";
import type { AdviserAction, ClientFact, ClientReviewData } from "../types/demo.js";
import {
  selectActionQueue,
  selectClientReadySummary,
  selectDashboardSummary,
  selectHighImpactChanges,
  selectItemsRequiringAttention,
  selectRecentAdviserDecisions
} from "./reviewSelectors.js";

type DecisionSnapshot = NonNullable<AdviserAction["latestDecision"]>;

const createDecision = (
  overrides: Partial<DecisionSnapshot> = {}
): DecisionSnapshot => ({
  decision: "CONFIRM",
  note: null,
  candidateValue: "Subiaco",
  officialValueBefore: "East Perth",
  resultingOfficialValue: "Subiaco",
  actor: "demo-adviser",
  createdAt: "2026-06-24T00:00:00.000Z",
  ...overrides
});

const createFact = (overrides: Partial<ClientFact> = {}): ClientFact => ({
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
  memoryExplanation: "Address remains pending adviser confirmation.",
  ...overrides
});

const createAction = (
  overrides: Partial<AdviserAction> = {}
): AdviserAction => ({
  id: "confirm-address",
  factId: "fact-address",
  title: "Confirm whether Alex has moved to Subiaco",
  detail: "Meeting note mentions Subiaco, but the address has not been verified.",
  status: "Needs confirmation",
  lifecycleStatus: "NEEDS_CONFIRMATION",
  primaryDecision: "CONFIRM",
  secondaryDecision: "LEAVE_UNVERIFIED",
  primaryLabel: "Confirm",
  secondaryLabel: "Leave unverified",
  latestDecision: null,
  decisionHistory: [],
  ...overrides
});

const createRiskAction = (
  overrides: Partial<AdviserAction> = {}
): AdviserAction =>
  createAction({
    id: "review-risk-profile",
    factId: "fact-risk-profile",
    title: "Review the possible change from Balanced to a growth-oriented risk approach",
    detail: "This is a high-impact attribute and needs adviser approval before use.",
    status: "Requires adviser approval",
    lifecycleStatus: "REQUIRES_ADVISER_APPROVAL",
    primaryDecision: "APPROVE",
    secondaryDecision: "KEEP_CURRENT",
    primaryLabel: "Approve",
    secondaryLabel: "Keep current",
    ...overrides
  });

const createReview = (
  overrides: Partial<ClientReviewData> = {}
): ClientReviewData => ({
  client: {
    id: "demo-alex-taylor",
    name: "Alex Taylor",
    adviserName: "Jordan Lee",
    reviewYear: 2026,
    reviewStatus: "Ready for adviser review"
  },
  summaryMetrics: [
    { value: "8", label: "Facts reviewed" },
    { value: "2", label: "Items needing confirmation" }
  ],
  sourceRecords: [],
  clientFacts: [
    createFact(),
    createFact({
      id: "fact-risk-profile",
      field: "Risk profile",
      currentLabel: "Official value",
      currentValue: "Balanced",
      officialValue: "Balanced",
      candidateValue: "High Growth",
      lifecycleStatus: "REQUIRES_ADVISER_APPROVAL",
      status: "Requires adviser approval",
      memoryExplanation: "Risk profile requires adviser approval."
    })
  ],
  meaningfulChanges: [
    "Annual income increased from AUD 110,000 to AUD 135,000",
    "Risk profile candidate: Balanced to High Growth"
  ],
  adviserActions: [createAction(), createRiskAction()],
  workflowTrace: [],
  ...overrides
});

describe("review selectors", () => {
  it("builds a dashboard summary from only the current ReviewResponse", () => {
    const review = createReview();
    const dashboard = selectDashboardSummary(review);

    expect(dashboard.currentReview).toEqual({
      clientId: "demo-alex-taylor",
      clientName: "Alex Taylor",
      adviserName: "Jordan Lee",
      reviewYear: 2026,
      reviewStatus: "Ready for adviser review"
    });
    expect(dashboard.summaryMetrics).toEqual(review.summaryMetrics);
    expect(dashboard.meaningfulChanges).toEqual(review.meaningfulChanges);
    expect(dashboard.itemsRequiringAttention).toHaveLength(2);
    expect(dashboard.highImpactChanges).toHaveLength(1);
    expect(dashboard).not.toHaveProperty("upcomingReviews");
    expect(dashboard).not.toHaveProperty("overdueReviews");
    expect(dashboard).not.toHaveProperty("completedReviews");
  });

  it("copies dashboard source arrays instead of returning mutable references", () => {
    const review = createReview();
    const dashboard = selectDashboardSummary(review);

    expect(dashboard.summaryMetrics).toEqual(review.summaryMetrics);
    expect(dashboard.meaningfulChanges).toEqual(review.meaningfulChanges);
    expect(dashboard.summaryMetrics).not.toBe(review.summaryMetrics);
    expect(dashboard.meaningfulChanges).not.toBe(review.meaningfulChanges);
    expect(dashboard.summaryMetrics[0]).not.toBe(review.summaryMetrics[0]);
  });

  it("groups the action queue into only supported pending categories", () => {
    const queue = selectActionQueue(createReview());

    expect(queue.map((group) => group.category)).toEqual([
      "needs-confirmation",
      "requires-adviser-approval"
    ]);
    expect(queue[0]).toMatchObject({
      title: "Needs confirmation",
      items: [
        {
          actionId: "confirm-address",
          factId: "fact-address",
          category: "needs-confirmation",
          primaryLabel: "Confirm",
          secondaryLabel: "Leave unverified"
        }
      ]
    });
    expect(queue[1]).toMatchObject({
      title: "Requires adviser approval",
      items: [
        {
          actionId: "review-risk-profile",
          factId: "fact-risk-profile",
          category: "requires-adviser-approval",
          primaryLabel: "Approve",
          secondaryLabel: "Keep current"
        }
      ]
    });
  });

  it("excludes decided actions from the action queue", () => {
    const queue = selectActionQueue(
      createReview({
        adviserActions: [
          createAction({
            latestDecision: createDecision()
          }),
          createRiskAction()
        ]
      })
    );

    expect(queue[0]?.items).toEqual([]);
    expect(queue[1]?.items).toEqual([
      expect.objectContaining({
        actionId: "review-risk-profile",
        category: "requires-adviser-approval"
      })
    ]);
  });

  it("does not infer unsupported conflict or overdue action categories", () => {
    const items = selectItemsRequiringAttention(
      createReview({
        adviserActions: [
          createAction({
            detail: "Candidate differs from official value and has evidence text."
          }),
          createRiskAction()
        ]
      })
    );

    expect(items.map((item) => item.category)).toEqual([
      "needs-confirmation",
      "requires-adviser-approval"
    ]);
    expect(items.map((item) => item.category)).not.toContain("conflicting-evidence");
    expect(items.map((item) => item.category)).not.toContain("overdue");
  });

  it("selects unresolved high-impact changes from requires-approval actions only", () => {
    const changes = selectHighImpactChanges(createReview());

    expect(changes).toEqual([
      expect.objectContaining({
        actionId: "review-risk-profile",
        factId: "fact-risk-profile",
        field: "Risk profile",
        currentValue: "Balanced",
        candidateValue: "High Growth"
      })
    ]);
  });

  it("excludes resolved high-impact actions", () => {
    const changes = selectHighImpactChanges(
      createReview({
        adviserActions: [
          createAction(),
          createRiskAction({
            latestDecision: createDecision({
              decision: "APPROVE",
              officialValueBefore: "Balanced",
              resultingOfficialValue: "High Growth"
            })
          })
        ]
      })
    );

    expect(changes).toEqual([]);
  });

  it("returns recent adviser decisions newest first from decision history", () => {
    const decisions = selectRecentAdviserDecisions(
      createReview({
        adviserActions: [
          createAction({
            latestDecision: createDecision(),
            decisionHistory: [
              createDecision({
                decision: "LEAVE_UNVERIFIED",
                resultingOfficialValue: "East Perth",
                createdAt: "2026-06-23T00:00:00.000Z"
              }),
              createDecision()
            ]
          })
        ]
      })
    );

    expect(decisions.map((decision) => decision.decision)).toEqual([
      "CONFIRM",
      "LEAVE_UNVERIFIED"
    ]);
    expect(decisions[0]).toMatchObject({
      factId: "fact-address",
      field: "Address",
      actor: "demo-adviser",
      candidateValue: "Subiaco",
      officialValueBefore: "East Perth",
      resultingOfficialValue: "Subiaco"
    });
  });

  it("uses deterministic tie-breaking for equal decision timestamps", () => {
    const createdAt = "2026-06-24T00:00:00.000Z";
    const decisions = selectRecentAdviserDecisions(
      createReview({
        adviserActions: [
          createRiskAction({
            latestDecision: createDecision({
              decision: "APPROVE",
              createdAt,
              officialValueBefore: "Balanced",
              resultingOfficialValue: "High Growth"
            }),
            decisionHistory: [
              createDecision({
                decision: "KEEP_CURRENT",
                createdAt,
                resultingOfficialValue: "Balanced"
              }),
              createDecision({
                decision: "APPROVE",
                createdAt,
                officialValueBefore: "Balanced",
                resultingOfficialValue: "High Growth"
              })
            ]
          }),
          createAction({
            latestDecision: createDecision({ decision: "CONFIRM", createdAt }),
            decisionHistory: [
              createDecision({ decision: "LEAVE_UNVERIFIED", createdAt }),
              createDecision({ decision: "CONFIRM", createdAt })
            ]
          })
        ]
      })
    );

    expect(
      decisions.map((decision) => `${decision.actionId}:${decision.decision}`)
    ).toEqual([
      "confirm-address:CONFIRM",
      "confirm-address:LEAVE_UNVERIFIED",
      "review-risk-profile:APPROVE",
      "review-risk-profile:KEEP_CURRENT"
    ]);
  });

  it("falls back to latestDecision when decisionHistory is empty", () => {
    const decisions = selectRecentAdviserDecisions(
      createReview({
        adviserActions: [
          createAction({
            latestDecision: createDecision({
              decision: "LEAVE_UNVERIFIED",
              resultingOfficialValue: "East Perth"
            }),
            decisionHistory: []
          })
        ]
      })
    );

    expect(decisions).toEqual([
      expect.objectContaining({
        actionId: "confirm-address",
        decision: "LEAVE_UNVERIFIED",
        officialValueBefore: "East Perth",
        resultingOfficialValue: "East Perth"
      })
    ]);
  });

  it("handles missing related facts safely", () => {
    const review = createReview({
      clientFacts: [],
      adviserActions: [
        createRiskAction({
          latestDecision: createDecision({
            decision: "APPROVE",
            officialValueBefore: "Balanced",
            resultingOfficialValue: "High Growth"
          })
        })
      ]
    });

    expect(selectHighImpactChanges(review)).toEqual([]);
    expect(selectRecentAdviserDecisions(review)).toEqual([
      expect.objectContaining({
        actionId: "review-risk-profile",
        factId: "fact-risk-profile",
        field: null
      })
    ]);
  });

  it("builds a client-ready summary without technical execution fields", () => {
    const summary = selectClientReadySummary(
      createReview({
        adviserActions: [
          createAction({
            latestDecision: createDecision(),
            decisionHistory: [createDecision()]
          }),
          createRiskAction()
        ]
      })
    );

    expect(summary.client.clientName).toBe("Alex Taylor");
    expect(summary.currentClientPicture).toHaveLength(2);
    expect(summary.confirmedChanges).toEqual([
      {
        factId: "fact-address",
        field: "Address",
        decision: "CONFIRM",
        fromValue: "East Perth",
        toValue: "Subiaco",
        decidedAt: "2026-06-24T00:00:00.000Z"
      }
    ]);
    expect(summary.outstandingQuestions).toEqual([
      expect.objectContaining({
        actionId: "review-risk-profile",
        category: "requires-adviser-approval"
      })
    ]);
    expect(summary).not.toHaveProperty("workflowTrace");
    expect(summary).not.toHaveProperty("executionMetadata");
    expect(summary).not.toHaveProperty("extractionMetadata");
  });
});
