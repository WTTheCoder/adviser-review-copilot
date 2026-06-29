import { LifecycleStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildMeaningfulChanges,
  buildSummaryMetrics,
  countUnresolvedReviewItems,
  mapFactToDto,
  shouldIncludeAdviserAction,
  type FactForReview
} from "./reviewService.js";

const createFact = (
  overrides: Partial<FactForReview> = {}
): FactForReview => ({
  id: "fact-address",
  field: "Address",
  officialValue: "East Perth",
  candidateValue: "Subiaco",
  previousValue: null,
  sourceRecordId: "source-annual-review",
  observedAt: new Date("2025-11-16T00:00:00.000Z"),
  officialSourceRecordId: "source-annual-review",
  officialObservedAt: new Date("2025-11-16T00:00:00.000Z"),
  previousSourceRecordId: null,
  previousObservedAt: null,
  candidateSourceRecordId: "source-meeting-note",
  candidateObservedAt: new Date("2026-06-04T00:00:00.000Z"),
  candidateEvidence:
    "Alex may have moved to Subiaco, but the address has not been confirmed.",
  confidence: "Medium",
  lifecycleStatus: LifecycleStatus.NEEDS_CONFIRMATION,
  explanation: "Demo explanation",
  officialSourceRecord: {
    title: "Annual Review"
  },
  previousSourceRecord: null,
  candidateSourceRecord: {
    title: "Adviser Meeting Note"
  },
  adviserDecisions: [],
  ...overrides
});

describe("review service read-back mapping", () => {
  it("returns Subiaco as official after CONFIRM persistence", () => {
    const dto = mapFactToDto(
      createFact({
        officialValue: "Subiaco",
        candidateValue: null,
        previousValue: "East Perth",
        lifecycleStatus: LifecycleStatus.CURRENT
      })
    );

    expect(dto.officialValue).toBe("Subiaco");
    expect(dto.currentValue).toBe("Subiaco");
    expect(dto.previousValue).toBe("East Perth");
    expect(dto.status).toBe("Current");
  });

  it("returns Growth-oriented as official after APPROVE persistence", () => {
    const dto = mapFactToDto(
      createFact({
        id: "fact-risk-profile",
        field: "Risk profile",
        officialValue: "Growth-oriented",
        candidateValue: null,
        previousValue: "Balanced",
        lifecycleStatus: LifecycleStatus.CURRENT
      })
    );

    expect(dto.officialValue).toBe("Growth-oriented");
    expect(dto.currentValue).toBe("Growth-oriented");
    expect(dto.previousValue).toBe("Balanced");
    expect(dto.status).toBe("Current");
  });

  it("returns East Perth as official after LEAVE_UNVERIFIED persistence", () => {
    const dto = mapFactToDto(
      createFact({
        officialValue: "East Perth",
        candidateValue: null,
        previousValue: null,
        lifecycleStatus: LifecycleStatus.CURRENT
      })
    );

    expect(dto.officialValue).toBe("East Perth");
    expect(dto.currentValue).toBe("East Perth");
  });

  it("returns Balanced as official after KEEP_CURRENT persistence", () => {
    const dto = mapFactToDto(
      createFact({
        id: "fact-risk-profile",
        field: "Risk profile",
        officialValue: "Balanced",
        candidateValue: null,
        previousValue: null,
        lifecycleStatus: LifecycleStatus.CURRENT
      })
    );

    expect(dto.officialValue).toBe("Balanced");
    expect(dto.currentValue).toBe("Balanced");
  });

  it("returns reset Address candidate-review state", () => {
    const dto = mapFactToDto(createFact());

    expect(dto.officialValue).toBe("East Perth");
    expect(dto.candidateValue).toBe("Subiaco");
    expect(dto.status).toBe("Needs confirmation");
  });

  it("returns reset Risk profile candidate-review state", () => {
    const dto = mapFactToDto(
      createFact({
        id: "fact-risk-profile",
        field: "Risk profile",
        officialValue: "Balanced",
        candidateValue: "Growth-oriented",
        lifecycleStatus: LifecycleStatus.REQUIRES_ADVISER_APPROVAL
      })
    );

    expect(dto.officialValue).toBe("Balanced");
    expect(dto.candidateValue).toBe("Growth-oriented");
    expect(dto.status).toBe("Requires adviser approval");
  });

  it("derives unresolved-review metrics from final fact projection", () => {
    const facts = [
      createFact(),
      createFact({
        id: "fact-risk-profile",
        field: "Risk profile",
        candidateValue: "Growth-oriented",
        lifecycleStatus: LifecycleStatus.REQUIRES_ADVISER_APPROVAL
      })
    ];
    const changes = buildMeaningfulChanges(facts);
    const metrics = buildSummaryMetrics(facts, changes);

    expect(countUnresolvedReviewItems(facts)).toBe(2);
    expect(
      metrics.find((metric) => metric.label === "Items needing confirmation")
        ?.value
    ).toBe("2");
    expect(metrics.find((metric) => metric.label === "Meaningful changes")?.value)
      .toBe("6");
  });

  it("does not count cleared candidates as unresolved or candidate-driven changes", () => {
    const facts = [
      createFact({
        candidateValue: null,
        lifecycleStatus: LifecycleStatus.CURRENT
      }),
      createFact({
        id: "fact-risk-profile",
        field: "Risk profile",
        candidateValue: null,
        lifecycleStatus: LifecycleStatus.CURRENT
      })
    ];
    const changes = buildMeaningfulChanges(facts);
    const metrics = buildSummaryMetrics(facts, changes);

    expect(countUnresolvedReviewItems(facts)).toBe(0);
    expect(metrics.find((metric) => metric.label === "Meaningful changes")?.value)
      .toBe("4");
    expect(
      metrics.find((metric) => metric.label === "Items needing confirmation")
        ?.value
    ).toBe("0");
  });

  it("does not expose a pending risk action without a candidate or persisted decision", () => {
    const risk = createFact({
      id: "fact-risk-profile",
      field: "Risk profile",
      candidateValue: null,
      lifecycleStatus: LifecycleStatus.CURRENT
    });
    const changes = buildMeaningfulChanges([risk]);
    const metrics = buildSummaryMetrics([risk], changes);

    expect(shouldIncludeAdviserAction(risk)).toBe(false);
    expect(metrics.find((metric) => metric.label === "Meaningful changes")?.value)
      .toBe("4");
    expect(
      metrics.find((metric) => metric.label === "Items needing confirmation")
        ?.value
    ).toBe("0");
  });

  it("keeps only the address increment when contradictory risk evidence is omitted", () => {
    const facts = [
      createFact({
        candidateValue: "Joondalup",
        lifecycleStatus: LifecycleStatus.NEEDS_CONFIRMATION
      }),
      createFact({
        id: "fact-risk-profile",
        field: "Risk profile",
        candidateValue: null,
        lifecycleStatus: LifecycleStatus.CURRENT
      })
    ];
    const changes = buildMeaningfulChanges(facts);
    const metrics = buildSummaryMetrics(facts, changes);

    expect(metrics.find((metric) => metric.label === "Meaningful changes")?.value)
      .toBe("5");
    expect(
      metrics.find((metric) => metric.label === "Items needing confirmation")
        ?.value
    ).toBe("1");
    expect(shouldIncludeAdviserAction(facts[1]!)).toBe(false);
  });
});
