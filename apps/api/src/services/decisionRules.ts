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

export const isDecisionAllowedForFact = (factId: string, decision: DecisionType) =>
  (factId === "fact-address" &&
    (decision === DecisionType.CONFIRM ||
      decision === DecisionType.LEAVE_UNVERIFIED)) ||
  (factId === "fact-risk-profile" &&
    (decision === DecisionType.APPROVE || decision === DecisionType.KEEP_CURRENT));
