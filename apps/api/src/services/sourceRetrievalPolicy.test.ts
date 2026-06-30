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

const broadMatchContent = (label: string) => [
  `${label}: Alex moved to Subiaco.`,
  "The home purchase goal remains active.",
  "Employer changed to New Energy Ltd.",
  "Annual income increased."
];

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

  it("retains a newer risk-profile source when older broad sources score higher", () => {
    const sources = [
      createSource("source-broad-a", broadMatchContent("A"), {
        observedAt: "2026-06-01T00:00:00.000Z"
      }),
      createSource("source-broad-b", broadMatchContent("B"), {
        observedAt: "2026-06-02T00:00:00.000Z"
      }),
      createSource("source-broad-c", broadMatchContent("C"), {
        observedAt: "2026-06-03T00:00:00.000Z"
      }),
      createSource("source-new-risk", ["Alex has decided to remain Balanced."], {
        observedAt: "2026-06-04T00:00:00.000Z"
      })
    ];

    const selectedIds = selectRelevantSources(sources).map((item) => item.source.id);

    expect(selectedIds).toContain("source-new-risk");
    expect(selectedIds).toHaveLength(maxRetrievedSourceCount);
  });

  it("retains a newer address source when older broad sources score higher", () => {
    const sources = [
      createSource("source-broad-a", broadMatchContent("A"), {
        observedAt: "2026-06-01T00:00:00.000Z"
      }),
      createSource("source-broad-b", broadMatchContent("B"), {
        observedAt: "2026-06-02T00:00:00.000Z"
      }),
      createSource("source-broad-c", broadMatchContent("C"), {
        observedAt: "2026-06-03T00:00:00.000Z"
      }),
      createSource("source-new-address", ["Alex is now living in Fremantle."], {
        observedAt: "2026-06-04T00:00:00.000Z"
      })
    ];

    expect(selectRelevantSources(sources).map((item) => item.source.id)).toContain(
      "source-new-address"
    );
  });

  it("retains separate newest address and risk-profile sources with one global fill slot", () => {
    const sources = [
      createSource("source-global-a", broadMatchContent("A"), {
        observedAt: "2026-06-01T00:00:00.000Z"
      }),
      createSource("source-global-b", broadMatchContent("B"), {
        observedAt: "2026-06-02T00:00:00.000Z"
      }),
      createSource("source-new-address", ["Alex is now living in Joondalup."], {
        observedAt: "2026-06-05T00:00:00.000Z"
      }),
      createSource("source-new-risk", ["Alex is considering High Growth."], {
        observedAt: "2026-06-06T00:00:00.000Z"
      })
    ];

    const selectedIds = selectRelevantSources(sources).map((item) => item.source.id);

    expect(selectedIds).toEqual([
      "source-global-b",
      "source-new-risk",
      "source-new-address"
    ]);
  });

  it("deduplicates one source protected for both high-impact fields and fills deterministically", () => {
    const sources = [
      createSource("source-protected-both", [
        "Alex moved to Fremantle.",
        "Alex is considering High Growth."
      ], {
        observedAt: "2026-06-06T00:00:00.000Z"
      }),
      createSource("source-fill-a", ["Employer changed to New Energy Ltd."], {
        observedAt: "2026-06-04T00:00:00.000Z"
      }),
      createSource("source-fill-b", ["Annual income increased."], {
        observedAt: "2026-06-05T00:00:00.000Z"
      }),
      createSource("source-fill-c", ["Superannuation balance increased."], {
        observedAt: "2026-06-03T00:00:00.000Z"
      })
    ];

    expect(selectRelevantSources(sources).map((item) => item.source.id)).toEqual([
      "source-protected-both",
      "source-fill-b",
      "source-fill-a"
    ]);
  });

  it("keeps existing global ranking when no high-impact fields match", () => {
    const sources = [
      createSource("source-income", ["Annual income increased."], {
        observedAt: "2026-06-06T00:00:00.000Z"
      }),
      createSource("source-employment-goal", [
        "Employer changed to New Energy Ltd.",
        "The property goal remains active."
      ], {
        observedAt: "2026-06-01T00:00:00.000Z"
      }),
      createSource("source-super", ["Superannuation balance increased."], {
        observedAt: "2026-06-05T00:00:00.000Z"
      })
    ];

    expect(selectRelevantSources(sources).map((item) => item.source.id)).toEqual([
      "source-employment-goal",
      "source-income",
      "source-super"
    ]);
  });

  it("uses score then id to break protected-source date ties", () => {
    const sources = [
      createSource("source-risk-low", ["Alex is considering High Growth."], {
        observedAt: "2026-06-06T00:00:00.000Z"
      }),
      createSource("source-risk-high", [
        "Alex is considering High Growth.",
        "The home purchase goal remains active."
      ], {
        observedAt: "2026-06-06T00:00:00.000Z"
      }),
      createSource("source-address-b", ["Alex moved to Subiaco."], {
        observedAt: "2026-06-06T00:00:00.000Z"
      }),
      createSource("source-address-a", ["Alex moved to Fremantle."], {
        observedAt: "2026-06-06T00:00:00.000Z"
      })
    ];

    const selectedIds = selectRelevantSources(sources, undefined, 2).map(
      (item) => item.source.id
    );

    expect(selectedIds).toEqual(["source-risk-high", "source-address-a"]);
  });

  it("does not mutate input arrays while protecting high-impact sources", () => {
    const sources = [
      createSource("source-broad-c", broadMatchContent("C"), {
        observedAt: "2026-06-03T00:00:00.000Z"
      }),
      createSource("source-new-risk", ["Alex has decided to remain Balanced."], {
        observedAt: "2026-06-04T00:00:00.000Z"
      }),
      createSource("source-broad-a", broadMatchContent("A"), {
        observedAt: "2026-06-01T00:00:00.000Z"
      }),
      createSource("source-broad-b", broadMatchContent("B"), {
        observedAt: "2026-06-02T00:00:00.000Z"
      })
    ];
    const originalOrder = sources.map((source) => source.id);

    selectRelevantSources(sources);

    expect(sources.map((source) => source.id)).toEqual(originalOrder);
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
