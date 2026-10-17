// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CardSkeleton } from "../src/components/CardSkeleton";

afterEach(() => {
  cleanup();
});

describe("CardSkeleton (#291)", () => {
  it("marks the container as aria-busy with role='status'", () => {
    render(<CardSkeleton />);

    const statusElement = screen.getByRole("status");
    expect(statusElement).toBeInTheDocument();
    expect(statusElement).toHaveAttribute("aria-busy", "true");
    expect(statusElement).toHaveClass("stack", "stack--tight");
  });

  it("exposes the default loading label to assistive tech via sr-only", () => {
    render(<CardSkeleton />);

    const labelElement = screen.getByText("Reading from the chain…");
    expect(labelElement).toBeInTheDocument();
    expect(labelElement).toHaveClass("sr-only");
    expect(labelElement.tagName.toLowerCase()).toBe("span");

    // The status container's accessible text matches the default label
    const statusElement = screen.getByRole("status");
    expect(statusElement).toHaveTextContent("Reading from the chain…");
  });

  it("renders custom announcement labels for assistive tech", () => {
    const customLabel = "Loading escrow positions…";
    render(<CardSkeleton label={customLabel} />);

    const labelElement = screen.getByText(customLabel);
    expect(labelElement).toBeInTheDocument();
    expect(labelElement).toHaveClass("sr-only");

    const statusElement = screen.getByRole("status");
    expect(statusElement).toHaveTextContent(customLabel);
  });

  it("marks all decorative skeleton lines as aria-hidden='true' to hide them from assistive tech", () => {
    const { container } = render(<CardSkeleton label="Fetching stream data…" />);

    const skeletonLines = container.querySelectorAll(".skeleton-line");
    expect(skeletonLines.length).toBe(3);

    for (const line of skeletonLines) {
      expect(line).toHaveAttribute("aria-hidden", "true");
    }

    // Verify presence of line modifier classes
    expect(container.querySelector(".skeleton-line--narrow")).toBeInTheDocument();
    expect(container.querySelector(".skeleton-line--full")).toBeInTheDocument();
    expect(container.querySelector(".skeleton-line--wide")).toBeInTheDocument();
  });
});
