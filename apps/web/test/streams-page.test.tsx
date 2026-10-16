// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StreamsPage from "../src/app/streams/page";
import { RPC_URL } from "../src/lib/network";
import type { Position } from "../src/lib/positions";

const SENDER = "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY3NXMOCLWEZDTWE47XLNZT7";
const RECIPIENT = "GCKFBEIYTKP5RDBQMUQ5G5NB5Z7F6T5XHKXVZX4MKZVNQPRJVKQKJT3L";

const position: Position = {
  kind: "stream",
  contractId: "CA" + "A".repeat(54),
  label: "Payroll stream",
  addedAt: Date.now(),
  network: RPC_URL,
};

const withdraw = vi.fn();
const cancel = vi.fn();
const topUp = vi.fn();
const extend = vi.fn();

function makeCall() {
  return { signAndSend: vi.fn(async () => ({ hash: "deadbeef", result: {} })) };
}

let stream: Record<string, unknown>;

vi.mock("@sororail/sdk", () => {
  class StreamClient {}
  class SigningError extends Error {}
  return { StreamClient, SigningError };
});

let walletAddress: string = RECIPIENT;

vi.mock("@/lib/wallet", () => ({
  useWallet: () => ({ address: walletAddress, signer: {} }),
}));

vi.mock("@/hooks/usePositionCard", () => ({
  usePositionCard: () => ({
    data: stream,
    loadError: null,
    client: { withdraw, cancel, topUp, extend },
    refresh: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock("@/components/PositionRegistry", () => ({
  usePositions: () => [position],
  usePositionPolling: () => {},
  AddPositionForm: () => null,
  PositionHeader: () => <div>Payroll stream</div>,
}));

vi.mock("@/components/CreatePositionForm", () => ({
  CreatePositionForm: () => null,
}));

beforeEach(() => {
  walletAddress = RECIPIENT;
  withdraw.mockReset().mockImplementation(makeCall);
  cancel.mockReset().mockImplementation(makeCall);
  topUp.mockReset().mockImplementation(makeCall);
  extend.mockReset().mockImplementation(makeCall);
  stream = {
    sender: SENDER,
    recipient: RECIPIENT,
    ratePerSecond: 1n,
    deposited: 1_000n,
    withdrawn: 0n,
    start: 0n,
    stop: 9_999_999_999n,
    cancellable: true,
    cancelledAt: null,
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("streams page withdraw amount validation", () => {
  it("rejects withdrawing before any balance has accrued: the control is disabled and sends nothing", async () => {
    const user = userEvent.setup();
    render(<StreamsPage />);

    const withdrawButton = await screen.findByRole("button", { name: "Withdraw" });
    expect(withdrawButton).toBeDisabled();
    expect(withdrawButton).toHaveAttribute("aria-disabled", "true");

    await user.click(withdrawButton, { skipPointerEventsCheck: true });

    expect(withdraw).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("also rejects withdrawing from a wallet that is not the recipient", async () => {
    // Even if a balance were known, only the recipient may withdraw -- the
    // sender's wallet must stay blocked by the very same control.
    walletAddress = SENDER;
    render(<StreamsPage />);

    const withdrawButton = await screen.findByRole("button", { name: "Withdraw" });
    expect(withdrawButton).toBeDisabled();
    expect(
      screen.getByText("Only the recipient can withdraw from a stream."),
    ).toBeInTheDocument();

    await userEvent.setup().click(withdrawButton, { skipPointerEventsCheck: true });
    expect(withdraw).not.toHaveBeenCalled();
  });
});

describe("streams page cancel confirmation", () => {
  it("does not cancel immediately -- it opens the Confirm dialog first", async () => {
    const user = userEvent.setup();
    render(<StreamsPage />);

    const cancelButton = await screen.findByRole("button", { name: "Cancel stream" });
    await user.click(cancelButton);

    expect(cancel).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("dialog", { name: "Cancel this stream" }),
    ).toBeInTheDocument();
  });

  it("only calls the contract once the dialog is confirmed", async () => {
    const user = userEvent.setup();
    render(<StreamsPage />);

    const cancelButton = await screen.findByRole("button", { name: "Cancel stream" });
    await user.click(cancelButton);

    const dialog = await screen.findByRole("dialog", { name: "Cancel this stream" });
    const confirmButton = within(dialog).getByRole("button", { name: "Cancel stream" });
    await user.click(confirmButton);

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("dismissing the dialog never calls the contract", async () => {
    const user = userEvent.setup();
    render(<StreamsPage />);

    const cancelButton = await screen.findByRole("button", { name: "Cancel stream" });
    await user.click(cancelButton);

    const dialog = await screen.findByRole("dialog", { name: "Cancel this stream" });
    const dismissButton = within(dialog).getByRole("button", { name: "Cancel" });
    await user.click(dismissButton);

    expect(cancel).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
