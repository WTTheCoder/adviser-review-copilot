import { StatusBadge } from "./StatusBadge.js";

type ClientReviewListItem = {
  clientName: string;
  review: string;
  adviser: string;
  status: string;
  openActions: number;
  lastUpdated: string;
  isInteractive: boolean;
};

type ClientReviewsListProps = {
  onOpenAlexReview: () => void;
};

const reviewItems: readonly ClientReviewListItem[] = [
  {
    clientName: "Alex Taylor",
    review: "2026 Client Review",
    adviser: "Jordan Bennett",
    status: "Ready for adviser review",
    openActions: 2,
    lastUpdated: "Today",
    isInteractive: true
  },
  {
    clientName: "Emma Wilson",
    review: "2026 Client Review",
    adviser: "Jordan Bennett",
    status: "Preparing review",
    openActions: 0,
    lastUpdated: "Today",
    isInteractive: false
  },
  {
    clientName: "Daniel Harris",
    review: "2026 Client Review",
    adviser: "Priya Nair",
    status: "Ready for client meeting",
    openActions: 0,
    lastUpdated: "Yesterday",
    isInteractive: false
  },
  {
    clientName: "Sarah Brown",
    review: "2026 Client Review",
    adviser: "Jordan Bennett",
    status: "Review completed",
    openActions: 0,
    lastUpdated: "2 days ago",
    isInteractive: false
  },
  {
    clientName: "Michael Parker",
    review: "2026 Client Review",
    adviser: "Jordan Bennett",
    status: "Awaiting source documents",
    openActions: 0,
    lastUpdated: "3 days ago",
    isInteractive: false
  }
];

const summaryMetrics = [
  { label: "Active reviews", value: String(reviewItems.length) },
  {
    label: "Open adviser actions",
    value: String(
      reviewItems.reduce((total, item) => total + item.openActions, 0)
    )
  },
  {
    label: "Ready for review",
    value: String(
      reviewItems.filter((item) => item.status === "Ready for adviser review")
        .length
    )
  }
] as const;

export const ClientReviewsList = ({
  onOpenAlexReview
}: ClientReviewsListProps) => (
  <section className="work-surface">
    <header className="mb-4 flex flex-col gap-3 border-b border-[var(--border)] pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-slate-950">Client Reviews</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Manage active annual reviews and open adviser work.
        </p>
      </div>
    </header>

    <section
      className="mb-4 grid gap-px overflow-hidden rounded-[var(--radius-compact)] border border-[var(--border)] bg-[var(--border)] md:grid-cols-3"
      aria-label="Client review list indicators"
    >
      {summaryMetrics.map((metric) => (
        <div className="bg-white px-4 py-3" key={metric.label}>
          <div className="text-xs font-semibold text-[var(--muted)]">
            {metric.label}
          </div>
          <div className="mt-1 text-lg font-semibold text-slate-950">
            {metric.value}
          </div>
        </div>
      ))}
    </section>

    <section className="enterprise-panel">
      <div className="panel-heading">
        <h2 className="text-base font-semibold text-slate-950">
          Annual review worklist
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[var(--surface-subtle)] text-xs font-semibold text-[var(--muted)]">
            <tr>
              <th className="border-b border-[var(--border)] px-4 py-2">
                Client
              </th>
              <th className="border-b border-[var(--border)] px-4 py-2">
                Review
              </th>
              <th className="border-b border-[var(--border)] px-4 py-2">
                Adviser
              </th>
              <th className="w-56 border-b border-[var(--border)] px-4 py-2">
                Status
              </th>
              <th className="border-b border-[var(--border)] px-4 py-2">
                Open actions
              </th>
              <th className="border-b border-[var(--border)] px-4 py-2">
                Last updated
              </th>
              <th className="border-b border-[var(--border)] px-4 py-2">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] bg-white">
            {reviewItems.map((item) => (
              <tr className="align-top" key={item.clientName}>
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-950">
                  {item.clientName}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {item.review}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {item.adviser}
                </td>
                <td className="w-56 whitespace-nowrap px-4 py-3">
                  <StatusBadge status={item.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {item.openActions}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {item.lastUpdated}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {item.isInteractive ? (
                    <button
                      className="link-action focus-ring"
                      type="button"
                      onClick={onOpenAlexReview}
                    >
                      Open review
                    </button>
                  ) : (
                    <span className="text-sm font-medium text-[var(--muted)]">
                      Unavailable
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  </section>
);
