import type {
  CandidateFactExtractionResult,
  SupportedCandidateField
} from "./candidateFactSchemas.js";

export type CandidateFactExtractionInput = {
  clientId: string;
  clientDisplayName: string;
  sourceRecordId: string;
  sourceType: "ADVISER_MEETING_NOTE" | "UPLOADED_PDF";
  observedDate: string;
  meetingNoteText: string;
  supportedFields: readonly SupportedCandidateField[];
};

export type CandidateFactExtractor = {
  extract: (
    input: CandidateFactExtractionInput
  ) => Promise<CandidateFactExtractionResult>;
};
