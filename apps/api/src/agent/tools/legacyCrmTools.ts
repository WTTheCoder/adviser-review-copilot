import { z } from "zod";
import {
  clientFactSchema,
  sourceRecordSchema
} from "@client-review-prep/shared";
import type { ToolDefinition } from "./toolTypes.js";
import type { FactForReview } from "../../services/reviewService.js";

const clientIdInputSchema = z.object({
  clientId: z.string().min(1)
});

export const legacyClientSchema = z.object({
  id: z.string(),
  name: z.string(),
  adviserName: z.string(),
  reviewYear: z.number(),
  reviewStatus: z.string()
});

const legacyFactsOutputSchema = z.array(clientFactSchema);
const legacySourceRecordsOutputSchema = z.array(sourceRecordSchema);

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);

const lifecycleLabel = (status: FactForReview["lifecycleStatus"]) => {
  switch (status) {
    case "CURRENT":
      return "Current";
    case "SUPERSEDED":
      return "Superseded";
    case "NEEDS_CONFIRMATION":
      return "Needs confirmation";
    case "REQUIRES_ADVISER_APPROVAL":
      return "Requires adviser approval";
  }
};

const currentLabelForField = (field: string) => {
  if (field === "Address") {
    return "Current official value";
  }

  if (field === "Risk profile") {
    return "Official value";
  }

  return "Current";
};

const contentToLines = (content: unknown): string[] =>
  Array.isArray(content) && content.every((line) => typeof line === "string")
    ? content
    : [];

export type LegacyCrmToolAdapter = {
  getLegacyClientRecord: (clientId: string) => Promise<{
    id: string;
    name: string;
    adviserName: string;
    reviewYear: number;
    reviewStatus: string;
  } | null>;
  getLegacySourceRecords: (clientId: string) => Promise<
    Array<{
      id: string;
      type: "LEGACY_CRM" | "ANNUAL_REVIEW" | "ADVISER_MEETING_NOTE";
      title: string;
      observedAt: Date;
      summary: string;
      content: unknown;
      lifecycleStatus: FactForReview["lifecycleStatus"];
    }>
  >;
  getLegacyFacts: (clientId: string) => Promise<FactForReview[]>;
};

export const createLegacyCrmTools = (legacyAdapter: LegacyCrmToolAdapter) => {
  const getClient: ToolDefinition<typeof clientIdInputSchema, typeof legacyClientSchema> =
    {
      name: "legacy.getClient",
      description: "Load the client record through the simulated legacy CRM boundary.",
      inputSchema: clientIdInputSchema,
      outputSchema: legacyClientSchema,
      risk: "LOW",
      execute: async ({ clientId }, context) => {
        const client = await legacyAdapter.getLegacyClientRecord(clientId);
        if (!client) {
          throw new Error("CLIENT_NOT_FOUND");
        }
        context.recordEvent({ label: "Client loaded through legacy CRM tool" });
        return {
          id: client.id,
          name: client.name,
          adviserName: client.adviserName,
          reviewYear: client.reviewYear,
          reviewStatus: client.reviewStatus
        };
      }
    };

  const getSourceRecords: ToolDefinition<
    typeof clientIdInputSchema,
    typeof legacySourceRecordsOutputSchema
  > = {
    name: "legacy.getSourceRecords",
    description: "Load source records through the simulated legacy CRM boundary.",
    inputSchema: clientIdInputSchema,
    outputSchema: legacySourceRecordsOutputSchema,
    risk: "LOW",
    execute: async ({ clientId }, context) => {
      const records = await legacyAdapter.getLegacySourceRecords(clientId);
      context.recordEvent({ label: "Source records loaded" });
      return records.map((record) => ({
        id: record.id,
        type: record.type,
        title: record.title,
        observedAt: record.observedAt.toISOString(),
        observedDate: formatDate(record.observedAt),
        summary: record.summary,
        content: contentToLines(record.content),
        lifecycleStatus: record.lifecycleStatus
      }));
    }
  };

  const getFacts: ToolDefinition<
    typeof clientIdInputSchema,
    typeof legacyFactsOutputSchema
  > = {
    name: "legacy.getFacts",
    description: "Load client facts through the simulated legacy CRM boundary.",
    inputSchema: clientIdInputSchema,
    outputSchema: legacyFactsOutputSchema,
    risk: "LOW",
    execute: async ({ clientId }, context) => {
      const facts = await legacyAdapter.getLegacyFacts(clientId);
      context.recordEvent({ label: "Facts loaded" });
      return facts.map((fact) => ({
        id: fact.id,
        field: fact.field,
        currentLabel: currentLabelForField(fact.field),
        currentValue: fact.officialValue,
        officialValue: fact.officialValue,
        candidateValue: fact.candidateValue,
        previousValue: fact.previousValue,
        sourceRecordId: fact.sourceRecordId,
        sourceDocument: fact.sourceRecord.title,
        observedAt: fact.observedAt.toISOString(),
        observedDate: formatDate(fact.observedAt),
        confidence:
          fact.confidence === "High" || fact.confidence === "Medium"
            ? fact.confidence
            : "Low",
        lifecycleStatus: fact.lifecycleStatus,
        status: lifecycleLabel(fact.lifecycleStatus),
        memoryExplanation: fact.explanation
      }));
    }
  };

  return [getClient, getSourceRecords, getFacts] as const;
};
