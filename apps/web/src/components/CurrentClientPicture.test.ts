import { describe, expect, it } from "vitest";
import { getFactDisplayModel } from "./CurrentClientPicture.js";
import type { ClientFact } from "../types/demo.js";

const createFact = (overrides: Partial<ClientFact>): ClientFact => ({
  id: "fact-address",
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
  candidateEvidence:
    "Alex may have moved to Subiaco, but the address has not been confirmed.",
  confidence: "Medium",
  lifecycleStatus: "NEEDS_CONFIRMATION",
  status: "Needs confirmation",
  memoryExplanation: "Demo explanation",
  ...overrides
});

describe("CurrentClientPicture display model", () => {
  it("displays Subiaco after CONFIRM", () => {
    expect(
      getFactDisplayModel(
        createFact({
          currentValue: "Subiaco",
          officialValue: "Subiaco",
          candidateValue: null,
          previousValue: "East Perth",
          lifecycleStatus: "CURRENT",
          status: "Current"
        })
      )
    ).toMatchObject({
      value: "Subiaco",
      previousValue: "East Perth",
      status: "Current"
    });
  });

  it("displays Growth-oriented after APPROVE", () => {
    expect(
      getFactDisplayModel(
        createFact({
          id: "fact-risk-profile",
          field: "Risk profile",
          currentLabel: "Official value",
          currentValue: "Growth-oriented",
          officialValue: "Growth-oriented",
          candidateValue: null,
          previousValue: "Balanced",
          lifecycleStatus: "CURRENT",
          status: "Current"
        })
      ).value
    ).toBe("Growth-oriented");
  });

  it("displays East Perth after LEAVE_UNVERIFIED", () => {
    expect(
      getFactDisplayModel(
        createFact({
          candidateValue: null,
          lifecycleStatus: "CURRENT",
          status: "Current"
        })
      ).value
    ).toBe("East Perth");
  });

  it("displays Balanced after KEEP_CURRENT", () => {
    expect(
      getFactDisplayModel(
        createFact({
          id: "fact-risk-profile",
          field: "Risk profile",
          currentLabel: "Official value",
          currentValue: "Balanced",
          officialValue: "Balanced",
          candidateValue: null,
          lifecycleStatus: "CURRENT",
          status: "Current"
        })
      ).value
    ).toBe("Balanced");
  });
});
