import { useEffect, useMemo, useRef, useState } from "react";
import {
  adviserDecisionPayloadSchema,
  healthResponseSchema,
  reviewResponseSchema,
  type DecisionType,
  type DocumentUploadResponse,
  type HealthResponse,
  type ReviewResponse
} from "@client-review-prep/shared";
import { AppShell } from "./components/AppShell.js";
import { AdviserDashboard } from "./components/AdviserDashboard.js";
import { AdviserNavigation } from "./components/AdviserNavigation.js";
import { type ApiStatus } from "./components/ApiStatusBadge.js";
import { ClientReviewWorkspace } from "./components/ClientReviewWorkspace.js";
import { MyActions } from "./components/MyActions.js";
import {
  clearUploadTrace,
  replaceUploadTrace
} from "./domain/uploadTraceState.js";
import { parseDecisionResponse } from "./domain/decisionResponse.js";
import {
  getPrepareButtonLabel,
  hasPreparedReviewWorkspaceData,
  getPrimaryExtractionWarning,
  getReviewPhaseForDisplay,
  getReviewStatusLabel,
  type ReviewPhase
} from "./domain/reviewWorkflow.js";
import { createDecisionSubmissionLock } from "./domain/decisionSubmissionLock.js";
import { createClientOperationGeneration } from "./domain/clientOperationGeneration.js";
import {
  adviserViewFromHash,
  canonicalHashForAdviserHash,
  hashForAdviserView,
  openClientReviewState,
  type AdviserView
} from "./domain/adviserViews.js";
import type { ClientFact, UploadExecutionMetadata } from "./types/demo.js";

const DEMO_CLIENT_ID = "demo-alex-taylor";

export type ClientReviewWorkspaceState = {
  currentSelectedFact: ClientFact | null;
  isPrepared: boolean;
  isPreparing: boolean;
  prepareButtonLabel: string;
  reviewStatus: string;
  selectedFactAction: ReviewResponse["adviserActions"][number] | null;
};

export type ResetClientReviewState = {
  activeView: AdviserView;
  reviewData: ReviewResponse;
  reviewPhase: ReviewPhase;
  selectedFact: ClientFact | null;
};

export const getInitialAdviserView = (
  hash = typeof window === "undefined" ? "" : window.location.hash
): AdviserView => adviserViewFromHash(hash);

export const getResetClientReviewState = (
  resetReview: ReviewResponse,
  activeView: AdviserView
): ResetClientReviewState => ({
  activeView,
  reviewData: resetReview,
  reviewPhase: "ready",
  selectedFact: null
});

export const getClientReviewWorkspaceState = ({
  reviewData,
  reviewPhase,
  selectedFact
}: {
  reviewData: ReviewResponse | null;
  reviewPhase: ReviewPhase;
  selectedFact: ClientFact | null;
}): ClientReviewWorkspaceState => {
  const displayReviewPhase = getReviewPhaseForDisplay(
    reviewPhase,
    reviewData?.client.reviewStatus,
    hasPreparedReviewWorkspaceData(reviewData)
  );
  const currentSelectedFact =
    selectedFact && reviewData
      ? reviewData.clientFacts.find((fact) => fact.id === selectedFact.id) ??
        selectedFact
      : selectedFact;
  const selectedFactAction =
    currentSelectedFact && reviewData
      ? reviewData.adviserActions.find(
          (action) => action.factId === currentSelectedFact.id
        ) ?? null
      : null;

  return {
    currentSelectedFact,
    isPrepared: displayReviewPhase === "prepared",
    isPreparing: displayReviewPhase === "preparing",
    prepareButtonLabel: getPrepareButtonLabel(displayReviewPhase),
    reviewStatus: getReviewStatusLabel(displayReviewPhase),
    selectedFactAction
  };
};

export type AdviserAppContentProps = {
  activeView: AdviserView;
  apiBaseUrl: string;
  apiStatus: ApiStatus;
  clientId: string;
  extractionLabel: string | null;
  extractionWarning: string | null;
  isLoading: boolean;
  isResetting: boolean;
  latestUploadTrace: UploadExecutionMetadata | null;
  loadError: string | null;
  noticeMessage: string | null;
  reviewData: ReviewResponse | null;
  savingFactId: string | null;
  skillLabel: string;
  uploadPanelResetToken: number;
  workspaceState: ClientReviewWorkspaceState;
  onCloseEvidence: () => void;
  onDecision: (factId: string, decision: DecisionType) => void;
  onOpenReview: (factId?: string) => void;
  onPrepareReview: () => void;
  onResetDemo: () => void;
  onSelectFact: (fact: ClientFact) => void;
  onUploaded: (upload: DocumentUploadResponse) => void;
  onViewChange: (view: AdviserView) => void;
};

export const AdviserAppContent = ({
  activeView,
  apiBaseUrl,
  apiStatus,
  clientId,
  extractionLabel,
  extractionWarning,
  isLoading,
  isResetting,
  latestUploadTrace,
  loadError,
  noticeMessage,
  reviewData,
  savingFactId,
  skillLabel,
  uploadPanelResetToken,
  workspaceState,
  onCloseEvidence,
  onDecision,
  onOpenReview,
  onPrepareReview,
  onResetDemo,
  onSelectFact,
  onUploaded,
  onViewChange
}: AdviserAppContentProps) => (
  <AppShell
    navigation={
      <AdviserNavigation activeView={activeView} onChange={onViewChange} />
    }
  >
    {reviewData && activeView === "dashboard" ? (
      <AdviserDashboard review={reviewData} onOpenReview={onOpenReview} />
    ) : null}
    {reviewData && activeView === "my-actions" ? (
      <MyActions review={reviewData} onOpenReview={onOpenReview} />
    ) : null}
    {activeView === "client-review" || !reviewData ? (
      <ClientReviewWorkspace
        apiBaseUrl={apiBaseUrl}
        apiStatus={apiStatus}
        clientId={clientId}
        currentSelectedFact={workspaceState.currentSelectedFact}
        extractionLabel={extractionLabel}
        extractionWarning={extractionWarning}
        isLoading={isLoading}
        isPrepared={workspaceState.isPrepared}
        isPreparing={workspaceState.isPreparing}
        isResetting={isResetting}
        latestUploadTrace={latestUploadTrace}
        loadError={loadError}
        noticeMessage={noticeMessage}
        prepareButtonLabel={workspaceState.prepareButtonLabel}
        reviewData={reviewData}
        reviewStatus={workspaceState.reviewStatus}
        savingFactId={savingFactId}
        selectedFactAction={workspaceState.selectedFactAction}
        skillLabel={skillLabel}
        uploadPanelResetToken={uploadPanelResetToken}
        onCloseEvidence={onCloseEvidence}
        onDecision={onDecision}
        onPrepareReview={onPrepareReview}
        onResetDemo={onResetDemo}
        onSelectFact={onSelectFact}
        onUploaded={onUploaded}
      />
    ) : null}
  </AppShell>
);

export const App = () => {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("connecting");
  const [reviewData, setReviewData] = useState<ReviewResponse | null>(null);
  const [reviewPhase, setReviewPhase] = useState<ReviewPhase>("ready");
  const [activeView, setActiveView] =
    useState<AdviserView>(getInitialAdviserView);
  const [selectedFact, setSelectedFact] = useState<ClientFact | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [savingFactId, setSavingFactId] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [latestUploadTrace, setLatestUploadTrace] =
    useState<UploadExecutionMetadata | null>(null);
  const [uploadPanelResetToken, setUploadPanelResetToken] = useState(0);
  const decisionSubmissionLock = useRef(createDecisionSubmissionLock());
  const clientOperationGeneration = useRef(createClientOperationGeneration());
  const apiBaseUrl = useMemo(
    () => import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001",
    []
  );

  useEffect(() => {
    const controller = new AbortController();

    const checkApiHealth = async () => {
      setApiStatus("connecting");

      try {
        const response = await fetch(`${apiBaseUrl}/health`, {
          signal: controller.signal
        });

        if (!response.ok) {
          setApiStatus("unavailable");
          return;
        }

        const payload: unknown = await response.json();
        const health: HealthResponse = healthResponseSchema.parse(payload);
        setApiStatus(
          health.service === "client-review-prep-api" ? "connected" : "unavailable"
        );
      } catch {
        if (!controller.signal.aborted) {
          setApiStatus("unavailable");
        }
      }
    };

    void checkApiHealth();

    return () => {
      controller.abort();
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    const syncViewFromHash = () => {
      const nextView = adviserViewFromHash(window.location.hash);
      const canonicalHash = canonicalHashForAdviserHash(window.location.hash);

      setActiveView(nextView);

      if (window.location.hash !== canonicalHash) {
        window.history.replaceState(null, "", canonicalHash);
      }
    };

    syncViewFromHash();
    window.addEventListener("hashchange", syncViewFromHash);

    return () => {
      window.removeEventListener("hashchange", syncViewFromHash);
    };
  }, []);

  const changeActiveView = (view: AdviserView) => {
    setActiveView(view);
    const nextHash = hashForAdviserView(view);

    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    const loadReview = async () => {
      setLoadError(null);
      setNoticeMessage(null);

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/clients/${DEMO_CLIENT_ID}/review`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Review data is unavailable.");
        }

        const review = reviewResponseSchema.parse(await response.json());
        setReviewData(review);
        setReviewPhase(
          review.client.reviewStatus === "Ready for adviser review"
            ? "prepared"
            : "ready"
        );
      } catch {
        if (!controller.signal.aborted) {
          setLoadError(
            "Review data is unavailable. Check that the API and local PostgreSQL database are running."
          );
          setNoticeMessage(null);
        }
      }
    };

    void loadReview();

    return () => {
      controller.abort();
    };
  }, [apiBaseUrl]);

  const refreshReview = async (
    operationGeneration: number,
    successMessage: string | null = null
  ) => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/clients/${DEMO_CLIENT_ID}/review`
      );

      if (!response.ok) {
        throw new Error("Review data is unavailable.");
      }

      const review = reviewResponseSchema.parse(await response.json());
      clientOperationGeneration.current.applyIfCurrent(
        operationGeneration,
        () => {
          setReviewData(review);
          setReviewPhase(
            review.client.reviewStatus === "Ready for adviser review"
              ? "prepared"
              : "ready"
          );
          setLoadError(null);
          setNoticeMessage(successMessage);
        }
      );
    } catch {
      clientOperationGeneration.current.applyIfCurrent(
        operationGeneration,
        () => {
          setLoadError(
            "Review data is unavailable. Check that the API and local PostgreSQL database are running."
          );
          setNoticeMessage(null);
        }
      );
    }
  };

  const handlePrepareReview = async () => {
    const operationGeneration = clientOperationGeneration.current.capture();
    setReviewPhase("preparing");
    setLoadError(null);
    setNoticeMessage(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/clients/${DEMO_CLIENT_ID}/prepare-review`,
        { method: "POST" }
      );

      if (!response.ok) {
        throw new Error("Review preparation failed.");
      }

      const preparedReview = reviewResponseSchema.parse(await response.json());
      clientOperationGeneration.current.applyIfCurrent(
        operationGeneration,
        () => {
          setReviewData(preparedReview);
          setReviewPhase("prepared");
          setNoticeMessage(null);
        }
      );
    } catch {
      clientOperationGeneration.current.applyIfCurrent(
        operationGeneration,
        () => {
          setReviewPhase(reviewData ? "prepared" : "ready");
          setLoadError(
            "Review preparation failed. Check that the API and database are available."
          );
          setNoticeMessage(null);
        }
      );
    }
  };

  const handleDecision = async (factId: string, decision: DecisionType) => {
    if (!decisionSubmissionLock.current.tryStart(factId)) {
      return;
    }

    const operationGeneration = clientOperationGeneration.current.capture();
    setSavingFactId(factId);
    setLoadError(null);
    setNoticeMessage(null);

    try {
      const payload = adviserDecisionPayloadSchema.parse({
        decision,
        note: `Local demo decision: ${decision}. No production CRM was updated.`
      });
      const response = await fetch(
        `${apiBaseUrl}/api/clients/${DEMO_CLIENT_ID}/facts/${factId}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      if (response.status === 409) {
        await refreshReview(
          operationGeneration,
          "The client state changed before this decision could be saved. The current review has been refreshed."
        );
        return;
      }

      if (!response.ok) {
        throw new Error("Could not save decision.");
      }

      const parsedDecision = parseDecisionResponse(await response.json());
      clientOperationGeneration.current.applyIfCurrent(
        operationGeneration,
        () => {
          if (parsedDecision.kind === "refreshRequired") {
            setNoticeMessage(parsedDecision.message);
            setReviewPhase("prepared");
            return;
          }

          setReviewData(parsedDecision.review);
          setReviewPhase("prepared");
          setNoticeMessage(null);
        }
      );
    } catch {
      clientOperationGeneration.current.applyIfCurrent(
        operationGeneration,
        () => {
          setLoadError(
            "The adviser decision could not be saved. No production CRM was updated."
          );
          setNoticeMessage(null);
        }
      );
    } finally {
      decisionSubmissionLock.current.finish(factId);
      clientOperationGeneration.current.applyIfCurrent(
        operationGeneration,
        () => setSavingFactId(null)
      );
    }
  };

  const handleResetDemo = async () => {
    const resetGeneration = clientOperationGeneration.current.invalidate();
    setIsResetting(true);
    setSavingFactId(null);
    setLoadError(null);
    setNoticeMessage(null);
    setUploadPanelResetToken((current) => current + 1);

    try {
      const response = await fetch(`${apiBaseUrl}/api/demo/reset`, {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("Could not reset demo.");
      }

      const resetReview = reviewResponseSchema.parse(await response.json());
      clientOperationGeneration.current.applyIfCurrent(resetGeneration, () => {
        const resetState = getResetClientReviewState(resetReview, activeView);
        setReviewData(resetState.reviewData);
        setReviewPhase(resetState.reviewPhase);
        setSelectedFact(resetState.selectedFact);
        setActiveView(resetState.activeView);
        setLatestUploadTrace(clearUploadTrace());
        setNoticeMessage(null);
      });
    } catch {
      clientOperationGeneration.current.applyIfCurrent(resetGeneration, () => {
        setReviewPhase(
          reviewData?.client.reviewStatus === "Ready for adviser review"
            ? "prepared"
            : "ready"
        );
        setLoadError("The local demo reset failed. Check the API and database.");
        setNoticeMessage(null);
      });
    } finally {
      clientOperationGeneration.current.applyIfCurrent(
        resetGeneration,
        () => setIsResetting(false)
      );
    }
  };

  const handleUploadedSource = (upload: DocumentUploadResponse) => {
    const operationGeneration = clientOperationGeneration.current.capture();
    clientOperationGeneration.current.applyIfCurrent(operationGeneration, () =>
      setLatestUploadTrace(replaceUploadTrace(upload))
    );
    void refreshReview(operationGeneration);
  };

  const openClientReview = (factId?: string) => {
    const nextState = openClientReviewState(reviewData, factId);
    changeActiveView(nextState.activeView);
    setSelectedFact(nextState.selectedFact);
  };

  const isLoading = !reviewData && !loadError;
  const workspaceState = getClientReviewWorkspaceState({
    reviewData,
    reviewPhase,
    selectedFact
  });
  const skillLabel = reviewData?.executionMetadata
    ? reviewData.executionMetadata.skillName === "apply-adviser-decision"
      ? `Executed skill: ${reviewData.executionMetadata.skillName}`
      : `Selected skill: ${reviewData.executionMetadata.skillName}`
    : "Selected skill: prepare-annual-review";
  const extractionLabel = reviewData?.extractionMetadata
    ? reviewData.extractionMetadata.warnings.some((warning) =>
        warning.includes("Mock extraction was used")
      )
      ? "Extraction: Mock fallback"
      : reviewData.extractionMetadata.providerMode === "openai"
      ? `Extraction: OpenAI - ${reviewData.extractionMetadata.model ?? "configured model"}`
      : "Extraction: Mock"
    : null;
  const extractionWarning = getPrimaryExtractionWarning(
    reviewData?.extractionMetadata?.warnings
  );

  return (
    <AdviserAppContent
      activeView={activeView}
      apiBaseUrl={apiBaseUrl}
      apiStatus={apiStatus}
      clientId={DEMO_CLIENT_ID}
      extractionLabel={extractionLabel}
      extractionWarning={extractionWarning}
      isLoading={isLoading}
      isResetting={isResetting}
      latestUploadTrace={latestUploadTrace}
      loadError={loadError}
      noticeMessage={noticeMessage}
      reviewData={reviewData}
      savingFactId={savingFactId}
      skillLabel={skillLabel}
      uploadPanelResetToken={uploadPanelResetToken}
      workspaceState={workspaceState}
      onCloseEvidence={() => setSelectedFact(null)}
      onDecision={handleDecision}
      onOpenReview={openClientReview}
      onPrepareReview={handlePrepareReview}
      onResetDemo={handleResetDemo}
      onSelectFact={setSelectedFact}
      onUploaded={handleUploadedSource}
      onViewChange={changeActiveView}
    />
  );
};
