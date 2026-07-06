import type {
  AdviserAction,
  ClientFact,
  ClientReviewData,
  SummaryMetric
} from "../types/demo.js";
import { getAdviserActionPresentation } from "./factPresentation.js";

export type DashboardAttentionItem = {
  actionId: AdviserAction["id"];
  factId: string;
  clientId: string;
  clientName: string;
  category: ActionQueueCategory;
  title: string;
  detail: string;
  status: string;
  primaryLabel: string;
  secondaryLabel: string;
};

export type DashboardHighImpactChange = {
  actionId: AdviserAction["id"];
  factId: string;
  field: string | null;
  currentValue: string | null;
  candidateValue: string | null;
  title: string;
  detail: string;
};

export type DashboardSummary = {
  currentReview: {
    clientId: string;
    clientName: string;
    adviserName: string;
    reviewYear: number;
    reviewStatus: string;
  };
  summaryMetrics: ReadonlyArray<SummaryMetric>;
  itemsRequiringAttention: ReadonlyArray<DashboardAttentionItem>;
  meaningfulChanges: readonly string[];
  highImpactChanges: ReadonlyArray<DashboardHighImpactChange>;
  recentAdviserDecisions: ReadonlyArray<RecentAdviserDecision>;
};

export type ActionQueueCategory =
  | "needs-confirmation"
  | "requires-adviser-approval";

export type ActionQueueGroup = {
  category: ActionQueueCategory;
  title: string;
  items: ReadonlyArray<DashboardAttentionItem>;
};

export type RecentAdviserDecision = {
  actionId: AdviserAction["id"];
  factId: string;
  field: string | null;
  decision: NonNullable<AdviserAction["latestDecision"]>["decision"];
  createdAt: string;
  actor: string | null;
  candidateValue: string | null;
  officialValueBefore: string | null;
  resultingOfficialValue: string | null;
  title: string;
};

export type ClientReadySummary = {
  client: DashboardSummary["currentReview"];
  currentClientPicture: ReadonlyArray<{
    factId: string;
    field: string;
    label: string;
    value: string;
    status: string;
    observedDate: string;
    sourceDocument: string;
  }>;
  confirmedChanges: ReadonlyArray<{
    factId: string;
    field: string | null;
    decision: "CONFIRM" | "APPROVE";
    fromValue: string | null;
    toValue: string | null;
    decidedAt: string;
  }>;
  outstandingQuestions: ReadonlyArray<DashboardAttentionItem>;
  adviserDecisions: ReadonlyArray<RecentAdviserDecision>;
};

const actionQueueTitles: Record<ActionQueueCategory, string> = {
  "needs-confirmation": "Needs confirmation",
  "requires-adviser-approval": "Requires adviser approval"
};

const categoryForAction = (
  action: AdviserAction
): ActionQueueCategory | null => {
  if (action.lifecycleStatus === "NEEDS_CONFIRMATION") {
    return "needs-confirmation";
  }

  if (action.lifecycleStatus === "REQUIRES_ADVISER_APPROVAL") {
    return "requires-adviser-approval";
  }

  return null;
};

const factForAction = (
  facts: readonly ClientFact[],
  action: AdviserAction
) => facts.find((fact) => fact.id === action.factId) ?? null;

const toAttentionItem = (
  review: ClientReviewData,
  action: AdviserAction
): DashboardAttentionItem | null => {
  if (action.latestDecision) {
    return null;
  }

  const category = categoryForAction(action);
  if (!category) {
    return null;
  }

  const fact = factForAction(review.clientFacts, action);
  const presentation = getAdviserActionPresentation(action, fact);

  return {
    actionId: action.id,
    factId: action.factId,
    clientId: review.client.id,
    clientName: review.client.name,
    category,
    title: presentation.title,
    detail: presentation.detail,
    status: action.status,
    primaryLabel: action.primaryLabel,
    secondaryLabel: action.secondaryLabel
  };
};

export const selectActionQueue = (
  review: ClientReviewData
): ReadonlyArray<ActionQueueGroup> => {
  const items = review.adviserActions.flatMap((action) => {
    const item = toAttentionItem(review, action);
    return item ? [item] : [];
  });

  return (Object.keys(actionQueueTitles) as ActionQueueCategory[]).map(
    (category) => ({
      category,
      title: actionQueueTitles[category],
      items: items.filter((item) => item.category === category)
    })
  );
};

export const selectItemsRequiringAttention = (
  review: ClientReviewData
): ReadonlyArray<DashboardAttentionItem> =>
  selectActionQueue(review).flatMap((group) => group.items);

export const selectHighImpactChanges = (
  review: ClientReviewData
): ReadonlyArray<DashboardHighImpactChange> =>
  review.adviserActions.flatMap((action) => {
    if (
      action.latestDecision ||
      action.lifecycleStatus !== "REQUIRES_ADVISER_APPROVAL"
    ) {
      return [];
    }

    const fact = factForAction(review.clientFacts, action);
    const presentation = getAdviserActionPresentation(action, fact);

    return [
      {
        actionId: action.id,
        factId: action.factId,
        field: fact?.field ?? null,
        currentValue: fact?.currentValue ?? null,
        candidateValue: fact?.candidateValue ?? null,
        title: presentation.title,
        detail: presentation.detail
      }
    ];
  });

export const selectRecentAdviserDecisions = (
  review: ClientReviewData
): ReadonlyArray<RecentAdviserDecision> =>
  review.adviserActions
    .flatMap((action) => {
      const fact = factForAction(review.clientFacts, action);
      const decisions =
        action.decisionHistory && action.decisionHistory.length > 0
          ? action.decisionHistory
          : action.latestDecision
            ? [action.latestDecision]
            : [];

      return decisions.map((decision) => ({
        actionId: action.id,
        factId: action.factId,
        field: fact?.field ?? null,
        decision: decision.decision,
        createdAt: decision.createdAt,
        actor: decision.actor ?? null,
        candidateValue: decision.candidateValue ?? null,
        officialValueBefore: decision.officialValueBefore ?? null,
        resultingOfficialValue: decision.resultingOfficialValue ?? null,
        title: getAdviserActionPresentation(action, fact).title
      }));
    })
    .sort(
      (first, second) =>
        second.createdAt.localeCompare(first.createdAt) ||
        first.actionId.localeCompare(second.actionId) ||
        first.decision.localeCompare(second.decision)
    );

export const selectDashboardSummary = (
  review: ClientReviewData
): DashboardSummary => ({
  currentReview: {
    clientId: review.client.id,
    clientName: review.client.name,
    adviserName: review.client.adviserName,
    reviewYear: review.client.reviewYear,
    reviewStatus: review.client.reviewStatus
  },
  summaryMetrics: review.summaryMetrics.map((metric) => ({ ...metric })),
  itemsRequiringAttention: selectItemsRequiringAttention(review),
  meaningfulChanges: [...review.meaningfulChanges],
  highImpactChanges: selectHighImpactChanges(review),
  recentAdviserDecisions: selectRecentAdviserDecisions(review)
});

export const selectClientReadySummary = (
  review: ClientReviewData
): ClientReadySummary => {
  const dashboard = selectDashboardSummary(review);
  const adviserDecisions = dashboard.recentAdviserDecisions;

  return {
    client: dashboard.currentReview,
    currentClientPicture: review.clientFacts.map((fact) => ({
      factId: fact.id,
      field: fact.field,
      label: fact.currentLabel,
      value: fact.currentValue,
      status: fact.status,
      observedDate: fact.officialObservedDate,
      sourceDocument: fact.officialSourceDocument
    })),
    confirmedChanges: adviserDecisions.flatMap((decision) => {
      if (decision.decision !== "CONFIRM" && decision.decision !== "APPROVE") {
        return [];
      }

      return [
        {
          factId: decision.factId,
          field: decision.field,
          decision: decision.decision,
          fromValue: decision.officialValueBefore,
          toValue: decision.resultingOfficialValue,
          decidedAt: decision.createdAt
        }
      ];
    }),
    outstandingQuestions: dashboard.itemsRequiringAttention,
    adviserDecisions
  };
};
