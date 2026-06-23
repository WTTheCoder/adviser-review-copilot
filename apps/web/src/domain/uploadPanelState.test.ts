import { describe, expect, it } from "vitest";
import {
  completeUpload,
  failUpload,
  initialUploadPanelState,
  resetUploadPanelState,
  selectUploadFile,
  startUpload
} from "./uploadPanelState.js";

describe("upload panel transient state", () => {
  it("shows the uploaded filename after a successful upload", () => {
    const state = completeUpload("phase-6a-test-note-2.txt");

    expect(state.status).toBe("Uploaded phase-6a-test-note-2.txt.");
    expect(state.error).toBeNull();
    expect(state.selectedFileName).toBeNull();
    expect(state.isUploading).toBe(false);
  });

  it("clears success, error, selected file, and pending state on reset", () => {
    const successState = completeUpload("phase-6a-test-note-2.txt");
    const errorState = failUpload("The document could not be uploaded.");
    const selectedState = startUpload(selectUploadFile("candidate-note.md"));
    const resetState = resetUploadPanelState();

    expect(successState.status).toContain("Uploaded");
    expect(errorState.error).toContain("could not be uploaded");
    expect(selectedState.selectedFileName).toBe("candidate-note.md");
    expect(selectedState.isUploading).toBe(true);
    expect(resetState).toEqual(initialUploadPanelState());
  });

  it("allows a new upload after reset", () => {
    const resetState = resetUploadPanelState();
    const selectedState = selectUploadFile("new-note.txt");
    const completedState = completeUpload("new-note.txt");

    expect(resetState.status).toBeNull();
    expect(selectedState.selectedFileName).toBe("new-note.txt");
    expect(completedState.status).toBe("Uploaded new-note.txt.");
  });
});
