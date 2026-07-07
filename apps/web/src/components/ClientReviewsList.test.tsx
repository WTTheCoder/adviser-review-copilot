import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ClientReviewsList } from "./ClientReviewsList.js";

type InspectableProps = Record<string, unknown> & {
  children?: ReactNode;
};
type InspectableElement = ReactElement<InspectableProps>;

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

const findButtons = (
  node: ReactNode,
  label: string,
  matches: InspectableElement[] = []
) => {
  if (!isValidElement<InspectableProps>(node)) {
    return matches;
  }

  if (node.type === "button" && textContent(node.props.children) === label) {
    matches.push(node);
  }

  Children.toArray(node.props.children).forEach((child) =>
    findButtons(child, label, matches)
  );

  return matches;
};

describe("ClientReviewsList", () => {
  it("renders the enterprise client reviews worklist", () => {
    const markup = renderToStaticMarkup(
      <ClientReviewsList onOpenAlexReview={() => undefined} />
    );

    expect(markup).toContain("Client Reviews");
    expect(markup).toContain("Manage active annual reviews and open adviser work.");
    expect(markup).toContain("Alex Taylor");
    expect(markup).toContain("Emma Wilson");
    expect(markup).toContain("Daniel Harris");
    expect(markup).toContain("Sarah Brown");
    expect(markup).toContain("Michael Parker");
    expect(markup).toContain("Ready for adviser review");
    expect(markup).toContain("Preparing review");
    expect(markup).toContain("Ready for client meeting");
    expect(markup).toContain("Review completed");
    expect(markup).toContain("Awaiting source documents");
  });

  it("only exposes an active Open review action for Alex Taylor", () => {
    const onOpenAlexReview = vi.fn();
    const tree = ClientReviewsList({ onOpenAlexReview });
    const markup = renderToStaticMarkup(tree);
    const openButtons = findButtons(tree, "Open review");

    expect(openButtons).toHaveLength(1);
    expect(markup).toContain("Unavailable");

    (openButtons[0]?.props.onClick as () => void)();

    expect(onOpenAlexReview).toHaveBeenCalledTimes(1);
  });
});
