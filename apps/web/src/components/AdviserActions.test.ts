import { describe, expect, it } from "vitest";
import {
  getDecisionButtonClass,
  isDecisionButtonSelected
} from "./AdviserActions.js";
import type { AdviserAction } from "../types/demo.js";

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
