import { describe, expect, it, vi } from "vitest";
import type { AiConfig } from "../config/aiConfig.js";
import { AiError } from "../errors/aiErrors.js";
import {
  createCandidateFactTextFormat,
  OpenAiCandidateFactExtractor,
  type OpenAiResponsesClient,
  type ParsedCandidateResponse
} from "./openAiCandidateFactExtractor.js";

const config: AiConfig = {
  mode: "openai",
  apiKey: "sk-test-secret",
  model: "example-model",
  timeoutMs: 25
};

const input = {
  clientId: "demo-alex-taylor",
  clientDisplayName: "Alex Taylor",
  sourceRecordId: "source-meeting-note",
  sourceType: "ADVISER_MEETING_NOTE" as const,
  observedDate: "2026-06-04",
  meetingNoteText: "Alex may have moved to Subiaco.",
  supportedFields: ["ADDRESS"] as const
};

const textFormat = {
  type: "json_schema",
  name: "candidate_fact_extraction",
  strict: true,
  schema: {}
} as const;

const createClient = (output: ParsedCandidateResponse): OpenAiResponsesClient => ({
  responses: {
    parse: vi.fn(async () => output)
  }
});

describe("OpenAiCandidateFactExtractor", () => {
  it("constructs the real structured text format without a network call", async () => {
    expect(() => createCandidateFactTextFormat()).not.toThrow();
    const parse: OpenAiResponsesClient["responses"]["parse"] = vi.fn(async () => ({
      output_parsed: {
        candidateFacts: [],
        warnings: []
      }
    }));
    const extractor = new OpenAiCandidateFactExtractor(config, {
      client: {
        responses: {
          parse
        }
      }
    });

    await extractor.extract(input);

    expect(parse).toHaveBeenCalledOnce();
    const firstCall = vi.mocked(parse).mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) {
      throw new Error("Expected OpenAI parse to be called.");
    }
    const body = firstCall[0];
    expect(body?.text.format).toBeTruthy();
    expect(body?.text.format).toMatchObject({
      type: expect.any(String)
    });
  });

  it("returns a validated structured result", async () => {
    const extractor = new OpenAiCandidateFactExtractor(config, {
      client: createClient({
        output_parsed: {
          candidateFacts: [
            {
              field: "ADDRESS",
              proposedValue: "Subiaco",
              confidence: "MEDIUM",
              evidence: "may have moved to Subiaco",
              requiresHumanReview: false
            }
          ],
          warnings: []
        }
      }),
      textFormat
    });

    const result = await extractor.extract(input);

    expect(result.providerMode).toBe("openai");
    expect(result.model).toBe("example-model");
    expect(result.candidateFacts[0]?.field).toBe("ADDRESS");
  });

  it("maps timeout safely", async () => {
    const parse: OpenAiResponsesClient["responses"]["parse"] = async (
      _body,
      options
    ) =>
      new Promise((_, reject) => {
        options.signal.addEventListener("abort", () =>
          reject(new Error("aborted"))
        );
      });
    const extractor = new OpenAiCandidateFactExtractor(config, {
      client: {
        responses: {
          parse: vi.fn(parse)
        }
      },
      textFormat
    });

    await expect(extractor.extract(input)).rejects.toMatchObject({
      code: "AI_TIMEOUT"
    });
  });

  it("maps provider errors without leaking secrets", async () => {
    const extractor = new OpenAiCandidateFactExtractor(config, {
      client: {
        responses: {
          parse: vi.fn(async () => {
            throw new Error("provider failed with sk-test-secret");
          })
        }
      },
      textFormat
    });

    await expect(extractor.extract(input)).rejects.toMatchObject({
      code: "AI_PROVIDER_ERROR"
    });
    await expect(extractor.extract(input)).rejects.not.toThrow("sk-test-secret");
  });

  it("rejects invalid output and no-output refusal states", async () => {
    const invalidExtractor = new OpenAiCandidateFactExtractor(config, {
      client: createClient({
        output_parsed: { candidateFacts: [{ field: "BAD" }] }
      }),
      textFormat
    });
    const refusalExtractor = new OpenAiCandidateFactExtractor(config, {
      client: createClient({ output_parsed: null }),
      textFormat
    });

    await expect(invalidExtractor.extract(input)).rejects.toMatchObject({
      code: "AI_INVALID_OUTPUT"
    });
    await expect(refusalExtractor.extract(input)).rejects.toMatchObject({
      code: "AI_REFUSAL"
    });
  });

  it("rejects missing live configuration", () => {
    expect(
      () =>
        new OpenAiCandidateFactExtractor({
          ...config,
          apiKey: null
        })
    ).toThrow(AiError);
  });
});
