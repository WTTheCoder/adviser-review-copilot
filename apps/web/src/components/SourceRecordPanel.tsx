import { useEffect, useState } from "react";
import { StatusBadge } from "./StatusBadge.js";
import { resolveSelectedSourceRecordId } from "../domain/sourceRecordSelection.js";
import type { SourceRecord } from "../types/demo.js";

type SourceRecordPanelProps = {
  records: SourceRecord[];
};

export const SourceRecordPanel = ({ records }: SourceRecordPanelProps) => {
  const [selectedRecordId, setSelectedRecordId] = useState<string>(
    records[0]?.id ?? ""
  );
  useEffect(() => {
    setSelectedRecordId((current) =>
      resolveSelectedSourceRecordId(records, current)
    );
  }, [records]);
  const selectedRecord =
    records.find((record) => record.id === selectedRecordId) ?? records[0];

  return (
    <section className="rounded border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-950">Source records</h2>
        <p className="mt-1 text-sm text-slate-600">
          Select a record to inspect its original content.
        </p>
      </div>
      <div className="p-4">
        <div className="grid gap-2" role="list" aria-label="Source records">
          {records.map((record) => (
            <button
              className={`rounded border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-700 ${
                selectedRecordId === record.id
                  ? "border-cyan-300 bg-cyan-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
              key={record.id}
              type="button"
              onClick={() => setSelectedRecordId(record.id)}
            >
              <span className="block text-sm font-semibold text-slate-950">
                {record.title}
              </span>
              <span className="mt-1 block text-xs text-slate-600">
                Observed: {record.observedDate}
              </span>
              {record.upload ? (
                <span className="mt-1 block text-xs font-medium text-cyan-800">
                  Uploaded file: {record.upload.safeFilename}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {selectedRecord ? (
          <article className="mt-5 rounded border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">
                  {selectedRecord.title}
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Observed: {selectedRecord.observedDate}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Source type: {selectedRecord.type.replaceAll("_", " ")}
                </p>
                {selectedRecord.upload ? (
                  <div className="mt-2 space-y-1 text-xs text-cyan-800">
                    <p>
                      Upload origin: {selectedRecord.upload.origin} -{" "}
                      {selectedRecord.upload.safeFilename}
                    </p>
                    <p>
                      Media type: {selectedRecord.upload.mediaType} -{" "}
                      Original size:{" "}
                      {selectedRecord.upload.originalByteCount ??
                        selectedRecord.upload.byteCount}{" "}
                      bytes
                    </p>
                    <p>
                      {selectedRecord.upload.pageCount
                        ? `${selectedRecord.upload.pageCount} pages - `
                        : ""}
                      {selectedRecord.upload.characterCount} extracted
                      characters
                    </p>
                  </div>
                ) : null}
              </div>
              <StatusBadge
                status={
                  selectedRecord.lifecycleStatus === "SUPERSEDED"
                    ? "Superseded"
                    : "Current"
                }
              />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {selectedRecord.summary}
            </p>
            <pre className="mt-4 whitespace-pre-wrap rounded bg-white px-3 py-2 font-sans text-sm leading-6 text-slate-700">
              {selectedRecord.content.join("\n")}
            </pre>
          </article>
        ) : null}
      </div>
    </section>
  );
};
