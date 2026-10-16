import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useWallet } from "../src/lib/wallet";

// #280 — useWallet must throw a clear error when called outside a WalletProvider.
// The hook must never silently return empty defaults, which would let the rest
// of the UI proceed as if connected and produce confusing downstream failures.
describe("useWallet outside a provider (#280)", () => {
  it("throws an error with a descriptive message when no WalletProvider is present", () => {
    expect(() => renderHook(() => useWallet())).toThrow(
      "useWallet must be used inside a WalletProvider",
    );
  });

  it("throws an Error instance (not a string or unknown)", () => {
    let caught: unknown;
    try {
      renderHook(() => useWallet());
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
  });
});
