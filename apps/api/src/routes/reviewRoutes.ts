import {
  adviserDecisionPayloadSchema,
  reviewResponseSchema
} from "@client-review-prep/shared";
import type { FastifyInstance } from "fastify";
import { DEMO_CLIENT_ID } from "../demo/seedDemoData.js";
import { prisma } from "../db/prisma.js";
import { createReviewService } from "../services/reviewService.js";

type ReviewService = ReturnType<typeof createReviewService>;

export const registerReviewRoutes = async (
  server: FastifyInstance,
  reviewService: ReviewService = createReviewService(prisma)
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

    try {
      const review = await reviewService.prepareReview(clientId);
      return reviewResponseSchema.parse(review);
    } catch (error) {
      request.log.error(error);
      return reply.status(503).send({ message: "Review preparation failed." });
    }
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

      try {
        const review = await reviewService.recordDecision(
          clientId,
          factId,
          payloadResult.data
        );
        return reviewResponseSchema.parse(review);
      } catch (error) {
        if (
          error instanceof Error &&
          ["FACT_NOT_FOUND", "INVALID_DECISION_FOR_FACT"].includes(error.message)
        ) {
          return reply.status(400).send({ message: "Invalid adviser decision." });
        }

        request.log.error(error);
        return reply.status(503).send({ message: "Could not save decision." });
      }
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
