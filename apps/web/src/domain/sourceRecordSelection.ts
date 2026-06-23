import type { SourceRecord } from "../types/demo.js";

export const resolveSelectedSourceRecordId = (
  records: readonly SourceRecord[],
  selectedRecordId: string
) => {
  if (records.some((record) => record.id === selectedRecordId)) {
    return selectedRecordId;
  }

  return records[0]?.id ?? "";
};
