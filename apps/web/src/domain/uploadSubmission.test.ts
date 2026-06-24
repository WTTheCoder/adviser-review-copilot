import { describe, expect, it } from "vitest";
import { createUploadSubmissionController } from "./uploadSubmission.js";

describe("upload submission controller", () => {
  it("allows only one active submission and releases after completion or error", () => {
    const submissions = createUploadSubmissionController();
    const first = submissions.tryStart();

    expect(first).not.toBeNull();
    expect(submissions.tryStart()).toBeNull();
    expect(submissions.isActive()).toBe(true);

    if (!first) {
      throw new Error("Expected an active upload submission.");
    }
    submissions.finish(first);

    const afterCompletion = submissions.tryStart();
    expect(afterCompletion).not.toBeNull();
    if (!afterCompletion) {
      throw new Error("Expected a new upload submission.");
    }
    submissions.finish(afterCompletion);
    expect(submissions.tryStart()).not.toBeNull();
  });

  it("aborts reset work silently and unlocks a later upload", () => {
    const submissions = createUploadSubmissionController();
    const first = submissions.tryStart();
    if (!first) {
      throw new Error("Expected an active upload submission.");
    }

    submissions.abortActive();

    expect(first.controller.signal.aborted).toBe(true);
    expect(submissions.isActive()).toBe(false);
    expect(submissions.tryStart()).not.toBeNull();
  });
});
