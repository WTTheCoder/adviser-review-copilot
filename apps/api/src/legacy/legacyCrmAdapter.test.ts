import { describe, expect, it } from "vitest";
import { DEMO_CLIENT_ID } from "../demo/seedDemoData.js";
import { createLegacyCrmAdapter } from "./legacyCrmAdapter.js";

describe("legacy CRM adapter", () => {
  it("reads the seeded fictional client record through the controlled boundary", async () => {
    const adapter = createLegacyCrmAdapter({
      client: {
        findUnique: async () => ({
          id: DEMO_CLIENT_ID,
          name: "Alex Taylor",
          adviserName: "Jordan Bennett",
          reviewYear: 2026,
          reviewStatus: "Preparation in progress",
          createdAt: new Date(),
          updatedAt: new Date()
        })
      },
      sourceRecord: { findMany: async () => [] },
      clientFact: { findMany: async () => [] }
    } as never);

    await expect(adapter.getLegacyClientRecord(DEMO_CLIENT_ID)).resolves.toMatchObject(
      {
        id: DEMO_CLIENT_ID,
        name: "Alex Taylor"
      }
    );
  });
});
