// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NetworkGuard } from "../src/components/NetworkGuard";
import { NETWORK_PASSPHRASE } from "../src/lib/network";

function mockRpcNetwork(passphrase: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { passphrase } }),
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NetworkGuard", () => {
  it("renders its children when the RPC reports the configured network", async () => {
    mockRpcNetwork(NETWORK_PASSPHRASE);

    render(
      <NetworkGuard>
        <p>app ready</p>
      </NetworkGuard>,
    );

    expect(await screen.findByText("app ready")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns and withholds the app when the RPC reports a different network", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockRpcNetwork("Public Global Stellar Network ; September 2015");

    render(
      <NetworkGuard>
        <p>app ready</p>
      </NetworkGuard>,
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/not the Stellar testnet/);
    expect(screen.queryByText("app ready")).not.toBeInTheDocument();
  });
});
