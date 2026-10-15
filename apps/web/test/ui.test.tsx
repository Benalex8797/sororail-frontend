import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CardSkeleton } from "../src/components/CardSkeleton";
import { ErrorNotice } from "../src/components/Feedback";
import { Address } from "../src/components/Money";

describe("loading and recovery controls", () => {
  it("renders a retry action inside a failed RPC notice", () => {
    const markup = renderToStaticMarkup(
      <ErrorNotice error={new Error("RPC unavailable")} onRetry={vi.fn()} />,
    );

    expect(markup).toContain(">Retry</button>");
  });

  it("renders an accessible card skeleton", () => {
    const markup = renderToStaticMarkup(<CardSkeleton label="Loading streams" />);

    expect(markup).toContain("aria-busy=\"true\"");
    expect(markup).toContain("Loading streams");
  });

  it("keeps the full address available from the copy control", () => {
    const value = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV";
    const markup = renderToStaticMarkup(<Address value={value} />);

    expect(markup).toContain("type=\"button\"");
    expect(markup).toContain(value);
  });
});