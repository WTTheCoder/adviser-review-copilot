import type {
  AdviserActionDto,
  ClientFactDto,
  DecisionType,
  ReviewResponse,
  SourceRecordDto
} from "@client-review-prep/shared";

export type SourceRecord = SourceRecordDto;
export type ClientFact = ClientFactDto;
export type AdviserAction = AdviserActionDto;
export type ClientReviewData = ReviewResponse;
export type ActionDecision = DecisionType;

export type SummaryMetric = {
  label: string;
  value: string;
};

export type ExecutionTraceItem = {
  label: string;
  status: "COMPLETE" | "ESCALATED" | "FAILED";
  detail: string | null;
};
