// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_CONTRACT_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const VALID_ACCOUNT_ID = "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY3NXMOCLWEZDTWE47XLNZT7";
const ARBITER_ACCOUNT_ID = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

// Mock wallet
const mockSigner = {
  sign: vi.fn(),
  signAuthEntry: vi.fn(),
};

const mockWallet = {
  address: VALID_ACCOUNT_ID,
  signer: mockSigner,
};

vi.mock("@/lib/wallet", () => ({
  useWallet: () => mockWallet,
}));

// Mock positions storage
vi.mock("@/lib/positions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/positions")>();
  return {
    ...actual,
    addPosition: vi.fn(() => true),
  };
});

import { addPosition } from "@/lib/positions";

// Mock SDK clients
const mockSignAndSend = vi.fn().mockResolvedValue({
  hash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
});

const mockStreamCreate = vi.fn().mockResolvedValue({
  signAndSend: mockSignAndSend,
});
const mockVestingCreate = vi.fn().mockResolvedValue({
  signAndSend: mockSignAndSend,
});
const mockEscrowInit = vi.fn().mockResolvedValue({
  signAndSend: mockSignAndSend,
});

vi.mock("@sororail/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sororail/sdk")>();
  return {
    ...actual,
    StreamClient: vi.fn().mockImplementation(() => ({
      create: mockStreamCreate,
    })),
    VestingClient: vi.fn().mockImplementation(() => ({
      create: mockVestingCreate,
    })),
    EscrowClient: vi.fn().mockImplementation(() => ({
      init: mockEscrowInit,
    })),
  };
});

import { CreatePositionForm } from "../src/components/CreatePositionForm";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockWallet.address = VALID_ACCOUNT_ID;
  mockWallet.signer = mockSigner;
});

describe("CreatePositionForm validation & inline errors (#293)", () => {
  it("displays inline errors for empty required fields on submit (stream)", async () => {
    const user = userEvent.setup();
    render(<CreatePositionForm kind="stream" />);

    const submitButton = screen.getByRole("button", { name: "Create a stream" });
    await user.click(submitButton);

    // Assert inline errors are rendered
    expect(screen.getByText("Contract address is required.")).toBeInTheDocument();
    expect(screen.getByText("Recipient address is required.")).toBeInTheDocument();
    expect(screen.getByText("Rate per second is required.")).toBeInTheDocument();
    expect(screen.getByText("Duration is required.")).toBeInTheDocument();

    // Verify fields have aria-invalid set
    expect(screen.getByLabelText("Deployed contract address")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Recipient address")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Rate per second (stroops)")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Duration (seconds)")).toHaveAttribute("aria-invalid", "true");

    // Client must not have been invoked
    expect(mockStreamCreate).not.toHaveBeenCalled();
    expect(mockSignAndSend).not.toHaveBeenCalled();
  });

  it("displays inline errors for empty required fields on submit (vesting)", async () => {
    const user = userEvent.setup();
    render(<CreatePositionForm kind="vesting" />);

    // Clear cliff which defaults to "0" to test empty field validation
    const cliffInput = screen.getByLabelText("Cliff (seconds)");
    await user.clear(cliffInput);

    const submitButton = screen.getByRole("button", { name: "Create a grant" });
    await user.click(submitButton);

    expect(screen.getByText("Contract address is required.")).toBeInTheDocument();
    expect(screen.getByText("Beneficiary address is required.")).toBeInTheDocument();
    expect(screen.getByText("Amount is required.")).toBeInTheDocument();
    expect(screen.getByText("Duration is required.")).toBeInTheDocument();
    expect(screen.getByText("Cliff is required.")).toBeInTheDocument();

    expect(mockVestingCreate).not.toHaveBeenCalled();
  });

  it("displays inline errors for empty required fields on submit (escrow)", async () => {
    const user = userEvent.setup();
    render(<CreatePositionForm kind="escrow" />);

    const submitButton = screen.getByRole("button", { name: "Create an escrow" });
    await user.click(submitButton);

    expect(screen.getByText("Contract address is required.")).toBeInTheDocument();
    expect(screen.getByText("Beneficiary address is required.")).toBeInTheDocument();
    expect(screen.getByText("Amount is required.")).toBeInTheDocument();
    expect(screen.getByText("Seconds until deadline is required.")).toBeInTheDocument();

    expect(mockEscrowInit).not.toHaveBeenCalled();
  });

  it("shows an inline error when amount has too many decimal places (more than 7)", async () => {
    const user = userEvent.setup();
    render(<CreatePositionForm kind="vesting" />);

    const contractInput = screen.getByLabelText("Deployed contract address");
    const beneficiaryInput = screen.getByLabelText("Beneficiary address");
    const amountInput = screen.getByLabelText("Amount (stroops)");
    const durationInput = screen.getByLabelText("Duration (seconds)");

    await user.type(contractInput, VALID_CONTRACT_ID);
    await user.type(beneficiaryInput, VALID_ACCOUNT_ID);
    // 8 decimals: "10.12345678"
    await user.type(amountInput, "10.12345678");
    await user.type(durationInput, "3600");

    const submitButton = screen.getByRole("button", { name: "Create a grant" });
    await user.click(submitButton);

    // Must show inline error identifying too many decimal places
    expect(screen.getByText("Amount has too many decimal places (maximum 7).")).toBeInTheDocument();
    expect(amountInput).toHaveAttribute("aria-invalid", "true");

    // Other valid fields should not have error
    expect(screen.queryByText("Contract address is required.")).not.toBeInTheDocument();
    expect(mockVestingCreate).not.toHaveBeenCalled();
  });

  it("shows an inline error when stream rate has too many decimal places", async () => {
    const user = userEvent.setup();
    render(<CreatePositionForm kind="stream" />);

    const contractInput = screen.getByLabelText("Deployed contract address");
    const recipientInput = screen.getByLabelText("Recipient address");
    const rateInput = screen.getByLabelText("Rate per second (stroops)");
    const durationInput = screen.getByLabelText("Duration (seconds)");

    await user.type(contractInput, VALID_CONTRACT_ID);
    await user.type(recipientInput, VALID_ACCOUNT_ID);
    // 9 decimals: "1.123456789"
    await user.type(rateInput, "1.123456789");
    await user.type(durationInput, "86400");

    const submitButton = screen.getByRole("button", { name: "Create a stream" });
    await user.click(submitButton);

    expect(screen.getByText("Rate per second has too many decimal places (maximum 7).")).toBeInTheDocument();
    expect(rateInput).toHaveAttribute("aria-invalid", "true");
    expect(mockStreamCreate).not.toHaveBeenCalled();
  });

  it("shows an inline error for invalid addresses and zero/negative numbers", async () => {
    const user = userEvent.setup();
    render(<CreatePositionForm kind="escrow" />);

    const contractInput = screen.getByLabelText("Deployed contract address");
    const beneficiaryInput = screen.getByLabelText("Beneficiary address");
    const arbiterInput = screen.getByLabelText("Arbiter address (optional)");
    const amountInput = screen.getByLabelText("Amount (stroops)");
    const durationInput = screen.getByLabelText("Seconds until deadline");

    await user.type(contractInput, "invalid-contract-id");
    await user.type(beneficiaryInput, "not-a-stellar-g-address");
    await user.type(arbiterInput, "bad-arbiter");
    await user.type(amountInput, "0");
    await user.type(durationInput, "0");

    const submitButton = screen.getByRole("button", { name: "Create an escrow" });
    await user.click(submitButton);

    expect(screen.getByText("Enter the address of a deployed, uninitialized contract.")).toBeInTheDocument();
    expect(screen.getByText("Beneficiary must be a valid Stellar account address.")).toBeInTheDocument();
    expect(screen.getByText("Arbiter must be a valid Stellar account address.")).toBeInTheDocument();
    expect(screen.getByText("Amount must be greater than zero.")).toBeInTheDocument();
    expect(screen.getByText("Seconds until deadline must be greater than zero.")).toBeInTheDocument();

    expect(mockEscrowInit).not.toHaveBeenCalled();
  });

  it("clears field inline error when user types into the field", async () => {
    const user = userEvent.setup();
    render(<CreatePositionForm kind="stream" />);

    const submitButton = screen.getByRole("button", { name: "Create a stream" });
    await user.click(submitButton);

    const contractInput = screen.getByLabelText("Deployed contract address");
    expect(screen.getByText("Contract address is required.")).toBeInTheDocument();

    await user.type(contractInput, "C");
    expect(screen.queryByText("Contract address is required.")).not.toBeInTheDocument();
  });
});

describe("CreatePositionForm submit-disabled-while-pending & double-click (#294)", () => {
  it("disables submit button and shows pending label while transaction is in flight", async () => {
    let resolveSignAndSend: (val: unknown) => void;
    mockSignAndSend.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignAndSend = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<CreatePositionForm kind="stream" />);

    await user.type(screen.getByLabelText("Deployed contract address"), VALID_CONTRACT_ID);
    await user.type(screen.getByLabelText("Recipient address"), VALID_ACCOUNT_ID);
    await user.type(screen.getByLabelText("Rate per second (stroops)"), "1000000");
    await user.type(screen.getByLabelText("Duration (seconds)"), "3600");

    const submitButton = screen.getByRole("button", { name: "Create a stream" });
    await user.click(submitButton);

    // Pending state verification
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent("Submitting…");
    expect(mockStreamCreate).toHaveBeenCalledTimes(1);

    // Resolve transaction
    await act(async () => {
      resolveSignAndSend({ hash: "tx-hash-123" });
    });

    // Form should re-enable and show success notice
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
      expect(submitButton).toHaveTextContent("Create a stream");
    });
    expect(screen.getByText(/Position initialized and added to this browser/)).toBeInTheDocument();
  });

  it("sends only one transaction when submit is double-clicked", async () => {
    let resolveSignAndSend: (val: unknown) => void;
    mockSignAndSend.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignAndSend = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<CreatePositionForm kind="vesting" />);

    await user.type(screen.getByLabelText("Deployed contract address"), VALID_CONTRACT_ID);
    await user.type(screen.getByLabelText("Beneficiary address"), VALID_ACCOUNT_ID);
    await user.type(screen.getByLabelText("Amount (stroops)"), "50000000");
    await user.type(screen.getByLabelText("Duration (seconds)"), "86400");

    const submitButton = screen.getByRole("button", { name: "Create a grant" });

    // Double-click submit button in rapid succession
    await user.dblClick(submitButton);

    // Also attempt an immediate second form submit event while pending
    const form = submitButton.closest("form")!;
    fireEvent.submit(form);

    // Must have only invoked VestingClient.create and signAndSend once
    expect(mockVestingCreate).toHaveBeenCalledTimes(1);
    expect(mockSignAndSend).toHaveBeenCalledTimes(1);

    // Complete the first transaction
    await act(async () => {
      resolveSignAndSend({ hash: "tx-vesting-123" });
    });

    expect(addPosition).toHaveBeenCalledTimes(1);
    expect(addPosition).toHaveBeenCalledWith("vesting", VALID_CONTRACT_ID, "");
  });

  it("handles transaction failure and restores button state", async () => {
    mockSignAndSend.mockRejectedValueOnce(new Error("Host error: Insufficient balance"));

    const user = userEvent.setup();
    render(<CreatePositionForm kind="escrow" />);

    await user.type(screen.getByLabelText("Deployed contract address"), VALID_CONTRACT_ID);
    await user.type(screen.getByLabelText("Beneficiary address"), VALID_ACCOUNT_ID);
    await user.type(screen.getByLabelText("Amount (stroops)"), "10000000");
    await user.type(screen.getByLabelText("Seconds until deadline"), "7200");

    const submitButton = screen.getByRole("button", { name: "Create an escrow" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Host error: Insufficient balance/)).toBeInTheDocument();
      expect(submitButton).not.toBeDisabled();
      expect(submitButton).toHaveTextContent("Create an escrow");
    });

    expect(addPosition).not.toHaveBeenCalled();
  });
});
