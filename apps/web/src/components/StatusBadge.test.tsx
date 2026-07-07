import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge.js";

describe("StatusBadge", () => {
  it("uses the shared compact badge treatment for long adviser statuses", () => {
    const markup = renderToStaticMarkup(
      <StatusBadge status="Requires adviser approval" />
    );

    expect(markup).toContain("status-chip");
    expect(markup).toContain("status-chip-info");
    expect(markup).toContain("Requires adviser approval");
    expect(markup).not.toContain("rounded-full");
  });

  it("preserves semantic lifecycle colours", () => {
    expect(renderToStaticMarkup(<StatusBadge status="Current" />)).toContain(
      "status-chip-success"
    );
    expect(
      renderToStaticMarkup(<StatusBadge status="Needs confirmation" />)
    ).toContain("status-chip-warning");
  });
});
