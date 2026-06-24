export type UploadSubmission = {
  controller: AbortController;
};

export const createUploadSubmissionController = () => {
  let active: UploadSubmission | null = null;

  return {
    tryStart(): UploadSubmission | null {
      if (active) {
        return null;
      }

      active = {
        controller: new AbortController()
      };
      return active;
    },
    finish(submission: UploadSubmission) {
      if (active === submission) {
        active = null;
      }
    },
    abortActive() {
      const submission = active;
      active = null;
      submission?.controller.abort();
    },
    isActive() {
      return active !== null;
    }
  };
};
