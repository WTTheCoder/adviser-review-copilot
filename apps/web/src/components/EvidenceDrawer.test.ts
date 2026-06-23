import { describe, expect, it } from "vitest";
import { getEvidenceExplanation } from "../domain/factPresentation.js";
import type { AdviserAction, ClientFact } from "../types/demo.js";

const staleAddressPhrase = "remains a candidate fact";
const staleAddressUntilPhrase = "until an adviser confirms";
const staleRiskApprovalPhrase = "requires adviser approval before use";
const staleRiskUntilPhrase = "stays unchanged until reviewed";

const createFact = (overrides: Partial<ClientFact> = {}): ClientFact => ({
  id: "fact-address",
  field: "Address",
  currentLabel: "Current official value",
  currentValue: "East Perth",
  officialValue: "East Perth",
  candidateValue: "Subiaco",
  previousValue: null,
  sourceRecordId: "source-meeting-note",
  sourceDocument: "Adviser Meeting Note",
  observedAt: "2026-06-04T00:00:00.000Z",
  observedDate: "4 June 2026",
  confidence: "Medium",
  lifecycleStatus: "NEEDS_CONFIRMATION",
  status: "Needs confirmation",
  memoryExplanation:
    "Subiaco remains a candidate fact until an adviser confirms the change.",
  ...overrides
});

const createAction = (
  factId: string,
  decision: NonNullable<AdviserAction["latestDecision"]>["decision"]
): AdviserAction => ({
  id: factId === "fact-address" ? "confirm-address" : "review-risk-profile",
  factId,
  title: "Demo action",
  detail: "Demo action detail",
  status: "Current",
  lifecycleStatus: "CURRENT",
  primaryDecision: factId === "fact-address" ? "CONFIRM" : "APPROVE",
  secondaryDecision:
    factId === "fact-address" ? "LEAVE_UNVERIFIED" : "KEEP_CURRENT",
  primaryLabel: factId === "fact-address" ? "Confirm" : "Approve",
  secondaryLabel:
    factId === "fact-address" ? "Leave unverified" : "Keep current",
  latestDecision: {
    decision,
    note: null,
    createdAt: "2026-06-04T00:00:00.000Z"
  }
});

const expectNoCompletedStaleCopy = (explanation: string) => {
  expect(explanation).not.toContain(staleAddressPhrase);
  expect(explanation).not.toContain(staleAddressUntilPhrase);
  expect(explanation).not.toContain(staleRiskApprovalPhrase);
  expect(explanation).not.toContain(staleRiskUntilPhrase);
};

describe("Evidence drawer explanation mapping", () => {
  it("explains a pending address candidate", () => {
    const explanation = getEvidenceExplanation(createFact());

    expect(explanation).toContain("unverified address candidate");
    expect(explanation).toContain("East Perth");
    expect(explanation).toContain("official value");
  });

  it("explains address after CONFIRM without stale candidate copy", () => {
    const explanation = getEvidenceExplanation(
      createFact({
        currentValue: "Subiaco",
        officialValue: "Subiaco",
        candidateValue: null,
        previousValue: "East Perth",
        lifecycleStatus: "CURRENT",
        status: "Current"
      }),
      createAction("fact-address", "CONFIRM")
    );

    expect(explanation).toContain("adviser confirmed Subiaco");
    expect(explanation).toContain("current official address");
    expect(explanation).toContain("East Perth is retained as previous history");
    expectNoCompletedStaleCopy(explanation);
  });

  it("explains address after LEAVE_UNVERIFIED without stale candidate copy", () => {
    const explanation = getEvidenceExplanation(
      createFact({
        candidateValue: null,
        lifecycleStatus: "CURRENT",
        status: "Current"
      }),
      createAction("fact-address", "LEAVE_UNVERIFIED")
    );

    expect(explanation).toContain("left the address candidate unverified");
    expect(explanation).toContain("East Perth was retained");
    expect(explanation).toContain("candidate was not promoted");
    expectNoCompletedStaleCopy(explanation);
  });

  it("explains a pending risk-profile candidate", () => {
    const explanation = getEvidenceExplanation(
      createFact({
        id: "fact-risk-profile",
        field: "Risk profile",
        currentLabel: "Official value",
        currentValue: "Balanced",
        officialValue: "Balanced",
        candidateValue: "Growth-oriented",
        lifecycleStatus: "REQUIRES_ADVISER_APPROVAL",
        status: "Requires adviser approval",
        memoryExplanation:
          "Growth-oriented requires adviser approval before use and stays unchanged until reviewed."
      })
    );

    expect(explanation).toContain("high-impact risk-profile candidate");
    expect(explanation).toContain("requires adviser approval");
    expect(explanation).toContain("Balanced remains the official value");
  });

  it("explains risk profile after APPROVE without stale approval copy", () => {
    const explanation = getEvidenceExplanation(
      createFact({
        id: "fact-risk-profile",
        field: "Risk profile",
        currentLabel: "Official value",
        currentValue: "Growth-oriented",
        officialValue: "Growth-oriented",
        candidateValue: null,
        previousValue: "Balanced",
        lifecycleStatus: "CURRENT",
        status: "Current",
        memoryExplanation:
          "Growth-oriented requires adviser approval before use and stays unchanged until reviewed."
      }),
      createAction("fact-risk-profile", "APPROVE")
    );

    expect(explanation).toContain("adviser approved Growth-oriented");
    expect(explanation).toContain("current official risk profile");
    expect(explanation).toContain("Balanced is retained as previous history");
    expectNoCompletedStaleCopy(explanation);
  });

  it("explains risk profile after KEEP_CURRENT without stale approval copy", () => {
    const explanation = getEvidenceExplanation(
      createFact({
        id: "fact-risk-profile",
        field: "Risk profile",
        currentLabel: "Official value",
        currentValue: "Balanced",
        officialValue: "Balanced",
        candidateValue: null,
        lifecycleStatus: "CURRENT",
        status: "Current",
        memoryExplanation:
          "Growth-oriented requires adviser approval before use and stays unchanged until reviewed."
      }),
      createAction("fact-risk-profile", "KEEP_CURRENT")
    );

    expect(explanation).toContain("adviser retained Balanced");
    expect(explanation).toContain("candidate was not promoted");
    expectNoCompletedStaleCopy(explanation);
  });

  it("uses persisted read-back state and latest decision instead of stale stored prose", () => {
    const explanation = getEvidenceExplanation(
      createFact({
        currentValue: "Subiaco",
        officialValue: "Subiaco",
        candidateValue: null,
        previousValue: "East Perth",
        lifecycleStatus: "CURRENT",
        status: "Current",
        memoryExplanation:
          "Subiaco remains a candidate fact until an adviser confirms the change."
      }),
      createAction("fact-address", "CONFIRM")
    );

    expect(explanation).toContain("adviser confirmed Subiaco");
    expectNoCompletedStaleCopy(explanation);
  });
});
