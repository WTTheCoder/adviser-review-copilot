import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdviserNavigation } from "./AdviserNavigation.js";

type InspectableProps = Record<string, unknown> & {
  children?: ReactNode;
};
type InspectableElement = ReactElement<InspectableProps>;

const findButtonByText = (
  node: ReactNode,
  label: string
): InspectableElement | null => {
  if (!isValidElement<InspectableProps>(node)) {
    return null;
  }

  if (
    node.type === "button" &&
    textContent(node.props.children) === label
  ) {
    return node;
  }

  for (const child of Children.toArray(node.props.children)) {
    const match = findButtonByText(child, label);
    if (match) {
      return match;
    }
  }

  return null;
};

const textContent = (node: ReactNode): string =>
  Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }
      if (isValidElement<InspectableProps>(child)) {
        return textContent(child.props.children);
      }
      return "";
    })
    .join("");

describe("AdviserNavigation", () => {
  it("renders accessible navigation with the selected view", () => {
    const markup = renderToStaticMarkup(
      <AdviserNavigation activeView="my-actions" onChange={() => undefined} />
    );

    expect(markup).toContain('aria-label="Primary adviser views"');
    expect(markup).not.toContain('role="tablist"');
    expect(markup).not.toContain('role="tab"');
    expect(markup).toContain("Overview");
    expect(markup).toContain("My Actions");
    expect(markup).toContain("Client Reviews");
    expect(markup).not.toContain("aria-selected");
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain("Jordan Bennett");
    expect(markup).toContain("Adviser workspace");
    expect(markup).not.toContain(">Adviser</div>");
    expect(markup).not.toContain("Adviser review queue");
  });

  it("requests the selected view when a navigation item is activated", () => {
    const onChange = vi.fn();
    const tree = AdviserNavigation({
      activeView: "dashboard",
      onChange
    });
    const myActions = findButtonByText(tree, "My Actions");

    expect(myActions?.props.role).toBeUndefined();
    expect(myActions?.props["aria-current"]).toBeUndefined();
    expect(myActions?.props.onClick).toBeTypeOf("function");
    (myActions?.props.onClick as () => void)();

    expect(onChange).toHaveBeenCalledWith("my-actions");
  });

  it("marks only the active destination as the current page", () => {
    const tree = AdviserNavigation({
      activeView: "client-review",
      onChange: () => undefined
    });
    const overview = findButtonByText(tree, "Overview");
    const clientReview = findButtonByText(tree, "Client Reviews");

    expect(overview?.props["aria-current"]).toBeUndefined();
    expect(clientReview?.props["aria-current"]).toBe("page");
  });

  it("opens the Client Reviews list from the navigation item", () => {
    const onChange = vi.fn();
    const tree = AdviserNavigation({
      activeView: "client-review",
      onChange
    });
    const clientReviews = findButtonByText(tree, "Client Reviews");

    (clientReviews?.props.onClick as () => void)();

    expect(onChange).toHaveBeenCalledWith("client-reviews");
  });
});
