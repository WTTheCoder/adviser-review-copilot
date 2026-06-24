import {
  documentUploadRequestSchema,
  documentUploadResultSchema
} from "@client-review-prep/shared";
import { z } from "zod";
import type { SkillDefinition } from "./skillTypes.js";
import {
  extractedPdfUploadSchema,
  uploadResponseOutputSchema,
  validatedPdfUploadSchema,
  validatedTextUploadSchema
} from "../tools/documentTools.js";

export const ingestClientDocumentSkill: SkillDefinition<
  typeof documentUploadRequestSchema,
  typeof documentUploadResultSchema
> = {
  name: "ingest-client-document",
  description:
    "Validate, extract, and persist one local text or text-based PDF upload.",
  version: "2",
  idempotency:
    "Each valid upload creates one deliberate source record; reset removes demo uploads.",
  inputSchema: documentUploadRequestSchema,
  outputSchema: documentUploadResultSchema,
  allowedTools: [
    "document.validateTextUpload",
    "document.validatePdfUpload",
    "document.extractPdfText",
    "review.createUploadedSourceRecord"
  ],
  execute: async (input, context) => {
    context.recordEvent({ label: "Upload metadata validated" });

    const validated =
      input.documentType === "TEXT"
        ? await context.toolRegistry.execute(
            "document.validateTextUpload",
            input,
            ingestClientDocumentSkill.allowedTools,
            context,
            validatedTextUploadSchema
          )
        : await context.toolRegistry.execute(
            "document.validatePdfUpload",
            input,
            ingestClientDocumentSkill.allowedTools,
            context,
            validatedPdfUploadSchema
          );

    context.recordEvent({ label: "Filename sanitized" });

    const document =
      validated.documentType === "TEXT"
        ? validated
        : await context.toolRegistry.execute(
            "document.extractPdfText",
            validated,
            ingestClientDocumentSkill.allowedTools,
            context,
            extractedPdfUploadSchema
          );

    if (document.documentType === "TEXT") {
      context.recordEvent({ label: "File size validated" });
      context.recordEvent({ label: "UTF-8 text decoded" });
      context.recordEvent({
        label: "Document content validated",
        detail: `${document.characterCount} characters.`
      });
    }

    const stored = await context.toolRegistry.execute(
      "review.createUploadedSourceRecord",
      document,
      ingestClientDocumentSkill.allowedTools,
      context,
      uploadResponseOutputSchema
    );
    context.recordEvent({
      label: "Source record persisted",
      detail: stored.sourceRecord.id
    });

    return z
      .object(documentUploadResultSchema.shape)
      .strict()
      .parse(stored);
  }
};
