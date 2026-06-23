export const canonicalRiskProfiles = [
  "Conservative",
  "Balanced",
  "Growth-oriented",
  "High Growth"
] as const;

export type CanonicalRiskProfile = (typeof canonicalRiskProfiles)[number];

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
  ["high growth", "High Growth"]
]);

const negatedOrConflictingGrowthPatterns = [
  /\bdoes not want\b.*\bgrowth\b/,
  /\bdo not want\b.*\bgrowth\b/,
  /\bnot\b.*\bgrowth\b/,
  /\bless growth oriented\b/,
  /\bremain balanced\b/,
  /\bwants to remain balanced\b/,
  /\bwant to remain balanced\b/,
  /\bnot high growth\b/
];

const isGrowthProfile = (value: CanonicalRiskProfile) =>
  value === "Growth-oriented" || value === "High Growth";

export const normalizeRiskProfileCandidate = (input: {
  proposedValue: string;
  evidence: string;
}): CanonicalRiskProfile | null => {
  const normalizedProposedValue = normalizePhrase(input.proposedValue);
  const canonicalValue = phraseMap.get(normalizedProposedValue) ?? null;

  if (!canonicalValue) {
    return null;
  }

  const normalizedEvidence = normalizePhrase(input.evidence);
  const combinedText = `${normalizedProposedValue} ${normalizedEvidence}`;

  if (
    isGrowthProfile(canonicalValue) &&
    negatedOrConflictingGrowthPatterns.some((pattern) => pattern.test(combinedText))
  ) {
    return null;
  }

  return canonicalValue;
};
