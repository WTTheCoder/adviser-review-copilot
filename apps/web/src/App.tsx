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
import { type ApiStatus } from "./components/ApiStatusBadge.js";
import { ClientReviewWorkspace } from "./components/ClientReviewWorkspace.js";
import {
  clearUploadTrace,
  replaceUploadTrace
} from "./domain/uploadTraceState.js";
import { parseDecisionResponse } from "./domain/decisionResponse.js";
import {
  getPrepareButtonLabel,
  getPrimaryExtractionWarning,
  getReviewStatusLabel,
  type ReviewPhase
} from "./domain/reviewWorkflow.js";
import { createDecisionSubmissionLock } from "./domain/decisionSubmissionLock.js";
import { createClientOperationGeneration } from "./domain/clientOperationGeneration.js";
import type { ClientFact, UploadExecutionMetadata } from "./types/demo.js";

const DEMO_CLIENT_ID = "demo-alex-taylor";

export const App = () => {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("connecting");
  const [reviewData, setReviewData] = useState<ReviewResponse | null>(null);
  const [reviewPhase, setReviewPhase] = useState<ReviewPhase>("ready");
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
        setReviewData(resetReview);
        setReviewPhase("ready");
        setSelectedFact(null);
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

  const isLoading = !reviewData && !loadError;
  const isPrepared = reviewPhase === "prepared";
  const isPreparing = reviewPhase === "preparing";
  const reviewStatus = getReviewStatusLabel(reviewPhase);
  const prepareButtonLabel = getPrepareButtonLabel(reviewPhase);
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

  return (
    <AppShell>
      <ClientReviewWorkspace
        apiBaseUrl={apiBaseUrl}
        apiStatus={apiStatus}
        clientId={DEMO_CLIENT_ID}
        currentSelectedFact={currentSelectedFact}
        extractionLabel={extractionLabel}
        extractionWarning={extractionWarning}
        isLoading={isLoading}
        isPrepared={isPrepared}
        isPreparing={isPreparing}
        isResetting={isResetting}
        latestUploadTrace={latestUploadTrace}
        loadError={loadError}
        noticeMessage={noticeMessage}
        prepareButtonLabel={prepareButtonLabel}
        reviewData={reviewData}
        reviewStatus={reviewStatus}
        savingFactId={savingFactId}
        selectedFactAction={selectedFactAction}
        skillLabel={skillLabel}
        uploadPanelResetToken={uploadPanelResetToken}
        onCloseEvidence={() => setSelectedFact(null)}
        onDecision={handleDecision}
        onPrepareReview={handlePrepareReview}
        onResetDemo={handleResetDemo}
        onSelectFact={setSelectedFact}
        onUploaded={handleUploadedSource}
      />
    </AppShell>
  );
};
