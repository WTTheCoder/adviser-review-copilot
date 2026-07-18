import { renderToStaticMarkup } from "react-dom/server";
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode
} from "react";
import { describe, expect, it, vi } from "vitest";
import type { ReviewResponse } from "@client-review-prep/shared";
import {
  AdviserAppContent,
  getClientReviewWorkspaceState,
  getInitialAdviserView,
  getResetClientReviewState
} from "./App.js";
import { AdviserDashboard } from "./components/AdviserDashboard.js";
import { ClientReviewWorkspace } from "./components/ClientReviewWorkspace.js";
import { ClientReviewsList } from "./components/ClientReviewsList.js";
import { MyActions } from "./components/MyActions.js";
import { selectActionQueue, selectDashboardSummary } from "./domain/reviewSelectors.js";
import type { AdviserView } from "./domain/adviserViews.js";

type InspectableProps = Record<string, unknown> & {
  children?: ReactNode;
};
type InspectableElement = ReactElement<InspectableProps>;

const findComponent = (
  node: ReactNode,
  type: unknown
): InspectableElement | null => {
  if (!isValidElement<InspectableProps>(node)) {
    return null;
  }

  if (node.type === type) {
    return node;
  }

  for (const child of Children.toArray(node.props.children)) {
    const match = findComponent(child, type);
    if (match) {
      return match;
    }
  }

  return null;
};

const resetReview: ReviewResponse = {
  client: {
    id: "demo-alex-taylor",
    name: "Alex Taylor",
    adviserName: "Jordan Bennett",
    reviewYear: 2026,
    reviewStatus: "Preparation in progress"
  },
  summaryMetrics: [
    { value: "6", label: "Facts reviewed" },
    { value: "0", label: "Meaningful changes" },
    { value: "0", label: "Items needing confirmation" }
  ],
  sourceRecords: [
    {
      id: "source-annual-review",
      type: "ANNUAL_REVIEW",
      title: "Annual Review",
      observedAt: "2025-11-16T00:00:00.000Z",
      observedDate: "16 November 2025",
      summary: "Verified annual-review record.",
      content: ["Annual review content"],
      lifecycleStatus: "CURRENT"
    }
  ],
  clientFacts: [],
  meaningfulChanges: [],
  adviserActions: [],
  workflowTrace: []
};

const preparedReview: ReviewResponse = {
  ...resetReview,
  client: {
    ...resetReview.client,
    reviewStatus: "Ready for adviser review"
  },
  summaryMetrics: [
    { value: "12", label: "Facts reviewed" },
    { value: "6", label: "Meaningful changes" },
    { value: "2", label: "Items needing confirmation" }
  ],
  clientFacts: [
    {
      id: "fact-employment",
      field: "Employment",
      currentLabel: "Current",
      currentValue: "New Energy Ltd",
      officialValue: "New Energy Ltd",
      candidateValue: null,
      previousValue: "ABC Mining",
      sourceRecordId: "source-annual-review",
      sourceDocument: "Annual Review",
      observedAt: "2025-11-16T00:00:00.000Z",
      observedDate: "16 November 2025",
      officialSourceRecordId: "source-annual-review",
      officialSourceDocument: "Annual Review",
      officialObservedAt: "2025-11-16T00:00:00.000Z",
      officialObservedDate: "16 November 2025",
      previousSourceRecordId: "source-legacy-crm",
      previousSourceDocument: "Legacy CRM Record",
      previousObservedAt: "2023-05-10T00:00:00.000Z",
      previousObservedDate: "10 May 2023",
      candidateSourceRecordId: null,
      candidateSourceDocument: null,
      candidateObservedAt: null,
      candidateObservedDate: null,
      candidateEvidence: null,
      confidence: "High",
      lifecycleStatus: "CURRENT",
      status: "Current",
      memoryExplanation: "Employment was reconciled from source material."
    },
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
      candidateEvidence:
        "Alex may have moved to Subiaco, but the address has not been confirmed.",
      confidence: "Medium",
      lifecycleStatus: "NEEDS_CONFIRMATION",
      status: "Needs confirmation",
      memoryExplanation: "Address requires adviser confirmation."
    },
    {
      id: "fact-risk-profile",
      field: "Risk profile",
      currentLabel: "Official value",
      currentValue: "Balanced",
      officialValue: "Balanced",
      candidateValue: "Growth-oriented",
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
        "Alex is considering a more growth-oriented investment approach.",
      confidence: "Medium",
      lifecycleStatus: "REQUIRES_ADVISER_APPROVAL",
      status: "Requires adviser approval",
      memoryExplanation: "Risk profile requires adviser approval."
    }
  ],
  meaningfulChanges: [
    "Employer changed from ABC Mining to New Energy Ltd",
    "Annual income increased from AUD 110,000 to AUD 135,000",
    "Superannuation increased from AUD 125,000 to AUD 174,000",
    "Home-buying timeframe changed from five years to two years",
    "Address candidate: East Perth to Subiaco",
    "Risk profile candidate: Balanced to Growth-oriented"
  ],
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
      title:
        "Review the possible change from Balanced to a growth-oriented risk approach",
      detail:
        "This is a high-impact attribute and needs adviser approval before use.",
      status: "Requires adviser approval",
      lifecycleStatus: "REQUIRES_ADVISER_APPROVAL",
      primaryDecision: "APPROVE",
      secondaryDecision: "KEEP_CURRENT",
      primaryLabel: "Approve",
      secondaryLabel: "Keep current",
      latestDecision: null,
      decisionHistory: []
    }
  ]
};

const renderContent = (activeView: AdviserView, review = resetReview) => {
  const workspaceState = getClientReviewWorkspaceState({
    reviewData: review,
    reviewPhase: "ready",
    selectedFact: null
  });

  return renderToStaticMarkup(
    <AdviserAppContent
      activeView={activeView}
      apiBaseUrl="http://localhost:3001"
      apiStatus="connected"
      clientId={review.client.id}
      extractionLabel={null}
      extractionWarning={null}
      isLoading={false}
      isResetting={false}
      latestUploadTrace={null}
      loadError={null}
      noticeMessage={null}
      reviewData={review}
      savingFactId={null}
      skillLabel="Selected skill: prepare-annual-review"
      uploadPanelResetToken={1}
      workspaceState={workspaceState}
      onCloseEvidence={() => undefined}
      onDecision={() => undefined}
      onOpenClientReviews={() => undefined}
      onOpenReview={() => undefined}
      onPrepareReview={() => undefined}
      onResetDemo={() => undefined}
      onSelectFact={() => undefined}
      onUploaded={() => undefined}
      onViewChange={() => undefined}
    />
  );
};

describe("App reset and view orchestration", () => {
  it("restores the initial view from supported hashes", () => {
    expect(getInitialAdviserView("#overview")).toBe("dashboard");
    expect(getInitialAdviserView("#my-actions")).toBe("my-actions");
    expect(getInitialAdviserView("#client-reviews")).toBe("client-reviews");
    expect(getInitialAdviserView("#client-review")).toBe("client-review");
    expect(getInitialAdviserView("#invalid")).toBe("dashboard");
  });

  it("renders Client Reviews as the list page and Client Review as Alex detail", () => {
    const listMarkup = renderContent("client-reviews", preparedReview);
    const detailMarkup = renderContent("client-review", preparedReview);

    expect(listMarkup).toContain("Client Reviews");
    expect(listMarkup).toContain("Manage active annual reviews");
    expect(listMarkup).toContain("Emma Wilson");
    expect(listMarkup).toContain("Open review");
    expect(listMarkup).not.toContain("Current client picture");
    expect(detailMarkup).toContain("Back to client reviews");
    expect(detailMarkup).toContain("Current client picture");
  });

  it("opens Alex detail from the Client Reviews list and returns to the list", () => {
    let activeView: AdviserView = "client-reviews";
    const workspaceState = getClientReviewWorkspaceState({
      reviewData: preparedReview,
      reviewPhase: "prepared",
      selectedFact: null
    });
    const renderTree = () =>
      AdviserAppContent({
        activeView,
        apiBaseUrl: "http://localhost:3001",
        apiStatus: "connected",
        clientId: preparedReview.client.id,
        extractionLabel: null,
        extractionWarning: null,
        isLoading: false,
        isResetting: false,
        latestUploadTrace: null,
        loadError: null,
        noticeMessage: null,
        reviewData: preparedReview,
        savingFactId: null,
        skillLabel: "Selected skill: prepare-annual-review",
        uploadPanelResetToken: 1,
        workspaceState,
        onCloseEvidence: () => undefined,
        onDecision: () => undefined,
        onOpenClientReviews: () => {
          activeView = "client-reviews";
        },
        onOpenReview: () => {
          activeView = "client-review";
        },
        onPrepareReview: () => undefined,
        onResetDemo: () => undefined,
        onSelectFact: () => undefined,
        onUploaded: () => undefined,
        onViewChange: (view) => {
          activeView = view;
        }
      });

    const list = findComponent(renderTree(), ClientReviewsList);
    (list?.props.onOpenAlexReview as () => void)();
    expect(activeView).toBe("client-review");

    const workspace = findComponent(renderTree(), ClientReviewWorkspace);
    (workspace?.props.onBackToClientReviews as () => void)();
    expect(activeView).toBe("client-reviews");
  });

  it("opens Client Reviews from the Overview CTA while My Actions opens Alex detail", () => {
    let activeView: AdviserView = "dashboard";
    const workspaceState = getClientReviewWorkspaceState({
      reviewData: preparedReview,
      reviewPhase: "prepared",
      selectedFact: null
    });
    const renderTree = () =>
      AdviserAppContent({
        activeView,
        apiBaseUrl: "http://localhost:3001",
        apiStatus: "connected",
        clientId: preparedReview.client.id,
        extractionLabel: null,
        extractionWarning: null,
        isLoading: false,
        isResetting: false,
        latestUploadTrace: null,
        loadError: null,
        noticeMessage: null,
        reviewData: preparedReview,
        savingFactId: null,
        skillLabel: "Selected skill: prepare-annual-review",
        uploadPanelResetToken: 1,
        workspaceState,
        onCloseEvidence: () => undefined,
        onDecision: () => undefined,
        onOpenClientReviews: () => {
          activeView = "client-reviews";
        },
        onOpenReview: () => {
          activeView = "client-review";
        },
        onPrepareReview: () => undefined,
        onResetDemo: () => undefined,
        onSelectFact: () => undefined,
        onUploaded: () => undefined,
        onViewChange: (view) => {
          activeView = view;
        }
      });

    const dashboard = findComponent(renderTree(), AdviserDashboard);
    (dashboard?.props.onOpenClientReviews as () => void)();
    expect(activeView).toBe("client-reviews");

    activeView = "my-actions";
    const actions = findComponent(renderTree(), MyActions);
    (actions?.props.onOpenReview as () => void)();
    expect(activeView).toBe("client-review");
  });

  it("renders refreshed prepared review data across primary views after preparation", () => {
    const clientReviewMarkup = renderContent("client-review", preparedReview);
    const overviewMarkup = renderContent("dashboard", preparedReview);
    const actionsMarkup = renderContent("my-actions", preparedReview);

    expect(clientReviewMarkup).toContain("Re-run Preparation");
    expect(clientReviewMarkup).toContain("Ready for adviser review");
    expect(clientReviewMarkup).toContain("Current client picture");
    expect(clientReviewMarkup).toContain("Confirm whether Alex has moved to Subiaco");
    expect(clientReviewMarkup).toContain(
      "Review the possible change from Balanced to Growth-oriented"
    );
    expect(clientReviewMarkup).not.toContain(
      "Prepare the review to see current facts"
    );
    expect(overviewMarkup).toContain("12");
    expect(overviewMarkup).toContain("6");
    expect(overviewMarkup).toContain("2");
    expect(overviewMarkup).toContain("Confirm whether Alex has moved to Subiaco");
    expect(actionsMarkup).toContain("2 open actions");
    expect(actionsMarkup).toContain("Needs confirmation");
    expect(actionsMarkup).toContain("Requires adviser approval");
  });

  it("replaces stale prepared review data with the reset response and keeps Client Review active", () => {
    const resetState = getResetClientReviewState(
      resetReview,
      "client-review"
    );

    expect(resetState).toEqual({
      activeView: "client-review",
      reviewData: resetReview,
      reviewPhase: "ready",
      selectedFact: null
    });
    expect(
      getClientReviewWorkspaceState({
        reviewData: resetState.reviewData,
        reviewPhase: resetState.reviewPhase,
        selectedFact: resetState.selectedFact
      })
    ).toMatchObject({
      currentSelectedFact: null,
      isPrepared: false,
      isPreparing: false,
      prepareButtonLabel: "Prepare Client Review",
      selectedFactAction: null
    });
  });

  it("renders reset Client Review as unprepared without selected evidence", () => {
    const markup = renderContent("client-review");

    expect(markup).toContain("Prepare Client Review");
    expect(markup).toContain("Ready to prepare");
    expect(markup).toContain("Adviser workspace will appear here");
    expect(markup).not.toContain("Preparation in progress");
    expect(markup).not.toContain("Current client picture");
    expect(markup).not.toContain("Source records");
    expect(markup).not.toContain("Evidence and memory");
    expect(markup).not.toContain("Confirm whether Alex has moved to Subiaco");
  });

  it("renders Overview and My Actions from reset data without open prepared-review work", () => {
    const dashboard = selectDashboardSummary(resetReview);
    const actionQueue = selectActionQueue(resetReview);
    const overviewMarkup = renderContent("dashboard");
    const actionsMarkup = renderContent("my-actions");

    expect(dashboard.itemsRequiringAttention).toEqual([]);
    expect(dashboard.highImpactChanges).toEqual([]);
    expect(dashboard.summaryMetrics).toContainEqual({
      value: "6",
      label: "Facts reviewed"
    });
    expect(actionQueue.flatMap((group) => group.items)).toEqual([]);
    expect(overviewMarkup).toContain("Ready to prepare");
    expect(overviewMarkup).not.toContain("Preparation in progress");
    expect(overviewMarkup).toContain("0");
    expect(overviewMarkup).toContain("No review items currently require adviser action.");
    expect(actionsMarkup).toContain("0 open actions");
    expect(actionsMarkup).toContain("No actions in this queue.");
  });

  it("does not trigger preparation while rendering reset state", () => {
    const onPrepareReview = vi.fn();
    const workspaceState = getClientReviewWorkspaceState({
      reviewData: resetReview,
      reviewPhase: "ready",
      selectedFact: null
    });

    renderToStaticMarkup(
      <AdviserAppContent
        activeView="client-review"
        apiBaseUrl="http://localhost:3001"
        apiStatus="connected"
        clientId={resetReview.client.id}
        extractionLabel={null}
        extractionWarning={null}
        isLoading={false}
        isResetting={false}
        latestUploadTrace={null}
        loadError={null}
        noticeMessage={null}
        reviewData={resetReview}
        savingFactId={null}
        skillLabel="Selected skill: prepare-annual-review"
        uploadPanelResetToken={1}
        workspaceState={workspaceState}
        onCloseEvidence={() => undefined}
        onDecision={() => undefined}
        onOpenClientReviews={() => undefined}
        onOpenReview={() => undefined}
        onPrepareReview={onPrepareReview}
        onResetDemo={() => undefined}
        onSelectFact={() => undefined}
        onUploaded={() => undefined}
        onViewChange={() => undefined}
      />
    );

    expect(onPrepareReview).not.toHaveBeenCalled();
  });
});
