// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ConnectWalletCard,
  PositionCount,
} from "../src/components/OverviewInteractive";

const ADDRESS = "GCKFBEIYTKP5RDBQMUQ5G5NB5Z7F6T5XHKXVZX4MKZVNQPRJVKQKJT3L";

let wallet: {
  address: string | null;
  connect: () => Promise<void>;
  connecting: boolean;
} = {
  address: null,
  connect: async () => {},
  connecting: false,
};

vi.mock("@/lib/wallet", () => ({
  useWallet: () => wallet,
}));

let positionCount = 0;

vi.mock("@/components/PositionRegistry", () => ({
  usePositionCount: () => positionCount,
}));

beforeEach(() => {
  wallet = { address: null, connect: vi.fn(async () => {}), connecting: false };
  positionCount = 0;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ConnectWalletCard", () => {
  it("invites a wallet connection and starts the handshake when clicked", async () => {
    const user = userEvent.setup();
    render(<ConnectWalletCard />);

    expect(
      screen.getByRole("heading", { name: "Connect a wallet to begin" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This app never sees a secret key/),
    ).toBeInTheDocument();

    const button = screen.getByRole("button", { name: "Connect wallet" });
    expect(button).toBeEnabled();

    await user.click(button);
    expect(wallet.connect).toHaveBeenCalledTimes(1);
  });

  it("renders nothing once a wallet is connected", () => {
    wallet = { ...wallet, address: ADDRESS };

    const { container } = render(<ConnectWalletCard />);

    expect(container).toBeEmptyDOMElement();
    expect(
      screen.queryByRole("button", { name: "Connect wallet" }),
    ).not.toBeInTheDocument();
  });

  it("disables the button and reports progress while connecting", () => {
    wallet = { ...wallet, connecting: true };

    render(<ConnectWalletCard />);

    const button = screen.getByRole("button", { name: "Connecting…" });
    expect(button).toBeDisabled();
  });
});

describe("PositionCount", () => {
  it("shows how many positions of the kind are tracked", () => {
    positionCount = 5;

    render(<PositionCount kind="stream" />);

    expect(screen.getByText("5 tracked")).toBeInTheDocument();
  });

  it("shows zero when none are tracked", () => {
    positionCount = 0;

    render(<PositionCount kind="vesting" />);

    const pill = screen.getByText("0 tracked");
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveClass("pill");
  });
});
