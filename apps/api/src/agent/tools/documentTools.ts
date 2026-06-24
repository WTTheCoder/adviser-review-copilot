import {
  documentUploadResultSchema,
  maxPdfExtractedBytes,
  maxPdfExtractedCharacters,
  maxPdfPages,
  maxPdfUploadBytes,
  maxUploadBytes,
  maxUploadCharacters,
  maxUploadFilenameLength,
  pdfDocumentUploadRequestSchema,
  textDocumentUploadRequestSchema
} from "@client-review-prep/shared";
import { z } from "zod";
import {
  extractPdfText,
  PDF_PARSER_NAME,
  PDF_PARSER_VERSION,
  PdfUploadError,
  validatePdfUpload
} from "../../documents/pdfUpload.js";
import {
  DocumentUploadError,
  validateTextUpload
} from "../../documents/textUpload.js";
import { ExecutionError } from "../harness/executionErrors.js";
import type { ToolDefinition } from "./toolTypes.js";

export const validatedTextUploadSchema = z
  .object({
    documentType: z.literal("TEXT"),
    clientId: z.string().min(1).max(80),
    observedDate: z.string(),
    sourceType: z.literal("ADVISER_MEETING_NOTE"),
    safeFilename: z.string().min(1).max(maxUploadFilenameLength),
    mediaType: z.enum([
      "text/plain",
      "text/markdown",
      "text/x-markdown",
      "application/octet-stream"
    ]),
    text: z.string().min(1).max(maxUploadCharacters),
    characterCount: z.number().int().positive().max(maxUploadCharacters),
    byteCount: z.number().int().positive().max(maxUploadBytes),
    originalByteCount: z.number().int().positive().max(maxUploadBytes)
  })
  .strict();

export const validatedPdfUploadSchema = z
  .object({
    documentType: z.literal("PDF"),
    clientId: z.string().min(1).max(80),
    observedDate: z.string(),
    sourceType: z.literal("ADVISER_MEETING_NOTE"),
    safeFilename: z.string().min(1).max(maxUploadFilenameLength),
    mediaType: z.literal("application/pdf"),
    bytes: z.instanceof(Uint8Array),
    originalByteCount: z.number().int().positive().max(maxPdfUploadBytes)
  })
  .strict();

export const extractedPdfUploadSchema = z
  .object({
    documentType: z.literal("PDF"),
    clientId: z.string().min(1).max(80),
    observedDate: z.string(),
    sourceType: z.literal("ADVISER_MEETING_NOTE"),
    safeFilename: z.string().min(1).max(maxUploadFilenameLength),
    mediaType: z.literal("application/pdf"),
    text: z.string().min(1).max(maxPdfExtractedCharacters),
    characterCount: z
      .number()
      .int()
      .positive()
      .max(maxPdfExtractedCharacters),
    byteCount: z.number().int().positive().max(maxPdfExtractedBytes),
    originalByteCount: z.number().int().positive().max(maxPdfUploadBytes),
    pageCount: z.number().int().positive().max(maxPdfPages),
    parser: z
      .object({
        name: z.literal(PDF_PARSER_NAME),
        version: z.literal(PDF_PARSER_VERSION)
      })
      .strict(),
    warnings: z.array(z.string().min(1).max(160)).max(5)
  })
  .strict();

export const validatedDocumentForPersistenceSchema = z.discriminatedUnion(
  "documentType",
  [validatedTextUploadSchema, extractedPdfUploadSchema]
);

const toPdfExecutionError = (error: PdfUploadError) => {
  switch (error.code) {
    case "PDF_INVALID_SIGNATURE":
    case "PDF_TOO_LARGE":
    case "PDF_PARSE_FAILED":
    case "PDF_ENCRYPTED":
    case "PDF_PASSWORD_PROTECTED":
    case "PDF_PARSE_TIMEOUT":
    case "PDF_PAGE_LIMIT_EXCEEDED":
    case "PDF_TEXT_NOT_AVAILABLE":
    case "PDF_EXTRACTED_TEXT_TOO_LARGE":
    case "PDF_UNSUPPORTED_FEATURE":
      return new ExecutionError(error.code);
    default:
      return new ExecutionError("INVALID_TOOL_INPUT");
  }
};

export const createDocumentTools = (
  dependencies: {
    extractPdfText?: typeof extractPdfText;
  } = {}
) => {
  const extractPdf = dependencies.extractPdfText ?? extractPdfText;
  const validateTextUploadTool: ToolDefinition<
    typeof textDocumentUploadRequestSchema,
    typeof validatedTextUploadSchema
  > = {
    name: "document.validateTextUpload",
    description: "Validate one local UTF-8 text upload without filesystem access.",
    inputSchema: textDocumentUploadRequestSchema,
    outputSchema: validatedTextUploadSchema,
    risk: "MEDIUM",
    execute: async (input, context) => {
      try {
        const validated = validateTextUpload(input);
        context.recordEvent({
          label: "Text upload validated",
          detail: `${validated.characterCount} characters.`
        });
        return {
          documentType: "TEXT",
          clientId: input.clientId,
          observedDate: input.observedDate,
          sourceType: input.sourceType,
          safeFilename: validated.safeFilename,
          mediaType: validated.mediaType,
          text: validated.text,
          characterCount: validated.characterCount,
          byteCount: validated.byteCount,
          originalByteCount: validated.byteCount
        };
      } catch (error) {
        if (error instanceof DocumentUploadError) {
          throw new ExecutionError("INVALID_TOOL_INPUT");
        }

        throw error;
      }
    }
  };

  const validatePdfUploadTool: ToolDefinition<
    typeof pdfDocumentUploadRequestSchema,
    typeof validatedPdfUploadSchema
  > = {
    name: "document.validatePdfUpload",
    description:
      "Validate one bounded in-memory PDF upload without filesystem access.",
    inputSchema: pdfDocumentUploadRequestSchema,
    outputSchema: validatedPdfUploadSchema,
    risk: "MEDIUM",
    execute: async (input, context) => {
      try {
        const validated = validatePdfUpload(input);
        context.recordEvent({ label: "PDF signature validated" });
        context.recordEvent({
          label: "PDF size validated",
          detail: `${validated.originalByteCount} bytes.`
        });
        return {
          documentType: "PDF",
          clientId: input.clientId,
          observedDate: input.observedDate,
          sourceType: input.sourceType,
          safeFilename: validated.safeFilename,
          mediaType: validated.mediaType,
          bytes: validated.bytes,
          originalByteCount: validated.originalByteCount
        };
      } catch (error) {
        if (error instanceof PdfUploadError) {
          throw toPdfExecutionError(error);
        }

        throw error;
      }
    }
  };

  const extractPdfTextTool: ToolDefinition<
    typeof validatedPdfUploadSchema,
    typeof extractedPdfUploadSchema
  > = {
    name: "document.extractPdfText",
    description:
      "Extract bounded plain text from a validated PDF without OCR or file writes.",
    inputSchema: validatedPdfUploadSchema,
    outputSchema: extractedPdfUploadSchema,
    risk: "MEDIUM",
    execute: async (input, context) => {
      context.recordEvent({ label: "PDF text extraction started" });
      try {
        const extracted = await extractPdf({ bytes: input.bytes });
        context.recordEvent({
          label: "PDF page limit validated",
          detail: `${extracted.pageCount} pages.`
        });
        context.recordEvent({
          label: "Extracted PDF text validated",
          detail: `${extracted.extractedCharacterCount} characters.`
        });
        return {
          documentType: "PDF",
          clientId: input.clientId,
          observedDate: input.observedDate,
          sourceType: input.sourceType,
          safeFilename: input.safeFilename,
          mediaType: input.mediaType,
          text: extracted.text,
          characterCount: extracted.extractedCharacterCount,
          byteCount: extracted.extractedByteCount,
          originalByteCount: input.originalByteCount,
          pageCount: extracted.pageCount,
          parser: {
            name: PDF_PARSER_NAME,
            version: PDF_PARSER_VERSION
          },
          warnings: extracted.warnings
        };
      } catch (error) {
        if (error instanceof PdfUploadError) {
          throw toPdfExecutionError(error);
        }

        throw error;
      }
    }
  };

  return [
    validateTextUploadTool,
    validatePdfUploadTool,
    extractPdfTextTool
  ] as const;
};

export const uploadResponseOutputSchema = documentUploadResultSchema;
