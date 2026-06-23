import type { PrismaClient } from "@prisma/client";

export const createLegacyCrmAdapter = (client: PrismaClient) => ({
  getLegacyClientRecord: async (clientId: string) =>
    client.client.findUnique({
      where: { id: clientId }
    }),

  getLegacySourceRecords: async (clientId: string) =>
    client.sourceRecord.findMany({
      where: { clientId },
      orderBy: { observedAt: "asc" }
    }),

  getLegacyFacts: async (clientId: string) =>
    client.clientFact.findMany({
      where: { clientId },
      include: {
        sourceRecord: true,
        adviserDecisions: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      },
      orderBy: { createdAt: "asc" }
    })
});
