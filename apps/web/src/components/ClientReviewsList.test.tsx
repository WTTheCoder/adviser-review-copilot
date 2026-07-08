import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ReviewResponse } from "@client-review-prep/shared";
import { ClientReviewsList } from "./ClientReviewsList.js";

type InspectableProps = Record<string, unknown> & {
  children?: ReactNode;
};
type InspectableElement = ReactElement<InspectableProps>;

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

const rowTextForMarkup = (markup: string, clientName: string) => {
  const row = markup.match(
    new RegExp(`<tr[^>]*>[\\s\\S]*?${clientName}[\\s\\S]*?</tr>`)
  );

  return row ? row[0].replaceAll(/<[^>]+>/g, "") : "";
};

const decision = (): NonNullable<
  ReviewResponse["adviserActions"][number]["latestDecision"]
> => ({
  decision: "CONFIRM",
  actor: "demo-adviser",
  note: null,
  candidateValue: "Subiaco",
  candidateSourceRecordId: "source-meeting-note",
  candidateSourceDocument: "Adviser Meeting Note",
  candidateObservedAt: "2026-06-04T00:00:00.000Z",
  candidateObservedDate: "2026-06-04",
  officialValueBefore: "East Perth",
  resultingOfficialValue: "Subiaco",
  createdAt: "2026-06-05T00:00:00.000Z"
});

const createReview = ({
  prepared = true,
  resolved = false
}: {
  prepared?: boolean;
  resolved?: boolean;
} = {}): ReviewResponse => ({
  client: {
    id: "demo-alex-taylor",
    name: "Alex Taylor",
    adviserName: "Jordan Bennett",
    reviewYear: 2026,
    reviewStatus: prepared ? "Ready for adviser review" : "Preparation in progress"
  },
  summaryMetrics: [],
  sourceRecords: [],
  clientFacts: prepared
    ? [
        {
          id: "fact-address",
          field: "Address",
          currentLabel: resolved ? "Current value" : "Official value",
          currentValue: resolved ? "Subiaco" : "East Perth",
          previousValue: null,
          candidateValue: resolved ? null : "Subiaco",
          sourceRecordId: "source-annual-review",
          sourceDocument: "Annual Review",
          observedAt: "2025-11-16T00:00:00.000Z",
          observedDate: "2025-11-16",
          officialValue: resolved ? "Subiaco" : "East Perth",
          officialSourceRecordId: "source-annual-review",
          officialSourceDocument: "Annual Review",
          officialObservedAt: "2025-11-16T00:00:00.000Z",
          officialObservedDate: "2025-11-16",
          previousSourceRecordId: null,
          previousSourceDocument: null,
          previousObservedAt: null,
          previousObservedDate: null,
          candidateSourceRecordId: resolved ? null : "source-meeting-note",
          candidateSourceDocument: resolved ? null : "Adviser Meeting Note",
          candidateObservedAt: resolved ? null : "2026-06-04T00:00:00.000Z",
          candidateObservedDate: resolved ? null : "2026-06-04",
          candidateEvidence: resolved ? null : "Alex may have moved to Subiaco.",
          confidence: "Medium",
          status: resolved ? "Current" : "Needs confirmation",
          lifecycleStatus: resolved ? "CURRENT" : "NEEDS_CONFIRMATION",
          memoryExplanation: "Address requires adviser confirmation."
        }
      ]
    : [],
  meaningfulChanges: prepared ? ["Address has a candidate update."] : [],
  adviserActions: prepared
    ? [
        {
          id: "confirm-address",
          factId: "fact-address",
          title: "Confirm whether Alex has moved to Subiaco",
          detail: "Meeting note mentions Subiaco.",
          status: resolved ? "Current" : "Needs confirmation",
          lifecycleStatus: resolved ? "CURRENT" : "NEEDS_CONFIRMATION",
          primaryDecision: "CONFIRM",
          secondaryDecision: "LEAVE_UNVERIFIED",
          primaryLabel: "Confirm",
          secondaryLabel: "Leave unverified",
          latestDecision: resolved ? decision() : null,
          decisionHistory: resolved ? [decision()] : []
        },
        {
          id: "review-risk-profile",
          factId: "fact-risk-profile",
          title: "Review risk profile",
          detail: "Risk profile needs approval.",
          status: resolved ? "Current" : "Requires adviser approval",
          lifecycleStatus: resolved ? "CURRENT" : "REQUIRES_ADVISER_APPROVAL",
          primaryDecision: "APPROVE",
          secondaryDecision: "KEEP_CURRENT",
          primaryLabel: "Approve",
          secondaryLabel: "Keep current",
          latestDecision: resolved
            ? { ...decision(), decision: "APPROVE", resultingOfficialValue: "Growth-oriented" }
            : null,
          decisionHistory: resolved
            ? [
                {
                  ...decision(),
                  decision: "APPROVE",
                  resultingOfficialValue: "Growth-oriented"
                }
              ]
            : []
        }
      ]
    : [],
  workflowTrace: []
});

describe("ClientReviewsList", () => {
  it("renders the enterprise client reviews worklist", () => {
    const markup = renderToStaticMarkup(
      <ClientReviewsList
        review={createReview()}
        onOpenAlexReview={() => undefined}
      />
    );

    expect(markup).toContain("Client Reviews");
    expect(markup).toContain("Manage active annual reviews and open adviser work.");
    expect(markup).toContain("Alex Taylor");
    expect(markup).toContain("Emma Wilson");
    expect(markup).toContain("Daniel Harris");
    expect(markup).toContain("Sarah Brown");
    expect(markup).toContain("Michael Parker");
    expect(markup).toContain("Ready for adviser review");
    expect(markup).toContain("Preparing review");
    expect(markup).toContain("Ready for client meeting");
    expect(markup).toContain("Review completed");
    expect(markup).toContain("Awaiting source documents");
  });

  it("derives the Alex row from an unprepared review", () => {
    const tree = ClientReviewsList({
      review: createReview({ prepared: false }),
      onOpenAlexReview: () => undefined
    });
    const alexRow = rowTextForMarkup(renderToStaticMarkup(tree), "Alex Taylor");

    expect(alexRow).toContain("Jordan Bennett");
    expect(alexRow).toContain("2026 Client Review");
    expect(alexRow).toContain("Ready to prepare");
    expect(alexRow).toContain("0");
  });

  it("derives the Alex row from a prepared review with open actions", () => {
    const tree = ClientReviewsList({
      review: createReview(),
      onOpenAlexReview: () => undefined
    });
    const alexRow = rowTextForMarkup(renderToStaticMarkup(tree), "Alex Taylor");

    expect(alexRow).toContain("Jordan Bennett");
    expect(alexRow).toContain("Ready for adviser review");
    expect(alexRow).toContain("2");
  });

  it("keeps the prepared Alex row but drops open actions after decisions", () => {
    const tree = ClientReviewsList({
      review: createReview({ resolved: true }),
      onOpenAlexReview: () => undefined
    });
    const alexRow = rowTextForMarkup(renderToStaticMarkup(tree), "Alex Taylor");

    expect(alexRow).toContain("Ready for adviser review");
    expect(alexRow).toContain("0");
  });

  it("only exposes an active Open review action for Alex Taylor", () => {
    const onOpenAlexReview = vi.fn();
    const tree = ClientReviewsList({
      review: createReview(),
      onOpenAlexReview
    });
    const markup = renderToStaticMarkup(tree);
    const openButtons = findButtons(tree, "Open review");

    expect(openButtons).toHaveLength(1);
    expect(markup).toContain("Unavailable");

    (openButtons[0]?.props.onClick as () => void)();

    expect(onOpenAlexReview).toHaveBeenCalledTimes(1);
  });
});
