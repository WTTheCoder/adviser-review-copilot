const statusStyles: Record<string, string> = {
  Current: "status-chip-success",
  Superseded: "",
  "Needs confirmation": "status-chip-warning",
  "Requires adviser approval": "status-chip-info",
  "Ready for adviser review": "status-chip-success",
  "Ready to prepare": "status-chip-loading"
};

type StatusBadgeProps = {
  status: string;
};

export const StatusBadge = ({ status }: StatusBadgeProps) => (
  <span
    className={`status-chip ${
      statusStyles[status] ?? statusStyles.Current
    }`}
  >
    {status}
  </span>
);
