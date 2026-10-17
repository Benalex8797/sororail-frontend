import { afterEach, describe, expect, it, vi } from "vitest";

import {
  explorerContract,
  explorerTx,
  resolveExplorerBase,
  shortAddress,
} from "../src/lib/network";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("resolveExplorerBase", () => {
  it("uses the testnet explorer for the supported testnet RPC", () => {
    expect(resolveExplorerBase("https://soroban-testnet.stellar.org")).toBe(
      "https://stellar.expert/explorer/testnet",
    );
  });

  it.each([
    "http://localhost:8000/rpc",
    "https://rpc-futurenet.stellar.org",
    "not a url",
  ])("returns null for an unsupported RPC: %s", (rpcUrl) => {
    expect(resolveExplorerBase(rpcUrl)).toBeNull();
  });
});

describe("explorer links", () => {
  it("builds transaction and contract URLs from the resolved base", () => {
    expect(explorerTx("tx-hash")).toBe(
      "https://stellar.expert/explorer/testnet/tx/tx-hash",
    );
    expect(explorerContract("contract-id")).toBe(
      "https://stellar.expert/explorer/testnet/contract/contract-id",
    );
  });

  it("returns null when the configured RPC has no explorer", async () => {
    vi.stubEnv("NEXT_PUBLIC_RPC_URL", "http://localhost:8000/rpc");
    vi.resetModules();
    const network = await import("../src/lib/network");

    expect(network.explorerTx("tx-hash")).toBeNull();
    expect(network.explorerContract("contract-id")).toBeNull();
  });
});

describe("shortAddress", () => {
  it("leaves short inputs unchanged", () => {
    expect(shortAddress("ABCDEF", 2)).toBe("ABCDEF");
  });

  it("uses the requested number of characters from each half", () => {
    expect(shortAddress("1234567890", 3)).toBe("123…890");
  });

  it("places the ellipsis between the two address halves", () => {
    const shortened = shortAddress("ABCDEFGHIJKLMNOPQRSTUVWXYZ", 4);

    expect(shortened).toBe("ABCD…WXYZ");
    expect(shortened.indexOf("…")).toBe(4);
  });
});