import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SourceRecordPanel } from "./SourceRecordPanel.js";
import { SourceUploadPanel } from "./SourceUploadPanel.js";
import type { SourceRecord } from "../types/demo.js";

describe("SourceUploadPanel", () => {
  it("shows PDF support, limits, OCR deferral, and accepted extensions", () => {
    const markup = renderToStaticMarkup(
      <SourceUploadPanel
        apiBaseUrl="http://localhost:3001"
        clientId="demo-alex-taylor"
        resetToken={0}
        onUploaded={() => undefined}
      />
    );

    expect(markup).toContain(".txt,.md,.pdf");
    expect(markup).toContain("PDFs up to");
    expect(markup).toContain("2 MB");
    expect(markup).toContain("25 pages");
    expect(markup).toContain("OCR");
  });

  it("displays uploaded PDF metadata and extracted text as escaped plain text", () => {
    const record: SourceRecord = {
      id: "source-upload-pdf",
      type: "ADVISER_MEETING_NOTE",
      title: "Uploaded: alex-review.pdf",
      observedAt: "2026-06-04T00:00:00.000Z",
      observedDate: "4 June 2026",
      summary: "Uploaded text-based PDF.",
      content: ["[Page 1]", "<script>alert('no')</script>"],
      lifecycleStatus: "CURRENT",
      upload: {
        origin: "UPLOAD",
        documentType: "PDF",
        safeFilename: "alex-review.pdf",
        mediaType: "application/pdf",
        characterCount: 48,
        byteCount: 48,
        originalByteCount: 650,
        pageCount: 1,
        parser: { name: "unpdf", version: "1.6.2" },
        uploadedAt: "2026-06-04T00:00:00.000Z"
      }
    };
    const markup = renderToStaticMarkup(
      <SourceRecordPanel records={[record]} />
    );

    expect(markup).toContain("alex-review.pdf");
    expect(markup).toContain("application/pdf");
    expect(markup).toContain("650");
    expect(markup).toContain("1 pages");
    expect(markup).toContain("48 extracted");
    expect(markup).toContain("&lt;script&gt;");
    expect(markup).not.toContain("<script>");
  });
});
