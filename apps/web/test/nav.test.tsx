// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let currentPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
}));

const mockWalletState = {
  address: null as string | null,
  connect: vi.fn(),
  disconnect: vi.fn(),
  connecting: false,
  error: null as Error | null,
  networkError: null as string | null,
};

vi.mock("@/lib/wallet", () => ({
  useWallet: () => mockWalletState,
}));

import { Nav } from "../src/components/Nav";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  currentPathname = "/";
  mockWalletState.address = null;
  mockWalletState.connecting = false;
  mockWalletState.error = null;
  mockWalletState.networkError = null;
});

describe("Nav active-link highlighting (#292)", () => {
  it("highlights only Overview with aria-current='page' when on '/'", () => {
    currentPathname = "/";
    render(<Nav />);

    const overviewLink = screen.getByRole("link", { name: "Overview" });
    const payrollLink = screen.getByRole("link", { name: "Payroll" });
    const streamsLink = screen.getByRole("link", { name: "Streams" });
    const vestingLink = screen.getByRole("link", { name: "Vesting" });
    const escrowLink = screen.getByRole("link", { name: "Escrow" });

    // Overview is active
    expect(overviewLink).toHaveAttribute("aria-current", "page");
    expect(overviewLink).toHaveClass("nav__link--active");

    // All other links must not have aria-current
    expect(payrollLink).not.toHaveAttribute("aria-current");
    expect(payrollLink).not.toHaveClass("nav__link--active");

    expect(streamsLink).not.toHaveAttribute("aria-current");
    expect(streamsLink).not.toHaveClass("nav__link--active");

    expect(vestingLink).not.toHaveAttribute("aria-current");
    expect(vestingLink).not.toHaveClass("nav__link--active");

    expect(escrowLink).not.toHaveAttribute("aria-current");
    expect(escrowLink).not.toHaveClass("nav__link--active");
  });

  it("highlights only Payroll with aria-current='page' when on '/payroll'", () => {
    currentPathname = "/payroll";
    render(<Nav />);

    const overviewLink = screen.getByRole("link", { name: "Overview" });
    const payrollLink = screen.getByRole("link", { name: "Payroll" });
    const streamsLink = screen.getByRole("link", { name: "Streams" });
    const vestingLink = screen.getByRole("link", { name: "Vesting" });
    const escrowLink = screen.getByRole("link", { name: "Escrow" });

    expect(payrollLink).toHaveAttribute("aria-current", "page");
    expect(payrollLink).toHaveClass("nav__link--active");

    expect(overviewLink).not.toHaveAttribute("aria-current");
    expect(overviewLink).not.toHaveClass("nav__link--active");

    expect(streamsLink).not.toHaveAttribute("aria-current");
    expect(vestingLink).not.toHaveAttribute("aria-current");
    expect(escrowLink).not.toHaveAttribute("aria-current");
  });

  it("highlights only Streams with aria-current='page' when on '/streams'", () => {
    currentPathname = "/streams";
    render(<Nav />);

    const streamsLink = screen.getByRole("link", { name: "Streams" });
    expect(streamsLink).toHaveAttribute("aria-current", "page");
    expect(streamsLink).toHaveClass("nav__link--active");

    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Payroll" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Vesting" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Escrow" })).not.toHaveAttribute("aria-current");
  });

  it("highlights only Vesting with aria-current='page' when on '/vesting'", () => {
    currentPathname = "/vesting";
    render(<Nav />);

    const vestingLink = screen.getByRole("link", { name: "Vesting" });
    expect(vestingLink).toHaveAttribute("aria-current", "page");
    expect(vestingLink).toHaveClass("nav__link--active");

    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Payroll" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Streams" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Escrow" })).not.toHaveAttribute("aria-current");
  });

  it("highlights only Escrow with aria-current='page' when on '/escrow'", () => {
    currentPathname = "/escrow";
    render(<Nav />);

    const escrowLink = screen.getByRole("link", { name: "Escrow" });
    expect(escrowLink).toHaveAttribute("aria-current", "page");
    expect(escrowLink).toHaveClass("nav__link--active");

    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Payroll" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Streams" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Vesting" })).not.toHaveAttribute("aria-current");
  });

  it("activates parent section with aria-current='page' on nested sub-paths", () => {
    currentPathname = "/streams/new";
    const { unmount } = render(<Nav />);

    expect(screen.getByRole("link", { name: "Streams" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");

    unmount();

    currentPathname = "/escrow/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
    render(<Nav />);

    expect(screen.getByRole("link", { name: "Escrow" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("renders the brand link pointing to '/' without active link styles", () => {
    currentPathname = "/payroll";
    render(<Nav />);

    const brandLink = screen.getByRole("link", { name: "SoroRail" });
    expect(brandLink).toHaveAttribute("href", "/");
    expect(brandLink).toHaveClass("nav__brand");
    expect(brandLink).not.toHaveAttribute("aria-current");
    expect(brandLink).not.toHaveClass("nav__link--active");
  });

  it("renders wallet connection controls and handles connect/disconnect interactions", async () => {
    const user = userEvent.setup();
    mockWalletState.address = null;
    const { rerender } = render(<Nav />);

    const connectButton = screen.getByRole("button", { name: "Connect wallet" });
    expect(connectButton).toBeInTheDocument();
    await user.click(connectButton);
    expect(mockWalletState.connect).toHaveBeenCalledTimes(1);

    // Connected state
    mockWalletState.address = "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY3NXMOCLWEZDTWE47XLNZT7";
    rerender(<Nav />);

    expect(screen.queryByRole("button", { name: "Connect wallet" })).not.toBeInTheDocument();
    const disconnectButton = screen.getByRole("button", { name: "Disconnect" });
    expect(disconnectButton).toBeInTheDocument();
    expect(screen.getByText("GBRPYH…XLNZT7")).toBeInTheDocument();

    await user.click(disconnectButton);
    expect(mockWalletState.disconnect).toHaveBeenCalledTimes(1);
  });

  it("renders feedback banners for wallet error and network mismatch", () => {
    mockWalletState.error = new Error("Freighter connection rejected");
    mockWalletState.networkError = "Selected network does not match testnet";

    render(<Nav />);

    expect(screen.getByText("Freighter connection rejected")).toBeInTheDocument();
    expect(screen.getByText("Wrong network in Freighter")).toBeInTheDocument();
    expect(screen.getByText("Selected network does not match testnet")).toBeInTheDocument();
  });
});
