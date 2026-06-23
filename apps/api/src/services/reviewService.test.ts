import { LifecycleStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { mapFactToDto, type FactForReview } from "./reviewService.js";

const createFact = (
  overrides: Partial<FactForReview> = {}
): FactForReview => ({
  id: "fact-address",
  field: "Address",
  officialValue: "East Perth",
  candidateValue: "Subiaco",
  previousValue: null,
  sourceRecordId: "source-meeting-note",
  observedAt: new Date("2026-06-04T00:00:00.000Z"),
  confidence: "Medium",
  lifecycleStatus: LifecycleStatus.NEEDS_CONFIRMATION,
  explanation: "Demo explanation",
  sourceRecord: {
    title: "Adviser Meeting Note"
  },
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
});
