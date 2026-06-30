import { describe, expect, it } from "vitest";
import type { SourceRecordDto } from "@client-review-prep/shared";
import type { SupportedCandidateField } from "../ai/contracts/candidateFactSchemas.js";
import {
  maxRetrievedSourceCount,
  selectRelevantSources
} from "./sourceRetrievalPolicy.js";

const createSource = (
  id: string,
  content: string[],
  overrides: Partial<SourceRecordDto> = {}
): SourceRecordDto => ({
  id,
  type: "ADVISER_MEETING_NOTE",
  title: `Source ${id}`,
  observedAt: "2026-06-04T00:00:00.000Z",
  observedDate: "4 June 2026",
  summary: "Integration test source.",
  content,
  lifecycleStatus: "CURRENT",
  upload: null,
  ...overrides
});

describe("source retrieval policy", () => {
  it("sorts by deterministic relevance score, observed date, and source id", () => {
    const sources = [
      createSource("source-mid", ["Alex moved to Fremantle."], {
        observedAt: "2026-06-03T00:00:00.000Z"
      }),
      createSource("source-high", [
        "Alex moved to Subiaco.",
        "Alex is considering high growth."
      ], {
        observedAt: "2026-06-01T00:00:00.000Z"
      }),
      createSource("source-newer", ["Alex moved to Joondalup."], {
        observedAt: "2026-06-05T00:00:00.000Z"
      })
    ];

    expect(selectRelevantSources(sources).map((item) => item.source.id)).toEqual([
      "source-high",
      "source-newer",
      "source-mid"
    ]);
  });

  it("uses stable id tie-breaking after score and observed date ties", () => {
    const sources = [
      createSource("source-b", ["Alex moved to Fremantle."]),
      createSource("source-a", ["Alex moved to Subiaco."])
    ];

    expect(selectRelevantSources(sources).map((item) => item.source.id)).toEqual([
      "source-a",
      "source-b"
    ]);
  });

  it("bounds the selected source count", () => {
    const sources = [
      createSource("source-1", ["Alex moved to Subiaco."]),
      createSource("source-2", ["Alex moved to Fremantle."]),
      createSource("source-3", ["Alex is considering high growth."]),
      createSource("source-4", ["Employer changed to New Energy Ltd."])
    ];

    expect(selectRelevantSources(sources, undefined, 2)).toHaveLength(2);
    expect(selectRelevantSources(sources)).toHaveLength(maxRetrievedSourceCount);
  });

  it("selects a relevant adviser meeting note", () => {
    const selected = selectRelevantSources([
      createSource("source-meeting-note", [
        "Alex may have moved to Subiaco, but the address has not been confirmed."
      ])
    ]);

    expect(selected).toEqual([
      expect.objectContaining({
        source: expect.objectContaining({ id: "source-meeting-note" }),
        relevantFields: ["ADDRESS"],
        fallback: false
      })
    ]);
  });

  it("selects a relevant uploaded document", () => {
    const selected = selectRelevantSources([
      createSource("source-upload-note", ["Salary increased to AUD 140,000."], {
        upload: {
          origin: "UPLOAD",
          documentType: "TEXT",
          safeFilename: "income-note.txt",
          mediaType: "text/plain",
          characterCount: 34,
          byteCount: 34,
          originalByteCount: 34,
          uploadedAt: "2026-06-04T00:00:00.000Z"
        }
      })
    ]);

    expect(selected[0]).toMatchObject({
      source: { id: "source-upload-note" },
      relevantFields: ["ANNUAL_INCOME"],
      fallback: false
    });
  });

  it("excludes irrelevant sources when another relevant source exists", () => {
    const selected = selectRelevantSources([
      createSource("source-general-note", ["Alex asked a general question."]),
      createSource("source-risk-note", ["Alex is considering high growth."])
    ]);

    expect(selected.map((item) => item.source.id)).toEqual(["source-risk-note"]);
  });

  it("does not extract from legacy or annual review records even when hints match", () => {
    const selected = selectRelevantSources([
      createSource("source-legacy-crm", ["Address: East Perth"], {
        type: "LEGACY_CRM"
      }),
      createSource("source-annual-review", ["Risk profile remains Balanced"], {
        type: "ANNUAL_REVIEW"
      }),
      createSource("source-meeting-note", ["Alex is considering high growth."])
    ]);

    expect(selected.map((item) => item.source.id)).toEqual(["source-meeting-note"]);
  });

  it("selects multiple sources that support the same field", () => {
    const selected = selectRelevantSources([
      createSource("source-risk-a", ["Alex is considering high growth."]),
      createSource("source-risk-b", ["Alex may prefer a conservative risk profile."])
    ]);

    expect(selected.map((item) => item.source.id).sort()).toEqual([
      "source-risk-a",
      "source-risk-b"
    ]);
    expect(selected.every((item) => item.relevantFields.includes("RISK_PROFILE"))).toBe(true);
  });

  it("keeps cross-source contradictory risk evidence available", () => {
    const selected = selectRelevantSources([
      createSource("source-risk-change", ["Alex is considering high growth."]),
      createSource("source-risk-current", ["Alex has decided to remain Balanced."])
    ]);

    expect(selected.map((item) => item.source.id).sort()).toEqual([
      "source-risk-change",
      "source-risk-current"
    ]);
  });

  it("falls back to the latest eligible adviser note when no hints match", () => {
    const selected = selectRelevantSources([
      createSource("source-old", ["No supported review facts here."], {
        observedAt: "2026-06-01T00:00:00.000Z"
      }),
      createSource("source-new", ["Still no supported review facts here."], {
        observedAt: "2026-06-02T00:00:00.000Z"
      })
    ]);

    expect(selected).toEqual([
      expect.objectContaining({
        source: expect.objectContaining({ id: "source-new" }),
        fallback: true
      })
    ]);
  });

  it("does not mutate input arrays", () => {
    const sources = [
      createSource("source-b", ["Alex moved to Subiaco."]),
      createSource("source-a", ["Alex moved to Fremantle."])
    ];
    const originalOrder = sources.map((source) => source.id);

    selectRelevantSources(sources);

    expect(sources.map((source) => source.id)).toEqual(originalOrder);
  });

  it("handles case and punctuation variations", () => {
    const selected = selectRelevantSources([
      createSource("source-punctuation", [
        "ADDRESS update: Alex is now living in Joondalup!"
      ])
    ]);

    expect(selected[0]?.relevantFields).toEqual(["ADDRESS"]);
  });

  it.each([
    ["ADDRESS", "Residence changed to Subiaco."],
    ["RISK_PROFILE", "Risk profile may move to High Growth."],
    ["FINANCIAL_GOAL", "Home purchase timeframe changed."],
    ["EMPLOYMENT", "Employer changed to New Energy Ltd."],
    ["ANNUAL_INCOME", "Annual income increased."],
    ["SUPERANNUATION", "Superannuation balance increased."]
  ] as const)(
    "maps %s to conservative source hints",
    (field: SupportedCandidateField, text: string) => {
      const selected = selectRelevantSources([createSource(`source-${field}`, [text])]);

      expect(selected[0]?.relevantFields).toContain(field);
    }
  );
});
