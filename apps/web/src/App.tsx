import { useEffect, useMemo, useState } from "react";
import {
  healthResponseSchema,
  type HealthResponse
} from "@client-review-prep/shared";

type ApiStatus = "connecting" | "connected" | "unavailable";

const statusLabels: Record<ApiStatus, string> = {
  connecting: "Connecting to API",
  connected: "API connected",
  unavailable: "API unavailable"
};

const statusStyles: Record<ApiStatus, string> = {
  connecting: "border-amber-300 bg-amber-50 text-amber-800",
  connected: "border-emerald-300 bg-emerald-50 text-emerald-800",
  unavailable: "border-rose-300 bg-rose-50 text-rose-800"
};

export const App = () => {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("connecting");
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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-cyan-700">
            Adviser review preparation
          </p>
          <h1 className="text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
            Client Review Prep Agent
          </h1>
          <p className="mt-5 text-xl leading-8 text-slate-700">
            Source-backed preparation for adviser annual reviews
          </p>
          <div
            className={`mt-8 inline-flex items-center gap-3 rounded border px-4 py-2 text-sm font-medium ${statusStyles[apiStatus]}`}
          >
            <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
            {statusLabels[apiStatus]}
          </div>
          <p className="mt-8 max-w-2xl text-base leading-7 text-slate-600">
            The client-review workflow will be added in the next milestone,
            including structured preparation steps for fragmented CRM records,
            review documents, and adviser meeting notes.
          </p>
        </div>
      </section>
    </main>
  );
};
