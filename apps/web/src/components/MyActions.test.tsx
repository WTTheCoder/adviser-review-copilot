import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ReviewResponse } from "@client-review-prep/shared";
import { MyActions } from "./MyActions.js";

type InspectableProps = Record<string, unknown> & {
  children?: ReactNode;
};
type InspectableElement = ReactElement<InspectableProps>;

const review = (): ReviewResponse => ({
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
      candidateEvidence: null,
      confidence: "Medium",
      lifecycleStatus: "NEEDS_CONFIRMATION",
      status: "Needs confirmation",
      memoryExplanation: "Address remains pending adviser confirmation."
    },
    {
      id: "fact-risk-profile",
      field: "Risk profile",
      currentLabel: "Official value",
      currentValue: "Balanced",
      officialValue: "Balanced",
      candidateValue: "High Growth",
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
      candidateEvidence: null,
      confidence: "Medium",
      lifecycleStatus: "REQUIRES_ADVISER_APPROVAL",
      status: "Requires adviser approval",
      memoryExplanation: "Risk profile requires adviser approval."
    }
  ],
  meaningfulChanges: [],
  adviserActions: [
    {
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
      decisionHistory: []
    },
    {
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
      latestDecision: null,
      decisionHistory: []
    }
  ],
  workflowTrace: []
});

const textContent = (node: ReactNode): string =>
  Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }
      if (isValidElement<InspectableProps>(child)) {
        return textContent(child.props.children);
      }
      return "";
    })
    .join("");

const findButtons = (
  node: ReactNode,
  label: string,
  matches: InspectableElement[] = []
) => {
  if (!isValidElement<InspectableProps>(node)) {
    return matches;
  }
  if (node.type === "button" && textContent(node.props.children) === label) {
    matches.push(node);
  }
  Children.toArray(node.props.children).forEach((child) =>
    findButtons(child, label, matches)
  );
  return matches;
};

describe("MyActions", () => {
  it("shows a unified queue with the two supported action types and counts", () => {
    const markup = renderToStaticMarkup(
      <MyActions review={review()} onOpenReview={() => undefined} />
    );

    expect(markup).toContain("Action queue");
    expect(markup).toContain("Priority");
    expect(markup).toContain("Client");
    expect(markup).toContain("Action");
    expect(markup).toContain("Type");
    expect(markup).toContain("Status");
    expect(markup).toContain("Direct action");
    expect(markup).toContain("Needs confirmation");
    expect(markup).toContain("Requires adviser approval");
    expect(markup).toContain("2 open actions");
    expect(markup).toContain("Confirm whether Alex has moved to Subiaco");
    expect(markup).toContain(
      "Review the possible change from Balanced to High Growth"
    );
    expect(markup).toContain("Standard");
    expect(markup).toContain("High");
  });

  it("excludes decided actions and uses honest empty states", () => {
    const resolvedReview = review();
    const addressAction = resolvedReview.adviserActions[0];
    const riskAction = resolvedReview.adviserActions[1];
    if (!addressAction || !riskAction) {
      throw new Error("Expected action fixtures.");
    }
    resolvedReview.adviserActions = [
      {
        ...addressAction,
        lifecycleStatus: "CURRENT",
        status: "Current",
        latestDecision: {
          decision: "CONFIRM",
          note: null,
          candidateValue: "Subiaco",
          createdAt: "2026-06-24T00:00:00.000Z"
        }
      },
      {
        ...riskAction,
        lifecycleStatus: "CURRENT",
        status: "Current",
        latestDecision: {
          decision: "APPROVE",
          note: null,
          candidateValue: "High Growth",
          createdAt: "2026-06-24T00:00:00.000Z"
        }
      }
    ];
    const markup = renderToStaticMarkup(
      <MyActions review={resolvedReview} onOpenReview={() => undefined} />
    );

    expect(markup).toContain("0 open actions");
    expect(markup).toContain("No actions in this queue.");
    expect(markup).not.toContain("Open review action");
  });

  it("does not render unsupported action categories", () => {
    const markup = renderToStaticMarkup(
      <MyActions review={review()} onOpenReview={() => undefined} />
    ).toLowerCase();

    expect(markup).not.toContain("overdue");
    expect(markup).not.toContain("conflict");
    expect(markup).not.toContain("upcoming");
    expect(markup).not.toContain("portfolio");
  });

  it("opens Client Review with the selected fact id", () => {
    const onOpenReview = vi.fn();
    const tree = MyActions({ review: review(), onOpenReview });
    const buttons = findButtons(tree, "Open review action");

    (buttons[0]?.props.onClick as () => void)();
    (buttons[1]?.props.onClick as () => void)();

    expect(onOpenReview).toHaveBeenNthCalledWith(1, "fact-address");
    expect(onOpenReview).toHaveBeenNthCalledWith(2, "fact-risk-profile");
  });
});
