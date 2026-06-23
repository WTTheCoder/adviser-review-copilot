import { describe, expect, it } from "vitest";
import {
  getPrepareButtonLabel,
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
});
