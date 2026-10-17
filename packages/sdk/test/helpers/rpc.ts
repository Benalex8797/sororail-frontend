import {
  Account,
  Networks,
  SorobanDataBuilder,
  StrKey,
  TransactionBuilder,
  rpc,
  type Transaction,
  type xdr,
} from "@stellar/stellar-sdk";
import { vi } from "vitest";

export const PAYER = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 1));
export const PAYEE = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 2));
export const ARBITER = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 3));
export const TOKEN = StrKey.encodeContract(Buffer.alloc(32, 4));
export const CONTRACT = StrKey.encodeContract(Buffer.alloc(32, 5));

export const clientOptions = {
  contractId: CONTRACT,
  rpcUrl: "https://rpc.example.invalid",
  networkPassphrase: Networks.TESTNET,
  publicKey: PAYER,
};

/** Mock only the RPC boundary; keep real transaction building and ScVal decoding. */
export function mockRpc() {
  const getAccount = vi.spyOn(rpc.Server.prototype, "getAccount")
    .mockImplementation(async (publicKey) => new Account(publicKey, "123"));
  // An unconfigured response fails rather than reaching a live endpoint.
  const simulateTransaction = vi.spyOn(rpc.Server.prototype, "simulateTransaction")
    .mockRejectedValue(new Error("Configure a simulation response for this test."));
  return { getAccount, simulateTransaction };
}

export function simulation(retval: xdr.ScVal): rpc.Api.SimulateTransactionSuccessResponse {
  return {
    id: "test-simulation",
    _parsed: true,
    latestLedger: 1,
    events: [],
    transactionData: new SorobanDataBuilder(),
    minResourceFee: "0",
    result: { auth: [], retval },
  };
}

export function contractInvocation(call: { toXDR(): string }): xdr.InvokeContractArgs {
  const transaction = TransactionBuilder.fromXDR(call.toXDR(), Networks.TESTNET) as Transaction;
  const operation = transaction.operations[0];
  if (operation?.type !== "invokeHostFunction"
    || operation.func.type !== "hostFunctionTypeInvokeContract") {
    throw new Error("Expected a contract invocation.");
  }
  return operation.func.invokeContract;
}
