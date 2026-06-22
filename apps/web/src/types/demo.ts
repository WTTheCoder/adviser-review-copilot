export type SourceRecordId = "legacy-crm" | "annual-review" | "meeting-note";

export type FactStatus =
  | "Current"
  | "Superseded"
  | "Needs confirmation"
  | "Requires adviser approval";

export type Confidence = "High" | "Medium" | "Low";

export type SourceRecord = {
  id: SourceRecordId;
  title: string;
  observedDate: string;
  summary: string;
  content: string[];
};

export type ClientFact = {
  id: string;
  field: string;
  currentLabel: string;
  currentValue: string;
  previousValue?: string;
  candidateValue?: string;
  status: FactStatus;
  sourceRecordId: SourceRecordId;
  sourceDocument: string;
  observedDate: string;
  confidence: Confidence;
  memoryExplanation: string;
};

export type SummaryMetric = {
  label: string;
  value: string;
};

export type AdviserActionId = "confirm-address" | "review-risk-profile";

export type ActionDecision = "pending" | "approved" | "kept-current" | "confirmed" | "unverified";

export type AdviserAction = {
  id: AdviserActionId;
  title: string;
  detail: string;
  status: FactStatus;
  primaryDecision: ActionDecision;
  secondaryDecision: ActionDecision;
  primaryLabel: string;
  secondaryLabel: string;
};

export type ExecutionTraceItem = {
  label: string;
  status: "Complete" | "Escalated";
};

export type ClientReviewDemo = {
  clientName: string;
  reviewName: string;
  adviserName: string;
  reviewStatus: string;
  summaryMetrics: SummaryMetric[];
  clientFacts: ClientFact[];
  meaningfulChanges: string[];
  adviserActions: AdviserAction[];
};
