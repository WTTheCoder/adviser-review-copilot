import { describe, expect, it } from "vitest";
import { createClientOperationGeneration } from "./clientOperationGeneration.js";

describe("client operation generation", () => {
  it("ignores success and failure callbacks captured before reset", () => {
    const generation = createClientOperationGeneration();
    const captured = generation.capture();
    let applied = false;

    generation.invalidate();

    expect(
      generation.applyIfCurrent(captured, () => {
        applied = true;
      })
    ).toBe(false);
    expect(applied).toBe(false);
  });

  it("allows callbacks captured after reset", () => {
    const generation = createClientOperationGeneration();
    generation.invalidate();
    const captured = generation.capture();

    expect(generation.isCurrent(captured)).toBe(true);
  });

  it("ignores a late refresh success captured before reset", async () => {
    const generation = createClientOperationGeneration();
    const captured = generation.capture();
    let resolveRefresh: (value: string) => void = () => undefined;
    const refresh = new Promise<string>((resolve) => {
      resolveRefresh = resolve;
    });
    let appliedReview: string | null = null;

    const settlement = refresh.then((review) =>
      generation.applyIfCurrent(captured, () => {
        appliedReview = review;
      })
    );
    generation.invalidate();
    resolveRefresh("stale review");

    await expect(settlement).resolves.toBe(false);
    expect(appliedReview).toBeNull();
  });

  it("ignores a late refresh error captured before reset", async () => {
    const generation = createClientOperationGeneration();
    const captured = generation.capture();
    let resolveRefresh: () => void = () => undefined;
    const refresh = new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    });
    let errorMessage: string | null = null;

    const settlement = refresh.then(() =>
      generation.applyIfCurrent(captured, () => {
        errorMessage = "stale error";
      })
    );
    generation.invalidate();
    resolveRefresh();

    await expect(settlement).resolves.toBe(false);
    expect(errorMessage).toBeNull();
  });
});
