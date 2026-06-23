import type { ExecutionTraceItem } from "../types/demo.js";

type ExecutionTraceProps = {
  items: ExecutionTraceItem[];
};

const traceStyles: Record<ExecutionTraceItem["status"], string> = {
  COMPLETE: "border-emerald-200 bg-emerald-50 text-emerald-800",
  ESCALATED: "border-amber-200 bg-amber-50 text-amber-800",
  FAILED: "border-rose-200 bg-rose-50 text-rose-800"
};

const traceLabels: Record<ExecutionTraceItem["status"], string> = {
  COMPLETE: "Complete",
  ESCALATED: "Escalated",
  FAILED: "Failed"
};

export const ExecutionTrace = ({ items }: ExecutionTraceProps) => (
  <details className="rounded border border-slate-200 bg-white p-5 shadow-sm">
    <summary className="cursor-pointer text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-700">
      View execution trace
    </summary>
    <ol className="mt-4 space-y-3">
      {items.map((item) => (
        <li className="flex items-center justify-between gap-4" key={item.label}>
          <span className="text-sm text-slate-600">{item.label}</span>
          <span
            className={`rounded border px-2 py-1 text-xs font-semibold ${traceStyles[item.status]}`}
          >
            {traceLabels[item.status]}
          </span>
        </li>
      ))}
    </ol>
  </details>
);
