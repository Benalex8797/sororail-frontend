// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EscrowPage from "../src/app/escrow/page";
import { RPC_URL } from "../src/lib/network";
import type { Position } from "../src/lib/positions";

const DEPOSITOR = "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY3NXMOCLWEZDTWE47XLNZT7";
const BENEFICIARY = "GCKFBEIYTKP5RDBQMUQ5G5NB5Z7F6T5XHKXVZX4MKZVNQPRJVKQKJT3L";
const ARBITER = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ";

const position: Position = {
  kind: "escrow",
  contractId: "CA" + "A".repeat(54),
  label: "Escrow agreement",
  addedAt: Date.now(),
  network: RPC_URL,
};

const fund = vi.fn();
const release = vi.fn();
const refund = vi.fn();
const dispute = vi.fn();
const resolve = vi.fn();
const refresh = vi.fn();

let walletAddress: string = DEPOSITOR;
let positions: Position[] = [position];
let escrow: {
  depositor: string;
  beneficiary: string;
  arbiter: string | null;
  token: string;
  amount: bigint;
  deadline: bigint;
  state: string;
};

// Only the pieces the page actually touches are replaced. The SDK has no
// build artifact in the test environment, so it is mocked like the other
// page tests do; `formatAmount` is included because `Money` renders with it.
vi.mock("@sororail/sdk", () => {
  class EscrowClient {}
  class SigningError extends Error {}
  const terminalStates = ["Released", "Refunded", "Resolved"];
  const isTerminalEscrowState = (state: string) =>
    terminalStates.includes(state);
  const formatAmount = (value: unknown) => String(value);
  return { EscrowClient, SigningError, isTerminalEscrowState, formatAmount };
});

vi.mock("@/lib/wallet", () => ({
  useWallet: () => ({ address: walletAddress, signer: {} }),
}));

vi.mock("@/components/PositionRegistry", () => ({
  usePositions: () => positions,
  usePositionPolling: () => {},
  AddPositionForm: () => null,
  PositionHeader: () => <div>Escrow card</div>,
}));

vi.mock("@/components/CreatePositionForm", () => ({
  CreatePositionForm: () => null,
}));

vi.mock("@/hooks/usePositionCard", () => ({
  usePositionCard: () => ({
    data: escrow,
    loadError: null,
    client: { fund, release, refund, dispute, resolve },
    refresh,
    isLoading: false,
  }),
}));

beforeEach(() => {
  walletAddress = DEPOSITOR;
  positions = [position];
  escrow = {
    depositor: DEPOSITOR,
    beneficiary: BENEFICIARY,
    arbiter: ARBITER,
    token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    amount: 1_000_000_000n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 100_000),
    state: "Created",
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("escrow page empty state", () => {
  it("invites the user to initialize or track an escrow when none are tracked", () => {
    positions = [];
    render(<EscrowPage />);

    expect(
      screen.getByText("No escrows tracked yet"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Initialize a deployed escrow contract below, or track one that already exists.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps the page heading while the list is empty", () => {
    positions = [];
    render(<EscrowPage />);

    expect(
      screen.getByRole("heading", { name: "Escrow", level: 1 }),
    ).toBeInTheDocument();
  });
});

describe("escrow page filtering by terminal state", () => {
  it.each(["Released", "Refunded", "Resolved"])(
    "presents a %s escrow as closed with no further actions",
    (state) => {
      escrow = { ...escrow, state };
      render(<EscrowPage />);

      expect(screen.getByText(state)).toHaveClass("pill--done");

      for (const name of ["Fund", "Release", "Refund", "Dispute"]) {
        expect(screen.getByRole("button", { name })).toBeDisabled();
      }
      expect(
        screen.queryByRole("button", { name: "Resolve" }),
      ).not.toBeInTheDocument();
    },
  );

  it.each(["Created", "Funded", "Disputed"])(
    "presents a %s escrow as active rather than closed",
    (state) => {
      escrow = { ...escrow, state };
      render(<EscrowPage />);

      const pill = screen.getByText(state);
      expect(pill).toHaveClass("pill--active");
      expect(pill).not.toHaveClass("pill--done");
    },
  );

  it("still allows the depositor to fund a Created escrow", () => {
    escrow = { ...escrow, state: "Created" };
    render(<EscrowPage />);

    expect(screen.getByRole("button", { name: "Fund" })).toBeEnabled();
  });

  it("still allows the depositor to release a Funded escrow", () => {
    escrow = { ...escrow, state: "Funded" };
    render(<EscrowPage />);

    expect(screen.getByRole("button", { name: "Release" })).toBeEnabled();
    expect(screen.getByText("Funded")).toHaveClass("pill--active");
  });
});
