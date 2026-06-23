import type { AiConfig } from "../config/aiConfig.js";
import type { CandidateFactExtractor } from "../contracts/candidateFactExtractor.js";
import { MockCandidateFactExtractor } from "./mockCandidateFactExtractor.js";
import { OpenAiCandidateFactExtractor } from "./openAiCandidateFactExtractor.js";

export const createCandidateFactExtractor = (
  config: AiConfig
): CandidateFactExtractor =>
  config.mode === "openai"
    ? new OpenAiCandidateFactExtractor(config)
    : new MockCandidateFactExtractor();
