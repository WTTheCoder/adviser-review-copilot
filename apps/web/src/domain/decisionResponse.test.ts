import { describe, expect, it } from "vitest";
import { parseDecisionResponse } from "./decisionResponse.js";

describe("decision response parsing", () => {
  it("treats committed refresh-required responses as saved decisions", () => {
    expect(
      parseDecisionResponse({
        committed: true,
        refreshRequired: true,
        review: null,
        message: "Decision was saved. Refresh to load the latest review."
      })
    ).toEqual({
      kind: "refreshRequired",
      message: "Decision was saved. Refresh to load the latest review."
    });
  });

  it("does not turn refresh-required responses into automatic retries", () => {
    const parsed = parseDecisionResponse({
      committed: true,
      refreshRequired: true,
      review: null,
      message: "Decision was saved. Refresh to load the latest review."
    });

    expect(parsed.kind).toBe("refreshRequired");
    expect("retry" in parsed).toBe(false);
  });
});
