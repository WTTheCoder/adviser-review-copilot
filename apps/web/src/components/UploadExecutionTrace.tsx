import type { ExecutionEventStatus } from "@client-review-prep/shared";
import type { UploadExecutionMetadata } from "../types/demo.js";

type UploadExecutionTraceProps = {
  metadata: UploadExecutionMetadata | null;
};

const traceStyles: Record<ExecutionEventStatus, string> = {
  STARTED: "border-sky-200 bg-sky-50 text-sky-800",
  COMPLETE: "border-emerald-200 bg-emerald-50 text-emerald-800",
  ESCALATED: "border-amber-200 bg-amber-50 text-amber-800",
  FAILED: "border-rose-200 bg-rose-50 text-rose-800"
};

const traceLabels: Record<ExecutionEventStatus, string> = {
  STARTED: "Started",
  COMPLETE: "Complete",
  ESCALATED: "Escalated",
  FAILED: "Failed"
};

export const UploadExecutionTrace = ({
  metadata
}: UploadExecutionTraceProps) => {
  if (!metadata) {
    return null;
  }

  return (
    <details className="rounded border border-slate-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-700">
        View upload execution trace
      </summary>
      <p className="mt-3 text-xs font-medium text-slate-500">
        Upload skill: {metadata.skillName}
      </p>
      <ol className="mt-4 space-y-3" aria-label="Upload ingestion trace">
        {metadata.events.map((event) => (
          <li
            className="flex items-center justify-between gap-4"
            key={`${event.sequence}-${event.label}`}
          >
            <span className="text-sm text-slate-600">{event.label}</span>
            <span
              className={`rounded border px-2 py-1 text-xs font-semibold ${traceStyles[event.status]}`}
            >
              {traceLabels[event.status]}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
};
