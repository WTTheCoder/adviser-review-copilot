import {
  allowedPdfUploadExtensions,
  allowedPdfUploadMediaTypes,
  maxPdfExtractedBytes,
  maxPdfExtractedCharacters,
  maxPdfPages,
  maxPdfUploadBytes,
  type DocumentUploadRequest
} from "@client-review-prep/shared";
import { Buffer } from "node:buffer";
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import {
  normalizeUploadMediaType,
  sanitizeUploadFilename
} from "./textUpload.js";

export const PDF_PARSER_NAME = "unpdf" as const;
export const PDF_PARSER_VERSION = "1.6.2";
export const PDF_PARSE_TIMEOUT_MS = 15_000;

export type PdfUploadErrorCode =
  | "PDF_INVALID_SIGNATURE"
  | "PDF_TOO_LARGE"
  | "PDF_PARSE_FAILED"
  | "PDF_ENCRYPTED"
  | "PDF_PASSWORD_PROTECTED"
  | "PDF_PARSE_TIMEOUT"
  | "PDF_PAGE_LIMIT_EXCEEDED"
  | "PDF_TEXT_NOT_AVAILABLE"
  | "PDF_EXTRACTED_TEXT_TOO_LARGE"
  | "PDF_UNSUPPORTED_FEATURE"
  | "EMPTY_DOCUMENT"
  | "UNSAFE_FILENAME"
  | "UNSUPPORTED_EXTENSION"
  | "UNSUPPORTED_MEDIA_TYPE";

export class PdfUploadError extends Error {
  constructor(readonly code: PdfUploadErrorCode) {
    super(code);
    this.name = "PdfUploadError";
  }
}

export const pdfExtractionInputSchema = z
  .object({
    bytes: z.instanceof(Uint8Array)
  })
  .strict();

export const pdfExtractionOutputSchema = z
  .object({
    text: z.string().min(1).max(maxPdfExtractedCharacters),
    pageCount: z.number().int().positive().max(maxPdfPages),
    extractedCharacterCount: z
      .number()
      .int()
      .positive()
      .max(maxPdfExtractedCharacters),
    extractedByteCount: z
      .number()
      .int()
      .positive()
      .max(maxPdfExtractedBytes),
    warnings: z.array(z.string().min(1).max(160)).max(5)
  })
  .strict();

export type PdfDocumentPort = {
  pageCount: number;
  extractPages: () => Promise<string[]>;
  destroy: () => Promise<void>;
};

export type PdfParserAdapter = {
  load: (bytes: Uint8Array) => Promise<PdfDocumentPort>;
};

const defaultPdfParserAdapter: PdfParserAdapter = {
  load: async (bytes) => {
    const document = await getDocumentProxy(bytes, {
      disableAutoFetch: true,
      disableStream: true,
      isEvalSupported: false,
      stopAtErrors: true,
      useSystemFonts: false,
      verbosity: 0
    });

    return {
      pageCount: document.numPages,
      extractPages: async () => {
        const result = await extractText(document);
        return result.text;
      },
      destroy: () => document.destroy()
    };
  }
};

const base64Pattern =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const decodePdfBase64 = (base64Data: string) => {
  if (
    base64Data.length === 0 ||
    base64Data.length % 4 !== 0 ||
    !base64Pattern.test(base64Data)
  ) {
    throw new PdfUploadError("PDF_PARSE_FAILED");
  }

  const bytes = Buffer.from(base64Data, "base64");
  if (bytes.length === 0) {
    throw new PdfUploadError("EMPTY_DOCUMENT");
  }

  if (bytes.length > maxPdfUploadBytes) {
    throw new PdfUploadError("PDF_TOO_LARGE");
  }

  return new Uint8Array(bytes);
};

const hasPdfSignature = (bytes: Uint8Array) =>
  bytes.length >= 5 &&
  bytes[0] === 0x25 &&
  bytes[1] === 0x50 &&
  bytes[2] === 0x44 &&
  bytes[3] === 0x46 &&
  bytes[4] === 0x2d;

export const validatePdfUpload = (
  input: Extract<DocumentUploadRequest, { documentType: "PDF" }>
) => {
  const filename = sanitizeUploadFilename(
    input.originalFilename,
    allowedPdfUploadExtensions
  );
  const mediaType = normalizeUploadMediaType(input.mediaType);
  if (!allowedPdfUploadMediaTypes.some((candidate) => candidate === mediaType)) {
    throw new PdfUploadError("UNSUPPORTED_MEDIA_TYPE");
  }

  const bytes = decodePdfBase64(input.base64Data);
  if (!hasPdfSignature(bytes)) {
    throw new PdfUploadError("PDF_INVALID_SIGNATURE");
  }
  return {
    safeFilename: filename.safeFilename,
    extension: filename.extension,
    mediaType: "application/pdf" as const,
    bytes,
    originalByteCount: bytes.length
  };
};

const normalizeExtractedPage = (text: string) =>
  text
    .replace(/\0/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n")
    .trim();

export const classifyPdfParserError = (error: unknown): PdfUploadError => {
  const name =
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof error.name === "string"
      ? error.name
      : "";

  if (name === "PasswordException") {
    return new PdfUploadError("PDF_PASSWORD_PROTECTED");
  }

  if (name === "UnsupportedFeatureException") {
    return new PdfUploadError("PDF_UNSUPPORTED_FEATURE");
  }

  return new PdfUploadError("PDF_PARSE_FAILED");
};

export const createPdfTextExtractor = (
  adapter: PdfParserAdapter = defaultPdfParserAdapter,
  timeoutMs = PDF_PARSE_TIMEOUT_MS
) => ({
  extract: async (input: z.infer<typeof pdfExtractionInputSchema>) => {
    const validatedInput = pdfExtractionInputSchema.parse(input);
    let document: PdfDocumentPort | null = null;
    let timedOut = false;

    const parsing = (async () => {
      try {
        document = await adapter.load(validatedInput.bytes);
        if (timedOut) {
          throw new PdfUploadError("PDF_PARSE_TIMEOUT");
        }
        if (document.pageCount > maxPdfPages) {
          throw new PdfUploadError("PDF_PAGE_LIMIT_EXCEEDED");
        }

        const pages = await document.extractPages();
        if (timedOut) {
          throw new PdfUploadError("PDF_PARSE_TIMEOUT");
        }
        const normalizedPages = pages.map(normalizeExtractedPage);
        if (normalizedPages.every((page) => page.length === 0)) {
          throw new PdfUploadError("PDF_TEXT_NOT_AVAILABLE");
        }

        const text = normalizedPages
          .map((page, index) => `[Page ${index + 1}]\n${page}`)
          .join("\n\n")
          .trim();
        const extractedByteCount = Buffer.byteLength(text, "utf8");

        if (
          text.length > maxPdfExtractedCharacters ||
          extractedByteCount > maxPdfExtractedBytes
        ) {
          throw new PdfUploadError("PDF_EXTRACTED_TEXT_TOO_LARGE");
        }

        return pdfExtractionOutputSchema.parse({
          text,
          pageCount: document.pageCount,
          extractedCharacterCount: text.length,
          extractedByteCount,
          warnings: []
        });
      } catch (error) {
        if (error instanceof PdfUploadError) {
          throw error;
        }

        throw classifyPdfParserError(error);
      } finally {
        if (document) {
          await document.destroy().catch(() => undefined);
        }
      }
    })();

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutResult = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        timedOut = true;
        reject(new PdfUploadError("PDF_PARSE_TIMEOUT"));
      }, timeoutMs);
    });

    try {
      return await Promise.race([parsing, timeoutResult]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
});

export const extractPdfText = createPdfTextExtractor().extract;
