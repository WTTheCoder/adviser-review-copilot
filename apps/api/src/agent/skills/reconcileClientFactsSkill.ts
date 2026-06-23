import { z } from "zod";
import {
  clientFactSchema,
  sourceRecordSchema
} from "@client-review-prep/shared";
import { legacyClientSchema } from "../tools/legacyCrmTools.js";
import type { SkillDefinition } from "./skillTypes.js";

export const meaningfulChanges = [
  "Employer changed from ABC Mining to New Energy Ltd",
  "Annual income increased from AUD 110,000 to AUD 135,000",
  "Superannuation increased from AUD 125,000 to AUD 174,000",
  "Home-buying timeframe changed from five years to two years"
];

export const reconcileClientFactsInputSchema = z.object({
  client: legacyClientSchema,
  sourceRecords: z.array(sourceRecordSchema),
  existingFacts: z.array(clientFactSchema)
});

export const reconcileClientFactsOutputSchema = z.object({
  currentFacts: z.array(clientFactSchema),
  historicalOrSupersededFacts: z.array(clientFactSchema),
  candidateFacts: z.array(clientFactSchema),
  adviserReviewItems: z.array(clientFactSchema),
  meaningfulChanges: z.array(z.string())
});

export const reconcileClientFacts = (
  input: z.infer<typeof reconcileClientFactsInputSchema>
): z.infer<typeof reconcileClientFactsOutputSchema> => {
  const currentFacts = input.existingFacts.filter(
    (fact) => fact.lifecycleStatus === "CURRENT"
  );
  const candidateFacts = input.existingFacts.filter((fact) =>
    ["NEEDS_CONFIRMATION", "REQUIRES_ADVISER_APPROVAL"].includes(
      fact.lifecycleStatus
    )
  );
  const historicalOrSupersededFacts = input.existingFacts.filter(
    (fact) => fact.lifecycleStatus === "SUPERSEDED" || fact.previousValue !== null
  );

  return {
    currentFacts,
    historicalOrSupersededFacts,
    candidateFacts,
    adviserReviewItems: candidateFacts,
    meaningfulChanges
  };
};

export const reconcileClientFactsSkill: SkillDefinition<
  typeof reconcileClientFactsInputSchema,
  typeof reconcileClientFactsOutputSchema
> = {
  name: "reconcile-client-facts",
  description: "Deterministically reconcile current, historical, and candidate facts.",
  version: "1",
  inputSchema: reconcileClientFactsInputSchema,
  outputSchema: reconcileClientFactsOutputSchema,
  allowedTools: [],
  execute: async (input, context) => {
    const output = reconcileClientFacts(input);
    context.recordEvent({ label: "Facts reconciled" });
    return output;
  }
};
