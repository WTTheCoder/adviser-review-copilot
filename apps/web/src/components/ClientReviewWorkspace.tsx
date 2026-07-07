import type {
  DecisionType,
  DocumentUploadResponse,
  ReviewResponse
} from "@client-review-prep/shared";
import { AdviserActions } from "./AdviserActions.js";
import { type ApiStatus } from "./ApiStatusBadge.js";
import { CurrentClientPicture } from "./CurrentClientPicture.js";
import { DemoControlsPanel } from "./DemoControlsPanel.js";
import { EvidenceDrawer } from "./EvidenceDrawer.js";
import { MeaningfulChanges } from "./MeaningfulChanges.js";
import { SourceRecordPanel } from "./SourceRecordPanel.js";
import { SourceUploadPanel } from "./SourceUploadPanel.js";
import { SummaryMetrics } from "./SummaryMetrics.js";
import { TechnicalDetailsPanel } from "./TechnicalDetailsPanel.js";
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
                {reviewStatus}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <button
              className="rounded bg-cyan-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={isPreparing || isLoading || isResetting}
              type="button"
              onClick={onPrepareReview}
            >
              {prepareButtonLabel}
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
              Retrieving the current client review and available source material.
            </p>
          </div>
        ) : null}

        {reviewData && !isPrepared ? (
          <div className="rounded border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-900">Ready to prepare</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Source material is available for this review. Start preparation to
              reconcile current facts, preserve superseded history, and surface
              items that need adviser attention.
            </p>
          </div>
        ) : null}

        {reviewData && isPrepared ? (
          <SummaryMetrics metrics={reviewData.summaryMetrics} />
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
          </>
        ) : (
          <div className="rounded border border-dashed border-slate-300 bg-white p-8 text-center">
            <h2 className="text-xl font-semibold text-slate-950">
              Adviser workspace will appear here
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Prepare the review to see current facts, meaningful changes, and
              adviser actions for this client.
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
        <SourceRecordPanel records={reviewData?.sourceRecords ?? []} />
        <TechnicalDetailsPanel
          apiStatus={apiStatus}
          extractionLabel={extractionLabel}
          extractionWarning={extractionWarning}
          latestUploadTrace={latestUploadTrace}
          reviewData={reviewData}
          skillLabel={skillLabel}
        />
        <DemoControlsPanel
          isLoading={isLoading}
          isResetting={isResetting}
          onResetDemo={onResetDemo}
        />
      </aside>
    </section>

    <EvidenceDrawer
      adviserAction={selectedFactAction}
      fact={currentSelectedFact}
      onClose={onCloseEvidence}
    />
  </>
);
