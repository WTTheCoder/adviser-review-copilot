import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("client-review-prep-api")
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
