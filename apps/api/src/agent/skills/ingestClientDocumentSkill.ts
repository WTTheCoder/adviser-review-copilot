import {
  documentUploadRequestSchema,
  documentUploadResultSchema
} from "@client-review-prep/shared";
import { z } from "zod";
import type { SkillDefinition } from "./skillTypes.js";
import {
  uploadResponseOutputSchema,
  validatedTextUploadSchema
} from "../tools/documentTools.js";

export const ingestClientDocumentSkill: SkillDefinition<
  typeof documentUploadRequestSchema,
  typeof documentUploadResultSchema
> = {
  name: "ingest-client-document",
  description: "Validate and persist one local text upload as a source record.",
  version: "1",
  idempotency:
    "Each valid upload creates one deliberate source record; reset removes demo uploads.",
  inputSchema: documentUploadRequestSchema,
  outputSchema: documentUploadResultSchema,
  allowedTools: [
    "document.validateTextUpload",
    "review.createUploadedSourceRecord"
  ],
  execute: async (input, context) => {
    context.recordEvent({ label: "Upload metadata validated" });
    const validated = await context.toolRegistry.execute(
      "document.validateTextUpload",
      input,
      ingestClientDocumentSkill.allowedTools,
      context,
      validatedTextUploadSchema
    );

    context.recordEvent({ label: "Filename sanitized" });
    context.recordEvent({ label: "File size validated" });
    context.recordEvent({ label: "UTF-8 text decoded" });
    context.recordEvent({
      label: "Document content validated",
      detail: `${validated.characterCount} characters.`
    });

    const stored = await context.toolRegistry.execute(
      "review.createUploadedSourceRecord",
      validated,
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
