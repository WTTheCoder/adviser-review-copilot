import { documentUploadRequestSchema, documentUploadResultSchema } from "@client-review-prep/shared";
import { z } from "zod";
import { DocumentUploadError, validateTextUpload } from "../../documents/textUpload.js";
import { ExecutionError } from "../harness/executionErrors.js";
import type { ToolDefinition } from "./toolTypes.js";

export const validatedTextUploadSchema = z
  .object({
    clientId: z.string().min(1).max(80),
    observedDate: z.string(),
    sourceType: z.literal("ADVISER_MEETING_NOTE"),
    safeFilename: z.string().min(1).max(120),
    mediaType: z.string(),
    text: z.string().min(1),
    characterCount: z.number().int().positive(),
    byteCount: z.number().int().positive()
  })
  .strict();

export const createDocumentTools = () => {
  const validateTextUploadTool: ToolDefinition<
    typeof documentUploadRequestSchema,
    typeof validatedTextUploadSchema
  > = {
    name: "document.validateTextUpload",
    description: "Validate one local UTF-8 text upload without filesystem access.",
    inputSchema: documentUploadRequestSchema,
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
          clientId: input.clientId,
          observedDate: input.observedDate,
          sourceType: input.sourceType,
          safeFilename: validated.safeFilename,
          mediaType: validated.mediaType,
          text: validated.text,
          characterCount: validated.characterCount,
          byteCount: validated.byteCount
        };
      } catch (error) {
        if (error instanceof DocumentUploadError) {
          throw new ExecutionError("INVALID_TOOL_INPUT");
        }

        throw new DocumentUploadError("INVALID_UPLOAD");
      }
    }
  };

  return [validateTextUploadTool] as const;
};

export const uploadResponseOutputSchema = documentUploadResultSchema;
