import type { SummaryMetric } from "../types/demo.js";

type SummaryMetricsProps = {
  metrics: SummaryMetric[];
};

export const SummaryMetrics = ({ metrics }: SummaryMetricsProps) => (
  <dl className="grid gap-3 sm:grid-cols-3">
    {metrics.map((metric) => (
      <div
        className="rounded border border-slate-200 bg-white p-5 shadow-sm"
        key={metric.label}
      >
        <dt className="text-sm font-medium text-slate-600">{metric.label}</dt>
        <dd className="mt-2 text-3xl font-semibold text-slate-950">
          {metric.value}
        </dd>
      </div>
    ))}
  </dl>
);
