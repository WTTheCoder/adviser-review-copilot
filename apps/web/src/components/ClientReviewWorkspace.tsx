import type {
  DecisionType,
  DocumentUploadResponse,
  ReviewResponse
} from "@client-review-prep/shared";
import { AdviserActions } from "./AdviserActions.js";
import { ApiStatusBadge, type ApiStatus } from "./ApiStatusBadge.js";
import { CurrentClientPicture } from "./CurrentClientPicture.js";
import { EvidenceDrawer } from "./EvidenceDrawer.js";
import { ExecutionTrace } from "./ExecutionTrace.js";
import { MeaningfulChanges } from "./MeaningfulChanges.js";
import { SourceRecordPanel } from "./SourceRecordPanel.js";
import { SourceUploadPanel } from "./SourceUploadPanel.js";
import { SummaryMetrics } from "./SummaryMetrics.js";
import { UploadExecutionTrace } from "./UploadExecutionTrace.js";
import type {
  AdviserAction,
  ClientFact,
  UploadExecutionMetadata
} from "../types/demo.js";

export type ClientReviewWorkspaceProps = {
  apiBaseUrl: string;
  apiStatus: ApiStatus;
  clientId: string;
  currentSelectedFact: ClientFact | null;
  extractionLabel: string | null;
  extractionWarning: string | null;
  isLoading: boolean;
  isPrepared: boolean;
  isPreparing: boolean;
  isResetting: boolean;
  latestUploadTrace: UploadExecutionMetadata | null;
  loadError: string | null;
  noticeMessage: string | null;
  prepareButtonLabel: string;
  reviewData: ReviewResponse | null;
  reviewStatus: string;
  savingFactId: string | null;
  selectedFactAction: AdviserAction | null;
  skillLabel: string;
  uploadPanelResetToken: number;
  onCloseEvidence: () => void;
  onDecision: (factId: string, decision: DecisionType) => void;
  onPrepareReview: () => void;
  onResetDemo: () => void;
  onSelectFact: (fact: ClientFact) => void;
  onUploaded: (upload: DocumentUploadResponse) => void;
};

export const ClientReviewWorkspace = ({
  apiBaseUrl,
  apiStatus,
  clientId,
  currentSelectedFact,
  extractionLabel,
  extractionWarning,
  isLoading,
  isPrepared,
  isPreparing,
  isResetting,
  latestUploadTrace,
  loadError,
  noticeMessage,
  prepareButtonLabel,
  reviewData,
  reviewStatus,
  savingFactId,
  selectedFactAction,
  skillLabel,
  uploadPanelResetToken,
  onCloseEvidence,
  onDecision,
  onPrepareReview,
  onResetDemo,
  onSelectFact,
  onUploaded
}: ClientReviewWorkspaceProps) => (
  <>
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-7 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">
              Adviser Review Copilot
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
              Source-backed preparation for client reviews
            </h1>
            <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-700">
              <span className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium">
                {reviewData?.client.name ?? "Alex Taylor"}
              </span>
              <span className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5">
                {reviewData
                  ? `${reviewData.client.reviewYear} Client Review`
                  : "2026 Client Review"}
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
              onClick={onPrepareReview}
            >
              {prepareButtonLabel}
            </button>
            <button
              className="text-xs font-semibold text-slate-500 underline-offset-4 hover:text-slate-800 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
              disabled={isResetting || isLoading}
              type="button"
              onClick={onResetDemo}
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
              onSelectFact={onSelectFact}
            />
            <div className="grid gap-6 xl:grid-cols-2">
              <MeaningfulChanges changes={reviewData.meaningfulChanges} />
              <AdviserActions
                facts={reviewData.clientFacts}
                savingFactId={savingFactId}
                disabled={isResetting}
                items={reviewData.adviserActions}
                onDecision={onDecision}
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
          clientId={clientId}
          resetToken={uploadPanelResetToken}
          onUploaded={onUploaded}
        />
        <UploadExecutionTrace metadata={latestUploadTrace} />
        <SourceRecordPanel records={reviewData?.sourceRecords ?? []} />
      </aside>
    </section>

    <EvidenceDrawer
      adviserAction={selectedFactAction}
      fact={currentSelectedFact}
      onClose={onCloseEvidence}
    />
  </>
);
