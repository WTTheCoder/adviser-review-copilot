import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getEvidenceExplanation } from "../domain/factPresentation.js";
import type { AdviserAction, ClientFact } from "../types/demo.js";
import { EvidenceDrawer } from "./EvidenceDrawer.js";

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
  memoryExplanation:
    "Subiaco remains a candidate fact until an adviser confirms the change.",
  ...overrides
});

const createAction = (
  factId: string,
  decision: NonNullable<AdviserAction["latestDecision"]>["decision"],
  candidateValue?: string
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
    candidateValue,
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
        candidateValue: "High Growth",
        lifecycleStatus: "REQUIRES_ADVISER_APPROVAL",
        status: "Requires adviser approval",
        memoryExplanation:
          "High Growth requires adviser approval before use and stays unchanged until reviewed."
      })
    );

    expect(explanation).toContain("high-impact risk-profile candidate");
    expect(explanation).toContain("High Growth");
    expect(explanation).toContain("requires adviser approval");
    expect(explanation).toContain("Balanced remains the official value");
  });

  it("explains risk profile after APPROVE without stale approval copy", () => {
    const explanation = getEvidenceExplanation(
      createFact({
        id: "fact-risk-profile",
        field: "Risk profile",
        currentLabel: "Official value",
        currentValue: "High Growth",
        officialValue: "High Growth",
        candidateValue: null,
        previousValue: "Balanced",
        lifecycleStatus: "CURRENT",
        status: "Current",
        memoryExplanation:
          "High Growth requires adviser approval before use and stays unchanged until reviewed."
      }),
      createAction("fact-risk-profile", "APPROVE", "High Growth")
    );

    expect(explanation).toContain("adviser approved High Growth");
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
      createAction("fact-risk-profile", "KEEP_CURRENT", "High Growth")
    );

    expect(explanation).toContain("adviser retained Balanced");
    expect(explanation).toContain("High Growth was not promoted");
    expectNoCompletedStaleCopy(explanation);
  });

  it("does not claim unchanged Balanced was approved", () => {
    const explanation = getEvidenceExplanation(
      createFact({
        id: "fact-risk-profile",
        field: "Risk profile",
        currentValue: "Balanced",
        officialValue: "Balanced",
        candidateValue: null,
        previousValue: null,
        lifecycleStatus: "CURRENT",
        status: "Current",
        memoryExplanation: "Balanced remains the official risk profile."
      }),
      createAction("fact-risk-profile", "APPROVE", "Balanced")
    );

    expect(explanation).not.toContain("approved Balanced");
    expect(explanation).toBe("Balanced remains the official risk profile.");
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

  it("shows KEEP_CURRENT history after the active candidate is cleared", () => {
    const markup = renderToStaticMarkup(
      createElement(EvidenceDrawer, {
        fact: createFact({
          id: "fact-risk-profile",
          field: "Risk profile",
          currentLabel: "Official value",
          currentValue: "Balanced",
          officialValue: "Balanced",
          candidateValue: null,
          lifecycleStatus: "CURRENT",
          status: "Current"
        }),
        adviserAction: {
          ...createAction("fact-risk-profile", "KEEP_CURRENT", "High Growth"),
          decisionHistory: [
            {
              decision: "KEEP_CURRENT",
              actor: "demo-adviser",
              note: null,
              candidateValue: "High Growth",
              candidateSourceDocument: "Adviser Meeting Note",
              candidateObservedDate: "4 June 2026",
              candidateEvidence: "Evidence for High Growth",
              officialValueBefore: "Balanced",
              resultingOfficialValue: "Balanced",
              createdAt: "2026-06-04T00:00:00.000Z"
            }
          ]
        },
        onClose: () => undefined
      })
    );

    expect(markup).toContain("Decision history");
    expect(markup).toContain("KEEP_CURRENT");
    expect(markup).toContain("High Growth");
    expect(markup).toContain("Evidence for High Growth");
    expect(markup).toContain("Balanced to Balanced");
  });

  it("shows LEAVE_UNVERIFIED history after the active candidate is cleared", () => {
    const markup = renderToStaticMarkup(
      createElement(EvidenceDrawer, {
        fact: createFact({
          candidateValue: null,
          lifecycleStatus: "CURRENT",
          status: "Current"
        }),
        adviserAction: {
          ...createAction("fact-address", "LEAVE_UNVERIFIED", "Subiaco"),
          decisionHistory: [
            {
              decision: "LEAVE_UNVERIFIED",
              actor: "demo-adviser",
              note: null,
              candidateValue: "Subiaco",
              candidateSourceDocument: "Adviser Meeting Note",
              candidateObservedDate: "4 June 2026",
              candidateEvidence: "Subiaco was not verified.",
              officialValueBefore: "East Perth",
              resultingOfficialValue: "East Perth",
              createdAt: "2026-06-04T00:00:00.000Z"
            }
          ]
        },
        onClose: () => undefined
      })
    );

    expect(markup).toContain("LEAVE_UNVERIFIED");
    expect(markup).toContain("Subiaco");
    expect(markup).toContain("Subiaco was not verified.");
    expect(markup).toContain("East Perth to East Perth");
  });

  it("shows approval history with before, candidate and resulting values", () => {
    const markup = renderToStaticMarkup(
      createElement(EvidenceDrawer, {
        fact: createFact({
          id: "fact-risk-profile",
          field: "Risk profile",
          currentLabel: "Official value",
          currentValue: "High Growth",
          officialValue: "High Growth",
          candidateValue: null,
          previousValue: "Balanced",
          lifecycleStatus: "CURRENT",
          status: "Current"
        }),
        adviserAction: {
          ...createAction("fact-risk-profile", "APPROVE", "High Growth"),
          decisionHistory: [
            {
              decision: "APPROVE",
              actor: "demo-adviser",
              note: null,
              candidateValue: "High Growth",
              candidateSourceDocument: "Adviser Meeting Note",
              candidateObservedDate: "4 June 2026",
              candidateEvidence: "Evidence for High Growth",
              officialValueBefore: "Balanced",
              resultingOfficialValue: "High Growth",
              createdAt: "2026-06-04T00:00:00.000Z"
            }
          ]
        },
        onClose: () => undefined
      })
    );

    expect(markup).toContain("APPROVE");
    expect(markup).toContain("High Growth");
    expect(markup).toContain("Balanced to High Growth");
  });
});
