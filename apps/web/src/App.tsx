import { useEffect, useMemo, useState } from "react";
import {
  healthResponseSchema,
  type HealthResponse
} from "@client-review-prep/shared";
import { AdviserActions } from "./components/AdviserActions.js";
import { ApiStatusBadge, type ApiStatus } from "./components/ApiStatusBadge.js";
import { CurrentClientPicture } from "./components/CurrentClientPicture.js";
import { EvidenceDrawer } from "./components/EvidenceDrawer.js";
import { ExecutionTrace } from "./components/ExecutionTrace.js";
import { MeaningfulChanges } from "./components/MeaningfulChanges.js";
import { SourceRecordPanel } from "./components/SourceRecordPanel.js";
import { SummaryMetrics } from "./components/SummaryMetrics.js";
import {
  demoClientReview,
  executionTrace,
  sourceRecords
} from "./data/demoReview.js";
import {
  createInitialReviewWorkflow,
  getPrepareButtonLabel,
  getReviewStatusLabel,
  markReviewPrepared,
  startReviewPreparation,
  updateActionDecision
} from "./domain/reviewWorkflow.js";
import type { ClientFact } from "./types/demo.js";

export const App = () => {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("connecting");
  const [workflow, setWorkflow] = useState(createInitialReviewWorkflow);
  const [selectedFact, setSelectedFact] = useState<ClientFact | null>(null);
  const apiBaseUrl = useMemo(
    () => import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001",
    []
  );

  useEffect(() => {
    const controller = new AbortController();

    const checkApiHealth = async () => {
      setApiStatus("connecting");

      try {
        const response = await fetch(`${apiBaseUrl}/health`, {
          signal: controller.signal
        });

        if (!response.ok) {
          setApiStatus("unavailable");
          return;
        }

        const payload: unknown = await response.json();
        const health: HealthResponse = healthResponseSchema.parse(payload);
        setApiStatus(
          health.service === "client-review-prep-api" ? "connected" : "unavailable"
        );
      } catch {
        if (!controller.signal.aborted) {
          setApiStatus("unavailable");
        }
      }
    };

    void checkApiHealth();

    return () => {
      controller.abort();
    };
  }, [apiBaseUrl]);

  const handlePrepareReview = () => {
    setWorkflow(startReviewPreparation);

    window.setTimeout(() => {
      setWorkflow(markReviewPrepared);
    }, 550);
  };

  const handleDecision = (
    actionId: Parameters<typeof updateActionDecision>[1],
    decision: Parameters<typeof updateActionDecision>[2]
  ) => {
    setWorkflow((currentWorkflow) =>
      updateActionDecision(currentWorkflow, actionId, decision)
    );
  };

  const isPrepared = workflow.phase === "prepared";
  const isPreparing = workflow.phase === "preparing";
  const reviewStatus = getReviewStatusLabel(workflow.phase);
  const prepareButtonLabel = getPrepareButtonLabel(workflow.phase);

  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-7 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">
                Client Review Prep Agent
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
                Source-backed preparation for adviser annual reviews
              </h1>
              <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-700">
                <span className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium">
                  Alex Taylor
                </span>
                <span className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5">
                  2026 Annual Review
                </span>
                <span className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5">
                  Adviser: Jordan Lee
                </span>
                <span className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-800">
                  {reviewStatus}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <ApiStatusBadge status={apiStatus} />
              <button
                className="rounded bg-cyan-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={isPreparing}
                type="button"
                onClick={handlePrepareReview}
              >
                {prepareButtonLabel}
              </button>
            </div>
          </div>

          {!isPrepared ? (
            <div className="rounded border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Ready to prepare</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-650">
                Three fictional source records are loaded. Start the preparation
                run to reconcile current facts, preserve superseded history, and
                surface the items that need adviser confirmation.
              </p>
            </div>
          ) : (
            <SummaryMetrics metrics={demoClientReview.summaryMetrics} />
          )}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="space-y-6">
          {isPrepared ? (
            <>
              <CurrentClientPicture
                facts={demoClientReview.clientFacts}
                onSelectFact={setSelectedFact}
              />
              <div className="grid gap-6 xl:grid-cols-2">
                <MeaningfulChanges changes={demoClientReview.meaningfulChanges} />
                <AdviserActions
                  decisions={workflow.actionDecisions}
                  items={demoClientReview.adviserActions}
                  onDecision={handleDecision}
                />
              </div>
              <ExecutionTrace items={executionTrace} />
            </>
          ) : (
            <div className="rounded border border-dashed border-slate-300 bg-white p-8 text-center">
              <h2 className="text-xl font-semibold text-slate-950">
                Adviser workspace will appear here
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                The demo run is deterministic and local to the browser. It does
                not call AI, update a CRM, or generate financial recommendations.
              </p>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <SourceRecordPanel records={sourceRecords} />
        </aside>
      </section>

      <EvidenceDrawer fact={selectedFact} onClose={() => setSelectedFact(null)} />
    </main>
  );
};
