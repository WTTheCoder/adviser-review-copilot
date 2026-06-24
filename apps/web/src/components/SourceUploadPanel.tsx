import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import {
  allowedUploadExtensions,
  documentUploadErrorResponseSchema,
  documentUploadResponseSchema,
  maxPdfUploadBytes,
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
import {
  buildDocumentUploadRequest,
  documentTypeForFile,
  uploadErrorMessage,
  validateSelectedUploadFile
} from "../domain/documentUpload.js";
import { createUploadSubmissionController } from "../domain/uploadSubmission.js";

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
  const submissionControllerRef = useRef(
    createUploadSubmissionController()
  );
  const [file, setFile] = useState<File | null>(null);
  const [observedDate, setObservedDate] = useState("2026-06-04");
  const [uploadState, setUploadState] = useState(initialUploadPanelState);

  const clearNativeFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    submissionControllerRef.current.abortActive();
    uploadGenerationRef.current = invalidateUploadGeneration(
      uploadGenerationRef.current
    );
    setFile(null);
    setUploadState(resetUploadPanelState());
    clearNativeFileInput();
  }, [resetToken]);

  useEffect(
    () => () => {
      submissionControllerRef.current.abortActive();
    },
    []
  );

  const selectFile = (candidate: File | null) => {
    if (submissionControllerRef.current.isActive()) {
      return;
    }
    setFile(candidate);
    setUploadState(selectUploadFile(candidate?.name ?? null));
    if (!candidate) {
      clearNativeFileInput();
    }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (submissionControllerRef.current.isActive()) {
      return;
    }
    const droppedFiles = Array.from(event.dataTransfer.files);

    if (droppedFiles.length !== 1) {
      selectFile(null);
      setUploadState(failUpload("Select one .txt, .md, or .pdf file."));
      return;
    }

    selectFile(droppedFiles[0] ?? null);
  };

  const upload = async () => {
    const submission = submissionControllerRef.current.tryStart();
    if (!submission) {
      return;
    }

    if (!file) {
      setUploadState(failUpload("Select one .txt, .md, or .pdf file."));
      submissionControllerRef.current.finish(submission);
      return;
    }

    const fileError = validateSelectedUploadFile(file);
    if (fileError) {
      setUploadState(failUpload(fileError));
      submissionControllerRef.current.finish(submission);
      return;
    }

    setUploadState((current) => startUpload(current));
    const uploadGeneration = nextUploadGeneration(uploadGenerationRef.current);
    uploadGenerationRef.current = uploadGeneration;

    try {
      const payload = await buildDocumentUploadRequest({
        clientId,
        observedDate,
        file
      });
      const response = await fetch(
        `${apiBaseUrl}/api/clients/${clientId}/source-records/upload`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: submission.controller.signal
        }
      );

      if (!response.ok) {
        const errorPayload = documentUploadErrorResponseSchema.safeParse(
          await response.json().catch(() => null)
        );
        throw new Error(
          uploadErrorMessage(
            errorPayload.success ? errorPayload.data.code : null
          )
        );
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
    } catch (error) {
      if (submission.controller.signal.aborted) {
        return;
      }
      applyIfCurrentUploadGeneration(
        uploadGeneration,
        uploadGenerationRef.current,
        () => {
          setUploadState(
            failUpload(
              error instanceof Error
                ? error.message
                : uploadErrorMessage(null)
            )
          );
        }
      );
    } finally {
      submissionControllerRef.current.finish(submission);
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
        TXT/MD up to {maxUploadBytes / 1024} KB. Text-based PDFs up to{" "}
        {maxPdfUploadBytes / (1024 * 1024)} MB and 25 pages. Scanned PDFs
        require OCR and are not supported yet.
      </p>
      <div className="mt-4 grid gap-3">
        <label
          className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700 focus-within:ring-2 focus-within:ring-cyan-700"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <span className="font-semibold">
            Select or drop a source document
          </span>
          <span className="mt-1 block text-xs text-slate-500">
            {uploadState.selectedFileName ?? "No file selected"}
          </span>
          <input
            accept={acceptedTypes}
            className="mt-3 block w-full text-sm"
            id={fileInputId}
            ref={fileInputRef}
            type="file"
            disabled={uploadState.isUploading}
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
          disabled={uploadState.isUploading}
          onChange={(event) => setObservedDate(event.target.value)}
        />
        <button
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={uploadState.isUploading}
          type="button"
          onClick={upload}
        >
          {uploadState.isUploading
            ? file && documentTypeForFile(file) === "PDF"
              ? "Parsing PDF..."
              : "Uploading..."
            : "Upload source"}
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
