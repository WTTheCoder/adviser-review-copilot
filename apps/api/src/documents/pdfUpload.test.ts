import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import {
  maxPdfExtractedCharacters,
  maxPdfPages,
  maxPdfUploadBytes,
  type DocumentUploadRequest
} from "@client-review-prep/shared";
import {
  classifyPdfParserError,
  createPdfTextExtractor,
  PdfUploadError,
  validatePdfUpload,
  type PdfDocumentPort
} from "./pdfUpload.js";
import { MockCandidateFactExtractor } from "../ai/providers/mockCandidateFactExtractor.js";
import {
  attachTrustedCandidateProvenance,
  classifyCandidateFacts
} from "../ai/contracts/candidateFactReviewRules.js";

const escapePdfText = (value: string) =>
  value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");

export const createSyntheticTextPdf = (pages: readonly string[]) => {
  const fontObjectNumber = 3 + pages.length * 2;
  const pageObjectNumbers = pages.map((_, index) => 3 + index * 2);
  const objects = new Map<number, string>();

  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(
    2,
    `<< /Type /Pages /Kids [${pageObjectNumbers
      .map((number) => `${number} 0 R`)
      .join(" ")}] /Count ${pages.length} >>`
  );

  pages.forEach((text, index) => {
    const pageObjectNumber = pageObjectNumbers[index];
    if (!pageObjectNumber) {
      throw new Error("Missing synthetic page object number.");
    }
    const contentObjectNumber = pageObjectNumber + 1;
    const textCommands = text
      .split("\n")
      .map((line, lineIndex) =>
        lineIndex === 0
          ? `(${escapePdfText(line)}) Tj`
          : `0 -18 Td (${escapePdfText(line)}) Tj`
      )
      .join("\n");
    const stream = `BT /F1 10 Tf 72 720 Td\n${textCommands}\nET`;
    objects.set(
      pageObjectNumber,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    );
    objects.set(
      contentObjectNumber,
      `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`
    );
  });
  objects.set(
    fontObjectNumber,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  );

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let objectNumber = 1; objectNumber <= fontObjectNumber; objectNumber += 1) {
    const body = objects.get(objectNumber);
    if (!body) {
      throw new Error("Missing synthetic PDF object.");
    }
    offsets[objectNumber] = Buffer.byteLength(pdf, "ascii");
    pdf += `${objectNumber} 0 obj\n${body}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${fontObjectNumber + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let objectNumber = 1; objectNumber <= fontObjectNumber; objectNumber += 1) {
    pdf += `${String(offsets[objectNumber]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${fontObjectNumber + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "ascii");
};

const pdfRequest = (
  bytes: Uint8Array,
  overrides: Partial<
    Extract<DocumentUploadRequest, { documentType: "PDF" }>
  > = {}
): Extract<DocumentUploadRequest, { documentType: "PDF" }> => ({
  clientId: "demo-alex-taylor",
  observedDate: "2026-06-04",
  sourceType: "ADVISER_MEETING_NOTE",
  originalFilename: "alex-review.pdf",
  mediaType: "application/pdf",
  sizeBytes: bytes.length,
  documentType: "PDF",
  base64Data: Buffer.from(bytes).toString("base64"),
  ...overrides
});

const fakeDocument = (
  pageCount: number,
  pages: readonly string[]
): PdfDocumentPort => ({
  pageCount,
  extractPages: async () => [...pages],
  destroy: async () => undefined
});

describe("PDF upload validation", () => {
  const validPdf = createSyntheticTextPdf(["Alex may have moved to Joondalup."]);

  it("accepts valid lowercase and uppercase PDF filenames", () => {
    expect(validatePdfUpload(pdfRequest(validPdf)).originalByteCount).toBe(
      validPdf.length
    );
    expect(
      validatePdfUpload(
        pdfRequest(validPdf, { originalFilename: "ALEX-REVIEW.PDF" })
      ).safeFilename
    ).toBe("ALEX-REVIEW.PDF");
  });

  it("rejects fake PDF content, invalid MIME, empty content, and corrupt structure", async () => {
    expect(() =>
      validatePdfUpload(pdfRequest(Buffer.from("plain text"), {}))
    ).toThrowError(expect.objectContaining({ code: "PDF_INVALID_SIGNATURE" }));
    expect(() =>
      validatePdfUpload(pdfRequest(validPdf, { mediaType: "text/plain" }))
    ).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_MEDIA_TYPE" }));
    expect(() =>
      validatePdfUpload(pdfRequest(new Uint8Array(), { base64Data: "" }))
    ).toThrowError(expect.objectContaining({ code: "PDF_PARSE_FAILED" }));

    const corrupt = Buffer.from("%PDF-1.4\nnot a real PDF", "ascii");
    const validated = validatePdfUpload(pdfRequest(corrupt));
    await expect(
      createPdfTextExtractor().extract({ bytes: validated.bytes })
    ).rejects.toMatchObject({ code: "PDF_PARSE_FAILED" });
  });

  it("does not treat visible /Encrypt text as encrypted PDF structure", async () => {
    const pdf = createSyntheticTextPdf([
      "The visible review note contains /Encrypt as ordinary text."
    ]);
    const validated = validatePdfUpload(pdfRequest(pdf));
    const extracted = await createPdfTextExtractor().extract({
      bytes: validated.bytes
    });

    expect(extracted.text).toContain("/Encrypt");
  });

  it("enforces the server-authoritative binary limit", () => {
    const exactlyAtLimit = Buffer.alloc(maxPdfUploadBytes, 0);
    exactlyAtLimit.write("%PDF-", 0, "ascii");
    expect(
      validatePdfUpload(pdfRequest(exactlyAtLimit)).originalByteCount
    ).toBe(maxPdfUploadBytes);

    const overLimit = Buffer.alloc(maxPdfUploadBytes + 1, 0);
    overLimit.write("%PDF-", 0, "ascii");
    expect(() => validatePdfUpload(pdfRequest(overLimit))).toThrowError(
      expect.objectContaining({ code: "PDF_TOO_LARGE" })
    );
  });

  it("sanitizes path-like filenames and rejects excessive filenames", () => {
    expect(
      validatePdfUpload(
        pdfRequest(validPdf, {
          originalFilename: "C:\\Users\\Alex\\review.pdf"
        })
      ).safeFilename
    ).toBe("review.pdf");
    expect(() =>
      validatePdfUpload(
        pdfRequest(validPdf, {
          originalFilename: `${"a".repeat(121)}.pdf`
        })
      )
    ).toThrowError(expect.objectContaining({ code: "UNSAFE_FILENAME" }));
  });
});

describe("PDF extraction wrapper", () => {
  it("feeds confirmed High Growth wording through real PDF extraction and mock classification", async () => {
    const pdf = createSyntheticTextPdf([
      "Alex may have moved to Joondalup, but the address has not been confirmed.",
      "Alex is considering changing to a High Growth risk profile for the next review period."
    ]);
    const extracted = await createPdfTextExtractor().extract({
      bytes: new Uint8Array(pdf)
    });
    const extraction = await new MockCandidateFactExtractor().extract({
      clientId: "demo-alex-taylor",
      clientDisplayName: "Alex Taylor",
      sourceRecordId: "source-upload-pdf",
      sourceType: "UPLOADED_PDF",
      observedDate: "2026-06-24",
      meetingNoteText: extracted.text,
      supportedFields: ["ADDRESS", "RISK_PROFILE"]
    });
    const classifications = classifyCandidateFacts(
      attachTrustedCandidateProvenance(extraction.candidateFacts, {
        sourceRecordId: "source-upload-pdf",
        observedDate: "2026-06-24"
      })
    );

    expect(extracted.text).toContain(
      "considering changing to a High Growth risk profile"
    );
    expect(extraction.candidateFacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "RISK_PROFILE",
          proposedValue: "High Growth"
        })
      ])
    );
    expect(classifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "RISK_PROFILE",
          proposedValue: "High Growth",
          applicationStatus: "REQUIRES_ADVISER_APPROVAL"
        })
      ])
    );
  });

  it("does not project negated High Growth wording from real PDF extraction", async () => {
    const pdf = createSyntheticTextPdf([
      "Alex is not considering changing to High Growth."
    ]);
    const extracted = await createPdfTextExtractor().extract({
      bytes: new Uint8Array(pdf)
    });
    const extraction = await new MockCandidateFactExtractor().extract({
      clientId: "demo-alex-taylor",
      clientDisplayName: "Alex Taylor",
      sourceRecordId: "source-upload-negated-pdf",
      sourceType: "UPLOADED_PDF",
      observedDate: "2026-06-24",
      meetingNoteText: extracted.text,
      supportedFields: ["RISK_PROFILE"]
    });

    expect(extracted.text).toContain(
      "not considering changing to High Growth"
    );
    expect(
      extraction.candidateFacts.filter(
        (candidate) => candidate.field === "RISK_PROFILE"
      )
    ).toEqual([]);
    expect(
      classifyCandidateFacts(
        attachTrustedCandidateProvenance(extraction.candidateFacts, {
          sourceRecordId: "source-upload-negated-pdf",
          observedDate: "2026-06-24"
        })
      )
    ).toEqual([]);
  });

  it("does not project cross-sentence contradictory risk evidence from a real PDF", async () => {
    const pdf = createSyntheticTextPdf([
      "Alex may prefer High Growth.",
      "Later in the meeting, Alex said he wants to stay Balanced."
    ]);
    const extracted = await createPdfTextExtractor().extract({
      bytes: new Uint8Array(pdf)
    });
    const extraction = await new MockCandidateFactExtractor().extract({
      clientId: "demo-alex-taylor",
      clientDisplayName: "Alex Taylor",
      sourceRecordId: "source-upload-contradictory-pdf",
      sourceType: "UPLOADED_PDF",
      observedDate: "2026-06-24",
      meetingNoteText: extracted.text,
      supportedFields: ["RISK_PROFILE"]
    });

    expect(extracted.text).toContain("may prefer High Growth");
    expect(extracted.text).toContain("wants to stay Balanced");
    expect(
      extraction.candidateFacts.filter(
        (candidate) => candidate.field === "RISK_PROFILE"
      )
    ).toEqual([]);
    expect(
      classifyCandidateFacts(
        attachTrustedCandidateProvenance(extraction.candidateFacts, {
          sourceRecordId: "source-upload-contradictory-pdf",
          observedDate: "2026-06-24"
        })
      )
    ).toEqual([]);
  });

  it("extracts known text in stable page order and reports page count", async () => {
    const pdf = createSyntheticTextPdf([
      "First page\r\nline",
      "Second page text"
    ]);
    const result = await createPdfTextExtractor().extract({
      bytes: new Uint8Array(pdf)
    });

    expect(result.pageCount).toBe(2);
    expect(result.text).toContain("[Page 1]");
    expect(result.text).toContain("First page");
    expect(result.text).toContain("[Page 2]");
    expect(result.text.indexOf("First page")).toBeLessThan(
      result.text.indexOf("Second page")
    );
    expect(result.text).not.toContain("\r");
  });

  it("rejects PDFs without extractable text and PDFs over page/text limits", async () => {
    await expect(
      createPdfTextExtractor({
        load: async () => fakeDocument(1, ["  \n "])
      }).extract({ bytes: new Uint8Array([1]) })
    ).rejects.toMatchObject({ code: "PDF_TEXT_NOT_AVAILABLE" });

    await expect(
      createPdfTextExtractor({
        load: async () => fakeDocument(maxPdfPages + 1, ["Text"])
      }).extract({ bytes: new Uint8Array([1]) })
    ).rejects.toMatchObject({ code: "PDF_PAGE_LIMIT_EXCEEDED" });

    await expect(
      createPdfTextExtractor({
        load: async () =>
          fakeDocument(1, ["x".repeat(maxPdfExtractedCharacters + 1)])
      }).extract({ bytes: new Uint8Array([1]) })
    ).rejects.toMatchObject({ code: "PDF_EXTRACTED_TEXT_TOO_LARGE" });
  });

  it.each([
    ["PasswordException", "PDF_PASSWORD_PROTECTED"],
    ["UnsupportedFeatureException", "PDF_UNSUPPORTED_FEATURE"],
    ["FormatError", "PDF_PARSE_FAILED"]
  ])("maps %s safely to %s", async (name, code) => {
    const parserError = Object.assign(new Error("secret parser stack"), {
      name
    });
    const extractor = createPdfTextExtractor({
      load: async () => {
        throw parserError;
      }
    });

    try {
      await extractor.extract({ bytes: new Uint8Array([1, 2, 3]) });
      throw new Error("Expected extraction to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(PdfUploadError);
      expect(error).toMatchObject({ code });
      expect(String(error)).not.toContain("secret parser stack");
    }
  });

  it("classifies demonstrated PDF.js password errors without exposing details", () => {
    const parserError = Object.assign(new Error("password details"), {
      name: "PasswordException",
      code: 1
    });

    expect(classifyPdfParserError(parserError)).toMatchObject({
      code: "PDF_PASSWORD_PROTECTED"
    });
    expect(String(classifyPdfParserError(parserError))).not.toContain(
      "password details"
    );
  });

  it("times out a parser that never resolves", async () => {
    const extractor = createPdfTextExtractor(
      {
        load: async () => new Promise<PdfDocumentPort>(() => undefined)
      },
      5
    );

    await expect(
      extractor.extract({ bytes: new Uint8Array([1]) })
    ).rejects.toMatchObject({ code: "PDF_PARSE_TIMEOUT" });
  });

  it("allows normal parsing before timeout and destroys late documents", async () => {
    const normal = createPdfTextExtractor(
      {
        load: async () => fakeDocument(1, ["Normal text"])
      },
      100
    );
    await expect(
      normal.extract({ bytes: new Uint8Array([1]) })
    ).resolves.toMatchObject({ pageCount: 1 });

    let resolveDocument: (document: PdfDocumentPort) => void = () => undefined;
    const destroyed: string[] = [];
    const delayedDocument = new Promise<PdfDocumentPort>((resolve) => {
      resolveDocument = resolve;
    });
    const delayed = createPdfTextExtractor(
      {
        load: async () => delayedDocument
      },
      5
    );
    await expect(
      delayed.extract({ bytes: new Uint8Array([1]) })
    ).rejects.toMatchObject({ code: "PDF_PARSE_TIMEOUT" });

    resolveDocument({
      pageCount: 1,
      extractPages: async () => ["Late text"],
      destroy: async () => {
        destroyed.push("destroyed");
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(destroyed).toEqual(["destroyed"]);
  });
});
