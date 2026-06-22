type MeaningfulChangesProps = {
  changes: string[];
};

export const MeaningfulChanges = ({ changes }: MeaningfulChangesProps) => (
  <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-semibold text-slate-950">Meaningful changes</h2>
    <ul className="mt-4 space-y-3">
      {changes.map((change) => (
        <li className="flex gap-3 text-sm leading-6 text-slate-700" key={change}>
          <span
            className="mt-2 h-2 w-2 rounded-full bg-cyan-700"
            aria-hidden="true"
          />
          <span>{change}</span>
        </li>
      ))}
    </ul>
  </section>
);
