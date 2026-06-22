import type { FactStatus } from "../types/demo.js";

const statusStyles: Record<FactStatus, string> = {
  Current: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Superseded: "border-slate-200 bg-slate-100 text-slate-700",
  "Needs confirmation": "border-amber-200 bg-amber-50 text-amber-800",
  "Requires adviser approval": "border-cyan-200 bg-cyan-50 text-cyan-800"
};

type StatusBadgeProps = {
  status: FactStatus;
};

export const StatusBadge = ({ status }: StatusBadgeProps) => (
  <span
    className={`inline-flex rounded border px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}
  >
    {status}
  </span>
);
