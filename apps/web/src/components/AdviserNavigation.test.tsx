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
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain("Overview");
    expect(markup).toContain("My Actions");
    expect(markup).toContain("Client Review");
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain("Jordan Lee");
  });

  it("requests the selected view when a navigation item is activated", () => {
    const onChange = vi.fn();
    const tree = AdviserNavigation({
      activeView: "dashboard",
      onChange
    });
    const myActions = findButtonByText(tree, "My Actions");

    expect(myActions?.props.role).toBe("tab");
    expect(myActions?.props.onClick).toBeTypeOf("function");
    (myActions?.props.onClick as () => void)();

    expect(onChange).toHaveBeenCalledWith("my-actions");
  });
});
