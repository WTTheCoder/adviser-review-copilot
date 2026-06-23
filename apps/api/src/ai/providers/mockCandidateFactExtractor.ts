import {
  candidateFactExtractionResultSchema,
  MAX_MEETING_NOTE_CHARS
} from "../contracts/candidateFactSchemas.js";
import type {
  CandidateFactExtractionInput,
  CandidateFactExtractor
} from "../contracts/candidateFactExtractor.js";
import { AiError } from "../errors/aiErrors.js";

export class MockCandidateFactExtractor implements CandidateFactExtractor {
  async extract(input: CandidateFactExtractionInput) {
    if (input.meetingNoteText.length > MAX_MEETING_NOTE_CHARS) {
      throw new AiError("AI_INPUT_TOO_LARGE");
    }

    const lowerText = input.meetingNoteText.toLowerCase();
    const candidateFacts = [];

    if (lowerText.includes("subiaco")) {
      candidateFacts.push({
        field: "ADDRESS",
        proposedValue: "Subiaco",
        confidence: "MEDIUM",
        evidence: "may have moved to Subiaco",
        sourceRecordId: input.sourceRecordId,
        observedDate: input.observedDate,
        requiresHumanReview: true,
        reason: "The note describes the address as unconfirmed."
      });
    }

    if (
      lowerText.includes("growth-oriented") ||
      lowerText.includes("growth oriented")
    ) {
      candidateFacts.push({
        field: "RISK_PROFILE",
        proposedValue: "Growth-oriented",
        confidence: "MEDIUM",
        evidence: "considering a more growth-oriented investment approach",
        sourceRecordId: input.sourceRecordId,
        observedDate: input.observedDate,
        requiresHumanReview: true,
        reason: "Risk-profile changes are high impact."
      });
    }

    if (
      lowerText.includes("home purchase") &&
      lowerText.includes("near-term")
    ) {
      candidateFacts.push({
        field: "FINANCIAL_GOAL",
        proposedValue: "Home purchase remains a near-term priority",
        confidence: "MEDIUM",
        evidence: "home purchase remains a near-term priority",
        sourceRecordId: input.sourceRecordId,
        observedDate: input.observedDate,
        requiresHumanReview: true,
        reason:
          "The note supports a candidate goal update, but the verified annual review remains authoritative."
      });
    }

    return candidateFactExtractionResultSchema.parse({
      providerMode: "mock",
      model: null,
      candidateFacts,
      warnings: [],
      metadata: {
        durationMs: 0,
        sourceTextLength: input.meetingNoteText.length,
        candidateCount: candidateFacts.length
      }
    });
  }
}
