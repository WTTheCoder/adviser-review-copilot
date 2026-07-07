import { useEffect, useId, useState } from "react";
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
import { selectClientReadySummary } from "../domain/reviewSelectors.js";
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
  initialTab?: WorkspaceTab;
  onCloseEvidence: () => void;
  onDecision: (factId: string, decision: DecisionType) => void;
  onPrepareReview: () => void;
  onResetDemo: () => void;
  onSelectFact: (fact: ClientFact) => void;
  onUploaded: (upload: DocumentUploadResponse) => void;
};

export type WorkspaceTab = "review" | "evidence" | "history" | "summary";

type WorkspaceTabItem = {
  id: WorkspaceTab;
  label: string;
};

export type PersistedWorkspaceTab =
  | "review"
  | "evidence-sources"
  | "decision-history"
  | "client-summary";

export const workspaceTabStorageKey =
  "adviser-review-copilot.client-review.workspace-tab";

const persistedValueByWorkspaceTab: Record<WorkspaceTab, PersistedWorkspaceTab> = {
  review: "review",
  evidence: "evidence-sources",
  history: "decision-history",
  summary: "client-summary"
};

export const workspaceTabFromPersistedValue = (
  value: string | null
): WorkspaceTab =>
  value === "evidence-sources"
    ? "evidence"
    : value === "decision-history"
    ? "history"
    : value === "client-summary"
    ? "summary"
    : "review";

export const persistedValueForWorkspaceTab = (
  tab: WorkspaceTab
): PersistedWorkspaceTab => persistedValueByWorkspaceTab[tab];

export const readInitialWorkspaceTab = (
  explicitInitialTab?: WorkspaceTab
): WorkspaceTab => {
  if (explicitInitialTab) {
    return explicitInitialTab;
  }

  if (typeof window === "undefined") {
    return "review";
  }

  try {
    return workspaceTabFromPersistedValue(
      window.sessionStorage.getItem(workspaceTabStorageKey)
    );
  } catch {
    return "review";
  }
};

const persistWorkspaceTab = (tab: WorkspaceTab) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      workspaceTabStorageKey,
      persistedValueForWorkspaceTab(tab)
    );
  } catch {
    // Session storage is a convenience only; the workspace remains usable.
  }
};

const workspaceTabs: readonly WorkspaceTabItem[] = [
  { id: "review", label: "Review" },
  { id: "evidence", label: "Evidence & Sources" },
  { id: "history", label: "Decision History" },
  { id: "summary", label: "Client Summary" }
];

const formatDecision = (decision: string) => decision.replaceAll("_", " ");

const unresolvedActionCount = (review: ReviewResponse | null) =>
  review?.adviserActions.filter((action) => !action.latestDecision).length ?? 0;

export const getWorkspaceTabAfterSelection = ({
  activeTab,
  currentSelectedFact,
  hasReviewData = true,
  isPrepared
}: {
  activeTab: WorkspaceTab;
  currentSelectedFact: ClientFact | null;
  hasReviewData?: boolean;
  isPrepared: boolean;
}): WorkspaceTab =>
  currentSelectedFact || (hasReviewData && !isPrepared) ? "review" : activeTab;

type WorkspaceTabsProps = {
  activeTab: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
  tabPrefix: string;
};

export const WorkspaceTabs = ({
  activeTab,
  onChange,
  tabPrefix
}: WorkspaceTabsProps) => (
  <div className="overflow-x-auto border-b border-[var(--border)]">
    <div
      className="flex min-w-max gap-1 px-4"
      role="tablist"
      aria-label="Client review workspace sections"
    >
      {workspaceTabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            aria-controls={`${tabPrefix}-${tab.id}`}
            aria-selected={isActive}
            className={`focus-ring border-b-2 px-3 py-3 text-sm font-semibold ${
              isActive
                ? "border-[var(--accent)] text-slate-950"
                : "border-transparent text-[var(--muted)] hover:text-slate-950"
            }`}
            id={`${tabPrefix}-${tab.id}-tab`}
            key={tab.id}
            role="tab"
            type="button"
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  </div>
);

const EmptyReviewPanel = () => (
  <div className="rounded border border-dashed border-slate-300 bg-white p-6 text-center">
    <h2 className="text-base font-semibold text-slate-950">
      Adviser workspace will appear here
    </h2>
    <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
      Prepare the review to see current facts, meaningful changes, and adviser
      actions for this client.
    </p>
  </div>
);

const getDecisionHistoryRows = (review: ReviewResponse) =>
  review.adviserActions
    .flatMap((action) => {
      const fact = review.clientFacts.find((item) => item.id === action.factId);

      return (action.decisionHistory ?? []).map((decision) => ({
        actionId: action.id,
        actor: decision.actor,
        createdAt: decision.createdAt,
        decision: decision.decision,
        field: fact?.field ?? null,
        officialValueBefore: decision.officialValueBefore,
        resultingOfficialValue: decision.resultingOfficialValue,
        status: decision.note ?? action.status,
        title: action.title
      }));
    })
    .sort((first, second) => {
      const createdAtComparison = second.createdAt.localeCompare(first.createdAt);

      if (createdAtComparison !== 0) {
        return createdAtComparison;
      }

      const actionComparison = first.actionId.localeCompare(second.actionId);

      if (actionComparison !== 0) {
        return actionComparison;
      }

      return first.decision.localeCompare(second.decision);
    });

const DecisionHistoryTable = ({ review }: { review: ReviewResponse }) => {
  const decisions = getDecisionHistoryRows(review);

  if (decisions.length === 0) {
    return (
      <p className="panel-body text-sm text-[var(--muted)]">
        No adviser decisions have been recorded for this review yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-[var(--surface-subtle)] text-xs font-semibold text-[var(--muted)]">
          <tr>
            <th className="border-b border-[var(--border)] px-4 py-2">Fact</th>
            <th className="border-b border-[var(--border)] px-4 py-2">
              Decision
            </th>
            <th className="border-b border-[var(--border)] px-4 py-2">Actor</th>
            <th className="border-b border-[var(--border)] px-4 py-2">
              Timestamp
            </th>
            <th className="border-b border-[var(--border)] px-4 py-2">
              Previous official value
            </th>
            <th className="border-b border-[var(--border)] px-4 py-2">
              Resulting official value
            </th>
            <th className="border-b border-[var(--border)] px-4 py-2">
              Rationale / status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)] bg-white">
          {decisions.map((decision) => (
            <tr
              className="align-top"
              key={`${decision.actionId}-${decision.decision}-${decision.createdAt}`}
            >
              <td className="px-4 py-3 font-semibold text-slate-950">
                {decision.field ?? "Review action"}
              </td>
              <td className="px-4 py-3">
                <span className="status-chip status-chip-success">
                  {formatDecision(decision.decision)}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-700">
                {decision.actor ?? "Not recorded"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                {decision.createdAt}
              </td>
              <td className="px-4 py-3 text-slate-700">
                {decision.officialValueBefore ?? "Not recorded"}
              </td>
              <td className="px-4 py-3 text-slate-700">
                {decision.resultingOfficialValue ?? "Not recorded"}
              </td>
              <td className="px-4 py-3 text-slate-700">
                <div>{decision.status}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {decision.title}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ClientSummaryPanel = ({ review }: { review: ReviewResponse }) => {
  const summary = selectClientReadySummary(review);

  return (
    <div className="space-y-4">
      <section className="enterprise-panel">
        <div className="panel-heading">
          <h2 className="text-base font-semibold text-slate-950">
            Review preparation summary
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Read-only preparation notes for a client meeting. This is not
            financial advice.
          </p>
        </div>
      </section>

      <section className="enterprise-panel">
        <div className="panel-heading flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-950">
            Current client picture
          </h3>
          <span className="status-chip">
            {summary.currentClientPicture.length}
          </span>
        </div>
        {summary.currentClientPicture.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {summary.currentClientPicture.map((fact) => (
              <div
                className="grid gap-2 px-4 py-3 md:grid-cols-[180px_minmax(0,1fr)_130px]"
                key={fact.factId}
              >
                <div className="font-semibold text-slate-950">{fact.field}</div>
                <div className="text-slate-700">{fact.value}</div>
                <span className="status-chip justify-self-start">
                  {fact.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="panel-body text-sm text-[var(--muted)]">
            Prepare the review to populate current client facts.
          </p>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="enterprise-panel">
          <div className="panel-heading">
            <h3 className="text-base font-semibold text-slate-950">
              Confirmed changes
            </h3>
          </div>
          {summary.confirmedChanges.length > 0 ? (
            <ul className="divide-y divide-[var(--border)]">
              {summary.confirmedChanges.map((change) => (
                <li className="px-4 py-3 text-sm" key={`${change.factId}-${change.decidedAt}`}>
                  <div className="font-semibold text-slate-950">
                    {change.field ?? "Review action"}
                  </div>
                  <div className="mt-1 text-[var(--muted)]">
                    {change.fromValue ?? "Not recorded"} to{" "}
                    {change.toValue ?? "Not recorded"}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-body text-sm text-[var(--muted)]">
              No confirmed changes have been recorded.
            </p>
          )}
        </div>

        <div className="enterprise-panel">
          <div className="panel-heading">
            <h3 className="text-base font-semibold text-slate-950">
              Outstanding questions
            </h3>
          </div>
          {summary.outstandingQuestions.length > 0 ? (
            <ul className="divide-y divide-[var(--border)]">
              {summary.outstandingQuestions.map((item) => (
                <li className="px-4 py-3 text-sm" key={item.actionId}>
                  <div className="font-semibold text-slate-950">{item.title}</div>
                  <p className="mt-1 text-[var(--muted)]">{item.detail}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-body text-sm text-[var(--muted)]">
              No outstanding questions are currently surfaced.
            </p>
          )}
        </div>

        <div className="enterprise-panel">
          <div className="panel-heading">
            <h3 className="text-base font-semibold text-slate-950">
              Adviser decisions
            </h3>
          </div>
          {summary.adviserDecisions.length > 0 ? (
            <ul className="divide-y divide-[var(--border)]">
              {summary.adviserDecisions.map((decision) => (
                <li
                  className="px-4 py-3 text-sm"
                  key={`${decision.actionId}-${decision.decision}-${decision.createdAt}`}
                >
                  <span className="status-chip status-chip-success">
                    {formatDecision(decision.decision)}
                  </span>
                  <p className="mt-2 text-slate-700">{decision.title}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-body text-sm text-[var(--muted)]">
              No adviser decisions have been recorded.
            </p>
          )}
        </div>
      </section>
    </div>
  );
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
  initialTab,
  onCloseEvidence,
  onDecision,
  onPrepareReview,
  onResetDemo,
  onSelectFact,
  onUploaded
}: ClientReviewWorkspaceProps) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(() =>
    readInitialWorkspaceTab(initialTab)
  );
  const tabPrefix = useId();
  const openActions = unresolvedActionCount(reviewData);
  const changeActiveTab = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    persistWorkspaceTab(tab);
  };

  useEffect(() => {
    setActiveTab((currentTab) => {
      const nextTab = getWorkspaceTabAfterSelection({
        activeTab: currentTab,
        currentSelectedFact,
        hasReviewData: reviewData !== null,
        isPrepared
      });

      if (nextTab !== currentTab) {
        persistWorkspaceTab(nextTab);
      }

      return nextTab;
    });
  }, [currentSelectedFact, isPrepared, reviewData]);

  return (
    <>
      <section className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-4 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">
                {reviewData?.client.name ?? "Alex Taylor"}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-700">
                <span className="status-chip">
                  {reviewData
                    ? `${reviewData.client.reviewYear} Client Review`
                    : "2026 Client Review"}
                </span>
                <span className="status-chip">
                  Adviser: {reviewData?.client.adviserName ?? "Jordan Lee"}
                </span>
                <span className="status-chip status-chip-warning">
                  {reviewStatus}
                </span>
                <span className="status-chip">{openActions} open actions</span>
              </div>
            </div>
            <button
              className="primary-action focus-ring self-start"
              disabled={isPreparing || isLoading || isResetting}
              type="button"
              onClick={onPrepareReview}
            >
              {prepareButtonLabel}
            </button>
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
          <div className="rounded border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Ready to prepare</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Source material is available for this review. Start preparation to
              reconcile current facts, preserve superseded history, and surface
              items that need adviser attention.
            </p>
          </div>
        ) : null}

        <WorkspaceTabs
          activeTab={activeTab}
          onChange={changeActiveTab}
          tabPrefix={tabPrefix}
        />
      </div>
    </section>

    <section className="mx-auto w-full max-w-7xl px-5 py-5 lg:px-8">
      <div
        id={`${tabPrefix}-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`${tabPrefix}-${activeTab}-tab`}
      >
        {activeTab === "review" ? (
          <div className="space-y-5">
            {reviewData && isPrepared ? (
              <>
                <SummaryMetrics metrics={reviewData.summaryMetrics} />
                <CurrentClientPicture
                  facts={reviewData.clientFacts}
                  onSelectFact={onSelectFact}
                />
                <div className="grid gap-5 xl:grid-cols-2">
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
              <EmptyReviewPanel />
            )}
          </div>
        ) : null}

        {activeTab === "evidence" ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            <SourceUploadPanel
              apiBaseUrl={apiBaseUrl}
              clientId={clientId}
              resetToken={uploadPanelResetToken}
              onUploaded={onUploaded}
            />
            <SourceRecordPanel records={reviewData?.sourceRecords ?? []} />
          </div>
        ) : null}

        {activeTab === "history" ? (
          <section className="enterprise-panel">
            <div className="panel-heading">
              <h2 className="text-base font-semibold text-slate-950">
                Decision history
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Persisted adviser decisions for this review.
              </p>
            </div>
            {reviewData ? <DecisionHistoryTable review={reviewData} /> : null}
          </section>
        ) : null}

        {activeTab === "summary" && reviewData ? (
          <ClientSummaryPanel review={reviewData} />
        ) : null}
      </div>

      <aside className="mt-5 grid gap-4 lg:grid-cols-2">
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
};
