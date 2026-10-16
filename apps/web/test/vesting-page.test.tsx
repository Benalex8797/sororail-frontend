// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import VestingPage from "../src/app/vesting/page";
import { RPC_URL } from "../src/lib/network";
import type { Position } from "../src/lib/positions";

const GRANTOR = "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY3NXMOCLWEZDTWE47XLNZT7";
const BENEFICIARY = "GCKFBEIYTKP5RDBQMUQ5G5NB5Z7F6T5XHKXVZX4MKZVNQPRJVKQKJT3L";

const position: Position = {
  kind: "vesting",
  contractId: "CA" + "A".repeat(54),
  label: "Founding grant",
  addedAt: Date.now(),
  network: RPC_URL,
};

function makeCall() {
  return { signAndSend: vi.fn(async () => ({ hash: "deadbeef", result: {} })) };
}

const claim = vi.fn();
const revoke = vi.fn();
const refresh = vi.fn();

let claimableValue: bigint | null = 1_000n;
const claimable = vi.fn(async () => {
  if (claimableValue === null) throw new Error("RPC unavailable");
  return claimableValue;
});

let walletAddress: string = BENEFICIARY;
let positions: Position[] = [position];
let grant: {
  grantor: string;
  beneficiary: string;
  token: string;
  total: bigint;
  start: bigint;
  cliff: bigint;
  duration: bigint;
  revocable: boolean;
  claimed: bigint;
  returned: bigint;
  revokedAt: bigint | null;
};

vi.mock("@sororail/sdk", () => {
  class VestingClient {}
  class SigningError extends Error {}
  const formatAmount = (value: unknown) => String(value);
  return { VestingClient, SigningError, formatAmount };
});

vi.mock("@/lib/wallet", () => ({
  useWallet: () => ({ address: walletAddress, signer: {} }),
}));

vi.mock("@/components/PositionRegistry", () => ({
  usePositions: () => positions,
  usePositionPolling: () => {},
  AddPositionForm: () => null,
  PositionHeader: () => <div>Grant card</div>,
}));

vi.mock("@/components/CreatePositionForm", () => ({
  CreatePositionForm: () => null,
}));

// The claim amount is read through the hook's `onRefresh` callback, so the
// stub drives that callback to mirror the real hook's behaviour.
vi.mock("@/hooks/usePositionCard", async () => {
  const React = await import("react");
  return {
    usePositionCard: (
      _Client: unknown,
      _position: unknown,
      _address: unknown,
      onRefresh?: (client: unknown, isCurrent?: () => boolean) => Promise<void>,
    ) => {
      const client = { claim, revoke, claimable };
      React.useEffect(() => {
        void onRefresh?.(client, () => true);
      }, []);
      return {
        data: grant,
        loadError: null,
        client,
        refresh,
        isLoading: false,
      };
    },
  };
});

beforeEach(() => {
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  walletAddress = BENEFICIARY;
  positions = [position];
  claimableValue = 1_000n;
  claim.mockReset().mockImplementation(makeCall);
  revoke.mockReset().mockImplementation(makeCall);
  grant = {
    grantor: GRANTOR,
    beneficiary: BENEFICIARY,
    token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    total: 10_000n,
    // Started in the past, cliff already passed, not yet fully vested.
    start: nowSec - 1_000n,
    cliff: 500n,
    duration: 2_000n,
    revocable: true,
    claimed: 0n,
    returned: 0n,
    revokedAt: null,
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("vesting page cliff display", () => {
  it("marks the cliff and explains that nothing vests before it", async () => {
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    grant = { ...grant, start: nowSec + 100_000n, cliff: 0n, duration: 200_000n };
    render(<VestingPage />);

    expect(await screen.findByText("Before cliff")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /cliff marker at/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nothing vests until the cliff."),
    ).toBeInTheDocument();
  });

  it("drops the before-cliff presentation once the cliff has passed", async () => {
    render(<VestingPage />);

    const pill = await screen.findByText("Vesting", { selector: ".pill" });
    expect(pill).toHaveClass("pill--active");
    expect(screen.queryByText("Before cliff")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Nothing vests until the cliff."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /cliff marker at/i }),
    ).toBeInTheDocument();
  });
});

describe("vesting page claim button", () => {
  it("claims only after the beneficiary confirms the dialog", async () => {
    const user = userEvent.setup();
    render(<VestingPage />);

    const claimButton = await screen.findByRole("button", { name: "Claim" });
    await waitFor(() => expect(claimButton).toBeEnabled());

    await user.click(claimButton);

    expect(claim).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog", {
      name: "Claim vested tokens",
    });
    await user.click(within(dialog).getByRole("button", { name: "Claim" }));

    expect(claim).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("Claimed vested tokens."),
    ).toBeInTheDocument();
  });

  it("disables the claim button for anyone but the beneficiary", async () => {
    walletAddress = GRANTOR;
    render(<VestingPage />);

    const claimButton = await screen.findByRole("button", { name: "Claim" });
    expect(claimButton).toBeDisabled();
    expect(
      screen.getByText("Only the beneficiary can claim."),
    ).toBeInTheDocument();
  });

  it("disables the claim button when nothing has vested yet", async () => {
    claimableValue = 0n;
    render(<VestingPage />);

    const claimButton = await screen.findByRole("button", { name: "Claim" });
    await waitFor(() => expect(claimButton).toBeDisabled());
    expect(
      screen.queryByRole("dialog", { name: "Claim vested tokens" }),
    ).not.toBeInTheDocument();
  });
});
