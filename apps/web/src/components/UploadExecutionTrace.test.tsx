import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DocumentUploadResponse } from "@client-review-prep/shared";
import { ExecutionTrace } from "./ExecutionTrace.js";
import { UploadExecutionTrace } from "./UploadExecutionTrace.js";
import {
  clearUploadTrace,
  replaceUploadTrace
} from "../domain/uploadTraceState.js";

const createUploadResponse = (
  sourceId: string,
  eventLabel = "Source record persisted"
): DocumentUploadResponse => ({
  status: "stored",
  sourceRecord: {
    id: sourceId,
    clientId: "demo-alex-taylor",
    type: "ADVISER_MEETING_NOTE",
    title: "Uploaded: note.txt",
    observedDate: "2026-06-04",
    upload: {
      origin: "UPLOAD",
      safeFilename: "note.txt",
      mediaType: "text/plain",
      characterCount: 32,
      byteCount: 32,
      uploadedAt: "2026-06-23T00:00:00.000Z"
    }
  },
  safeFilename: "note.txt",
  characterCount: 32,
  byteCount: 32,
  ingestionStatus: "validated",
  executionMetadata: {
    skillName: "ingest-client-document",
    skillVersion: "1",
    status: "SUCCEEDED",
    events: [
      {
        sequence: 1,
        label: "Skill selected: ingest-client-document",
        status: "STARTED",
        detail: null,
        timestamp: "2026-06-23T00:00:00.000Z"
      },
      {
        sequence: 2,
        label: eventLabel,
        status: "COMPLETE",
        detail: sourceId,
        timestamp: "2026-06-23T00:00:01.000Z"
      },
      {
        sequence: 3,
        label: "Skill completed: ingest-client-document",
        status: "COMPLETE",
        detail: null,
        timestamp: "2026-06-23T00:00:02.000Z"
      }
    ]
  }
});

describe("UploadExecutionTrace", () => {
  it("renders the latest upload execution trace after success", () => {
    const metadata = replaceUploadTrace(createUploadResponse("source-upload-1"));
    const markup = renderToStaticMarkup(
      <UploadExecutionTrace metadata={metadata} />
    );

    expect(markup).toContain("View upload execution trace");
    expect(markup).toContain("Skill selected: ingest-client-document");
    expect(markup).toContain("Source record persisted");
    expect(markup).toContain("Skill completed: ingest-client-document");
  });

  it("is collapsed by default", () => {
    const metadata = replaceUploadTrace(createUploadResponse("source-upload-1"));
    const markup = renderToStaticMarkup(
      <UploadExecutionTrace metadata={metadata} />
    );

    expect(markup).toContain("<details");
    expect(markup).not.toContain("<details open");
  });

  it("replaces the previous upload trace with the second upload", () => {
    const first = replaceUploadTrace(
      createUploadResponse("source-upload-1", "First source persisted")
    );
    const second = replaceUploadTrace(
      createUploadResponse("source-upload-2", "Second source persisted")
    );

    expect(first.events[1]?.label).toBe("First source persisted");
    expect(second.events[1]?.label).toBe("Second source persisted");
  });

  it("clears the upload trace on reset", () => {
    expect(clearUploadTrace()).toBeNull();
    expect(renderToStaticMarkup(<UploadExecutionTrace metadata={null} />)).toBe(
      ""
    );
  });

  it("keeps upload and preparation traces visually independent", () => {
    const metadata = replaceUploadTrace(createUploadResponse("source-upload-1"));
    const markup = renderToStaticMarkup(
      <>
        <UploadExecutionTrace metadata={metadata} />
        <ExecutionTrace
          items={[
            {
              label: "Skill completed: prepare-annual-review",
              status: "COMPLETE",
              detail: null
            }
          ]}
        />
      </>
    );

    expect(markup).toContain("View upload execution trace");
    expect(markup).toContain("View execution trace");
    expect(markup).toContain("Skill completed: ingest-client-document");
    expect(markup).toContain("Skill completed: prepare-annual-review");
  });
});
