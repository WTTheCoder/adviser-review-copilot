import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import {
  allowedUploadExtensions,
  documentUploadResponseSchema,
  maxUploadBytes,
  type DocumentUploadResponse
} from "@client-review-prep/shared";
import {
  completeUpload,
  failUpload,
  initialUploadPanelState,
  resetUploadPanelState,
  selectUploadFile,
  startUpload
} from "../domain/uploadPanelState.js";
import {
  applyIfCurrentUploadGeneration,
  invalidateUploadGeneration,
  nextUploadGeneration
} from "../domain/uploadGeneration.js";

type SourceUploadPanelProps = {
  apiBaseUrl: string;
  clientId: string;
  resetToken: number;
  onUploaded: (upload: DocumentUploadResponse) => void;
};

const acceptedTypes = allowedUploadExtensions.join(",");

export const SourceUploadPanel = ({
  apiBaseUrl,
  clientId,
  resetToken,
  onUploaded
}: SourceUploadPanelProps) => {
  const fileInputId = useId();
  const observedDateId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadGenerationRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [observedDate, setObservedDate] = useState("2026-06-04");
  const [uploadState, setUploadState] = useState(initialUploadPanelState);

  const clearNativeFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    uploadGenerationRef.current = invalidateUploadGeneration(
      uploadGenerationRef.current
    );
    setFile(null);
    setUploadState(resetUploadPanelState());
    clearNativeFileInput();
  }, [resetToken]);

  const selectFile = (candidate: File | null) => {
    setFile(candidate);
    setUploadState(selectUploadFile(candidate?.name ?? null));
    if (!candidate) {
      clearNativeFileInput();
    }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files);

    if (droppedFiles.length !== 1) {
      selectFile(null);
      setUploadState(failUpload("Select one .txt or .md file."));
      return;
    }

    selectFile(droppedFiles[0] ?? null);
  };

  const upload = async () => {
    if (!file) {
      setUploadState(failUpload("Select one .txt or .md file."));
      return;
    }

    if (file.size > maxUploadBytes) {
      setUploadState(failUpload("The file is too large for this local demo."));
      return;
    }

    setUploadState((current) => startUpload(current));
    const uploadGeneration = nextUploadGeneration(uploadGenerationRef.current);
    uploadGenerationRef.current = uploadGeneration;

    try {
      const text = await file.text();
      const response = await fetch(
        `${apiBaseUrl}/api/clients/${clientId}/source-records/upload`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            observedDate,
            sourceType: "ADVISER_MEETING_NOTE",
            originalFilename: file.name,
            mediaType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            text
          })
        }
      );

      if (!response.ok) {
        throw new Error("Upload failed.");
      }

      const uploadResponse = documentUploadResponseSchema.parse(
        await response.json()
      );
      applyIfCurrentUploadGeneration(
        uploadGeneration,
        uploadGenerationRef.current,
        () => {
          setFile(null);
          setUploadState(completeUpload(uploadResponse.safeFilename));
          clearNativeFileInput();
          onUploaded(uploadResponse);
        }
      );
    } catch {
      applyIfCurrentUploadGeneration(
        uploadGeneration,
        uploadGenerationRef.current,
        () => {
          setUploadState(
            failUpload(
              "The document could not be uploaded. Check the file type, date, and content."
            )
          );
        }
      );
    } finally {
      applyIfCurrentUploadGeneration(
        uploadGeneration,
        uploadGenerationRef.current,
        () => {
          setUploadState((current) => ({ ...current, isUploading: false }));
        }
      );
    }
  };

  return (
    <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Upload source note</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Accepted files: .txt and .md, up to 256 KB. Text is stored locally in PostgreSQL for this demo.
      </p>
      <div className="mt-4 grid gap-3">
        <label
          className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700 focus-within:ring-2 focus-within:ring-cyan-700"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <span className="font-semibold">Select or drop a text document</span>
          <span className="mt-1 block text-xs text-slate-500">
            {uploadState.selectedFileName ?? "No file selected"}
          </span>
          <input
            accept={acceptedTypes}
            className="mt-3 block w-full text-sm"
            id={fileInputId}
            ref={fileInputRef}
            type="file"
            onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700" htmlFor={observedDateId}>
          Observed date
        </label>
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-700"
          id={observedDateId}
          type="date"
          value={observedDate}
          onChange={(event) => setObservedDate(event.target.value)}
        />
        <button
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={uploadState.isUploading}
          type="button"
          onClick={upload}
        >
          {uploadState.isUploading ? "Uploading..." : "Upload source"}
        </button>
      </div>
      <div aria-live="polite" className="mt-3 text-sm">
        {uploadState.status ? (
          <p className="text-cyan-800">{uploadState.status}</p>
        ) : null}
        {uploadState.error ? (
          <p className="text-rose-700">{uploadState.error}</p>
        ) : null}
      </div>
    </section>
  );
};
