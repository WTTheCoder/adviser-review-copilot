import {
  adviserDecisionPayloadSchema,
  documentUploadResultSchema,
  documentUploadRequestSchema,
  documentUploadResponseSchema,
  type ReviewResponse,
  reviewResponseSchema
} from "@client-review-prep/shared";
import type { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ExecutionResult } from "../agent/harness/executionResult.js";
import { DEMO_CLIENT_ID } from "../demo/seedDemoData.js";
import type { createReviewService } from "../services/reviewService.js";

export type ReviewRouteService = Pick<
  ReturnType<typeof createReviewService>,
  "buildReviewResponse" | "resetDemo"
>;

type ReviewRouteSkillName =
  | "prepare-annual-review"
  | "apply-adviser-decision"
  | "ingest-client-document";

export type ReviewRouteHarness = {
  execute: <TOutputSchema extends z.ZodType>(
    skillName: ReviewRouteSkillName,
    input: unknown,
    outputSchema: TOutputSchema,
    clientId: string
  ) => Promise<ExecutionResult<z.infer<TOutputSchema>>>;
};

export type ReviewRouteDependencies = {
  reviewService: ReviewRouteService;
  harness: ReviewRouteHarness;
};

const withExecutionMetadata = (
  result: Extract<ExecutionResult<ReviewResponse>, { ok: true }>
) =>
  reviewResponseSchema.parse({
    ...result.output,
    executionMetadata: {
      skillName: result.metadata.skillName,
      skillVersion: result.metadata.skillVersion,
      status: result.metadata.status
    }
  });

export const registerReviewRoutes = async (
  server: FastifyInstance,
  { reviewService, harness }: ReviewRouteDependencies
) => {
  server.get("/api/clients/:clientId/review", async (request, reply) => {
    const { clientId } = request.params as { clientId: string };

    try {
      const review = await reviewService.buildReviewResponse(clientId);
      return reviewResponseSchema.parse(review);
    } catch (error) {
      if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") {
        return reply.status(404).send({ message: "Client review not found." });
      }

      request.log.error(error);
      return reply.status(503).send({ message: "Review data is unavailable." });
    }
  });

  server.post("/api/clients/:clientId/prepare-review", async (request, reply) => {
    const { clientId } = request.params as { clientId: string };

    const result = await harness.execute(
      "prepare-annual-review",
      { clientId },
      reviewResponseSchema,
      clientId
    );

    if (!result.ok) {
      request.log.warn({ code: result.error.code }, "Review preparation failed");
      return reply.status(400).send({ message: result.error.message });
    }

    return withExecutionMetadata(result);
  });

  server.post(
    "/api/clients/:clientId/facts/:factId/decision",
    async (request, reply) => {
      const { clientId, factId } = request.params as {
        clientId: string;
        factId: string;
      };
      const payloadResult = adviserDecisionPayloadSchema.safeParse(request.body);

      if (!payloadResult.success) {
        return reply.status(400).send({ message: "Invalid adviser decision." });
      }

      const result = await harness.execute(
        "apply-adviser-decision",
        {
          clientId,
          factId,
          payload: payloadResult.data
        },
        reviewResponseSchema,
        clientId
      );

      if (!result.ok) {
        request.log.warn({ code: result.error.code }, "Could not save decision");
        return reply.status(400).send({ message: result.error.message });
      }

      return withExecutionMetadata(result);
    }
  );

  server.post(
    "/api/clients/:clientId/source-records/upload",
    async (request, reply) => {
      const { clientId } = request.params as { clientId: string };
      const payloadResult = documentUploadRequestSchema.safeParse({
        ...(typeof request.body === "object" && request.body !== null
          ? request.body
          : {}),
        clientId,
        sourceType: "ADVISER_MEETING_NOTE"
      });

      if (!payloadResult.success) {
        return reply.status(400).send({ message: "Invalid upload request." });
      }

      const result = await harness.execute(
        "ingest-client-document",
        payloadResult.data,
        documentUploadResultSchema,
        clientId
      );

      if (!result.ok) {
        request.log.warn({ code: result.error.code }, "Document ingestion failed");
        return reply.status(400).send({
          message: "The document could not be uploaded. Check the file type, size, date, and content."
        });
      }

      return documentUploadResponseSchema.parse({
        ...result.output,
        executionMetadata: result.metadata
      });
    }
  );

  server.post("/api/demo/reset", async (request, reply) => {
    try {
      const review = await reviewService.resetDemo();
      return reviewResponseSchema.parse(review);
    } catch (error) {
      request.log.error(error);
      return reply
        .status(503)
        .send({ message: `Could not reset demo ${DEMO_CLIENT_ID}.` });
    }
  });
};
