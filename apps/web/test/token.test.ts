import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invokeContractFunction: vi.fn(),
  isSimulationSuccess: vi.fn(),
  scValToNative: vi.fn(),
  simulateTransaction: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk", () => ({
  Account: vi.fn(),
  BASE_FEE: "100",
  Operation: {
    invokeContractFunction: mocks.invokeContractFunction,
  },
  TransactionBuilder: class {
    addOperation() {
      return this;
    }

    setTimeout() {
      return this;
    }

    build() {
      return {};
    }
  },
  rpc: {
    Api: { isSimulationSuccess: mocks.isSimulationSuccess },
    Server: class {
      simulateTransaction = mocks.simulateTransaction;
    },
  },
  scValToNative: mocks.scValToNative,
}));

import { fetchTokenDecimals } from "../src/lib/token";

describe("fetchTokenDecimals", () => {
  it("returns the decimals from a successful RPC simulation", async () => {
    mocks.simulateTransaction.mockResolvedValue({
      result: { retval: "token-decimals" },
    });
    mocks.isSimulationSuccess.mockReturnValue(true);
    mocks.scValToNative.mockReturnValue(6);

    await expect(fetchTokenDecimals("token-id", "source-address")).resolves.toBe(
      6,
    );
    expect(mocks.simulateTransaction).toHaveBeenCalledOnce();
    expect(mocks.invokeContractFunction).toHaveBeenCalledWith({
      contract: "token-id",
      function: "decimals",
      args: [],
    });
  });

  it("rejects so the caller can use the default 7-decimal fallback", async () => {
    mocks.simulateTransaction.mockResolvedValue({ error: "RPC unavailable" });
    mocks.isSimulationSuccess.mockReturnValue(false);

    await expect(fetchTokenDecimals("token-id", "source-address")).rejects.toThrow(
      "Could not read the token's decimals.",
    );
  });
});