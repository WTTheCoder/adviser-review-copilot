import type { CandidateFact } from "./candidateFactSchemas.js";
import { normalizeRiskProfileCandidate } from "../../domain/riskProfile.js";

export type CandidateReviewClassification = {
  field: CandidateFact["field"];
  proposedValue: string;
  sourceRecordId: string;
  observedDate: string;
  applicationStatus:
    | "NEEDS_CONFIRMATION"
    | "REQUIRES_ADVISER_APPROVAL"
    | "CANDIDATE_REVIEW";
  requiresHumanReview: true;
};

export type CandidateReviewClassificationResult = {
  classifications: CandidateReviewClassification[];
  warnings: string[];
};

export const classifyCandidateFactsWithDiagnostics = (
  candidates: readonly CandidateFact[]
): CandidateReviewClassificationResult => {
  const warnings: string[] = [];
  const classifications = candidates.flatMap<CandidateReviewClassification>((candidate) => {
    if (candidate.field === "ADDRESS") {
      return {
        field: candidate.field,
        proposedValue: candidate.proposedValue,
        sourceRecordId: candidate.sourceRecordId,
        observedDate: candidate.observedDate,
        applicationStatus: "NEEDS_CONFIRMATION",
        requiresHumanReview: true
      };
    }

    if (candidate.field === "RISK_PROFILE") {
      const normalizedRiskProfile = normalizeRiskProfileCandidate({
        proposedValue: candidate.proposedValue,
        evidence: candidate.evidence
      });

      if (!normalizedRiskProfile) {
        warnings.push(
          "Unsupported risk-profile candidate omitted before projection."
        );
        return [];
      }

      return {
        field: candidate.field,
        proposedValue: normalizedRiskProfile,
        sourceRecordId: candidate.sourceRecordId,
        observedDate: candidate.observedDate,
        applicationStatus: "REQUIRES_ADVISER_APPROVAL",
        requiresHumanReview: true
      };
    }

    return {
      field: candidate.field,
      proposedValue: candidate.proposedValue,
      sourceRecordId: candidate.sourceRecordId,
      observedDate: candidate.observedDate,
      applicationStatus: "CANDIDATE_REVIEW",
      requiresHumanReview: true
    };
  });

  return { classifications, warnings };
};

export const classifyCandidateFacts = (
  candidates: readonly CandidateFact[]
): CandidateReviewClassification[] =>
  classifyCandidateFactsWithDiagnostics(candidates).classifications;
