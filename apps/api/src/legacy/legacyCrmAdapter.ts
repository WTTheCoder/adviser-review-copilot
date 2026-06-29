import type { PrismaClient } from "@prisma/client";

export const createLegacyCrmAdapter = (client: PrismaClient) => ({
  getLegacyClientRecord: async (clientId: string) =>
    client.client.findUnique({
      where: { id: clientId }
    }),

  getLegacySourceRecords: async (clientId: string) => {
    const records = await client.sourceRecord.findMany({
      where: { clientId },
      orderBy: [{ observedAt: "desc" }, { id: "asc" }]
    });

    return records.sort((first, second) => {
      const observedDifference =
        second.observedAt.getTime() - first.observedAt.getTime();
      if (observedDifference !== 0) {
        return observedDifference;
      }

      const firstUploaded = String(first.id).startsWith("source-upload-");
      const secondUploaded = String(second.id).startsWith("source-upload-");
      if (firstUploaded !== secondUploaded) {
        return firstUploaded ? -1 : 1;
      }

      return first.id.localeCompare(second.id);
    });
  },

  getLegacyFacts: async (clientId: string) =>
    client.clientFact.findMany({
      where: { clientId },
      include: {
        officialSourceRecord: true,
        previousSourceRecord: true,
        candidateSourceRecord: true,
        adviserDecisions: {
          orderBy: { createdAt: "desc" },
          take: 5
        }
      },
      orderBy: { createdAt: "asc" }
    })
});
