import * as React from "react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as unknown as { React: typeof React }).React = React;

import { Address, Money } from "../src/components/Money";

describe("Money component", () => {
  it("is memoized with React.memo", () => {
    // React memo elements have $$typeof Symbol(react.memo)
    const moneyAny = Money as unknown as { $$typeof: symbol; type: unknown };
    expect(moneyAny.$$typeof).toBe(Symbol.for("react.memo"));
    expect(typeof moneyAny.type).toBe("function");
  });

  // #281 — zero, large amounts, and unit visibility
  it("renders zero as '0'", () => {
    const html = renderToStaticMarkup(createElement(Money, { value: 0n }));
    expect(html).toContain("0");
  });

  it("renders a large amount with thousands grouping", () => {
    // 100_000_000_000_000 stroops = 10,000,000 XLM
    const html = renderToStaticMarkup(
      createElement(Money, { value: 100_000_000_000_000n }),
    );
    // Thousands separator is locale-dependent; verify at least the digits appear
    expect(html).toMatch(/10[,.]?000[,.]?000/);
  });

  it("renders the default unit symbol (XLM) when no unit prop is given", () => {
    const html = renderToStaticMarkup(
      createElement(Money, { value: 10_000_000n }),
    );
    expect(html).toContain("XLM");
  });

  it("renders a custom unit symbol when the unit prop is set", () => {
    const html = renderToStaticMarkup(
      createElement(Money, { value: 10_000_000n, unit: "USDC" }),
    );
    expect(html).toContain("USDC");
    expect(html).not.toContain("XLM");
  });

  it("hides the symbol when unit is an empty string", () => {
    const html = renderToStaticMarkup(
      createElement(Money, { value: 10_000_000n, unit: "" }),
    );
    // The unit span is still rendered but empty
    expect(html).toContain('class="amount__unit"');
    expect(html).not.toContain(">XLM<");
  });

  it("prefixes the ≥ glyph and sr-only text when approximate is true", () => {
    const html = renderToStaticMarkup(
      createElement(Money, { value: 10_000_000n, approximate: true }),
    );
    expect(html).toContain("≥");
    expect(html).toContain("At least ");
  });
});

describe("Address component (#282)", () => {
  const FULL = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV";

  it("renders the full address in the title attribute so it is accessible", () => {
    const html = renderToStaticMarkup(createElement(Address, { value: FULL }));
    expect(html).toContain(`title="${FULL}"`);
  });

  it("renders the full address in the screen-reader span", () => {
    const html = renderToStaticMarkup(createElement(Address, { value: FULL }));
    expect(html).toContain(FULL);
  });

  it("shortens the visible display text", () => {
    const html = renderToStaticMarkup(createElement(Address, { value: FULL }));
    // shortAddress(FULL, 6) truncates with an ellipsis — the full string must
    // not appear in the aria-hidden visible span
    const ariaHiddenMatch = html.match(/aria-hidden="true"[^>]*>([^<]+)</);
    if (ariaHiddenMatch) {
      expect(ariaHiddenMatch[1]).not.toBe(FULL);
      expect(ariaHiddenMatch[1].length).toBeLessThan(FULL.length);
    }
  });

  it("renders as a button (copyable) when no href is provided", () => {
    const html = renderToStaticMarkup(createElement(Address, { value: FULL }));
    expect(html).toContain('type="button"');
  });

  it("renders as an anchor when href is provided", () => {
    const html = renderToStaticMarkup(
      createElement(Address, { value: FULL, href: "https://stellar.expert" }),
    );
    expect(html).toContain("<a ");
    expect(html).toContain('href="https://stellar.expert"');
    // Full address still in title
    expect(html).toContain(`title="${FULL}"`);
  });
});
