import { describe, expect, it } from "vitest";
import {
  getPrepareButtonLabel,
  getPrimaryExtractionWarning,
  getReviewStatusLabel
} from "./reviewWorkflow.js";

describe("review workflow labels", () => {
  it("starts with ready-state labels", () => {
    expect(getReviewStatusLabel("ready")).toBe("Preparation in progress");
    expect(getPrepareButtonLabel("ready")).toBe("Prepare Client Review");
  });

  it("uses completed review copy after preparation finishes", () => {
    expect(getReviewStatusLabel("prepared")).toBe("Ready for adviser review");
    expect(getPrepareButtonLabel("prepared")).toBe("Re-run Preparation");
  });

  it("surfaces the first extraction warning without inventing candidate copy", () => {
    expect(
      getPrimaryExtractionWarning([
        "RISK_PROFILE candidate omitted: conflicting evidence also supports the current official value",
        "Secondary diagnostic"
      ])
    ).toBe(
      "RISK_PROFILE candidate omitted: conflicting evidence also supports the current official value"
    );
    expect(getPrimaryExtractionWarning([])).toBeNull();
    expect(getPrimaryExtractionWarning(null)).toBeNull();
  });
});
