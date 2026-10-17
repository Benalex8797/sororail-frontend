import { Address, nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecurringClient } from "../src/clients/recurring.js";
import { ValidationError } from "../src/errors/index.js";
import {
  CONTRACT,
  PAYEE,
  PAYER,
  TOKEN,
  clientOptions,
  contractInvocation,
  mockRpc,
  simulation,
} from "./helpers/rpc.js";

const authorization = {
  payer: PAYER,
  payee: PAYEE,
  token: TOKEN,
  amountPerPeriod: 9_007_199_254_740_993n,
  periodSeconds: 2_592_000n,
};

let rpc: ReturnType<typeof mockRpc>;
beforeEach(() => {
  rpc = mockRpc();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("RecurringClient.authorize", () => {
  it.each([
    ["zero amount", { amountPerPeriod: 0n }, "The amount per period must be greater than zero."],
    ["negative amount", { amountPerPeriod: -1n }, "The amount per period must be greater than zero."],
    ["zero period", { periodSeconds: 0n }, "The period must be greater than zero."],
    ["negative period", { periodSeconds: -1n }, "The period must be greater than zero."],
  ] as const)("rejects a %s before accessing RPC", (_label, invalid, message) => {
    const client = new RecurringClient(clientOptions);
    expect(() => client.authorize({ ...authorization, ...invalid })).toThrow(ValidationError);
    expect(() => client.authorize({ ...authorization, ...invalid })).toThrow(message);
    expect(rpc.getAccount).not.toHaveBeenCalled();
    expect(rpc.simulateTransaction).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, NaN, Infinity, -Infinity])(
    "rejects maxPeriods=%s before accessing RPC", (maxPeriods) => {
      const client = new RecurringClient(clientOptions);
      expect(() => client.authorize({ ...authorization, maxPeriods })).toThrow(ValidationError);
      expect(() => client.authorize({ ...authorization, maxPeriods })).toThrow(
        "maxPeriods must be a whole number of at least 1, or omitted for open-ended.",
      );
      expect(rpc.getAccount).not.toHaveBeenCalled();
      expect(rpc.simulateTransaction).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["omitted", {}],
    ["null", { maxPeriods: null }],
    ["one period", { maxPeriods: 1 }],
    ["multiple periods", { maxPeriods: 12 }],
  ] as const)("encodes an authorization with %s maxPeriods", async (_label, cap) => {
    rpc.simulateTransaction.mockResolvedValue(simulation(xdr.ScVal.scvVoid()));
    const call = await new RecurringClient(clientOptions).authorize({ ...authorization, ...cap });
    const prepared = contractInvocation(call);
    const maxPeriods = "maxPeriods" in cap ? cap.maxPeriods : null;

    expect(Address.fromScAddress(prepared.contractAddress).toString()).toBe(CONTRACT);
    expect(prepared.functionName.toString()).toBe("authorize");
    expect(prepared.args.map((arg) => scValToNative(arg))).toEqual([
      PAYER, PAYEE, TOKEN, authorization.amountPerPeriod, authorization.periodSeconds, maxPeriods,
    ]);
    expect(prepared.args.map((arg) => arg.type)).toEqual([
      "scvAddress", "scvAddress", "scvAddress", "scvI128", "scvU64",
      maxPeriods === null ? "scvVoid" : "scvU32",
    ]);
    expect(rpc.simulateTransaction).not.toHaveBeenCalled();
    await expect(call.simulate()).resolves.toBeUndefined();
  });
});

describe("RecurringClient.charge", () => {
  it.each([0n, 750n, 9_007_199_254_740_993n])(
    "decodes the i128 amount %s without losing precision", async (amount) => {
      rpc.simulateTransaction.mockResolvedValue(simulation(nativeToScVal(amount, { type: "i128" })));
      const call = await new RecurringClient(clientOptions).charge();
      const prepared = contractInvocation(call);

      expect(Address.fromScAddress(prepared.contractAddress).toString()).toBe(CONTRACT);
      expect(prepared.functionName.toString()).toBe("charge");
      expect(prepared.args).toEqual([]);
      const result = await call.simulate();
      expect(typeof result).toBe("bigint");
      expect(result).toBe(amount);
    },
  );

  it("normalizes an integer ScVal to bigint through the amount parser", async () => {
    rpc.simulateTransaction.mockResolvedValue(simulation(nativeToScVal(750, { type: "u32" })));
    const call = await new RecurringClient(clientOptions).charge();
    await expect(call.simulate()).resolves.toBe(750n);
  });

  it("rejects a non-integer return value", async () => {
    rpc.simulateTransaction.mockResolvedValue(simulation(xdr.ScVal.scvBool(true)));
    const call = await new RecurringClient(clientOptions).charge();
    const result = call.simulate();
    await expect(result).rejects.toThrow(ValidationError);
    await expect(result).rejects.toThrow(/amount/);
  });
});
