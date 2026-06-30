import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { supportedCandidateFieldSchema } from "../contracts/candidateFactSchemas.js";

const fixtureCandidateExpectationSchema = z
  .object({
    field: supportedCandidateFieldSchema,
    acceptedValues: z.array(z.string().min(1)).nonempty(),
    confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
    requiredEvidence: z.string().min(1),
    expectedHumanReview: z.literal(true)
  })
  .strict();

const fixtureSchema = z
  .object({
    id: z.string().min(1),
    note: z.string().min(1),
    expectedCandidates: z.array(fixtureCandidateExpectationSchema),
    mustNotIncludeFields: z.array(supportedCandidateFieldSchema),
    expectWarnings: z.boolean(),
    expectZeroCandidates: z.boolean()
  })
  .strict()
  .refine(
    (fixture) =>
      fixture.expectZeroCandidates === (fixture.expectedCandidates.length === 0),
    "expectZeroCandidates must match expectedCandidates length"
  );

describe("candidate fact extraction eval fixtures", () => {
  it("have precise schema-valid expectations for future live evaluation", async () => {
    const fileUrl = new URL(
      "./candidate-fact-extraction-fixtures.json",
      import.meta.url
    );
    const fixtures = z
      .array(fixtureSchema)
      .min(10)
      .parse(JSON.parse(await readFile(fileUrl, "utf8")));

    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      "clear-address-change",
      "uncertain-address-change",
      "risk-profile-discussion",
      "free-form-risk-profile-canonicalization",
      "general-investment-discussion",
      "prompt-injection-attempt",
      "conflicting-statements",
      "numeric-value-formatting",
      "automatic-approval-instruction",
      "retained-current-risk-profile"
    ]);
  });
});
