import { describe, expect, it } from "vitest";
import type { SourceRecord } from "../types/demo.js";
import { resolveSelectedSourceRecordId } from "./sourceRecordSelection.js";

const createRecord = (id: string): SourceRecord => ({
  id,
  type: "ADVISER_MEETING_NOTE",
  title: id,
  observedAt: "2026-06-04T00:00:00.000Z",
  observedDate: "4 June 2026",
  summary: "Demo source",
  content: ["Demo content"],
  lifecycleStatus: "CURRENT"
});

describe("source record selection", () => {
  it("keeps an existing selected source record", () => {
    const records = [createRecord("source-one"), createRecord("source-two")];

    expect(resolveSelectedSourceRecordId(records, "source-two")).toBe(
      "source-two"
    );
  });

  it("removes a selected uploaded source that no longer exists", () => {
    const records = [
      createRecord("source-meeting-note"),
      createRecord("source-annual-review")
    ];

    expect(
      resolveSelectedSourceRecordId(records, "source-upload-demo-alex-taylor-1")
    ).toBe("source-meeting-note");
  });

  it("returns no selection when records are empty", () => {
    expect(resolveSelectedSourceRecordId([], "source-upload-test")).toBe("");
  });
});
