import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AdviserDecisionSnapshotDto, ReviewResponse } from "@client-review-prep/shared";
import { AdviserDashboard } from "./AdviserDashboard.js";

type InspectableProps = Record<string, unknown> & {
  children?: ReactNode;
};
type InspectableElement = ReactElement<InspectableProps>;

const decision = (
  overrides: Partial<AdviserDecisionSnapshotDto> = {}
): AdviserDecisionSnapshotDto => ({
  decision: "CONFIRM",
  note: null,
  candidateValue: "Subiaco",
  officialValueBefore: "East Perth",
  resultingOfficialValue: "Subiaco",
  actor: "demo-adviser",
  createdAt: "2026-06-24T00:00:00.000Z",
  ...overrides
});

const review = (resolved = false): ReviewResponse => ({
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
    {
      id: "fact-address",
      field: "Address",
      currentLabel: "Current official value",
      currentValue: resolved ? "Subiaco" : "East Perth",
      officialValue: resolved ? "Subiaco" : "East Perth",
      candidateValue: resolved ? null : "Subiaco",
      previousValue: resolved ? "East Perth" : null,
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
      candidateSourceRecordId: resolved ? null : "source-meeting-note",
      candidateSourceDocument: resolved ? null : "Adviser Meeting Note",
      candidateObservedAt: resolved ? null : "2026-06-04T00:00:00.000Z",
      candidateObservedDate: resolved ? null : "4 June 2026",
      candidateEvidence: null,
      confidence: "Medium",
      lifecycleStatus: resolved ? "CURRENT" : "NEEDS_CONFIRMATION",
      status: resolved ? "Current" : "Needs confirmation",
      memoryExplanation: "Address remains pending adviser confirmation."
    },
    {
      id: "fact-risk-profile",
      field: "Risk profile",
      currentLabel: "Official value",
      currentValue: "Balanced",
      officialValue: "Balanced",
      candidateValue: resolved ? null : "High Growth",
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
      candidateSourceRecordId: resolved ? null : "source-meeting-note",
      candidateSourceDocument: resolved ? null : "Adviser Meeting Note",
      candidateObservedAt: resolved ? null : "2026-06-04T00:00:00.000Z",
      candidateObservedDate: resolved ? null : "4 June 2026",
      candidateEvidence: null,
      confidence: "Medium",
      lifecycleStatus: resolved ? "CURRENT" : "REQUIRES_ADVISER_APPROVAL",
      status: resolved ? "Current" : "Requires adviser approval",
      memoryExplanation: "Risk profile requires adviser approval."
    }
  ],
  meaningfulChanges: ["Annual income increased from AUD 110,000 to AUD 135,000"],
  adviserActions: [
    {
      id: "confirm-address",
      factId: "fact-address",
      title: "Confirm whether Alex has moved to Subiaco",
      detail: "Meeting note mentions Subiaco, but the address has not been verified.",
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
      title: "Review the possible change from Balanced to a growth-oriented risk approach",
      detail: "This is a high-impact attribute and needs adviser approval before use.",
      status: resolved ? "Current" : "Requires adviser approval",
      lifecycleStatus: resolved ? "CURRENT" : "REQUIRES_ADVISER_APPROVAL",
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

const findButton = (
  node: ReactNode,
  label: string
): InspectableElement | null => {
  if (!isValidElement<InspectableProps>(node)) {
    return null;
  }
  if (node.type === "button" && textContent(node.props.children) === label) {
    return node;
  }
  for (const child of Children.toArray(node.props.children)) {
    const match = findButton(child, label);
    if (match) {
      return match;
    }
  }
  return null;
};

describe("AdviserDashboard", () => {
  it("renders supported current review data and metrics", () => {
    const markup = renderToStaticMarkup(
      <AdviserDashboard review={review()} onOpenReview={() => undefined} />
    );

    expect(markup).toContain("Adviser workspace");
    expect(markup).toContain("Current client review");
    expect(markup).toContain("Alex Taylor");
    expect(markup).toContain("2026 Client Review");
    expect(markup).toContain("Facts reviewed");
    expect(markup).toContain("Open actions");
    expect(markup).toContain("Priority actions");
    expect(markup).toContain("Meaningful changes");
    expect(markup).toContain("High-impact changes");
    expect(markup).toContain("Recent adviser decisions");
  });

  it("uses honest empty states when actions and decisions are resolved or absent", () => {
    const markup = renderToStaticMarkup(
      <AdviserDashboard
        review={{
          ...review(true),
          meaningfulChanges: []
        }}
        onOpenReview={() => undefined}
      />
    );

    expect(markup).toContain("No review items currently require adviser action.");
    expect(markup).toContain(
      "No meaningful changes are currently surfaced for this review."
    );
    expect(markup).toContain(
      "No unresolved high-impact changes are currently surfaced."
    );
  });

  it("does not render unsupported dashboard categories", () => {
    const markup = renderToStaticMarkup(
      <AdviserDashboard review={review()} onOpenReview={() => undefined} />
    ).toLowerCase();

    expect(markup).not.toContain("upcoming");
    expect(markup).not.toContain("overdue");
    expect(markup).not.toContain("conflict");
    expect(markup).not.toContain("portfolio");
  });

  it("opens Client Review from the primary and item actions", () => {
    const onOpenReview = vi.fn();
    const tree = AdviserDashboard({ review: review(), onOpenReview });
    const primary = findButton(tree, "Open client review");
    const item = findButton(tree, "Review item");

    (primary?.props.onClick as () => void)();
    (item?.props.onClick as () => void)();

    expect(onOpenReview).toHaveBeenNthCalledWith(1);
    expect(onOpenReview).toHaveBeenNthCalledWith(2, "fact-risk-profile");
  });
});
