import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ReviewResponse } from "@client-review-prep/shared";
import { TechnicalDetailsPanel } from "./TechnicalDetailsPanel.js";

const review: ReviewResponse = {
  client: {
    id: "demo-alex-taylor",
    name: "Alex Taylor",
    adviserName: "Jordan Bennett",
    reviewYear: 2026,
    reviewStatus: "Ready for adviser review"
  },
  summaryMetrics: [],
  sourceRecords: [],
  clientFacts: [],
  meaningfulChanges: [],
  adviserActions: [],
  workflowTrace: [
    {
      label: "Skill selected: prepare-annual-review",
      status: "COMPLETE",
      detail: null
    }
  ],
  executionMetadata: {
    skillName: "prepare-annual-review",
    skillVersion: "legacy",
    status: "SUCCEEDED"
  }
};

describe("TechnicalDetailsPanel", () => {
  it("is collapsed by default with accessible disclosure semantics", () => {
    const markup = renderToStaticMarkup(
      <TechnicalDetailsPanel
        apiStatus="connected"
        extractionLabel="Extraction: Mock"
        extractionWarning="Mock extraction was used"
        latestUploadTrace={null}
        reviewData={review}
        skillLabel="Selected skill: prepare-annual-review"
      />
    );

    expect(markup).toContain("Technical details");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain("aria-controls=");
    expect(markup).not.toContain("API connected");
    expect(markup).not.toContain("Extraction: Mock");
    expect(markup).not.toContain("View execution trace");
  });

  it("reveals preserved diagnostic content when expanded", () => {
    const markup = renderToStaticMarkup(
      <TechnicalDetailsPanel
        apiStatus="connected"
        extractionLabel="Extraction: Mock"
        extractionWarning="Mock extraction was used"
        latestUploadTrace={{
          skillName: "ingest-client-document",
          skillVersion: "legacy",
          status: "SUCCEEDED",
          events: [
            {
              sequence: 1,
              label: "Upload request validated",
              status: "COMPLETE",
              detail: null,
              timestamp: "2026-06-24T00:00:00.000Z"
            }
          ]
        }}
        reviewData={review}
        skillLabel="Selected skill: prepare-annual-review"
        defaultExpanded
      />
    );

    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain("API connected");
    expect(markup).toContain("Extraction: Mock");
    expect(markup).toContain("Mock extraction was used");
    expect(markup).toContain("View execution trace");
    expect(markup).toContain("Skill selected: prepare-annual-review");
    expect(markup).toContain("View upload execution trace");
    expect(markup).toContain("Upload request validated");
    expect(markup).toContain("Execution metadata");
  });
});
