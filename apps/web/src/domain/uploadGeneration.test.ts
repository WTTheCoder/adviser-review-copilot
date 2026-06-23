import { describe, expect, it } from "vitest";
import {
  applyIfCurrentUploadGeneration,
  invalidateUploadGeneration,
  nextUploadGeneration
} from "./uploadGeneration.js";

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

describe("upload generation guard", () => {
  it("prevents an old successful upload from updating state after reset", async () => {
    let generation = 0;
    let successMessage: string | null = null;
    let uploadTraceVisible = false;
    let uploadedCallbackCount = 0;
    const startedGeneration = nextUploadGeneration(generation);
    generation = startedGeneration;
    const upload = createDeferred<string>();

    generation = invalidateUploadGeneration(generation);
    upload.resolve("Uploaded old-note.txt.");
    const result = await upload.promise;
    const applied = applyIfCurrentUploadGeneration(
      startedGeneration,
      generation,
      () => {
        successMessage = result;
        uploadTraceVisible = true;
        uploadedCallbackCount += 1;
      }
    );

    expect(applied).toBe(false);
    expect(successMessage).toBeNull();
    expect(uploadTraceVisible).toBe(false);
    expect(uploadedCallbackCount).toBe(0);
  });

  it("prevents an old failed upload from showing an error after reset", async () => {
    let generation = 0;
    let errorMessage: string | null = null;
    const startedGeneration = nextUploadGeneration(generation);
    generation = startedGeneration;
    const upload = createDeferred<string>();

    generation = invalidateUploadGeneration(generation);
    upload.reject(new Error("Old upload failed"));

    try {
      await upload.promise;
    } catch {
      const applied = applyIfCurrentUploadGeneration(
        startedGeneration,
        generation,
        () => {
          errorMessage = "The document could not be uploaded.";
        }
      );
      expect(applied).toBe(false);
    }

    expect(errorMessage).toBeNull();
  });

  it("allows a new upload after reset to update state normally", async () => {
    let generation = 0;
    let successMessage: string | null = null;

    generation = invalidateUploadGeneration(generation);
    const startedGeneration = nextUploadGeneration(generation);
    generation = startedGeneration;
    const upload = createDeferred<string>();

    upload.resolve("Uploaded new-note.txt.");
    const result = await upload.promise;
    const applied = applyIfCurrentUploadGeneration(
      startedGeneration,
      generation,
      () => {
        successMessage = result;
      }
    );

    expect(applied).toBe(true);
    expect(successMessage).toBe("Uploaded new-note.txt.");
  });

  it("keeps second-upload replacement behavior by ignoring the first completion", async () => {
    let generation = 0;
    let visibleTrace = "";
    const firstGeneration = nextUploadGeneration(generation);
    generation = firstGeneration;
    const firstUpload = createDeferred<string>();
    const secondGeneration = nextUploadGeneration(generation);
    generation = secondGeneration;
    const secondUpload = createDeferred<string>();

    firstUpload.resolve("first trace");
    secondUpload.resolve("second trace");
    const firstTrace = await firstUpload.promise;
    const secondTrace = await secondUpload.promise;
    const firstApplied = applyIfCurrentUploadGeneration(
      firstGeneration,
      generation,
      () => {
        visibleTrace = firstTrace;
      }
    );
    const secondApplied = applyIfCurrentUploadGeneration(
      secondGeneration,
      generation,
      () => {
        visibleTrace = secondTrace;
      }
    );

    expect(firstApplied).toBe(false);
    expect(secondApplied).toBe(true);
    expect(visibleTrace).toBe("second trace");
  });
});
