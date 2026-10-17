import { describe, expect, it, vi } from "vitest";

// Issues #249, #250, #251: BaseClient/PreparedCall behaviour exercised
// through VestingClient, the same light-fake pattern vesting.test.ts uses.
vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  class FakeServer {
    async getAccount(publicKey: string) {
      return new actual.Account(publicKey, "123");
    }
    async simulateTransaction() {
      return { error: "Error(Contract, #1)" };
    }
    async prepareTransaction(built: unknown) {
      return built;
    }
    async sendTransaction() {
      return { status: "PENDING", hash: "deadbeef" };
    }
    async pollTransaction() {
      return { status: "SUCCESS", returnValue: actual.nativeToScVal(1n, { type: "i128" }) };
    }
  }
  class FakeContract {
    constructor(_contractId: string) {}
    call(method: string, ...args: unknown[]) {
      return { method, args };
    }
  }
  class FakeTransactionBuilder {
    constructor(_source: unknown, _opts: unknown) {}
    addOperation(_op: unknown) {
      return this;
    }
    setTimeout(_seconds: number) {
      return this;
    }
    build() {
      return { toXDR: () => "AAAA" };
    }
    static fromXDR() {
      return { toXDR: () => "AAAA" };
    }
  }
  return {
    ...actual,
    rpc: { ...actual.rpc, Server: FakeServer },
    Contract: FakeContract,
    TransactionBuilder: FakeTransactionBuilder,
  };
});

import { ValidationError } from "../src/errors/index.js";
import { VestingClient } from "../src/clients/vesting.js";

const CONTRACT = "CCONTRACTADDRESSFORTESTINGONLYXXXXXXXXXXXXXXXXXXXXXX";
const ACCOUNT = "GAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQDZ7H";

function client(publicKey?: string): VestingClient {
  return new VestingClient({
    contractId: CONTRACT,
    rpcUrl: "http://localhost:8000",
    networkPassphrase: "Test SoroRail Network ; July 2026",
    ...(publicKey ? { publicKey } : {}),
    allowHttp: true,
  });
}

describe("BaseClient simulation error propagation (#249)", () => {
  it("decodes a simulation error through the errors module", async () => {
    const call = await client(ACCOUNT).revoke();
    await expect(call.simulate()).rejects.toMatchObject({ name: expect.any(String) });
  });
});

describe("PreparedCall.signAndSend (#250)", () => {
  it("sends after signing and returns the confirmed result", async () => {
    const call = await client(ACCOUNT).revoke();
    const signer = { publicKey: ACCOUNT, signTransaction: async (xdr: string) => xdr };
    const sent = await call.signAndSend(signer);
    expect(sent.hash).toBe("deadbeef");
    expect(sent.result).toBe(1n);
  });
});

describe("BaseClient requires a source account for write calls (#251)", () => {
  it("rejects with a ValidationError when no publicKey is configured", async () => {
    await expect(client().revoke()).rejects.toBeInstanceOf(ValidationError);
  });
});
