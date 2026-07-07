import { describe, expect, it } from "vitest";
import type { ClientFact, ClientReviewData } from "../types/demo.js";
import {
  adviserViewFromHash,
  canonicalHashForAdviserHash,
  hashForAdviserView,
  openClientReviewState
} from "./adviserViews.js";

const createFact = (id: string): ClientFact => ({
  id,
  field: "Address",
  currentLabel: "Current official value",
  currentValue: "East Perth",
  officialValue: "East Perth",
  candidateValue: "Subiaco",
  previousValue: null,
  sourceRecordId: "source-annual-review",
  sourceDocument: "Annual Review",
  observedAt: "2025-11-16T00:00:00.000Z",
  observedDate: "16 November 2025",
  officialSourceRecordId: "source-annual-review",
  officialSourceDocument: "Annual Review",
  officialObservedAt: "2025-11-16T00:00:00.000Z",
  officialObservedDate: "16 November 2025",
  previousSourceRecordId: null,
  previousSourceDocument: null,
  previousObservedAt: null,
  previousObservedDate: null,
  candidateSourceRecordId: "source-meeting-note",
  candidateSourceDocument: "Adviser Meeting Note",
  candidateObservedAt: "2026-06-04T00:00:00.000Z",
  candidateObservedDate: "4 June 2026",
  candidateEvidence: null,
  confidence: "Medium",
  lifecycleStatus: "NEEDS_CONFIRMATION",
  status: "Needs confirmation",
  memoryExplanation: "Address remains pending adviser confirmation."
});

const review = {
  clientFacts: [createFact("fact-address"), createFact("fact-risk-profile")]
} as ClientReviewData;

describe("adviser view state", () => {
  it("opens Client Review and selects the requested fact", () => {
    expect(openClientReviewState(review, "fact-risk-profile")).toEqual({
      activeView: "client-review",
      selectedFact: review.clientFacts[1]
    });
  });

  it("opens Client Review without a selected fact when no fact applies", () => {
    expect(openClientReviewState(review)).toEqual({
      activeView: "client-review",
      selectedFact: null
    });
    expect(openClientReviewState(review, "missing-fact")).toEqual({
      activeView: "client-review",
      selectedFact: null
    });
  });

  it("maps adviser views to stable URL hashes", () => {
    expect(hashForAdviserView("dashboard")).toBe("#overview");
    expect(hashForAdviserView("my-actions")).toBe("#my-actions");
    expect(hashForAdviserView("client-review")).toBe("#client-review");
  });

  it("restores adviser views from hashes with Overview fallback", () => {
    expect(adviserViewFromHash("#overview")).toBe("dashboard");
    expect(adviserViewFromHash("#my-actions")).toBe("my-actions");
    expect(adviserViewFromHash("#client-review")).toBe("client-review");
    expect(adviserViewFromHash("#unknown")).toBe("dashboard");
    expect(adviserViewFromHash("")).toBe("dashboard");
  });

  it("canonicalises invalid hashes to Overview", () => {
    expect(canonicalHashForAdviserHash("#invalid")).toBe("#overview");
    expect(canonicalHashForAdviserHash("")).toBe("#overview");
    expect(canonicalHashForAdviserHash("#my-actions")).toBe("#my-actions");
  });
});
