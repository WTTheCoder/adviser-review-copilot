import { StatusBadge } from "./StatusBadge.js";
import type { ActionDecision, AdviserAction, ClientFact } from "../types/demo.js";
import { getAdviserActionPresentation } from "../domain/factPresentation.js";

type AdviserActionsProps = {
  items: AdviserAction[];
  facts: ClientFact[];
  savingFactId: string | null;
  onDecision: (factId: string, decision: ActionDecision) => void;
};

const decisionLabels: Record<ActionDecision, string> = {
  APPROVE: "Approved",
  CONFIRM: "Confirmed",
  KEEP_CURRENT: "Current value kept",
  LEAVE_UNVERIFIED: "Left unverified"
};

const selectedButtonClass =
  "border-slate-900 bg-slate-900 text-white hover:bg-slate-700 focus:ring-slate-900";
const unselectedButtonClass =
  "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-700";

export const getDecisionButtonClass = (isPrimary: boolean) => {
  return `rounded border px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
    isPrimary ? selectedButtonClass : unselectedButtonClass
  }`;
};

export const shouldRenderAdviserAction = (
  item: AdviserAction,
  fact: ClientFact | null
) =>
  item.latestDecision !== null ||
  typeof fact?.candidateValue === "string";

export const AdviserActions = ({
  facts,
  items,
  savingFactId,
  onDecision
}: AdviserActionsProps) => {
  const renderableItems = items.flatMap((item) => {
    const fact = facts.find((candidate) => candidate.id === item.factId) ?? null;
    return shouldRenderAdviserAction(item, fact) ? [{ item, fact }] : [];
  });

  if (renderableItems.length === 0) {
    return null;
  }

  return (
    <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Adviser actions</h2>
      <div className="mt-4 space-y-4">
        {renderableItems.map(({ item, fact }) => {
          const isSaving = savingFactId === item.factId;
          const latestDecision = item.latestDecision;
          const presentation = getAdviserActionPresentation(item, fact);

          return (
            <article className="rounded border border-slate-200 p-4" key={item.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">
                    {presentation.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {presentation.detail}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>
              {!latestDecision ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    aria-pressed={false}
                    className={getDecisionButtonClass(true)}
                    disabled={isSaving}
                    type="button"
                    onClick={() => onDecision(item.factId, item.primaryDecision)}
                  >
                    {item.primaryLabel}
                  </button>
                  <button
                    aria-pressed={false}
                    className={getDecisionButtonClass(false)}
                    disabled={isSaving}
                    type="button"
                    onClick={() => onDecision(item.factId, item.secondaryDecision)}
                  >
                    {item.secondaryLabel}
                  </button>
                  {isSaving ? (
                    <span className="text-xs font-medium text-slate-600">
                      Saving local demo decision...
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4">
                  <span className="inline-flex rounded border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-medium leading-5 text-cyan-900">
                    Local demo decision: {decisionLabels[latestDecision.decision]}.
                    No production CRM was updated.
                  </span>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
