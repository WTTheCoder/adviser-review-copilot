export const canonicalRiskProfiles = [
  "Conservative",
  "Balanced",
  "Growth-oriented",
  "High Growth"
] as const;

export type CanonicalRiskProfile = (typeof canonicalRiskProfiles)[number];
export type RiskProfileIntent =
  | "SUPPORTED"
  | "REVIEWABLE"
  | "REJECTED"
  | "CONTRADICTORY";

export type RiskProfileEvidence = {
  proposedValue: CanonicalRiskProfile | null;
  evidence: string;
};

export type RiskProfileEvidenceClassification = {
  intent: RiskProfileIntent;
  candidate: CanonicalRiskProfile | null;
  evidence: string | null;
};

const normalizePhrase = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[‐‑‒–—-]/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");

const phraseMap: ReadonlyMap<string, CanonicalRiskProfile> = new Map([
  ["conservative", "Conservative"],
  ["more conservative", "Conservative"],
  ["balanced", "Balanced"],
  ["moderate", "Balanced"],
  ["growth", "Growth-oriented"],
  ["growth oriented", "Growth-oriented"],
  ["more growth oriented", "Growth-oriented"],
  ["more growth oriented investment approach", "Growth-oriented"],
  ["aggressive growth", "High Growth"],
  ["more aggressive growth strategy", "High Growth"],
  ["high growth", "High Growth"]
]);

const rejectedRiskIntentPatterns = [
  /\bdoes not want\b/,
  /\bdo not want\b/,
  /\bnot considering\b/,
  /\bnot comfortable with\b/,
  /\brejected\b/,
  /\bruled (?:it )?out\b/,
  /\bdecided against\b/,
  /\bno longer wants?\b/,
  /\bless growth oriented\b/,
  /\bremain balanced\b/,
  /\bstay balanced\b/,
  /\bstays balanced\b/,
  /\bkeep (?:the )?balanced(?: profile)?\b/,
  /\bretain (?:the )?balanced(?: profile)?\b/,
  /\bnot high growth\b/
];

const reviewableRiskIntentPatterns = [
  /\bconsidering\b/,
  /\bmay\b/,
  /\bmight\b/,
  /\bcould\b/,
  /\bpossible\b/
];

export const classifyRiskProfileIntent = (
  evidence: string
): Exclude<RiskProfileIntent, "CONTRADICTORY"> => {
  const normalizedEvidence = normalizePhrase(evidence);

  if (
    rejectedRiskIntentPatterns.some((pattern) =>
      pattern.test(normalizedEvidence)
    )
  ) {
    return "REJECTED";
  }

  if (
    reviewableRiskIntentPatterns.some((pattern) =>
      pattern.test(normalizedEvidence)
    )
  ) {
    return "REVIEWABLE";
  }

  return "SUPPORTED";
};

export const classifyRiskProfileEvidence = (
  evidenceItems: readonly RiskProfileEvidence[]
): RiskProfileEvidenceClassification => {
  const evaluated = evidenceItems.map((item) => ({
    ...item,
    intent: classifyRiskProfileIntent(item.evidence)
  }));
  const rejected = evaluated.some((item) => item.intent === "REJECTED");
  const positive = evaluated.filter(
    (
      item
    ): item is typeof item & {
      proposedValue: CanonicalRiskProfile;
      intent: "SUPPORTED" | "REVIEWABLE";
    } => item.proposedValue !== null && item.intent !== "REJECTED"
  );
  const proposedValues = new Set(
    positive.map((item) => item.proposedValue)
  );

  if (positive.length === 0) {
    return {
      intent: rejected ? "REJECTED" : "SUPPORTED",
      candidate: null,
      evidence: null
    };
  }

  if (rejected || proposedValues.size > 1) {
    return {
      intent: "CONTRADICTORY",
      candidate: null,
      evidence: null
    };
  }

  const supportingEvidence = positive[0];
  return {
    intent: positive.some((item) => item.intent === "REVIEWABLE")
      ? "REVIEWABLE"
      : "SUPPORTED",
    candidate: supportingEvidence?.proposedValue ?? null,
    evidence: supportingEvidence?.evidence ?? null
  };
};

export const normalizeRiskProfileCandidate = (input: {
  proposedValue: string;
  evidence: string;
}): CanonicalRiskProfile | null => {
  const normalizedProposedValue = normalizePhrase(input.proposedValue);
  const canonicalValue = phraseMap.get(normalizedProposedValue) ?? null;

  if (!canonicalValue) {
    return null;
  }

  if (
    classifyRiskProfileIntent(input.evidence) === "REJECTED"
  ) {
    return null;
  }

  return canonicalValue;
};
