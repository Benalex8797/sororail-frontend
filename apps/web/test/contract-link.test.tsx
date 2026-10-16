// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContractLink } from "../src/components/ContractLink";

const { explorerContract } = vi.hoisted(() => ({ explorerContract: vi.fn() }));

vi.mock("@/lib/network", () => ({ explorerContract }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ContractLink", () => {
  it("links to the explorer in a new tab with noopener and noreferrer when the network has one", () => {
    const href = "https://stellar.expert/explorer/testnet/contract/CABC";
    explorerContract.mockReturnValue(href);

    render(<ContractLink id="CABC">CABC</ContractLink>);

    const link = screen.getByRole("link", { name: "CABC" });
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("omits the link entirely when the network has no explorer base", () => {
    explorerContract.mockReturnValue(null);

    render(
      <ContractLink id="CABC" className="addr">
        CABC
      </ContractLink>,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    const text = screen.getByText("CABC");
    expect(text).toHaveClass("addr");
  });
});
