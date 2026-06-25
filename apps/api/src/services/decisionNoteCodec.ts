const decisionCandidateMarker = "\nCandidate value at decision: ";

export const encodeDecisionNote = (
  note: string,
  candidateValue: string | null
) => `${note}${decisionCandidateMarker}${candidateValue ?? ""}`;

export const decodeDecisionCandidateValue = (note: string | null) => {
  if (!note) {
    return null;
  }

  const markerIndex = note.lastIndexOf(decisionCandidateMarker);
  return markerIndex >= 0
    ? note.slice(markerIndex + decisionCandidateMarker.length).trim() || null
    : null;
};
