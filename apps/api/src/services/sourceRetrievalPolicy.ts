import type { SourceRecordDto } from "@client-review-prep/shared";
import type { SupportedCandidateField } from "../ai/contracts/candidateFactSchemas.js";

export type RetrievedSource = {
  source: SourceRecordDto;
  relevantFields: SupportedCandidateField[];
  score: number;
  reasons: string[];
  fallback: boolean;
};

export const maxRetrievedSourceCount = 3;

type FieldHintPolicy = {
  field: SupportedCandidateField;
  hints: RegExp[];
};

const fieldHintPolicies: FieldHintPolicy[] = [
  {
    field: "ADDRESS",
    hints: [
      /\baddress\b/i,
      /\bmoved?\b/i,
      /\bmoving\b/i,
      /\bliving\b/i,
      /\bresidence\b/i,
      /\bsubiaco\b/i,
      /\bfremantle\b/i,
      /\bjoondalup\b/i,
      /\beast perth\b/i
    ]
  },
  {
    field: "RISK_PROFILE",
    hints: [
      /\brisk(?: profile)?\b/i,
      /\bbalanced\b/i,
      /\bconservative\b/i,
      /\bgrowth[- ]oriented\b/i,
      /\bhigh growth\b/i
    ]
  },
  {
    field: "FINANCIAL_GOAL",
    hints: [
      /\bfinancial goal\b/i,
      /\bgoal\b/i,
      /\bhome\b/i,
      /\bproperty\b/i,
      /\bretirement\b/i,
      /\btimeframe\b/i
    ]
  },
  {
    field: "EMPLOYMENT",
    hints: [
      /\bemployer\b/i,
      /\bjob\b/i,
      /\bemployment\b/i,
      /\brole\b/i,
      /\bcompany\b/i
    ]
  },
  {
    field: "ANNUAL_INCOME",
    hints: [
      /\bannual income\b/i,
      /\bincome\b/i,
      /\bsalary\b/i,
      /\bearnings\b/i
    ]
  },
  {
    field: "SUPERANNUATION",
    hints: [
      /\bsuperannuation\b/i,
      /\bsuper\b/i,
      /\bpension\b/i,
      /\bretirement balance\b/i
    ]
  }
];

const supportedFieldOrder = fieldHintPolicies.map((policy) => policy.field);

const normalizedTextFor = (source: SourceRecordDto) =>
  [
    source.title,
    source.summary,
    source.upload?.safeFilename ?? "",
    ...source.content
  ]
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();

const matchedFieldsFor = (
  source: SourceRecordDto,
  supportedFields: readonly SupportedCandidateField[]
) => {
  const sourceText = normalizedTextFor(source);
  const supported = new Set(supportedFields);

  return fieldHintPolicies
    .filter((policy) => supported.has(policy.field))
    .flatMap((policy) =>
      policy.hints.some((hint) => hint.test(sourceText)) ? [policy.field] : []
    );
};

const sourceTypeBoostFor = (source: SourceRecordDto) => {
  if (source.upload) {
    return 2;
  }

  if (source.type === "ADVISER_MEETING_NOTE") {
    return 2;
  }

  if (source.type === "ANNUAL_REVIEW") {
    return 1;
  }

  return 0;
};

const scoreFor = (
  source: SourceRecordDto,
  relevantFields: readonly SupportedCandidateField[]
) => {
  if (relevantFields.length === 0) {
    return 0;
  }

  return relevantFields.length * 10 + sourceTypeBoostFor(source);
};

const isExtractionEligibleSource = (source: SourceRecordDto) =>
  source.type === "ADVISER_MEETING_NOTE" ||
  source.upload !== null && source.upload !== undefined;

const sourceTime = (source: SourceRecordDto) => {
  const parsed = Date.parse(source.observedAt);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortRetrievedSources = (sources: RetrievedSource[]) =>
  [...sources].sort((first, second) => {
    if (first.score !== second.score) {
      return second.score - first.score;
    }

    const observedDifference =
      sourceTime(second.source) - sourceTime(first.source);
    if (observedDifference !== 0) {
      return observedDifference;
    }

    return first.source.id.localeCompare(second.source.id);
  });

const fallbackCandidates = (sourceRecords: readonly SourceRecordDto[]) =>
  [...sourceRecords]
    .filter(isExtractionEligibleSource)
    .sort((first, second) => {
      const observedDifference = sourceTime(second) - sourceTime(first);
      if (observedDifference !== 0) {
        return observedDifference;
      }

      const firstUploaded = first.id.startsWith("source-upload-");
      const secondUploaded = second.id.startsWith("source-upload-");
      if (firstUploaded !== secondUploaded) {
        return firstUploaded ? -1 : 1;
      }

      return first.id.localeCompare(second.id);
    });

export const selectRelevantSources = (
  sourceRecords: readonly SourceRecordDto[],
  supportedFields: readonly SupportedCandidateField[] = supportedFieldOrder,
  maxSources = maxRetrievedSourceCount
): RetrievedSource[] => {
  const scored = sourceRecords
    .filter(isExtractionEligibleSource)
    .flatMap<RetrievedSource>((source) => {
      const relevantFields = matchedFieldsFor(source, supportedFields);
      const score = scoreFor(source, relevantFields);

      if (score === 0) {
        return [];
      }

      return {
        source,
        relevantFields,
        score,
        reasons: relevantFields.map((field) => `${field} hint matched`),
        fallback: false
      };
    });

  const selected = sortRetrievedSources(scored).slice(0, maxSources);
  if (selected.length > 0 || maxSources <= 0) {
    return selected;
  }

  const fallback = fallbackCandidates(sourceRecords)[0];
  if (!fallback) {
    return [];
  }

  return [
    {
      source: fallback,
      relevantFields: [...supportedFields],
      score: 0,
      reasons: ["No deterministic field hints matched; latest eligible source selected"],
      fallback: true
    }
  ];
};
