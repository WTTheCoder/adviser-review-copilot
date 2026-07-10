import { useId, useState } from "react";

type DemoControlsPanelProps = {
  isLoading: boolean;
  isResetting: boolean;
  onResetDemo: () => void;
  defaultExpanded?: boolean;
};

export const DemoControlsPanel = ({
  isLoading,
  isResetting,
  onResetDemo,
  defaultExpanded = false
}: DemoControlsPanelProps) => {
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
              Demo controls
            </span>
            <span className="mt-1 block text-xs font-medium text-[var(--muted)]">
              Local review data controls
            </span>
          </span>
          <span className="status-chip">{isExpanded ? "Hide" : "Show"}</span>
        </button>
      </div>

      {isExpanded ? (
        <div
          className="panel-body space-y-3"
          id={panelId}
          role="region"
          aria-labelledby={`${panelId}-heading`}
        >
          <p className="text-sm leading-5 text-[var(--muted)]">
            Reset the local review data to its starting state.
          </p>
          <button
            className="link-action focus-ring"
            disabled={isResetting || isLoading}
            type="button"
            onClick={onResetDemo}
          >
            {isResetting ? "Resetting local data..." : "Reset local demo data"}
          </button>
        </div>
      ) : null}
    </section>
  );
};
