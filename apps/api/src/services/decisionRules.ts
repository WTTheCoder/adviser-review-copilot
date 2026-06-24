import { DecisionType, LifecycleStatus } from "@prisma/client";

export type DecisionFactState = {
  id: string;
  officialValue: string;
  candidateValue: string | null;
  lifecycleStatus: LifecycleStatus;
};

export type DecisionFactUpdate = {
  officialValue: string;
  previousValue: string | null;
  candidateValue: string | null;
  lifecycleStatus: LifecycleStatus;
};

export const applyDecisionToFact = (
  fact: DecisionFactState,
  decision: DecisionType
): DecisionFactUpdate => {
  switch (decision) {
    case DecisionType.CONFIRM:
    case DecisionType.APPROVE:
      return {
        officialValue: fact.candidateValue ?? fact.officialValue,
        previousValue: fact.candidateValue ? fact.officialValue : null,
        candidateValue: null,
        lifecycleStatus: LifecycleStatus.CURRENT
      };
    case DecisionType.LEAVE_UNVERIFIED:
    case DecisionType.KEEP_CURRENT:
      return {
        officialValue: fact.officialValue,
        previousValue: null,
        candidateValue: null,
        lifecycleStatus: LifecycleStatus.CURRENT
      };
  }
};

const hasDistinctCandidate = (fact: DecisionFactState) =>
  Boolean(
    fact.candidateValue?.trim() &&
      fact.candidateValue.trim() !== fact.officialValue.trim()
  );

export const isDecisionAllowedForFact = (
  fact: DecisionFactState,
  decision: DecisionType
) => {
  if (!hasDistinctCandidate(fact)) {
    return false;
  }

  if (fact.id === "fact-address") {
    return (
      fact.lifecycleStatus === LifecycleStatus.NEEDS_CONFIRMATION &&
      (decision === DecisionType.CONFIRM ||
        decision === DecisionType.LEAVE_UNVERIFIED)
    );
  }

  if (fact.id === "fact-risk-profile") {
    return (
      fact.lifecycleStatus === LifecycleStatus.REQUIRES_ADVISER_APPROVAL &&
      (decision === DecisionType.APPROVE ||
        decision === DecisionType.KEEP_CURRENT)
    );
  }

  return false;
};
