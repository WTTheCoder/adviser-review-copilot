import { StatusBadge } from "./StatusBadge.js";
import type { ClientFact } from "../types/demo.js";

type CurrentClientPictureProps = {
  facts: ClientFact[];
  onSelectFact: (fact: ClientFact) => void;
};

export const CurrentClientPicture = ({
  facts,
  onSelectFact
}: CurrentClientPictureProps) => (
  <section className="rounded border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 px-5 py-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">
        Current client picture
      </p>
      <h2 className="mt-1 text-2xl font-semibold text-slate-950">
        Source-backed facts for Alex Taylor
      </h2>
    </div>
    <div className="grid gap-px bg-slate-200 md:grid-cols-2 xl:grid-cols-3">
      {facts.map((fact) => (
        <button
          className="flex min-h-48 flex-col bg-white p-5 text-left transition hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-700"
          key={fact.id}
          type="button"
          onClick={() => onSelectFact(fact)}
        >
          <span className="text-sm font-semibold text-slate-900">{fact.field}</span>
          <span className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
            {fact.currentLabel}
          </span>
          <span className="mt-1 text-xl font-semibold text-slate-950">
            {fact.currentValue}
          </span>
          {fact.candidateValue ? (
            <>
              <span className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                Candidate value
              </span>
              <span className="mt-1 text-base font-semibold text-slate-800">
                {fact.candidateValue}
              </span>
            </>
          ) : null}
          {fact.previousValue ? (
            <span className="mt-4 text-sm text-slate-600">
              Previous: {fact.previousValue}
            </span>
          ) : null}
          <span className="mt-auto pt-4">
            <StatusBadge status={fact.status} />
          </span>
        </button>
      ))}
    </div>
  </section>
);
