import type { ReviewResponse } from "@client-review-prep/shared";
import {
  selectDashboardSummary,
  type DashboardAttentionItem
} from "../domain/reviewSelectors.js";
import {
  getReviewStatusLabel,
  hasPreparedReviewWorkspaceData
} from "../domain/reviewWorkflow.js";
import { StatusBadge } from "./StatusBadge.js";

type AdviserDashboardProps = {
  review: ReviewResponse;
  onOpenClientReviews: () => void;
  onOpenReview: (factId?: string) => void;
};

const formatDecision = (decision: string) => decision.replaceAll("_", " ");

const typeLabel = (category: DashboardAttentionItem["category"]) =>
  category === "needs-confirmation"
    ? "Address verification"
    : "Risk profile review";

export const AdviserDashboard = ({
  review,
  onOpenClientReviews,
  onOpenReview
}: AdviserDashboardProps) => {
  const dashboard = selectDashboardSummary(review);
  const hasPreparedWorkspaceData = hasPreparedReviewWorkspaceData(review);
  const reviewStatus = hasPreparedWorkspaceData
    ? getReviewStatusLabel("prepared")
    : getReviewStatusLabel("ready");
  const factsReviewed =
    hasPreparedWorkspaceData
      ? dashboard.summaryMetrics.find(
          (metric) => metric.label === "Facts reviewed"
        )?.value ?? "0"
      : "0";
  const kpis = [
    {
      label: "Open actions",
      value: String(dashboard.itemsRequiringAttention.length)
    },
    {
      label: "High-impact changes",
      value: String(dashboard.highImpactChanges.length)
    },
    {
      label: "Facts reviewed",
      value: factsReviewed
    },
    {
      label: "Review status",
      value: reviewStatus
    }
  ];

  return (
    <section className="work-surface">
      <header className="mb-4 flex flex-col gap-3 border-b border-[var(--border)] pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-950">
            Adviser workspace
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Prioritise the current client review and resolve adviser actions.
          </p>
        </div>
        <button
          className="primary-action focus-ring self-start"
          type="button"
          onClick={onOpenClientReviews}
        >
          Open client review
        </button>
      </header>

      <section
        className="mb-4 grid gap-px overflow-hidden rounded-[var(--radius-compact)] border border-[var(--border)] bg-[var(--border)] md:grid-cols-4"
        aria-label="Review indicators"
      >
        {kpis.map((kpi) => (
          <div className="bg-white px-4 py-3" key={kpi.label}>
            <div className="text-xs font-semibold text-[var(--muted)]">
              {kpi.label}
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-950">
              {kpi.value}
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <section className="enterprise-panel">
            <div className="panel-heading flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  Priority actions
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Adviser decisions needed for this review.
                </p>
              </div>
              <span className="status-chip">
                {dashboard.itemsRequiringAttention.length}
              </span>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {dashboard.itemsRequiringAttention.length > 0 ? (
                dashboard.itemsRequiringAttention.map((item) => (
                  <div
                    className="grid gap-3 px-4 py-3 lg:grid-cols-[190px_minmax(0,1fr)_110px] lg:items-center"
                    key={item.actionId}
                  >
                    <div>
                      <span className="status-chip">{typeLabel(item.category)}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-950">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm leading-5 text-[var(--muted)]">
                        {item.detail}
                      </p>
                    </div>
                    <button
                      className="link-action focus-ring justify-self-start lg:justify-self-end"
                      type="button"
                      onClick={() => onOpenReview(item.factId)}
                    >
                      Open review
                    </button>
                  </div>
                ))
              ) : (
                <p className="panel-body text-sm text-[var(--muted)]">
                  No review items currently require adviser action.
                </p>
              )}
            </div>
          </section>

          <section className="enterprise-panel">
            <div className="panel-heading flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-950">
                Meaningful changes
              </h2>
              <span className="status-chip">
                {dashboard.meaningfulChanges.length}
              </span>
            </div>
            {dashboard.meaningfulChanges.length > 0 ? (
              <ul className="divide-y divide-[var(--border)]">
                {dashboard.meaningfulChanges.map((change) => (
                  <li className="px-4 py-2.5 text-sm text-slate-700" key={change}>
                    {change}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-body text-sm text-[var(--muted)]">
                No meaningful changes are currently surfaced for this review.
              </p>
            )}
          </section>

          <section className="enterprise-panel">
            <div className="panel-heading flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-950">
                Recent adviser decisions
              </h2>
              <span className="status-chip">
                {dashboard.recentAdviserDecisions.length}
              </span>
            </div>
            {dashboard.recentAdviserDecisions.length > 0 ? (
              <div className="divide-y divide-[var(--border)]">
                {dashboard.recentAdviserDecisions.map((decision) => (
                  <div
                    className="grid gap-2 px-4 py-3 md:grid-cols-[150px_minmax(0,1fr)]"
                    key={`${decision.actionId}-${decision.decision}-${decision.createdAt}`}
                  >
                    <span className="status-chip status-chip-success justify-self-start">
                      {formatDecision(decision.decision)}
                    </span>
                    <p className="text-sm text-slate-700">{decision.title}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-body text-sm text-[var(--muted)]">
                No adviser decisions have been recorded for this review yet.
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="enterprise-panel">
            <div className="panel-heading">
              <h2 className="text-base font-semibold text-slate-950">
                Current client review
              </h2>
            </div>
            <dl className="panel-body grid gap-3 text-sm">
              <div>
                <dt className="font-semibold text-[var(--muted)]">Client</dt>
                <dd className="mt-1 text-slate-950">
                  {dashboard.currentReview.clientName}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--muted)]">Review</dt>
                <dd className="mt-1 text-slate-950">
                  {dashboard.currentReview.reviewYear} Client Review
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--muted)]">Adviser</dt>
                <dd className="mt-1 text-slate-950">
                  {dashboard.currentReview.adviserName}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--muted)]">Status</dt>
                <dd className="mt-1">
                  <StatusBadge status={reviewStatus} />
                </dd>
              </div>
            </dl>
          </section>

          <section className="enterprise-panel">
            <div className="panel-heading flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-950">
                High-impact changes
              </h2>
              <span className="status-chip status-chip-warning">
                {dashboard.highImpactChanges.length}
              </span>
            </div>
            {dashboard.highImpactChanges.length > 0 ? (
              <div className="divide-y divide-[var(--border)]">
                {dashboard.highImpactChanges.map((change) => (
                  <div className="px-4 py-3" key={change.actionId}>
                    <h3 className="text-sm font-semibold text-slate-950">
                      {change.title}
                    </h3>
                    <p className="mt-1 text-sm leading-5 text-[var(--muted)]">
                      {change.detail}
                    </p>
                    <button
                      className="link-action focus-ring mt-2"
                      type="button"
                      onClick={() => onOpenReview(change.factId)}
                    >
                      Review item
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-body text-sm text-[var(--muted)]">
                No unresolved high-impact changes are currently surfaced.
              </p>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
};
