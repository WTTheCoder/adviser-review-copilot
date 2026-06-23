export const nextUploadGeneration = (currentGeneration: number) =>
  currentGeneration + 1;

export const invalidateUploadGeneration = (currentGeneration: number) =>
  currentGeneration + 1;

export const isCurrentUploadGeneration = (
  startedGeneration: number,
  currentGeneration: number
) => startedGeneration === currentGeneration;

export const applyIfCurrentUploadGeneration = (
  startedGeneration: number,
  currentGeneration: number,
  apply: () => void
) => {
  if (!isCurrentUploadGeneration(startedGeneration, currentGeneration)) {
    return false;
  }

  apply();
  return true;
};
