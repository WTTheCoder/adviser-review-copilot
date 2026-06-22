export type ApiStatus = "connecting" | "connected" | "unavailable";

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

type ApiStatusBadgeProps = {
  status: ApiStatus;
};

export const ApiStatusBadge = ({ status }: ApiStatusBadgeProps) => (
  <div
    className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-xs font-medium ${statusStyles[status]}`}
  >
    <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
    {statusLabels[status]}
  </div>
);
