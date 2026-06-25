export const createDecisionSubmissionLock = () => {
  let activeFactId: string | null = null;

  return {
    tryStart(factId: string) {
      if (activeFactId !== null) {
        return false;
      }

      activeFactId = factId;
      return true;
    },
    finish(factId: string) {
      if (activeFactId === factId) {
        activeFactId = null;
      }
    }
  };
};
