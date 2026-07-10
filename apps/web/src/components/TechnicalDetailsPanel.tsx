import { useId, useState } from "react";
import type { ReviewResponse } from "@client-review-prep/shared";
import { ApiStatusBadge, type ApiStatus } from "./ApiStatusBadge.js";
import { ExecutionTrace } from "./ExecutionTrace.js";
import { UploadExecutionTrace } from "./UploadExecutionTrace.js";
import type { UploadExecutionMetadata } from "../types/demo.js";

type TechnicalDetailsPanelProps = {
  apiStatus: ApiStatus;
  extractionLabel: string | null;
  extractionWarning: string | null;
  latestUploadTrace: UploadExecutionMetadata | null;
  reviewData: ReviewResponse | null;
  skillLabel: string;
  defaultExpanded?: boolean;
};

export const TechnicalDetailsPanel = ({
  apiStatus,
  extractionLabel,
  extractionWarning,
  latestUploadTrace,
  reviewData,
  skillLabel,
  defaultExpanded = false
}: TechnicalDetailsPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const panelId = useId();

  return (
    <section className="enterprise-panel" aria-labelledby={`${panelId}-heading`}>
      <div className="panel-heading">
        <button
          aria-controls={panelId}
          aria-expanded={isExpanded}
          className="focus-ring flex w-full items-center justify-between gap-3 text-left"
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
        >
          <span>
            <span
              className="block text-sm font-semibold text-slate-950"
              id={`${panelId}-heading`}
            >
              Technical details
            </span>
            <span className="mt-1 block text-xs font-medium text-[var(--muted)]">
              Diagnostics and execution trace
            </span>
          </span>
          <span className="status-chip">{isExpanded ? "Hide" : "Show"}</span>
        </button>
      </div>

      {isExpanded ? (
        <div
          className="panel-body space-y-4"
          id={panelId}
          role="region"
          aria-labelledby={`${panelId}-heading`}
        >
          <div className="space-y-3">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">
                Service status
              </div>
              <ApiStatusBadge status={apiStatus} />
            </div>
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="font-semibold text-[var(--muted)]">
                  Review execution
                </dt>
                <dd className="mt-1 text-slate-700">{skillLabel}</dd>
              </div>
              {reviewData?.executionMetadata ? (
                <div>
                  <dt className="font-semibold text-[var(--muted)]">
                    Execution metadata
                  </dt>
                  <dd className="mt-1 text-slate-700">
                    {reviewData.executionMetadata.skillName} ·{" "}
                    {reviewData.executionMetadata.status}
                  </dd>
                </div>
              ) : null}
              {extractionLabel ? (
                <div>
                  <dt className="font-semibold text-[var(--muted)]">
                    Extraction mode
                  </dt>
                  <dd className="mt-1 text-slate-700">{extractionLabel}</dd>
                </div>
              ) : null}
              {extractionWarning ? (
                <div>
                  <dt className="font-semibold text-[var(--muted)]">
                    Extraction warning
                  </dt>
                  <dd className="mt-1 text-amber-800">{extractionWarning}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          {reviewData ? <ExecutionTrace items={reviewData.workflowTrace} /> : null}
          <UploadExecutionTrace metadata={latestUploadTrace} />
        </div>
      ) : null}
    </section>
  );
};
