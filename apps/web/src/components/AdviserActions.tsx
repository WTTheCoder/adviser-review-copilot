import { StatusBadge } from "./StatusBadge.js";
import type {
  ActionDecision,
  AdviserAction,
  AdviserActionId
} from "../types/demo.js";

type AdviserActionsProps = {
  items: AdviserAction[];
  decisions: Record<AdviserActionId, ActionDecision>;
  onDecision: (actionId: AdviserActionId, decision: ActionDecision) => void;
};

const decisionLabels: Partial<Record<ActionDecision, string>> = {
  approved:
    "Local demo decision: approved for this presentation only. No production CRM was updated.",
  "kept-current":
    "Local demo decision: current value kept for this presentation only. No production CRM was updated.",
  confirmed:
    "Local demo decision: confirmed for this presentation only. No production CRM was updated.",
  unverified:
    "Local demo decision: left unverified for this presentation only. No production CRM was updated."
};

export const AdviserActions = ({
  items,
  decisions,
  onDecision
}: AdviserActionsProps) => (
  <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-semibold text-slate-950">Adviser actions</h2>
    <div className="mt-4 space-y-4">
      {items.map((item) => {
        const decision = decisions[item.id];

        return (
          <article className="rounded border border-slate-200 p-4" key={item.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {item.detail}
                </p>
              </div>
              <StatusBadge status={item.status} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                className="rounded bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                type="button"
                onClick={() => onDecision(item.id, item.primaryDecision)}
              >
                {item.primaryLabel}
              </button>
              <button
                className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:ring-offset-2"
                type="button"
                onClick={() => onDecision(item.id, item.secondaryDecision)}
              >
                {item.secondaryLabel}
              </button>
              {decision !== "pending" ? (
                <span className="rounded border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-medium leading-5 text-cyan-900">
                  {decisionLabels[decision]}
                </span>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  </section>
);
