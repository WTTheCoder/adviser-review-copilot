import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ReviewResponse } from "@client-review-prep/shared";
import {
  AdviserAppContent,
  getClientReviewWorkspaceState,
  getInitialAdviserView,
  getResetClientReviewState
} from "./App.js";
import { selectActionQueue, selectDashboardSummary } from "./domain/reviewSelectors.js";
import type { AdviserView } from "./domain/adviserViews.js";

const resetReview = {
  client: {
    id: "demo-alex-taylor",
    name: "Alex Taylor",
    adviserName: "Jordan Lee",
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
} satisfies ReviewResponse;

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
    expect(getInitialAdviserView("#client-review")).toBe("client-review");
    expect(getInitialAdviserView("#invalid")).toBe("dashboard");
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
    expect(markup).toContain("Source records");
    expect(markup).toContain("Annual Review");
    expect(markup).not.toContain("Preparation in progress");
    expect(markup).not.toContain("Current client picture");
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
