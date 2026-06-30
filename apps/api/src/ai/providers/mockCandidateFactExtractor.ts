import {
  candidateFactExtractionResultSchema,
  MAX_EVIDENCE_CHARS,
  MAX_MEETING_NOTE_CHARS
} from "../contracts/candidateFactSchemas.js";
import type {
  CandidateFactExtractionInput,
  CandidateFactExtractor
} from "../contracts/candidateFactExtractor.js";
import { AiError } from "../errors/aiErrors.js";
import {
  classifyRiskProfileEvidence,
  normalizeRiskProfileCandidate,
  type CanonicalRiskProfile
} from "../../domain/riskProfile.js";

const sentenceContexts = (text: string) =>
  text
    .replace(/\r\n?/g, "\n")
    .split(/\n|(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const boundedSentenceContext = (
  sentence: string,
  matchIndex: number,
  matchLength: number
) => {
  if (sentence.length <= MAX_EVIDENCE_CHARS) {
    return sentence;
  }

  const contextBeforeMatch = 100;
  const start = Math.max(
    0,
    Math.min(
      matchIndex - contextBeforeMatch,
      sentence.length - MAX_EVIDENCE_CHARS
    )
  );
  const end = Math.min(
    sentence.length,
    Math.max(start + MAX_EVIDENCE_CHARS, matchIndex + matchLength)
  );

  return sentence.slice(start, end).trim();
};

const riskProfilePatterns: ReadonlyArray<{
  value: CanonicalRiskProfile;
  pattern: RegExp;
}> = [
  {
    value: "High Growth",
    pattern:
      /\b(?:considering(?: changing)? to|considering|may (?:move|prefer)|move to|moving to|expressed interest in(?: moving to)?)\s+(?:a\s+)?high growth(?: risk profile)?\b/i
  },
  {
    value: "High Growth",
    pattern:
      /\bconsidering moving from balanced to high growth\b|\bmore aggressive growth strategy\b/i
  },
  {
    value: "Growth-oriented",
    pattern:
      /\bmay prefer\s+(?:a\s+)?(?:more\s+)?growth[- ]oriented(?: investment approach)?\b|\b(?:more\s+)?growth[- ]oriented(?: investment approach)?\b/i
  },
  {
    value: "Conservative",
    pattern:
      /\b(?:considering|may prefer|expressed interest in)\s+(?:a\s+)?conservative(?: risk profile)?\b|\bmore conservative(?: investment approach)?\b/i
  }
];

const explicitRiskLanguage =
  /\b(?:conservative|balanced|growth[- ]oriented|high growth|aggressive growth|risk profile)\b/i;
const rejectionLanguage =
  /\b(?:does not want|do not want|not considering|not comfortable with|rejected|ruled (?:it )?out|decided against|no longer wants?|less growth[- ]oriented|remain balanced|stay balanced|keep (?:the )?balanced|retain (?:the )?balanced)\b/i;
const refersToPriorProposal = /\b(?:it|that option|that profile)\b/i;

const collectRiskProfileEvidence = (text: string) => {
  const evidenceItems: Array<{
    proposedValue: CanonicalRiskProfile | null;
    evidence: string;
  }> = [];
  let hasPriorProposal = false;

  for (const sentence of sentenceContexts(text)) {
    let matchedProposal = false;
    for (const candidate of riskProfilePatterns) {
      const match = sentence.match(candidate.pattern);
      if (match && match.index !== undefined) {
        evidenceItems.push({
          proposedValue: candidate.value,
          evidence: boundedSentenceContext(
            sentence,
            match.index,
            match[0].length
          )
        });
        matchedProposal = true;
        hasPriorProposal = true;
        break;
      }
    }

    if (
      !matchedProposal &&
      rejectionLanguage.test(sentence) &&
      (explicitRiskLanguage.test(sentence) ||
        (hasPriorProposal && refersToPriorProposal.test(sentence)))
    ) {
      evidenceItems.push({
        proposedValue: null,
        evidence: boundedSentenceContext(sentence, 0, sentence.length)
      });
    }
  }

  return evidenceItems;
};

const addressPatterns: ReadonlyArray<{
  value: string;
  pattern: RegExp;
}> = [
  {
    value: "Joondalup",
    pattern:
      /\b(?:moved to|may have moved to|new address is (?:in|at)|now living in|is now living in)\s+joondalup\b/i
  },
  {
    value: "Fremantle",
    pattern:
      /\b(?:moved to|may have moved to|new address is (?:in|at)|now living in|is now living in)\s+fremantle\b/i
  },
  {
    value: "Subiaco",
    pattern:
      /\b(?:moved to|may have moved to|new address is (?:in|at)|now living in|is now living in)\s+subiaco\b/i
  }
];

const explicitAddressLanguage =
  /\b(?:address|moved?|moving|living|lives|subiaco|fremantle|joondalup|east perth)\b/i;
const addressRejectionLanguage =
  /\b(?:did not move|has not moved|not moved|not moving|not living in|no address change|address (?:has )?not changed|remains? in|stays? in|stayed in|still in|still living in|current address remains|considered, but|discussed, but|however)\b/i;

const collectAddressEvidence = (text: string) => {
  const evidenceItems: Array<{
    proposedValue: string | null;
    evidence: string;
  }> = [];

  for (const sentence of sentenceContexts(text)) {
    if (
      explicitAddressLanguage.test(sentence) &&
      addressRejectionLanguage.test(sentence)
    ) {
      evidenceItems.push({
        proposedValue: null,
        evidence: boundedSentenceContext(sentence, 0, sentence.length)
      });
      continue;
    }

    for (const candidate of addressPatterns) {
      const match = sentence.match(candidate.pattern);
      if (match && match.index !== undefined) {
        evidenceItems.push({
          proposedValue: candidate.value,
          evidence: boundedSentenceContext(
            sentence,
            match.index,
            match[0].length
          )
        });
        break;
      }
    }
  }

  return evidenceItems;
};

const classifyAddressEvidence = (
  evidenceItems: readonly {
    proposedValue: string | null;
    evidence: string;
  }[]
) => {
  const positive = evidenceItems.filter(
    (item): item is { proposedValue: string; evidence: string } =>
      item.proposedValue !== null
  );
  const rejected = evidenceItems.some((item) => item.proposedValue === null);
  const proposedValues = new Set(positive.map((item) => item.proposedValue));

  if (positive.length === 0 || rejected || proposedValues.size > 1) {
    return null;
  }

  return {
    candidate: positive[0]?.proposedValue ?? null,
    evidence: [...new Set(positive.map((item) => item.evidence))]
      .sort((first, second) => first.localeCompare(second))
      .slice(0, 3)
      .join(" | ")
  };
};

export class MockCandidateFactExtractor implements CandidateFactExtractor {
  async extract(input: CandidateFactExtractionInput) {
    if (input.meetingNoteText.length > MAX_MEETING_NOTE_CHARS) {
      throw new AiError("AI_INPUT_TOO_LARGE");
    }

    const lowerText = input.meetingNoteText.toLowerCase();
    const candidateFacts = [];

    const address = classifyAddressEvidence(
      collectAddressEvidence(input.meetingNoteText)
    );

    if (address?.candidate && address.evidence) {
      candidateFacts.push({
        field: "ADDRESS",
        proposedValue: address.candidate,
        confidence: "MEDIUM",
        evidence: address.evidence,
        requiresHumanReview: true,
        reason: "The note describes the address as unconfirmed."
      });
    }

    const riskProfileEvidence = collectRiskProfileEvidence(
      input.meetingNoteText
    );
    const normalizedEvidence = riskProfileEvidence.map((item) => ({
      proposedValue: item.proposedValue
        ? normalizeRiskProfileCandidate({
            proposedValue: item.proposedValue,
            evidence: item.evidence
          })
        : null,
      evidence: item.evidence
    }));
    const riskProfile = classifyRiskProfileEvidence(normalizedEvidence);

    if (riskProfile.candidate && riskProfile.evidence) {
      candidateFacts.push({
        field: "RISK_PROFILE",
        proposedValue: riskProfile.candidate,
        confidence: "MEDIUM",
        evidence: riskProfile.evidence,
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
