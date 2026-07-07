import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DemoControlsPanel } from "./DemoControlsPanel.js";

describe("DemoControlsPanel", () => {
  it("is collapsed by default with accessible disclosure semantics", () => {
    const markup = renderToStaticMarkup(
      <DemoControlsPanel
        isLoading={false}
        isResetting={false}
        onResetDemo={() => undefined}
      />
    );

    expect(markup).toContain("Demo controls");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain("aria-controls=");
    expect(markup).not.toContain("Reset local demo data");
  });

  it("reveals reset as a secondary control when expanded", () => {
    const markup = renderToStaticMarkup(
      <DemoControlsPanel
        isLoading={false}
        isResetting={false}
        onResetDemo={() => undefined}
        defaultExpanded
      />
    );

    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain("Reset the local review data");
    expect(markup).toContain("Reset local demo data");
  });

});
