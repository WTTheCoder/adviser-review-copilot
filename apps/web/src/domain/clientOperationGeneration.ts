export const createClientOperationGeneration = () => {
  let generation = 0;

  return {
    capture() {
      return generation;
    },
    invalidate() {
      generation += 1;
      return generation;
    },
    isCurrent(capturedGeneration: number) {
      return capturedGeneration === generation;
    },
    applyIfCurrent(capturedGeneration: number, apply: () => void) {
      if (capturedGeneration !== generation) {
        return false;
      }

      apply();
      return true;
    }
  };
};
