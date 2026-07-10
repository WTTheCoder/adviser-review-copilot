import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ReviewResponse } from "@client-review-prep/shared";
import {
  AdviserAppContent,
  getClientReviewWorkspaceState
} from "../App.js";
import { openClientReviewState, type AdviserView } from "../domain/adviserViews.js";
import type { ReviewPhase } from "../domain/reviewWorkflow.js";
import type { ClientFact } from "../types/demo.js";

type InspectableProps = Record<string, unknown> & {
  children?: ReactNode;
};
type InspectableElement = ReactElement<InspectableProps>;

const addressFact: ClientFact = {
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
  memoryExplanation: "Address remains pending adviser confirmation."
};

const preparedReview: ReviewResponse = {
  client: {
    id: "demo-alex-taylor",
    name: "Alex Taylor",
    adviserName: "Jordan Bennett",
    reviewYear: 2026,
    reviewStatus: "Preparation in progress"
  },
  summaryMetrics: [{ value: "12", label: "Facts reviewed" }],
  sourceRecords: [],
  clientFacts: [
    addressFact,
    {
      ...addressFact,
      id: "fact-risk-profile",
      field: "Risk profile",
      currentLabel: "Official value",
      currentValue: "Balanced",
      officialValue: "Balanced",
      candidateValue: "High Growth",
      lifecycleStatus: "REQUIRES_ADVISER_APPROVAL",
      status: "Requires adviser approval",
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
};

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
  if (typeof node.type === "function") {
    const renderComponent = node.type as (
      props: InspectableProps
    ) => ReactNode;
    return findButtons(renderComponent(node.props), label, matches);
  }
  if (node.type === "button" && textContent(node.props.children) === label) {
    matches.push(node);
  }
  Children.toArray(node.props.children).forEach((child) =>
    findButtons(child, label, matches)
  );
  return matches;
};

describe("adviser action navigation regression", () => {
  it("opens a prepared Client Review with the selected action fact", () => {
    let activeView: AdviserView = "my-actions";
    let selectedFact: ClientFact | null = null;
    const prepareReview = vi.fn();
    const resetDemo = vi.fn();
    const localPhase: ReviewPhase = "ready";

    const renderAppContent = () => {
      const workspaceState = getClientReviewWorkspaceState({
        reviewData: preparedReview,
        reviewPhase: localPhase,
        selectedFact
      });

      return {
        element: (
          <AdviserAppContent
            activeView={activeView}
            apiBaseUrl="http://localhost:3001"
            apiStatus="connected"
            clientId={preparedReview.client.id}
            extractionLabel={null}
            extractionWarning={null}
            isLoading={false}
            isResetting={false}
            latestUploadTrace={null}
            loadError={null}
            noticeMessage={null}
            reviewData={preparedReview}
            savingFactId={null}
            skillLabel="Selected skill: prepare-annual-review"
            uploadPanelResetToken={0}
            workspaceState={workspaceState}
            onCloseEvidence={() => {
              selectedFact = null;
            }}
            onDecision={() => undefined}
            onOpenClientReviews={() => {
              activeView = "client-reviews";
              selectedFact = null;
            }}
            onOpenReview={(factId) => {
              const nextState = openClientReviewState(preparedReview, factId);
              activeView = nextState.activeView;
              selectedFact = nextState.selectedFact;
            }}
            onPrepareReview={prepareReview}
            onResetDemo={resetDemo}
            onSelectFact={(fact) => {
              selectedFact = fact;
            }}
            onUploaded={() => undefined}
            onViewChange={(view) => {
              activeView = view;
            }}
          />
        ),
        workspaceState
      };
    };

    const initialContent = renderAppContent();
    const [openAddressAction] = findButtons(
      initialContent.element,
      "Open review action"
    );

    (openAddressAction?.props.onClick as () => void)();

    const updatedContent = renderAppContent();
    const markup = renderToStaticMarkup(updatedContent.element);

    const selectedFactAfterOpen = selectedFact as ClientFact | null;

    expect(activeView).toBe("client-review");
    expect(selectedFactAfterOpen?.id).toBe("fact-address");
    expect(updatedContent.workspaceState.isPrepared).toBe(true);
    expect(updatedContent.workspaceState.isPreparing).toBe(false);
    expect(updatedContent.workspaceState.currentSelectedFact?.id).toBe(
      "fact-address"
    );
    expect(updatedContent.workspaceState.selectedFactAction?.factId).toBe(
      "fact-address"
    );
    expect(markup).toContain("Current client picture");
    expect(markup).toContain("Evidence and memory");
    expect(markup).toContain("Address");
    expect(markup).not.toContain("Ready to prepare");
    expect(markup).not.toContain("Adviser workspace will appear here");
    expect(prepareReview).not.toHaveBeenCalled();
    expect(resetDemo).not.toHaveBeenCalled();
  });
});
