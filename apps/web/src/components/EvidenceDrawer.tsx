import { StatusBadge } from "./StatusBadge.js";
import type { AdviserAction, ClientFact } from "../types/demo.js";
import { getEvidenceExplanation } from "../domain/factPresentation.js";

type EvidenceDrawerProps = {
  fact: ClientFact | null;
  adviserAction?: AdviserAction | null;
  onClose: () => void;
};

export const EvidenceDrawer = ({
  fact,
  adviserAction = null,
  onClose
}: EvidenceDrawerProps) => {
  if (!fact) {
    return null;
  }

  const explanation = getEvidenceExplanation(fact, adviserAction);

  return (
    <div
      className="fixed inset-0 z-20 bg-slate-950/25"
      role="presentation"
      onClick={onClose}
    >
      <aside
        aria-labelledby="evidence-drawer-title"
        className="ml-auto flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">
                Evidence and memory
              </p>
              <h2
                className="mt-1 text-2xl font-semibold text-slate-950"
                id="evidence-drawer-title"
              >
                {fact.field}
              </h2>
            </div>
            <button
              className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-700"
              type="button"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-6 px-6 py-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {fact.candidateValue ? "Current value" : "Current value"}
              </dt>
              <dd className="mt-1 text-base font-semibold text-slate-950">
                {fact.currentValue}
              </dd>
            </div>
            {fact.candidateValue ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Candidate value
                </dt>
                <dd className="mt-1 text-base font-semibold text-slate-950">
                  {fact.candidateValue}
                </dd>
              </div>
            ) : null}
            {fact.previousValue ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Previous value
                </dt>
                <dd className="mt-1 text-base font-semibold text-slate-950">
                  {fact.previousValue}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Source document
              </dt>
              <dd className="mt-1 text-base font-semibold text-slate-950">
                {fact.officialSourceDocument}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Observed date
              </dt>
              <dd className="mt-1 text-base font-semibold text-slate-950">
                {fact.officialObservedDate}
              </dd>
            </div>
            {fact.candidateValue && fact.candidateSourceDocument ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Candidate source
                </dt>
                <dd className="mt-1 text-base font-semibold text-slate-950">
                  {fact.candidateSourceDocument}
                </dd>
              </div>
            ) : null}
            {fact.candidateValue && fact.candidateObservedDate ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Candidate observed date
                </dt>
                <dd className="mt-1 text-base font-semibold text-slate-950">
                  {fact.candidateObservedDate}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Confidence
              </dt>
              <dd className="mt-1 text-base font-semibold text-slate-950">
                {fact.confidence}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </dt>
              <dd className="mt-1">
                <StatusBadge status={fact.status} />
              </dd>
            </div>
          </dl>

          <section className="rounded border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-base font-semibold text-slate-950">
              Why is this remembered?
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {explanation}
            </p>
          </section>
          {fact.candidateEvidence ? (
            <section className="rounded border border-slate-200 bg-white p-4">
              <h3 className="text-base font-semibold text-slate-950">
                Candidate evidence
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {fact.candidateEvidence}
              </p>
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
};
