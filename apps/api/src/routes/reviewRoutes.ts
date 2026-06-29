import {
  adviserDecisionPayloadSchema,
  decisionMutationResultSchema,
  documentUploadResultSchema,
  documentUploadErrorResponseSchema,
  documentUploadRequestSchema,
  documentUploadResponseSchema,
  maxDocumentUploadRequestBytes,
  type ReviewResponse,
  reviewResponseSchema
} from "@client-review-prep/shared";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ExecutionResult } from "../agent/harness/executionResult.js";
import { DEMO_CLIENT_ID } from "../demo/seedDemoData.js";
import {
  ClientMutationBusyError,
  ClientMutationInvalidatedError
} from "../services/clientOperationCoordinator.js";
import type { ClientOperationCoordinator } from "../services/clientOperationCoordinator.js";
import type { createReviewService } from "../services/reviewService.js";

const pdfUploadErrorCodes = new Set([
  "PDF_INVALID_SIGNATURE",
  "PDF_TOO_LARGE",
  "PDF_PARSE_FAILED",
  "PDF_ENCRYPTED",
  "PDF_PASSWORD_PROTECTED",
  "PDF_PARSE_TIMEOUT",
  "PDF_PAGE_LIMIT_EXCEEDED",
  "PDF_TEXT_NOT_AVAILABLE",
  "PDF_EXTRACTED_TEXT_TOO_LARGE",
  "PDF_UNSUPPORTED_FEATURE"
]);

export const uploadRequestBodyLimit = maxDocumentUploadRequestBytes;

export type ReviewRouteService = Pick<
  ReturnType<typeof createReviewService>,
  "mutationCoordinator" | "buildReviewResponse" | "resetDemo"
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
  clientOperations: ClientOperationCoordinator;
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

const applyDecisionRouteResponseSchema = z.union([
  reviewResponseSchema,
  decisionMutationResultSchema
]);

export const registerReviewRoutes = async (
  server: FastifyInstance,
  { reviewService, harness, clientOperations }: ReviewRouteDependencies
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
      return reply
        .status(
          result.error.code === "CLIENT_MUTATION_INVALIDATED" ? 409 : 400
        )
        .send({
          code: result.error.code,
          message: result.error.message
        });
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

      const result = await clientOperations.runClientMutation(
        clientId,
        () =>
          harness.execute(
            "apply-adviser-decision",
            {
              clientId,
              factId,
              payload: payloadResult.data
            },
            applyDecisionRouteResponseSchema,
            clientId
          )
      );

      if (!result.ok) {
        request.log.warn({ code: result.error.code }, "Could not save decision");
        return reply
          .status(result.error.code === "DECISION_CONFLICT" ? 409 : 400)
          .send({
            code: result.error.code,
            message: result.error.message
          });
      }

      if ("refreshRequired" in result.output && result.output.refreshRequired) {
        return {
          ...result.output,
          executionMetadata: {
            skillName: result.metadata.skillName,
            skillVersion: result.metadata.skillVersion,
            status: result.metadata.status
          }
        };
      }

      const review = "refreshRequired" in result.output
        ? result.output.review
        : result.output;

      return reviewResponseSchema.parse({
        ...review,
        executionMetadata: {
          skillName: result.metadata.skillName,
          skillVersion: result.metadata.skillVersion,
          status: result.metadata.status
        }
      });
    }
  );

  server.post(
    "/api/clients/:clientId/source-records/upload",
    { bodyLimit: uploadRequestBodyLimit },
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

      let result: Awaited<ReturnType<ReviewRouteHarness["execute"]>>;
      try {
        result = await clientOperations.runClientMutation(
          clientId,
          () =>
            harness.execute(
              "ingest-client-document",
              payloadResult.data,
              documentUploadResultSchema,
              clientId
            ),
          { rejectIfBusy: true }
        );
      } catch (error) {
        if (error instanceof ClientMutationBusyError) {
          return reply.status(409).send({
            message: "An upload is already in progress for this client."
          });
        }
        if (error instanceof ClientMutationInvalidatedError) {
          return reply.status(409).send({
            message: "The upload was cancelled because the demo was reset."
          });
        }
        throw error;
      }

      if (!result.ok) {
        request.log.warn({ code: result.error.code }, "Document ingestion failed");
        if (result.error.code === "CLIENT_MUTATION_INVALIDATED") {
          return reply.status(409).send({
            code: result.error.code,
            message: result.error.message
          });
        }
        if (pdfUploadErrorCodes.has(result.error.code)) {
          return reply.status(400).send({
            ...documentUploadErrorResponseSchema.parse({
              code: result.error.code,
              message: result.error.message
            })
          });
        }

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
      const review = await clientOperations.runReset(DEMO_CLIENT_ID, () =>
        reviewService.resetDemo()
      );
      return reviewResponseSchema.parse(review);
    } catch (error) {
      request.log.error(error);
      return reply
        .status(503)
        .send({ message: `Could not reset demo ${DEMO_CLIENT_ID}.` });
    }
  });
};
