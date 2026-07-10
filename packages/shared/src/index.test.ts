import { describe, expect, it } from "vitest";
import {
  adviserDecisionPayloadSchema,
  documentUploadRequestSchema,
  documentUploadResultSchema,
  documentUploadResponseSchema,
  healthResponseSchema,
  maxUploadBytes,
  reviewResponseSchema
} from "./index.js";

describe("healthResponseSchema", () => {
  it("accepts the API health response contract", () => {
    const result = healthResponseSchema.parse({
      status: "ok",
      service: "client-review-prep-api"
    });

    expect(result).toEqual({
      status: "ok",
      service: "client-review-prep-api"
    });
  });
});

describe("adviserDecisionPayloadSchema", () => {
  it("accepts supported adviser decisions", () => {
    expect(
      adviserDecisionPayloadSchema.parse({
        decision: "CONFIRM",
        note: "Confirmed during the local demo."
      })
    ).toEqual({
      decision: "CONFIRM",
      note: "Confirmed during the local demo."
    });
  });
});

describe("reviewResponseSchema", () => {
  it("validates the minimum review response shape", () => {
    expect(
      reviewResponseSchema.safeParse({
        client: {
          id: "demo-alex-taylor",
          name: "Alex Taylor",
          adviserName: "Jordan Bennett",
          reviewYear: 2026,
          reviewStatus: "Ready for adviser review"
        },
        summaryMetrics: [],
        sourceRecords: [],
        clientFacts: [],
        meaningfulChanges: [],
        adviserActions: [],
        workflowTrace: []
      }).success
    ).toBe(true);
  });
});

describe("document upload schemas", () => {
  it("accepts the text upload request and response contracts", () => {
    const request = documentUploadRequestSchema.parse({
      clientId: "demo-alex-taylor",
      observedDate: "2026-06-04",
      sourceType: "ADVISER_MEETING_NOTE",
      originalFilename: "alex-note.md",
      mediaType: "text/markdown",
      sizeBytes: 42,
      documentType: "TEXT",
      text: "Alex may have moved to Fremantle."
    });
    if (request.documentType !== "TEXT") {
      throw new Error("Expected a text upload request.");
    }
    const result = documentUploadResultSchema.parse({
      status: "stored",
      sourceRecord: {
        id: "source-upload-demo-alex-taylor-1",
        clientId: request.clientId,
        type: "ADVISER_MEETING_NOTE",
        title: "Uploaded: alex-note.md",
        observedDate: request.observedDate,
        upload: {
          origin: "UPLOAD",
          documentType: "TEXT",
          safeFilename: "alex-note.md",
          mediaType: request.mediaType,
          characterCount: request.text.length,
          byteCount: request.text.length,
          uploadedAt: "2026-06-23T00:00:00.000Z"
        }
      },
      safeFilename: "alex-note.md",
      characterCount: request.text.length,
      byteCount: request.text.length,
      ingestionStatus: "validated"
    });
    const response = documentUploadResponseSchema.parse({
      ...result,
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
            label: "Skill completed: ingest-client-document",
            status: "COMPLETE",
            detail: null,
            timestamp: "2026-06-23T00:00:01.000Z"
          }
        ]
      }
    });

    expect(response.sourceRecord.upload.safeFilename).toBe("alex-note.md");
    expect(response.executionMetadata.events.at(-1)?.label).toBe(
      "Skill completed: ingest-client-document"
    );
  });

  it("accepts the PDF upload request and metadata contracts", () => {
    const request = documentUploadRequestSchema.parse({
      clientId: "demo-alex-taylor",
      observedDate: "2026-06-04",
      sourceType: "ADVISER_MEETING_NOTE",
      originalFilename: "alex-review.PDF",
      mediaType: "application/pdf",
      sizeBytes: 5,
      documentType: "PDF",
      base64Data: "JVBERi0="
    });

    expect(request.documentType).toBe("PDF");
    expect(
      documentUploadResultSchema.safeParse({
        status: "stored",
        sourceRecord: {
          id: "source-upload-pdf",
          clientId: request.clientId,
          type: "ADVISER_MEETING_NOTE",
          title: "Uploaded: alex-review.PDF",
          observedDate: request.observedDate,
          upload: {
            origin: "UPLOAD",
            documentType: "PDF",
            safeFilename: "alex-review.PDF",
            mediaType: "application/pdf",
            characterCount: 80,
            byteCount: 80,
            originalByteCount: 512,
            pageCount: 2,
            parser: { name: "unpdf", version: "1.6.2" },
            uploadedAt: "2026-06-23T00:00:00.000Z"
          }
        },
        safeFilename: "alex-review.PDF",
        characterCount: 80,
        byteCount: 80,
        originalByteCount: 512,
        pageCount: 2,
        ingestionStatus: "validated"
      }).success
    ).toBe(true);
  });

  it("rejects invalid dates and unexpected fields while treating sizeBytes as non-authoritative metadata", () => {
    expect(
      documentUploadRequestSchema.safeParse({
        clientId: "demo-alex-taylor",
        observedDate: "2026-02-31",
        sourceType: "ADVISER_MEETING_NOTE",
        originalFilename: "alex-note.txt",
        mediaType: "text/plain",
        sizeBytes: 12,
        documentType: "TEXT",
        text: "Text",
        unexpected: true
      }).success
    ).toBe(false);

    expect(
      documentUploadRequestSchema.safeParse({
        clientId: "demo-alex-taylor",
        observedDate: "2026-06-04",
        sourceType: "ADVISER_MEETING_NOTE",
        originalFilename: "alex-note.txt",
        mediaType: "text/plain",
        sizeBytes: maxUploadBytes + 1,
        documentType: "TEXT",
        text: "Text"
      }).success
    ).toBe(true);
  });
});
