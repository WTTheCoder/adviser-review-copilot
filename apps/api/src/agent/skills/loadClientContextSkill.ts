import { z } from "zod";
import {
  clientFactSchema,
  sourceRecordSchema
} from "@client-review-prep/shared";
import { legacyClientSchema } from "../tools/legacyCrmTools.js";
import type { SkillDefinition } from "./skillTypes.js";

export const loadClientContextInputSchema = z.object({
  clientId: z.string().min(1)
});

export const loadClientContextOutputSchema = z.object({
  client: legacyClientSchema,
  sourceRecords: z.array(sourceRecordSchema),
  existingFacts: z.array(clientFactSchema)
});

export const loadClientContextSkill: SkillDefinition<
  typeof loadClientContextInputSchema,
  typeof loadClientContextOutputSchema
> = {
  name: "load-client-context",
  description: "Load client, source records, and facts through controlled legacy tools.",
  version: "1",
  inputSchema: loadClientContextInputSchema,
  outputSchema: loadClientContextOutputSchema,
  allowedTools: [
    "legacy.getClient",
    "legacy.getSourceRecords",
    "legacy.getFacts"
  ],
  execute: async ({ clientId }, context) => {
    const client = await context.toolRegistry.execute(
      "legacy.getClient",
      { clientId },
      loadClientContextSkill.allowedTools,
      context,
      legacyClientSchema
    );
    const sourceRecords = await context.toolRegistry.execute(
      "legacy.getSourceRecords",
      { clientId },
      loadClientContextSkill.allowedTools,
      context,
      z.array(sourceRecordSchema)
    );
    const existingFacts = await context.toolRegistry.execute(
      "legacy.getFacts",
      { clientId },
      loadClientContextSkill.allowedTools,
      context,
      z.array(clientFactSchema)
    );

    return { client, sourceRecords, existingFacts };
  }
};
