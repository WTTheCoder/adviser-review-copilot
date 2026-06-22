import type {
  ClientReviewDemo,
  ExecutionTraceItem,
  SourceRecord
} from "../types/demo.js";

export const sourceRecords: SourceRecord[] = [
  {
    id: "legacy-crm",
    title: "Legacy CRM Record",
    observedDate: "10 May 2023",
    summary: "Original CRM profile used as historical baseline.",
    content: [
      "Employer: ABC Mining",
      "Annual income: AUD 110,000",
      "Superannuation balance: AUD 125,000",
      "Address: East Perth",
      "Financial goal: Buy a home within five years",
      "Risk profile: Balanced"
    ]
  },
  {
    id: "annual-review",
    title: "Annual Review",
    observedDate: "16 November 2025",
    summary: "Verified annual-review record replacing several older CRM facts.",
    content: [
      "Employer: New Energy Ltd",
      "Annual income: AUD 135,000",
      "Superannuation balance: AUD 174,000",
      "Financial goal: Buy a home within two years",
      "Risk profile remains Balanced"
    ]
  },
  {
    id: "meeting-note",
    title: "Adviser Meeting Note",
    observedDate: "4 June 2026",
    summary: "Recent adviser note containing candidate changes for review.",
    content: [
      "Alex is considering a more growth-oriented investment approach.",
      "Alex may have moved to Subiaco, but the address has not been confirmed.",
      "The home purchase remains a near-term priority."
    ]
  }
];

export const demoClientReview: ClientReviewDemo = {
  clientName: "Alex Taylor",
  reviewName: "2026 Annual Review",
  adviserName: "Jordan Lee",
  reviewStatus: "Preparation in progress",
  summaryMetrics: [
    { value: "12", label: "Facts reviewed" },
    { value: "4", label: "Meaningful changes" },
    { value: "2", label: "Items needing confirmation" }
  ],
  clientFacts: [
    {
      id: "employment",
      field: "Employment",
      currentLabel: "Current",
      currentValue: "New Energy Ltd",
      previousValue: "ABC Mining",
      status: "Current",
      sourceRecordId: "annual-review",
      sourceDocument: "Annual Review",
      observedDate: "16 November 2025",
      confidence: "High",
      memoryExplanation:
        "The newer verified employment record replaced the 2023 CRM value. The older employer remains in history but is no longer used as the current client state."
    },
    {
      id: "annual-income",
      field: "Annual income",
      currentLabel: "Current",
      currentValue: "AUD 135,000",
      previousValue: "AUD 110,000",
      status: "Current",
      sourceRecordId: "annual-review",
      sourceDocument: "Annual Review",
      observedDate: "16 November 2025",
      confidence: "High",
      memoryExplanation:
        "The newer verified income record replaced the 2023 CRM value. The earlier income remains available as historical context for the annual review."
    },
    {
      id: "superannuation",
      field: "Superannuation",
      currentLabel: "Current",
      currentValue: "AUD 174,000",
      previousValue: "AUD 125,000",
      status: "Current",
      sourceRecordId: "annual-review",
      sourceDocument: "Annual Review",
      observedDate: "16 November 2025",
      confidence: "High",
      memoryExplanation:
        "The 2025 annual review provides the current superannuation balance while the 2023 CRM value is retained as superseded history."
    },
    {
      id: "address",
      field: "Address",
      currentLabel: "Current official value",
      currentValue: "East Perth",
      candidateValue: "Subiaco",
      status: "Needs confirmation",
      sourceRecordId: "meeting-note",
      sourceDocument: "Adviser Meeting Note",
      observedDate: "4 June 2026",
      confidence: "Medium",
      memoryExplanation:
        "The Subiaco address remains a candidate fact because it was not verified. East Perth stays as the official value until an adviser confirms the change."
    },
    {
      id: "financial-goal",
      field: "Financial goal",
      currentLabel: "Current",
      currentValue: "Buy a home within two years",
      previousValue: "Buy a home within five years",
      status: "Current",
      sourceRecordId: "annual-review",
      sourceDocument: "Annual Review",
      observedDate: "16 November 2025",
      confidence: "High",
      memoryExplanation:
        "The 2025 annual review shortened the home-buying timeframe. The earlier five-year goal is retained as superseded historical context."
    },
    {
      id: "risk-profile",
      field: "Risk profile",
      currentLabel: "Official value",
      currentValue: "Balanced",
      candidateValue: "Growth-oriented",
      status: "Requires adviser approval",
      sourceRecordId: "meeting-note",
      sourceDocument: "Adviser Meeting Note",
      observedDate: "4 June 2026",
      confidence: "Medium",
      memoryExplanation:
        "The risk-profile change requires adviser approval because it is a high-impact client attribute. The Balanced profile remains official until reviewed."
    }
  ],
  meaningfulChanges: [
    "Employer changed from ABC Mining to New Energy Ltd",
    "Annual income increased from AUD 110,000 to AUD 135,000",
    "Superannuation increased from AUD 125,000 to AUD 174,000",
    "Home-buying timeframe changed from five years to two years"
  ],
  adviserActions: [
    {
      id: "confirm-address",
      title: "Confirm whether Alex has moved to Subiaco",
      detail: "Meeting note mentions Subiaco, but the address has not been verified.",
      status: "Needs confirmation",
      primaryDecision: "confirmed",
      secondaryDecision: "unverified",
      primaryLabel: "Confirm",
      secondaryLabel: "Leave unverified"
    },
    {
      id: "review-risk-profile",
      title: "Review the possible change from Balanced to a growth-oriented risk approach",
      detail: "This is a high-impact attribute and needs adviser approval before use.",
      status: "Requires adviser approval",
      primaryDecision: "approved",
      secondaryDecision: "kept-current",
      primaryLabel: "Approve",
      secondaryLabel: "Keep current"
    }
  ]
};

export const executionTrace: ExecutionTraceItem[] = [
  { label: "Loaded legacy CRM record", status: "Complete" },
  { label: "Read 2025 annual review", status: "Complete" },
  { label: "Read 2026 adviser meeting note", status: "Complete" },
  { label: "Extracted candidate facts", status: "Complete" },
  { label: "Validated structured data", status: "Complete" },
  { label: "Reconciled current and historical facts", status: "Complete" },
  { label: "Escalated high-impact changes for adviser review", status: "Escalated" },
  { label: "Generated annual-review preparation brief", status: "Complete" }
];
