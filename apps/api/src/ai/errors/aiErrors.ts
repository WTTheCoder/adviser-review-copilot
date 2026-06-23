export type AiErrorCode =
  | "AI_CONFIGURATION_ERROR"
  | "AI_TIMEOUT"
  | "AI_PROVIDER_ERROR"
  | "AI_INVALID_OUTPUT"
  | "AI_REFUSAL"
  | "AI_INPUT_TOO_LARGE";

const defaultMessages: Record<AiErrorCode, string> = {
  AI_CONFIGURATION_ERROR: "AI extraction is not configured correctly.",
  AI_TIMEOUT: "AI extraction timed out.",
  AI_PROVIDER_ERROR: "AI extraction provider failed.",
  AI_INVALID_OUTPUT: "AI extraction returned invalid output.",
  AI_REFUSAL: "AI extraction was refused by the provider.",
  AI_INPUT_TOO_LARGE: "AI extraction input is too large."
};

export class AiError extends Error {
  readonly code: AiErrorCode;

  constructor(code: AiErrorCode, message = defaultMessages[code]) {
    super(message);
    this.name = "AiError";
    this.code = code;
  }
}

export const toSafeAiError = (error: unknown): AiError => {
  if (error instanceof AiError) {
    return error;
  }

  return new AiError("AI_PROVIDER_ERROR");
};
