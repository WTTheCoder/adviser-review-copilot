import { File } from "node:buffer";
import { describe, expect, it } from "vitest";
import {
  buildDocumentUploadRequest,
  documentTypeForFile,
  uploadErrorMessage,
  validateSelectedUploadFile
} from "./documentUpload.js";

const createFile = (
  content: string,
  filename: string,
  type: string
) => new File([content], filename, { type });

describe("document upload presentation boundary", () => {
  it("accepts PDF and preserves TXT/Markdown support", () => {
    const pdf = createFile("%PDF-1.4", "review.PDF", "application/pdf");
    const text = createFile("Alex moved.", "note.txt", "text/plain");
    const markdown = createFile("# Review", "note.md", "text/markdown");

    expect(documentTypeForFile(pdf)).toBe("PDF");
    expect(validateSelectedUploadFile(pdf)).toBeNull();
    expect(validateSelectedUploadFile(text)).toBeNull();
    expect(validateSelectedUploadFile(markdown)).toBeNull();
  });

  it("rejects unsupported files and explains the PDF OCR boundary", () => {
    const unsupported = createFile(
      "x",
      "review.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    expect(validateSelectedUploadFile(unsupported)).toContain(
      ".txt, .md, or .pdf"
    );
    expect(uploadErrorMessage("PDF_TEXT_NOT_AVAILABLE")).toContain(
      "OCR for scanned PDFs is not supported yet"
    );
  });

  it("builds a bounded base64 PDF request and a text regression request", async () => {
    const pdf = createFile("%PDF-1.4", "review.pdf", "application/pdf");
    const pdfRequest = await buildDocumentUploadRequest({
      clientId: "demo-alex-taylor",
      observedDate: "2026-06-04",
      file: pdf
    });
    const textRequest = await buildDocumentUploadRequest({
      clientId: "demo-alex-taylor",
      observedDate: "2026-06-04",
      file: createFile("Alex moved.", "note.txt", "text/plain")
    });

    expect(pdfRequest).toMatchObject({
      documentType: "PDF",
      mediaType: "application/pdf",
      base64Data: "JVBERi0xLjQ="
    });
    expect(textRequest).toMatchObject({
      documentType: "TEXT",
      text: "Alex moved."
    });
  });
});
