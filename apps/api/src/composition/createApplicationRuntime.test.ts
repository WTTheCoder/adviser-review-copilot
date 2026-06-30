import { describe, expect, it } from "vitest";
import { createApplicationRuntime } from "./createApplicationRuntime.js";

describe("application runtime mutation wiring", () => {
  it("shares one client mutation coordinator across routes and services", () => {
    const runtime = createApplicationRuntime();

    expect(runtime.reviewRoutes.reviewService.mutationCoordinator).toBe(
      runtime.reviewRoutes.clientOperations
    );
  });
});
