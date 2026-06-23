import { describe, expect, it } from "vitest";
import {
  getDecisionButtonClass,
  isDecisionButtonSelected
} from "./AdviserActions.js";
import { getAdviserActionPresentation } from "../domain/factPresentation.js";
import type { AdviserAction, ClientFact } from "../types/demo.js";

const staleAddressPhrase = "has not been verified";
const staleRiskPhrase = "needs adviser approval before use";

const createAction = (
  primaryDecision: AdviserAction["primaryDecision"],
  secondaryDecision: AdviserAction["secondaryDecision"],
  latestDecision: AdviserAction["latestDecision"]
): AdviserAction => ({
  id: primaryDecision === "CONFIRM" ? "confirm-address" : "review-risk-profile",
  factId: primaryDecision === "CONFIRM" ? "fact-address" : "fact-risk-profile",
  title: "Demo action",
  detail: "Demo detail",
  status: "Current",
  lifecycleStatus: "CURRENT",
  primaryDecision,
  secondaryDecision,
  primaryLabel: primaryDecision === "CONFIRM" ? "Confirm" : "Approve",
  secondaryLabel:
    secondaryDecision === "LEAVE_UNVERIFIED" ? "Leave unverified" : "Keep current",
  latestDecision
});

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
  memoryExplanation: "Demo explanation",
  ...overrides
});

const expectNoCompletedStaleCopy = (presentation: {
  title: string;
  detail: string;
}) => {
  expect(presentation.title).not.toContain(staleAddressPhrase);
  expect(presentation.detail).not.toContain(staleAddressPhrase);
  expect(presentation.title).not.toContain(staleRiskPhrase);
  expect(presentation.detail).not.toContain(staleRiskPhrase);
};

describe("AdviserActions decision selection", () => {
  it("highlights Keep current, not Approve, for KEEP_CURRENT", () => {
    const action = createAction("APPROVE", "KEEP_CURRENT", {
      decision: "KEEP_CURRENT",
      note: null,
      createdAt: "2026-06-23T00:00:00.000Z"
    });

    expect(isDecisionButtonSelected(action, "KEEP_CURRENT")).toBe(true);
    expect(isDecisionButtonSelected(action, "APPROVE")).toBe(false);
    expect(getDecisionButtonClass(action, "KEEP_CURRENT", false)).toContain(
      "bg-slate-900"
    );
    expect(getDecisionButtonClass(action, "APPROVE", true)).toContain("bg-white");
  });

  it("highlights Approve for APPROVE", () => {
    const action = createAction("APPROVE", "KEEP_CURRENT", {
      decision: "APPROVE",
      note: null,
      createdAt: "2026-06-23T00:00:00.000Z"
    });

    expect(isDecisionButtonSelected(action, "APPROVE")).toBe(true);
    expect(getDecisionButtonClass(action, "APPROVE", true)).toContain(
      "bg-slate-900"
    );
  });

  it("highlights Confirm for CONFIRM", () => {
    const action = createAction("CONFIRM", "LEAVE_UNVERIFIED", {
      decision: "CONFIRM",
      note: null,
      createdAt: "2026-06-23T00:00:00.000Z"
    });

    expect(isDecisionButtonSelected(action, "CONFIRM")).toBe(true);
    expect(getDecisionButtonClass(action, "CONFIRM", true)).toContain(
      "bg-slate-900"
    );
  });

  it("highlights Leave unverified for LEAVE_UNVERIFIED", () => {
    const action = createAction("CONFIRM", "LEAVE_UNVERIFIED", {
      decision: "LEAVE_UNVERIFIED",
      note: null,
      createdAt: "2026-06-23T00:00:00.000Z"
    });

    expect(isDecisionButtonSelected(action, "LEAVE_UNVERIFIED")).toBe(true);
    expect(isDecisionButtonSelected(action, "CONFIRM")).toBe(false);
    expect(getDecisionButtonClass(action, "LEAVE_UNVERIFIED", false)).toContain(
      "bg-slate-900"
    );
    expect(getDecisionButtonClass(action, "CONFIRM", true)).toContain("bg-white");
  });
});

describe("AdviserActions presentation mapping", () => {
  it("explains a pending address action", () => {
    const action = createAction("CONFIRM", "LEAVE_UNVERIFIED", null);
    const presentation = getAdviserActionPresentation(action, createFact());

    expect(presentation.title).toBe("Confirm whether Alex has moved to Subiaco");
    expect(presentation.detail).toContain(staleAddressPhrase);
  });

  it("explains address after CONFIRM without pending copy", () => {
    const action = createAction("CONFIRM", "LEAVE_UNVERIFIED", {
      decision: "CONFIRM",
      note: null,
      createdAt: "2026-06-23T00:00:00.000Z"
    });
    const presentation = getAdviserActionPresentation(
      action,
      createFact({
        currentValue: "Subiaco",
        officialValue: "Subiaco",
        candidateValue: null,
        previousValue: "East Perth",
        lifecycleStatus: "CURRENT",
        status: "Current"
      })
    );

    expect(presentation.title).toContain("Subiaco address confirmed");
    expect(presentation.detail).toContain("Subiaco is now the official address");
    expect(presentation.detail).toContain("East Perth is retained");
    expectNoCompletedStaleCopy(presentation);
    expect(isDecisionButtonSelected(action, "CONFIRM")).toBe(true);
  });

  it("explains address after LEAVE_UNVERIFIED without pending copy", () => {
    const action = createAction("CONFIRM", "LEAVE_UNVERIFIED", {
      decision: "LEAVE_UNVERIFIED",
      note: null,
      createdAt: "2026-06-23T00:00:00.000Z"
    });
    const presentation = getAdviserActionPresentation(
      action,
      createFact({
        candidateValue: null,
        lifecycleStatus: "CURRENT",
        status: "Current"
      })
    );

    expect(presentation.title).toContain("Address left unverified");
    expect(presentation.detail).toContain("East Perth remains the official address");
    expect(presentation.detail).toContain("candidate was not promoted");
    expectNoCompletedStaleCopy(presentation);
    expect(isDecisionButtonSelected(action, "LEAVE_UNVERIFIED")).toBe(true);
  });

  it("explains a pending risk-profile action", () => {
    const action = createAction("APPROVE", "KEEP_CURRENT", null);
    const presentation = getAdviserActionPresentation(
      action,
      createFact({
        id: "fact-risk-profile",
        field: "Risk profile",
        currentLabel: "Official value",
        currentValue: "Balanced",
        officialValue: "Balanced",
        candidateValue: "Growth-oriented",
        lifecycleStatus: "REQUIRES_ADVISER_APPROVAL",
        status: "Requires adviser approval"
      })
    );

    expect(presentation.title).toBe(
      "Review the possible change from Balanced to Growth-oriented"
    );
    expect(presentation.detail).toContain(staleRiskPhrase);
  });

  it("explains risk profile after APPROVE without pending copy", () => {
    const action = createAction("APPROVE", "KEEP_CURRENT", {
      decision: "APPROVE",
      note: null,
      createdAt: "2026-06-23T00:00:00.000Z"
    });
    const presentation = getAdviserActionPresentation(
      action,
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
    );

    expect(presentation.title).toContain("Growth-oriented risk profile approved");
    expect(presentation.detail).toContain(
      "Growth-oriented is now the official risk profile"
    );
    expect(presentation.detail).toContain("Balanced is retained");
    expectNoCompletedStaleCopy(presentation);
    expect(isDecisionButtonSelected(action, "APPROVE")).toBe(true);
  });

  it("explains risk profile after KEEP_CURRENT without pending copy", () => {
    const action = createAction("APPROVE", "KEEP_CURRENT", {
      decision: "KEEP_CURRENT",
      note: null,
      createdAt: "2026-06-23T00:00:00.000Z"
    });
    const presentation = getAdviserActionPresentation(
      action,
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
    );

    expect(presentation.title).toContain("Current risk profile retained");
    expect(presentation.detail).toContain(
      "Balanced remains the official risk profile"
    );
    expect(presentation.detail).toContain("candidate was not promoted");
    expectNoCompletedStaleCopy(presentation);
    expect(isDecisionButtonSelected(action, "KEEP_CURRENT")).toBe(true);
  });

  it("uses persisted latest decision after refresh/read-back", () => {
    const action = createAction("APPROVE", "KEEP_CURRENT", {
      decision: "APPROVE",
      note: "Local demo decision: APPROVE. No production CRM was updated.",
      createdAt: "2026-06-23T00:00:00.000Z"
    });
    const presentation = getAdviserActionPresentation(
      action,
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
    );

    expect(presentation.detail).toContain(
      "Growth-oriented is now the official risk profile"
    );
    expectNoCompletedStaleCopy(presentation);
    expect(isDecisionButtonSelected(action, "APPROVE")).toBe(true);
    expect(isDecisionButtonSelected(action, "KEEP_CURRENT")).toBe(false);
  });
});
