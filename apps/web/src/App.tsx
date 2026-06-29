import { useEffect, useMemo, useRef, useState } from "react";
import {
  adviserDecisionPayloadSchema,
  healthResponseSchema,
  reviewResponseSchema,
  type DecisionType,
  type HealthResponse,
  type ReviewResponse
} from "@client-review-prep/shared";
import { AdviserActions } from "./components/AdviserActions.js";
import { ApiStatusBadge, type ApiStatus } from "./components/ApiStatusBadge.js";
import { CurrentClientPicture } from "./components/CurrentClientPicture.js";
import { EvidenceDrawer } from "./components/EvidenceDrawer.js";
import { ExecutionTrace } from "./components/ExecutionTrace.js";
import { MeaningfulChanges } from "./components/MeaningfulChanges.js";
import { SourceRecordPanel } from "./components/SourceRecordPanel.js";
import { SourceUploadPanel } from "./components/SourceUploadPanel.js";
import { SummaryMetrics } from "./components/SummaryMetrics.js";
import { UploadExecutionTrace } from "./components/UploadExecutionTrace.js";
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
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-7 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">
                Client Review Prep Agent
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
                Source-backed preparation for adviser annual reviews
              </h1>
              <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-700">
                <span className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium">
                  {reviewData?.client.name ?? "Alex Taylor"}
                </span>
                <span className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5">
                  {reviewData ? `${reviewData.client.reviewYear} Annual Review` : "2026 Annual Review"}
                </span>
                <span className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5">
                  Adviser: {reviewData?.client.adviserName ?? "Jordan Lee"}
                </span>
                <span className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-800">
                  {reviewData?.client.reviewStatus ?? reviewStatus}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <ApiStatusBadge status={apiStatus} />
              <button
                className="rounded bg-cyan-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={isPreparing || isLoading || isResetting}
                type="button"
                onClick={handlePrepareReview}
              >
                {prepareButtonLabel}
              </button>
              <button
                className="text-xs font-semibold text-slate-500 underline-offset-4 hover:text-slate-800 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
                disabled={isResetting || isLoading}
                type="button"
                onClick={handleResetDemo}
              >
                {isResetting ? "Resetting local demo..." : "Reset local demo data"}
              </button>
            </div>
          </div>

          {loadError ? (
            <div className="rounded border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-800">
              {loadError}
            </div>
          ) : null}

          {noticeMessage ? (
            <div className="rounded border border-cyan-200 bg-cyan-50 p-5 text-sm leading-6 text-cyan-900">
              {noticeMessage}
            </div>
          ) : null}

          {isLoading ? (
            <div className="rounded border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">
                Loading review data
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Connecting to the review API and local PostgreSQL-backed demo data.
              </p>
            </div>
          ) : null}

          {reviewData && !isPrepared ? (
            <div className="rounded border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Ready to prepare</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Three fictional source records are loaded from the database. Start
                the preparation run to reconcile current facts, preserve superseded
                history, and surface the items that need adviser confirmation.
              </p>
            </div>
          ) : null}

          {reviewData && isPrepared ? (
            <>
              <div className="text-xs font-semibold text-slate-500">
                {skillLabel}
                {extractionLabel ? (
                  <span className="ml-3 text-slate-400">{extractionLabel}</span>
                ) : null}
                {extractionWarning ? (
                  <span className="ml-3 text-amber-700">{extractionWarning}</span>
                ) : null}
              </div>
              <SummaryMetrics metrics={reviewData.summaryMetrics} />
            </>
          ) : null}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="space-y-6">
          {reviewData && isPrepared ? (
            <>
              <CurrentClientPicture
                facts={reviewData.clientFacts}
                onSelectFact={setSelectedFact}
              />
              <div className="grid gap-6 xl:grid-cols-2">
                <MeaningfulChanges changes={reviewData.meaningfulChanges} />
                <AdviserActions
                  facts={reviewData.clientFacts}
                  savingFactId={savingFactId}
                  disabled={isResetting}
                  items={reviewData.adviserActions}
                  onDecision={handleDecision}
                />
              </div>
              <ExecutionTrace items={reviewData.workflowTrace} />
            </>
          ) : (
            <div className="rounded border border-dashed border-slate-300 bg-white p-8 text-center">
              <h2 className="text-xl font-semibold text-slate-950">
                Adviser workspace will appear here
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                The demo run is deterministic. It does not call AI, update a
                production CRM, or generate financial recommendations.
              </p>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <SourceUploadPanel
            apiBaseUrl={apiBaseUrl}
            clientId={DEMO_CLIENT_ID}
            resetToken={uploadPanelResetToken}
            onUploaded={(upload) => {
              const operationGeneration =
                clientOperationGeneration.current.capture();
              clientOperationGeneration.current.applyIfCurrent(
                operationGeneration,
                () => setLatestUploadTrace(replaceUploadTrace(upload))
              );
              void refreshReview(operationGeneration);
            }}
          />
          <UploadExecutionTrace metadata={latestUploadTrace} />
          <SourceRecordPanel records={reviewData?.sourceRecords ?? []} />
        </aside>
      </section>

      <EvidenceDrawer
        adviserAction={selectedFactAction}
        fact={currentSelectedFact}
        onClose={() => setSelectedFact(null)}
      />
    </main>
  );
};
