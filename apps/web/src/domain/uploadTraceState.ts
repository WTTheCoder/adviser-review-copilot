import type { DocumentUploadResponse } from "@client-review-prep/shared";
import type { UploadExecutionMetadata } from "../types/demo.js";

export const uploadTraceFromResponse = (
  response: DocumentUploadResponse
): UploadExecutionMetadata => response.executionMetadata;

export const replaceUploadTrace = (
  response: DocumentUploadResponse
): UploadExecutionMetadata => uploadTraceFromResponse(response);

export const clearUploadTrace = (): UploadExecutionMetadata | null => null;
