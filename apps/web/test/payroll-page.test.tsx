// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PayrollPage from "../src/app/payroll/page";

const ADDRESS = "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY3NXMOCLWEZDTWE47XLNZT7";
const OTHER_ADDRESS = "GCKFBEIYTKP5RDBQMUQ5G5NB5Z7F6T5XHKXVZX4MKZVNQPRJVKQKJT3L";

const maxRecipients = vi.fn();
const preview = vi.fn();
const execute = vi.fn();

vi.mock("@sororail/sdk", () => {
  class BatchPayoutClient {
    maxRecipients = maxRecipients;
    preview = preview;
    execute = execute;
  }
  class SigningError extends Error {}
  return { BatchPayoutClient, SigningError };
});

vi.mock("@/lib/token", () => ({
  fetchTokenDecimals: vi.fn(async () => 7),
}));

vi.mock("@/lib/wallet", () => ({
  useWallet: () => ({
    address: ADDRESS,
    signer: {},
    connect: vi.fn(),
  }),
}));

beforeEach(() => {
  maxRecipients.mockResolvedValue(500);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function typeCsv(user: ReturnType<typeof userEvent.setup>, csv: string) {
  const textarea = screen.getByLabelText("Payroll CSV data");
  await user.clear(textarea);
  await user.type(textarea, csv, { skipClick: true });
}

/** The Total figure sits in the same container as its "Total" label. */
function totalAmountText() {
  const label = screen.getByText("Total");
  const amount = label.parentElement!.querySelector(".amount");
  return amount?.textContent ?? "";
}

/** Finds the <tr> for a given recipients-table line number. */
function rowForLine(line: number) {
  const rows = screen.getAllByRole("row");
  const row = rows.find((candidate) => within(candidate).queryByText(String(line)));
  expect(row).toBeDefined();
  return row!;
}

describe("payroll page CSV upload preview", () => {
  it("shows a total matching the sum of valid rows", async () => {
    const user = userEvent.setup();
    render(<PayrollPage />);

    await typeCsv(user, `${ADDRESS},10{enter}${OTHER_ADDRESS},5`);

    expect(await screen.findByText("2 recipients")).toBeInTheDocument();
    expect(totalAmountText()).toContain("15");
  });

  it("recomputes the total as rows are edited", async () => {
    const user = userEvent.setup();
    render(<PayrollPage />);

    await typeCsv(user, `${ADDRESS},10`);
    expect(await screen.findByText("1 recipient")).toBeInTheDocument();
    expect(totalAmountText()).toContain("10");

    await typeCsv(user, `${ADDRESS},10{enter}${OTHER_ADDRESS},20`);
    expect(await screen.findByText("2 recipients")).toBeInTheDocument();
    expect(totalAmountText()).toContain("30");
  });
});

describe("payroll page error rows", () => {
  it("lists invalid rows with their line numbers and errors", async () => {
    const user = userEvent.setup();
    render(<PayrollPage />);

    await typeCsv(user, `${ADDRESS},10{enter}invalid,20`);
    await screen.findByText(/line\(s\) to fix/);

    const row = rowForLine(2);
    expect(row.textContent).toContain("Not a valid account address (G…)");
  });

  it("disables the Pay button while any row has an error", async () => {
    const user = userEvent.setup();
    render(<PayrollPage />);

    await typeCsv(user, `${ADDRESS},10{enter}invalid,20`);
    await screen.findByText(/line\(s\) to fix/);

    const payButton = screen.getByRole("button", { name: /^Pay/ });
    expect(payButton).toBeDisabled();
  });

  it("enables the Pay button once every row is valid", async () => {
    const user = userEvent.setup();
    render(<PayrollPage />);

    await typeCsv(user, `${ADDRESS},10`);
    await screen.findByText("1 recipient");

    const payButton = screen.getByRole("button", { name: /^Pay/ });
    expect(payButton).not.toBeDisabled();
  });
});
