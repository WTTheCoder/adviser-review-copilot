import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  candidateFactExtractionResultSchema,
  MAX_MEETING_NOTE_CHARS,
  modelCandidateFactExtractionSchema
} from "../contracts/candidateFactSchemas.js";
import type {
  CandidateFactExtractionInput,
  CandidateFactExtractor
} from "../contracts/candidateFactExtractor.js";
import type { AiConfig } from "../config/aiConfig.js";
import { AiError, toSafeAiError } from "../errors/aiErrors.js";
import { buildCandidateFactExtractionPrompt } from "../prompts/candidateFactExtractionPrompt.js";

export type ParsedCandidateResponse = {
  output_parsed?: unknown;
  status?: string;
  error?: unknown;
};

type StructuredTextFormat =
  | ReturnType<typeof zodTextFormat>
  | {
      type: "json_schema";
      name: string;
      strict: boolean;
      schema: { [key: string]: unknown };
    };

export type OpenAiResponsesClient = {
  responses: {
    parse: (
      body: {
        model: string;
        input: ReturnType<typeof buildCandidateFactExtractionPrompt>;
        text: {
          format: StructuredTextFormat;
        };
        store: false;
      },
      options: { signal: AbortSignal }
    ) => Promise<ParsedCandidateResponse>;
  };
};

type OpenAiCandidateFactExtractorOptions = {
  client?: OpenAiResponsesClient;
  textFormat?: StructuredTextFormat;
};

export const createCandidateFactTextFormat = (): StructuredTextFormat =>
  zodTextFormat(
    modelCandidateFactExtractionSchema,
    "candidate_fact_extraction"
  );

export class OpenAiCandidateFactExtractor implements CandidateFactExtractor {
  private readonly client: OpenAiResponsesClient;
  private readonly textFormat: StructuredTextFormat;

  constructor(
    private readonly config: AiConfig,
    options: OpenAiCandidateFactExtractorOptions = {}
  ) {
    if (config.mode !== "openai" || !config.apiKey || !config.model) {
      throw new AiError("AI_CONFIGURATION_ERROR");
    }

    this.client =
      options.client ??
      new OpenAI({
        apiKey: config.apiKey,
        maxRetries: 1,
        timeout: config.timeoutMs
      });
    this.textFormat = options.textFormat ?? createCandidateFactTextFormat();
  }

  async extract(input: CandidateFactExtractionInput) {
    if (input.meetingNoteText.length > MAX_MEETING_NOTE_CHARS) {
      throw new AiError("AI_INPUT_TOO_LARGE");
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await this.client.responses.parse(
        {
          model: this.config.model ?? "",
          input: buildCandidateFactExtractionPrompt(input),
          text: {
            format: this.textFormat
          },
          store: false
        },
        { signal: controller.signal }
      );

      if (response.status === "incomplete" || response.status === "failed") {
        throw new AiError("AI_PROVIDER_ERROR");
      }

      if (!response.output_parsed) {
        throw new AiError("AI_REFUSAL");
      }

      const parsed = candidateFactExtractionResultSchema.safeParse({
        ...response.output_parsed,
        providerMode: "openai",
        model: this.config.model,
        metadata: {
          durationMs: Date.now() - startedAt,
          sourceTextLength: input.meetingNoteText.length,
          candidateCount: Array.isArray(
            (response.output_parsed as { candidateFacts?: unknown }).candidateFacts
          )
            ? (response.output_parsed as { candidateFacts: unknown[] })
                .candidateFacts.length
            : 0
        }
      });

      if (!parsed.success) {
        throw new AiError("AI_INVALID_OUTPUT");
      }

      return parsed.data;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new AiError("AI_TIMEOUT");
      }

      if (error instanceof AiError) {
        throw error;
      }

      throw toSafeAiError(error);
    } finally {
      clearTimeout(timeout);
    }
  }
}
