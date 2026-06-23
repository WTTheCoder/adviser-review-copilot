import { z } from "zod";
import { AiError } from "../errors/aiErrors.js";

const aiModeSchema = z.enum(["mock", "openai"]);

export type AiConfig = {
  mode: z.infer<typeof aiModeSchema>;
  apiKey: string | null;
  model: string | null;
  timeoutMs: number;
};

export const loadAiConfig = (
  env: NodeJS.ProcessEnv = process.env
): AiConfig => {
  const parsedMode = aiModeSchema.safeParse(env.AI_MODE ?? "mock");

  if (!parsedMode.success) {
    throw new AiError("AI_CONFIGURATION_ERROR");
  }

  const mode = parsedMode.data;
  const timeoutRaw = env.OPENAI_TIMEOUT_MS ?? "15000";
  const timeoutMs = Number(timeoutRaw);

  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60000) {
    throw new AiError("AI_CONFIGURATION_ERROR");
  }

  const apiKey = env.OPENAI_API_KEY?.trim() || null;
  const model = env.OPENAI_MODEL?.trim() || null;

  if (mode === "openai" && (!apiKey || !model)) {
    throw new AiError("AI_CONFIGURATION_ERROR");
  }

  return {
    mode,
    apiKey,
    model,
    timeoutMs
  };
};
