import type { AdviserAction, ClientFact } from "../types/demo.js";

const latestDecisionFor = (adviserAction: AdviserAction | null) =>
  adviserAction?.latestDecision?.decision ?? null;

export const getEvidenceExplanation = (
  fact: ClientFact,
  adviserAction: AdviserAction | null = null
) => {
  const latestDecision = latestDecisionFor(adviserAction);

  if (fact.field === "Address") {
    if (latestDecision === "CONFIRM") {
      return `The adviser confirmed ${fact.currentValue}. It became the current official address, and ${fact.previousValue ?? "the former official value"} is retained as previous history.`;
    }

    if (latestDecision === "LEAVE_UNVERIFIED") {
      return `The adviser left the address candidate unverified. ${fact.currentValue} was retained as the official address, and the candidate was not promoted.`;
    }

    if (fact.candidateValue && fact.lifecycleStatus === "NEEDS_CONFIRMATION") {
      return `${fact.candidateValue} remains an unverified address candidate. ${fact.officialValue} is still the official value until an adviser confirms the change.`;
    }
  }

  if (fact.field === "Risk profile") {
    if (latestDecision === "APPROVE") {
      return `The adviser approved ${fact.currentValue}. It became the current official risk profile, and ${fact.previousValue ?? "the former official value"} is retained as previous history.`;
    }

    if (latestDecision === "KEEP_CURRENT") {
      return `The adviser retained ${fact.currentValue} as the official risk profile. The candidate was not promoted.`;
    }

    if (
      fact.candidateValue &&
      fact.lifecycleStatus === "REQUIRES_ADVISER_APPROVAL"
    ) {
      return `${fact.candidateValue} is a high-impact risk-profile candidate. It requires adviser approval, and ${fact.officialValue} remains the official value.`;
    }
  }

  return fact.memoryExplanation;
};

export type AdviserActionPresentation = {
  title: string;
  detail: string;
};

export const getAdviserActionPresentation = (
  item: AdviserAction,
  fact: ClientFact | null = null
): AdviserActionPresentation => {
  const latestDecision = latestDecisionFor(item);

  if (item.id === "confirm-address") {
    const currentValue = fact?.currentValue ?? fact?.officialValue ?? "the address";
    const previousValue = fact?.previousValue ?? "the former official value";
    const candidateValue = fact?.candidateValue ?? "the candidate address";

    if (latestDecision === "CONFIRM") {
      return {
        title: `${currentValue} address confirmed`,
        detail: `${currentValue} is now the official address, and ${previousValue} is retained as previous history.`
      };
    }

    if (latestDecision === "LEAVE_UNVERIFIED") {
      return {
        title: "Address left unverified",
        detail: `${currentValue} remains the official address, and the candidate was not promoted.`
      };
    }

    return {
      title: `Confirm whether Alex has moved to ${candidateValue}`,
      detail: `${candidateValue} is mentioned in the meeting note, but the address has not been verified.`
    };
  }

  if (item.id === "review-risk-profile") {
    const currentValue =
      fact?.currentValue ?? fact?.officialValue ?? "the current risk profile";
    const previousValue = fact?.previousValue ?? "the former value";
    const candidateValue = fact?.candidateValue ?? "the candidate risk profile";

    if (latestDecision === "APPROVE") {
      return {
        title: `${currentValue} risk profile approved`,
        detail: `${currentValue} is now the official risk profile, and ${previousValue} is retained as previous history.`
      };
    }

    if (latestDecision === "KEEP_CURRENT") {
      return {
        title: "Current risk profile retained",
        detail: `${currentValue} remains the official risk profile, and the candidate was not promoted.`
      };
    }

    return {
      title: `Review the possible change from ${currentValue} to ${candidateValue}`,
      detail:
        "This high-impact candidate needs adviser approval before use."
    };
  }

  return {
    title: item.title,
    detail: item.detail
  };
};
