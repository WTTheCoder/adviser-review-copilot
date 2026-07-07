import type { ReviewResponse } from "@client-review-prep/shared";
import {
  selectActionQueue,
  type ActionQueueCategory,
  type DashboardAttentionItem
} from "../domain/reviewSelectors.js";

type MyActionsProps = {
  review: ReviewResponse;
  onOpenReview: (factId: string) => void;
};

const typeLabel = (category: ActionQueueCategory) =>
  category === "needs-confirmation"
    ? "Needs confirmation"
    : "Requires adviser approval";

const priorityLabel = (category: ActionQueueCategory) =>
  category === "requires-adviser-approval" ? "High" : "Standard";

const flattenQueue = (review: ReviewResponse): DashboardAttentionItem[] =>
  selectActionQueue(review).flatMap((group) => group.items);

export const MyActions = ({ review, onOpenReview }: MyActionsProps) => {
  const actions = flattenQueue(review);
  const counts = {
    "needs-confirmation": actions.filter(
      (action) => action.category === "needs-confirmation"
    ).length,
    "requires-adviser-approval": actions.filter(
      (action) => action.category === "requires-adviser-approval"
    ).length
  };

  return (
    <section className="work-surface">
      <header className="mb-4 flex flex-col gap-3 border-b border-[var(--border)] pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-950">My Actions</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Resolve open review actions for {review.client.name}.
          </p>
        </div>
        <span className="status-chip self-start">{actions.length} open actions</span>
      </header>

      <section className="enterprise-panel">
        <div className="panel-heading flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Action queue
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Current confirmation and approval work for this review.
            </p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Action type counts">
            <span className="status-chip">
              Needs confirmation {counts["needs-confirmation"]}
            </span>
            <span className="status-chip status-chip-warning">
              Requires adviser approval {counts["requires-adviser-approval"]}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-subtle)] text-xs font-semibold text-[var(--muted)]">
              <tr>
                <th className="border-b border-[var(--border)] px-4 py-2">
                  Priority
                </th>
                <th className="border-b border-[var(--border)] px-4 py-2">
                  Client
                </th>
                <th className="border-b border-[var(--border)] px-4 py-2">
                  Action
                </th>
                <th className="border-b border-[var(--border)] px-4 py-2">
                  Type
                </th>
                <th className="border-b border-[var(--border)] px-4 py-2">
                  Status
                </th>
                <th className="border-b border-[var(--border)] px-4 py-2">
                  Direct action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-white">
              {actions.length > 0 ? (
                actions.map((item) => (
                  <tr key={item.actionId} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`status-chip ${
                          item.category === "requires-adviser-approval"
                            ? "status-chip-warning"
                            : ""
                        }`}
                      >
                        {priorityLabel(item.category)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-950">
                      {item.clientName}
                    </td>
                    <td className="min-w-72 px-4 py-3">
                      <div className="font-semibold text-slate-950">
                        {item.title}
                      </div>
                      <div className="mt-1 text-sm leading-5 text-[var(--muted)]">
                        {item.detail}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`status-chip ${
                          item.category === "requires-adviser-approval"
                            ? "status-chip-warning"
                            : ""
                        }`}
                      >
                        {typeLabel(item.category)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="status-chip">{item.status}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        className="link-action focus-ring"
                        type="button"
                        onClick={() => onOpenReview(item.factId)}
                      >
                        Open review action
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-5 text-sm text-[var(--muted)]" colSpan={6}>
                    No actions in this queue.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
};
