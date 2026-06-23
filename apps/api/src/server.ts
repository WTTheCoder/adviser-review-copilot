import cors from "@fastify/cors";
import Fastify from "fastify";
import {
  healthResponseSchema,
  type HealthResponse
} from "@client-review-prep/shared";
import { createApplicationRuntime } from "./composition/createApplicationRuntime.js";
import { registerReviewRoutes } from "./routes/reviewRoutes.js";

const DEFAULT_WEB_ORIGIN = "http://localhost:5173";

export const createServer = async () => {
  const server = Fastify({
    logger: true
  });

  await server.register(cors, {
    origin: process.env.WEB_ORIGIN ?? DEFAULT_WEB_ORIGIN
  });

  server.get("/health", async (): Promise<HealthResponse> => {
    return healthResponseSchema.parse({
      status: "ok",
      service: "client-review-prep-api"
    });
  });

  const runtime = createApplicationRuntime();
  await registerReviewRoutes(server, runtime.reviewRoutes);

  return server;
};
