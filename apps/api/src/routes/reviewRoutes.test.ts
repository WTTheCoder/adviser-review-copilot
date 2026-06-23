import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type {
  DocumentUploadResult,
  ExecutionTraceMetadata,
  ReviewResponse
} from "@client-review-prep/shared";
import {
  registerReviewRoutes,
  type ReviewRouteDependencies,
  type ReviewRouteHarness,
  type ReviewRouteService
} from "./reviewRoutes.js";

const review: ReviewResponse = {
  client: {
    id: "demo-alex-taylor",
    name: "Alex Taylor",
    adviserName: "Jordan Lee",
    reviewYear: 2026,
    reviewStatus: "Ready for adviser review"
  },
  summaryMetrics: [],
  sourceRecords: [],
  clientFacts: [],
  meaningfulChanges: [],
  adviserActions: [],
  workflowTrace: []
};

const uploadResponse: DocumentUploadResult = {
  status: "stored",
  sourceRecord: {
    id: "source-upload-test",
    clientId: "demo-alex-taylor",
    type: "ADVISER_MEETING_NOTE",
    title: "Uploaded: note.txt",
    observedDate: "2026-06-04",
    upload: {
      origin: "UPLOAD",
      safeFilename: "note.txt",
      mediaType: "text/plain",
      characterCount: 32,
      byteCount: 32,
      uploadedAt: "2026-06-04T00:00:00.000Z"
    }
  },
  safeFilename: "note.txt",
  characterCount: 32,
  byteCount: 32,
  ingestionStatus: "validated"
};

const createTestServer = async () => {
  const server = Fastify({ logger: false });
  const service = {
    buildReviewResponse: vi.fn(async () => review),
    resetDemo: vi.fn(async () => review)
  } satisfies ReviewRouteService;
  const uploadExecutionMetadata: ExecutionTraceMetadata = {
    skillName: "ingest-client-document",
    skillVersion: "1",
    status: "SUCCEEDED",
    events: [
      {
        sequence: 1,
        label: "Skill selected: ingest-client-document",
        status: "STARTED",
        detail: "Validate and persist one local text upload as a source record.",
        timestamp: "2026-06-23T00:00:00.000Z"
      },
      {
        sequence: 2,
        label: "Skill input validated",
        status: "COMPLETE",
        detail: null,
        timestamp: "2026-06-23T00:00:01.000Z"
      },
      {
        sequence: 3,
        label: "Upload metadata validated",
        status: "COMPLETE",
        detail: null,
        timestamp: "2026-06-23T00:00:02.000Z"
      },
      {
        sequence: 4,
        label: "Source record persisted",
        status: "COMPLETE",
        detail: "source-upload-test",
        timestamp: "2026-06-23T00:00:03.000Z"
      },
      {
        sequence: 5,
        label: "Skill output validated",
        status: "COMPLETE",
        detail: null,
        timestamp: "2026-06-23T00:00:04.000Z"
      },
      {
        sequence: 6,
        label: "Skill completed: ingest-client-document",
        status: "COMPLETE",
        detail: null,
        timestamp: "2026-06-23T00:00:05.000Z"
      }
    ]
  };
  const harness = {
    execute: vi.fn<ReviewRouteHarness["execute"]>(
      async (skillName) => ({
        ok: true,
        output:
          skillName === "ingest-client-document" ? uploadResponse : review,
        metadata:
          skillName === "ingest-client-document"
            ? uploadExecutionMetadata
            : {
                skillName,
                skillVersion: "1",
                status: "SUCCEEDED",
                events: []
              }
      })
    )
  } satisfies ReviewRouteHarness;
  const dependencies = {
    reviewService: service,
    harness
  } satisfies ReviewRouteDependencies;
  await registerReviewRoutes(server, dependencies);
  return { server, service, harness, uploadExecutionMetadata };
};

describe("review routes", () => {
  it("returns the expected fictional client", async () => {
    const { server } = await createTestServer();
    const response = await server.inject("/api/clients/demo-alex-taylor/review");

    expect(response.statusCode).toBe(200);
    expect(response.json().client.name).toBe("Alex Taylor");
    await server.close();
  });

  it("prepares a review through the service", async () => {
    const { server, harness } = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/clients/demo-alex-taylor/prepare-review"
    });

    expect(response.statusCode).toBe(200);
    expect(harness.execute).toHaveBeenCalledWith(
      "prepare-annual-review",
      { clientId: "demo-alex-taylor" },
      expect.anything(),
      "demo-alex-taylor"
    );
    await server.close();
  });

  it("rejects invalid decision payloads", async () => {
    const { server } = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/clients/demo-alex-taylor/facts/fact-address/decision",
      payload: { decision: "BAD_DECISION" }
    });

    expect(response.statusCode).toBe(400);
    await server.close();
  });

  it("saves a decision through the fixed apply-adviser-decision skill", async () => {
    const { server, harness } = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/clients/demo-alex-taylor/facts/fact-address/decision",
      payload: { decision: "CONFIRM" }
    });

    expect(response.statusCode).toBe(200);
    expect(harness.execute).toHaveBeenCalledWith(
      "apply-adviser-decision",
      {
        clientId: "demo-alex-taylor",
        factId: "fact-address",
        payload: { decision: "CONFIRM" }
      },
      expect.anything(),
      "demo-alex-taylor"
    );
    await server.close();
  });

  it("does not expose an arbitrary public skill execution endpoint", async () => {
    const { server } = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/skills/prepare-annual-review"
    });

    expect(response.statusCode).toBe(404);
    await server.close();
  });

  it("uploads a text source through the fixed ingestion skill", async () => {
    const { server, harness } = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/clients/demo-alex-taylor/source-records/upload",
      payload: {
        observedDate: "2026-06-04",
        originalFilename: "note.txt",
        mediaType: "text/plain",
        sizeBytes: 32,
        text: "Alex may have moved to Fremantle."
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().safeFilename).toBe("note.txt");
    expect(response.json().executionMetadata.skillName).toBe(
      "ingest-client-document"
    );
    expect(harness.execute).toHaveBeenCalledWith(
      "ingest-client-document",
      expect.objectContaining({
        clientId: "demo-alex-taylor",
        sourceType: "ADVISER_MEETING_NOTE",
        originalFilename: "note.txt"
      }),
      expect.anything(),
      "demo-alex-taylor"
    );
    await server.close();
  });

  it("returns the actual safe ingestion execution metadata for upload", async () => {
    const { server, uploadExecutionMetadata } = await createTestServer();
    const uploadedText = "Alex may have moved to Fremantle.";
    const dangerousOriginalFilename = "C:\\Users\\Alex\\note.txt";
    const response = await server.inject({
      method: "POST",
      url: "/api/clients/demo-alex-taylor/source-records/upload",
      payload: {
        observedDate: "2026-06-04",
        originalFilename: dangerousOriginalFilename,
        mediaType: "text/plain",
        sizeBytes: uploadedText.length,
        text: uploadedText
      }
    });
    const payload = response.json();
    const labels = payload.executionMetadata.events.map(
      (event: { label: string }) => event.label
    );

    expect(response.statusCode).toBe(200);
    expect(payload.executionMetadata).toEqual(uploadExecutionMetadata);
    expect(labels.at(0)).toBe("Skill selected: ingest-client-document");
    expect(labels.at(1)).toBe("Skill input validated");
    expect(labels).toContain("Source record persisted");
    expect(labels.at(-1)).toBe("Skill completed: ingest-client-document");
    expect(JSON.stringify(payload.executionMetadata)).not.toContain(uploadedText);
    expect(JSON.stringify(payload.executionMetadata)).not.toContain(
      dangerousOriginalFilename
    );
    await server.close();
  });

  it("rejects malformed upload requests safely", async () => {
    const { server } = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/clients/demo-alex-taylor/source-records/upload",
      payload: {
        observedDate: "bad-date",
        originalFilename: "note.pdf",
        mediaType: "application/pdf",
        sizeBytes: 1,
        text: "x"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe("Invalid upload request.");
    expect(response.body).not.toContain("ZodError");
    expect(response.body).not.toContain("stack");
    await server.close();
  });

  it("does not expose internal upload execution errors", async () => {
    const { server, harness } = await createTestServer();
    harness.execute.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "INVALID_TOOL_OUTPUT",
        message: "SQL exploded at C:\\internal\\secret"
      },
      metadata: {
        skillName: "ingest-client-document",
        skillVersion: "1",
        status: "FAILED",
        events: []
      }
    });
    const response = await server.inject({
      method: "POST",
      url: "/api/clients/demo-alex-taylor/source-records/upload",
      payload: {
        observedDate: "2026-06-04",
        originalFilename: "note.txt",
        mediaType: "text/plain",
        sizeBytes: 32,
        text: "Alex may have moved to Fremantle."
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe(
      "The document could not be uploaded. Check the file type, size, date, and content."
    );
    expect(response.body).not.toContain("SQL");
    expect(response.body).not.toContain("secret");
    await server.close();
  });

  it("rejects unsupported multipart upload requests safely", async () => {
    const { server, harness } = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/clients/demo-alex-taylor/source-records/upload",
      headers: {
        "content-type": "multipart/form-data; boundary=phase6a"
      },
      payload:
        "--phase6a\r\nContent-Disposition: form-data; name=\"file\"; filename=\"note.txt\"\r\n\r\nhello\r\n--phase6a--"
    });

    expect([400, 415]).toContain(response.statusCode);
    expect(response.body).not.toContain("stack");
    expect(response.body).not.toContain("C:\\");
    expect(response.body).not.toContain("SQL");
    expect(response.body).not.toContain("Prisma");
    expect(harness.execute).not.toHaveBeenCalled();
    await server.close();
  });

  it("resets the demo through the service", async () => {
    const { server, service } = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/demo/reset"
    });

    expect(response.statusCode).toBe(200);
    expect(service.resetDemo).toHaveBeenCalledOnce();
    await server.close();
  });
});
