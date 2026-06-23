import { describe, expect, it } from "vitest";
import { loadAiConfig } from "./aiConfig.js";
import { AiError } from "../errors/aiErrors.js";

describe("AI configuration", () => {
  it("defaults to mock mode", () => {
    expect(loadAiConfig({}).mode).toBe("mock");
  });

  it("requires an API key and model for OpenAI mode", () => {
    expect(() => loadAiConfig({ AI_MODE: "openai" })).toThrow(AiError);
  });

  it("requires a model when an OpenAI API key is configured", () => {
    expect(() =>
      loadAiConfig({
        AI_MODE: "openai",
        OPENAI_API_KEY: "sk-secret"
      })
    ).toThrow(AiError);
  });

  it("rejects invalid AI modes with a stable application error", () => {
    expect(() =>
      loadAiConfig({
        AI_MODE: "provider-x"
      })
    ).toThrow(AiError);
  });

  it("rejects invalid timeout values without exposing secrets", () => {
    try {
      loadAiConfig({
        AI_MODE: "openai",
        OPENAI_API_KEY: "sk-secret",
        OPENAI_MODEL: "example-model",
        OPENAI_TIMEOUT_MS: "bad"
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AiError);
      expect(error instanceof Error ? error.message : "").not.toContain(
        "sk-secret"
      );
    }
  });
});
