import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AdviserActions,
  shouldRenderAdviserAction
} from "./AdviserActions.js";
import { getAdviserActionPresentation } from "../domain/factPresentation.js";
import type { AdviserAction, ClientFact } from "../types/demo.js";

const staleAddressPhrase = "has not been verified";
const staleRiskPhrase = "needs adviser approval before use";

const createAction = (
  primaryDecision: AdviserAction["primaryDecision"],
  secondaryDecision: AdviserAction["secondaryDecision"],
  latestDecision: AdviserAction["latestDecision"]
): AdviserAction => {
  const isAddress = primaryDecision === "CONFIRM";
  const lifecycleStatus = latestDecision
    ? "CURRENT"
    : isAddress
      ? "NEEDS_CONFIRMATION"
      : "REQUIRES_ADVISER_APPROVAL";

  return {
    id: isAddress ? "confirm-address" : "review-risk-profile",
    factId: isAddress ? "fact-address" : "fact-risk-profile",
    title: "Demo action",
    detail: "Demo detail",
    status:
      lifecycleStatus === "NEEDS_CONFIRMATION"
        ? "Needs confirmation"
        : lifecycleStatus === "REQUIRES_ADVISER_APPROVAL"
          ? "Requires adviser approval"
          : "Current",
    lifecycleStatus,
    primaryDecision,
    secondaryDecision,
    primaryLabel: isAddress ? "Confirm" : "Approve",
    secondaryLabel:
      secondaryDecision === "LEAVE_UNVERIFIED"
        ? "Leave unverified"
        : "Keep current",
    latestDecision
  };
};

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

const renderActions = (
  action: AdviserAction,
  fact: ClientFact,
  savingFactId: string | null = null
) =>
  renderToStaticMarkup(
    <AdviserActions
      facts={[fact]}
      items={[action]}
      savingFactId={savingFactId}
      onDecision={() => undefined}
    />
  );

const expectButtonsAbsent = (markup: string, labels: readonly string[]) => {
  expect(markup).not.toContain("<button");
  labels.forEach((label) => {
    expect(markup).not.toContain(`>${label}</button>`);
  });
};

describe("AdviserActions rendered controls", () => {
  it("renders both pending address decisions", () => {
    const markup = renderActions(
      createAction("CONFIRM", "LEAVE_UNVERIFIED", null),
      createFact()
    );

    expect(markup).toContain(">Confirm</button>");
    expect(markup).toContain(">Leave unverified</button>");
    expect(markup).toContain("Needs confirmation");
  });

  it.each(["CONFIRM", "LEAVE_UNVERIFIED"] as const)(
    "renders completed address copy without buttons after %s",
    (decision) => {
      const action = createAction("CONFIRM", "LEAVE_UNVERIFIED", {
        decision,
        note: null,
        candidateValue: "Subiaco",
        createdAt: "2026-06-23T00:00:00.000Z"
      });
      const fact = createFact({
        currentValue: decision === "CONFIRM" ? "Subiaco" : "East Perth",
        officialValue: decision === "CONFIRM" ? "Subiaco" : "East Perth",
        candidateValue: null,
        previousValue: decision === "CONFIRM" ? "East Perth" : null,
        lifecycleStatus: "CURRENT",
        status: "Current"
      });
      const markup = renderActions(action, fact);

      expect(markup).toContain(
        decision === "CONFIRM"
          ? "Subiaco address confirmed"
          : "Address left unverified"
      );
      expect(markup).toContain("Local demo decision:");
      expectButtonsAbsent(markup, ["Confirm", "Leave unverified"]);
    }
  );

  it("renders a persisted address decision without controls after read-back", () => {
    const markup = renderActions(
      createAction("CONFIRM", "LEAVE_UNVERIFIED", {
        decision: "CONFIRM",
        note: "Persisted decision",
        candidateValue: "Subiaco",
        createdAt: "2026-06-23T00:00:00.000Z"
      }),
      createFact({
        currentValue: "Subiaco",
        officialValue: "Subiaco",
        candidateValue: null,
        previousValue: "East Perth",
        lifecycleStatus: "CURRENT",
        status: "Current"
      })
    );

    expect(markup).toContain("Subiaco address confirmed");
    expectButtonsAbsent(markup, ["Confirm", "Leave unverified"]);
  });

  it("renders both pending risk decisions", () => {
    const markup = renderActions(
      createAction("APPROVE", "KEEP_CURRENT", null),
      createFact({
        id: "fact-risk-profile",
        field: "Risk profile",
        currentLabel: "Official value",
        currentValue: "Balanced",
        officialValue: "Balanced",
        candidateValue: "High Growth",
        lifecycleStatus: "REQUIRES_ADVISER_APPROVAL",
        status: "Requires adviser approval"
      })
    );

    expect(markup).toContain(">Approve</button>");
    expect(markup).toContain(">Keep current</button>");
    expect(markup).toContain("Requires adviser approval");
  });

  it.each(["APPROVE", "KEEP_CURRENT"] as const)(
    "renders completed risk copy without buttons after %s",
    (decision) => {
      const action = createAction("APPROVE", "KEEP_CURRENT", {
        decision,
        note: null,
        candidateValue: "High Growth",
        createdAt: "2026-06-23T00:00:00.000Z"
      });
      const fact = createFact({
        id: "fact-risk-profile",
        field: "Risk profile",
        currentLabel: "Official value",
        currentValue: decision === "APPROVE" ? "High Growth" : "Balanced",
        officialValue: decision === "APPROVE" ? "High Growth" : "Balanced",
        candidateValue: null,
        previousValue: decision === "APPROVE" ? "Balanced" : null,
        lifecycleStatus: "CURRENT",
        status: "Current"
      });
      const markup = renderActions(action, fact);

      expect(markup).toContain(
        decision === "APPROVE"
          ? "High Growth risk profile approved"
          : "Balanced risk profile retained"
      );
      expect(markup).toContain("Local demo decision:");
      expectButtonsAbsent(markup, ["Approve", "Keep current"]);
    }
  );

  it("renders a persisted risk decision without controls after read-back", () => {
    const markup = renderActions(
      createAction("APPROVE", "KEEP_CURRENT", {
        decision: "APPROVE",
        note: "Persisted decision",
        candidateValue: "High Growth",
        createdAt: "2026-06-23T00:00:00.000Z"
      }),
      createFact({
        id: "fact-risk-profile",
        field: "Risk profile",
        currentLabel: "Official value",
        currentValue: "High Growth",
        officialValue: "High Growth",
        candidateValue: null,
        previousValue: "Balanced",
        lifecycleStatus: "CURRENT",
        status: "Current"
      })
    );

    expect(markup).toContain("High Growth risk profile approved");
    expectButtonsAbsent(markup, ["Approve", "Keep current"]);
  });

  it("disables both pending buttons while the action is submitting", () => {
    const markup = renderActions(
      createAction("CONFIRM", "LEAVE_UNVERIFIED", null),
      createFact(),
      "fact-address"
    );

    expect(markup.match(/<button[^>]*disabled/g)).toHaveLength(2);
    expect(markup).toContain("Saving local demo decision...");
  });

  it("restores pending controls when a failed request leaves no decision", () => {
    const markup = renderActions(
      createAction("CONFIRM", "LEAVE_UNVERIFIED", null),
      createFact(),
      null
    );

    expect(markup).toContain(">Confirm</button>");
    expect(markup).toContain(">Leave unverified</button>");
    expect(markup).not.toContain("Local demo decision:");
  });

  it("does not render an action with no candidate and no persisted decision", () => {
    const action = createAction("CONFIRM", "LEAVE_UNVERIFIED", null);
    const fact = createFact({
      candidateValue: null,
      lifecycleStatus: "CURRENT",
      status: "Current"
    });

    expect(shouldRenderAdviserAction(action, fact)).toBe(false);
    expect(renderActions(action, fact)).toBe("");
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
        candidateValue: "High Growth",
        lifecycleStatus: "REQUIRES_ADVISER_APPROVAL",
        status: "Requires adviser approval"
      })
    );

    expect(presentation.title).toBe(
      "Review the possible change from Balanced to High Growth"
    );
    expect(presentation.detail).toContain(staleRiskPhrase);
  });

  it("explains risk profile after APPROVE without pending copy", () => {
    const action = createAction("APPROVE", "KEEP_CURRENT", {
      decision: "APPROVE",
      note: null,
      candidateValue: "High Growth",
      createdAt: "2026-06-23T00:00:00.000Z"
    });
    const presentation = getAdviserActionPresentation(
      action,
      createFact({
        id: "fact-risk-profile",
        field: "Risk profile",
        currentLabel: "Official value",
        currentValue: "High Growth",
        officialValue: "High Growth",
        candidateValue: null,
        previousValue: "Balanced",
        lifecycleStatus: "CURRENT",
        status: "Current"
      })
    );

    expect(presentation.title).toContain("High Growth risk profile approved");
    expect(presentation.detail).toContain(
      "High Growth is now the official risk profile"
    );
    expect(presentation.detail).toContain("Balanced is retained");
    expectNoCompletedStaleCopy(presentation);
  });

  it("explains risk profile after KEEP_CURRENT without pending copy", () => {
    const action = createAction("APPROVE", "KEEP_CURRENT", {
      decision: "KEEP_CURRENT",
      note: null,
      candidateValue: "High Growth",
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

    expect(presentation.title).toContain("Balanced risk profile retained");
    expect(presentation.detail).toContain(
      "Balanced remains the official risk profile"
    );
    expect(presentation.detail).toContain("High Growth was not promoted");
    expectNoCompletedStaleCopy(presentation);
  });

  it("uses persisted latest decision after refresh/read-back", () => {
    const action = createAction("APPROVE", "KEEP_CURRENT", {
      decision: "APPROVE",
      note: "Local demo decision: APPROVE. No production CRM was updated.",
      candidateValue: "High Growth",
      createdAt: "2026-06-23T00:00:00.000Z"
    });
    const presentation = getAdviserActionPresentation(
      action,
      createFact({
        id: "fact-risk-profile",
        field: "Risk profile",
        currentLabel: "Official value",
        currentValue: "High Growth",
        officialValue: "High Growth",
        candidateValue: null,
        previousValue: "Balanced",
        lifecycleStatus: "CURRENT",
        status: "Current"
      })
    );

    expect(presentation.detail).toContain(
      "High Growth is now the official risk profile"
    );
    expectNoCompletedStaleCopy(presentation);
  });

  it("never describes unchanged Balanced as newly approved", () => {
    const action = createAction("APPROVE", "KEEP_CURRENT", {
      decision: "APPROVE",
      note: null,
      candidateValue: "Balanced",
      createdAt: "2026-06-23T00:00:00.000Z"
    });
    const presentation = getAdviserActionPresentation(
      action,
      createFact({
        id: "fact-risk-profile",
        field: "Risk profile",
        currentValue: "Balanced",
        officialValue: "Balanced",
        candidateValue: null,
        previousValue: null,
        lifecycleStatus: "CURRENT",
        status: "Current"
      })
    );

    expect(presentation.title).not.toContain("Balanced risk profile approved");
    expect(presentation.detail).not.toContain("approved Balanced");
  });
});
