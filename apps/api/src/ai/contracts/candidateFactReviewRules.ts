import type {
  CandidateFact,
  TrustedCandidateFact
} from "./candidateFactSchemas.js";
import { normalizeRiskProfileCandidate } from "../../domain/riskProfile.js";

export type CandidateReviewClassification = {
  field: CandidateFact["field"];
  proposedValue: string;
  evidence: string;
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

export type CandidateFactReconciliationContext = {
  field: CandidateFact["field"];
  officialValue: string;
  officialObservedAt: string | null;
};

export const attachTrustedCandidateProvenance = (
  candidates: readonly CandidateFact[],
  provenance: Pick<TrustedCandidateFact, "sourceRecordId" | "observedDate">
): TrustedCandidateFact[] =>
  candidates.map((candidate) => ({
    ...candidate,
    sourceRecordId: provenance.sourceRecordId,
    observedDate: provenance.observedDate
  }));

const normalizeGenericValue = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const normalizeAddressValue = (value: string) => {
  const normalized = normalizeGenericValue(value);
  const knownAddresses = new Map([
    ["subiaco", "Subiaco"],
    ["fremantle", "Fremantle"],
    ["joondalup", "Joondalup"],
    ["east perth", "East Perth"]
  ]);

  return knownAddresses.get(normalized) ?? value.trim();
};

const normalizeCandidateValue = (candidate: TrustedCandidateFact) => {
  if (candidate.field === "RISK_PROFILE") {
    return normalizeRiskProfileCandidate({
      proposedValue: candidate.proposedValue,
      evidence: candidate.evidence
    });
  }

  if (candidate.field === "ADDRESS") {
    return normalizeAddressValue(candidate.proposedValue);
  }

  return candidate.proposedValue.trim();
};

const normalizeOfficialValue = (
  field: CandidateFact["field"],
  officialValue: string
) => {
  if (field === "RISK_PROFILE") {
    return normalizeRiskProfileCandidate({
      proposedValue: officialValue,
      evidence: officialValue
    });
  }

  if (field === "ADDRESS") {
    return normalizeAddressValue(officialValue);
  }

  return officialValue.trim();
};

const compareCalendarDates = (
  first: string | null,
  second: string | null
): -1 | 0 | 1 | null => {
  if (!first || !second) {
    return null;
  }

  const firstTime = Date.parse(`${first.slice(0, 10)}T00:00:00.000Z`);
  const secondTime = Date.parse(`${second.slice(0, 10)}T00:00:00.000Z`);

  if (Number.isNaN(firstTime) || Number.isNaN(secondTime)) {
    return null;
  }

  if (firstTime < secondTime) {
    return -1;
  }

  if (firstTime > secondTime) {
    return 1;
  }

  return 0;
};

const candidateDateTime = (candidate: TrustedCandidateFact) => {
  const parsed = Date.parse(`${candidate.observedDate.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const confidenceRank: Record<TrustedCandidateFact["confidence"], number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3
};

type EvaluatedCandidate = {
  candidate: TrustedCandidateFact;
  normalizedValue: string;
};

const selectRepresentativeAssertion = (
  items: readonly EvaluatedCandidate[]
) =>
  [...items].sort((first, second) => {
    const dateDifference =
      candidateDateTime(second.candidate) - candidateDateTime(first.candidate);
    if (dateDifference !== 0) {
      return dateDifference;
    }

    const confidenceDifference =
      confidenceRank[second.candidate.confidence] -
      confidenceRank[first.candidate.confidence];
    if (confidenceDifference !== 0) {
      return confidenceDifference;
    }

    return first.candidate.sourceRecordId.localeCompare(
      second.candidate.sourceRecordId
    );
  })[0];

const mergeEvidence = (candidates: readonly TrustedCandidateFact[]) =>
  [...new Set(candidates.map((candidate) => candidate.evidence.trim()).filter(Boolean))]
    .sort((first, second) => first.localeCompare(second))
    .slice(0, 3)
    .join(" | ");

const warningFor = (
  field: CandidateFact["field"],
  reason: string,
  evidence: string
) => `${field} candidate omitted: ${reason}${evidence ? ` Evidence: ${evidence}` : ""}`;

export const reconcileCandidateFactsWithDiagnostics = (
  candidates: readonly TrustedCandidateFact[],
  contexts: readonly CandidateFactReconciliationContext[]
): CandidateReviewClassificationResult => {
  const warnings: string[] = [];
  const contextByField = new Map(contexts.map((context) => [context.field, context]));
  const candidatesByField = new Map<CandidateFact["field"], TrustedCandidateFact[]>();

  for (const candidate of candidates) {
    const existing = candidatesByField.get(candidate.field) ?? [];
    existing.push(candidate);
    candidatesByField.set(candidate.field, existing);
  }

  const reconciled: TrustedCandidateFact[] = [];

  for (const [field, fieldCandidates] of candidatesByField) {
    const context = contextByField.get(field);
    const officialNormalized = context
      ? normalizeOfficialValue(field, context.officialValue)
      : null;
    const evaluated = fieldCandidates.flatMap((candidate) => {
      const normalizedValue =
        normalizeCandidateValue(candidate) ??
        (officialNormalized
          ? normalizeOfficialValue(field, candidate.proposedValue)
          : null);

      if (!normalizedValue) {
        warnings.push(
          warningFor(
            field,
            "unsupported or rejected value",
            candidate.evidence
          )
        );
        return [];
      }

      return [{ candidate, normalizedValue }];
    });

    if (evaluated.length === 0) {
      continue;
    }

    const officialSupport = officialNormalized
      ? evaluated.filter(
          (item) =>
            normalizeGenericValue(item.normalizedValue) ===
            normalizeGenericValue(officialNormalized)
        )
      : [];
    const changeItems = officialNormalized
      ? evaluated.filter(
          (item) =>
            normalizeGenericValue(item.normalizedValue) !==
            normalizeGenericValue(officialNormalized)
        )
      : evaluated;

    if (changeItems.length === 0) {
      continue;
    }

    if (!context || !officialNormalized) {
      const changeValues = new Set(
        changeItems.map((item) => normalizeGenericValue(item.normalizedValue))
      );

      if (changeValues.size > 1) {
        warnings.push(
          warningFor(field, "multiple proposed values conflict", mergeEvidence(fieldCandidates))
        );
        continue;
      }

      const representative = selectRepresentativeAssertion(changeItems);
      const normalizedValue = representative?.normalizedValue;
      const source = representative?.candidate;

      if (normalizedValue && source) {
        reconciled.push({
          ...source,
          proposedValue: normalizedValue,
          evidence: mergeEvidence(changeItems.map((item) => item.candidate))
        });
      }
      continue;
    }

    const combinedEvidence = mergeEvidence(
      evaluated.map((item) => item.candidate)
    );
    const changeValues = new Set(
      changeItems.map((item) => normalizeGenericValue(item.normalizedValue))
    );

    if (changeValues.size > 1) {
      warnings.push(
        warningFor(field, "multiple proposed values conflict", combinedEvidence)
      );
      continue;
    }

    const representative = selectRepresentativeAssertion(changeItems);
    const normalizedValue = representative?.normalizedValue;
    const source = representative?.candidate;

    if (!normalizedValue || !source) {
      continue;
    }

    const freshness = compareCalendarDates(
      source.observedDate,
      context?.officialObservedAt ?? null
    );

    if (freshness === null) {
      warnings.push(
        warningFor(field, "source freshness is unclear", combinedEvidence)
      );
      continue;
    }

    if (freshness === -1) {
      warnings.push(
        warningFor(
          field,
          "source is older than the current official source",
          combinedEvidence
        )
      );
      continue;
    }

    if (freshness === 0) {
      warnings.push(
        warningFor(
          field,
          "conflicts with official value on the same source date",
          combinedEvidence
        )
      );
      continue;
    }

    if (officialSupport.length > 0) {
      warnings.push(
        warningFor(
          field,
          "conflicting evidence also supports the current official value",
          combinedEvidence
        )
      );
      continue;
    }

    reconciled.push({
      ...source,
      proposedValue: normalizedValue,
      evidence: mergeEvidence(changeItems.map((item) => item.candidate))
    });
  }

  const classification = classifyCandidateFactsWithDiagnostics(reconciled);

  return {
    classifications: classification.classifications,
    warnings: [...warnings, ...classification.warnings]
  };
};

export const classifyCandidateFactsWithDiagnostics = (
  candidates: readonly TrustedCandidateFact[]
): CandidateReviewClassificationResult => {
  const warnings: string[] = [];
  const classifications = candidates.flatMap<CandidateReviewClassification>((candidate) => {
    if (candidate.field === "ADDRESS") {
      return {
        field: candidate.field,
        proposedValue: candidate.proposedValue,
        evidence: candidate.evidence,
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
        evidence: candidate.evidence,
        sourceRecordId: candidate.sourceRecordId,
        observedDate: candidate.observedDate,
        applicationStatus: "REQUIRES_ADVISER_APPROVAL",
        requiresHumanReview: true
      };
    }

    return {
      field: candidate.field,
      proposedValue: candidate.proposedValue,
      evidence: candidate.evidence,
      sourceRecordId: candidate.sourceRecordId,
      observedDate: candidate.observedDate,
      applicationStatus: "CANDIDATE_REVIEW",
      requiresHumanReview: true
    };
  });

  return { classifications, warnings };
};

export const classifyCandidateFacts = (
  candidates: readonly TrustedCandidateFact[]
): CandidateReviewClassification[] =>
  classifyCandidateFactsWithDiagnostics(candidates).classifications;
