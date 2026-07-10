import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell.js";

describe("AppShell", () => {
  it("wraps application content and preserves the future navigation slot", () => {
    const markup = renderToStaticMarkup(
      <AppShell navigation={<nav aria-label="Primary">Navigation</nav>}>
        <section>Workspace</section>
      </AppShell>
    );

    expect(markup).toContain("<main");
    expect(markup).toContain("Navigation");
    expect(markup).toContain("Workspace");
  });
});
