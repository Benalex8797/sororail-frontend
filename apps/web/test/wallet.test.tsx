// @vitest-environment jsdom
import { cleanup, render, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWallet, WalletProvider } from "../src/lib/wallet";

// ---------------------------------------------------------------------------
// Mock @sororail/sdk so FreighterSigner.connect() is controllable in tests.
// vi.mock intercepts dynamic imports too, so the connect() call inside wallet.tsx
// resolves to this fake without touching the real Freighter extension.
// ---------------------------------------------------------------------------

const PUBLIC_KEY = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX";

const mockSigner = {
  publicKey: PUBLIC_KEY,
  currentAddress: vi.fn().mockResolvedValue(PUBLIC_KEY),
  assertNetwork: vi.fn().mockResolvedValue(undefined),
};

const mockFreighterConnect = vi.fn();

vi.mock("@sororail/sdk", () => ({
  FreighterSigner: { connect: mockFreighterConnect },
  SigningError: class SigningError extends Error {},
  NetworkMismatchError: class NetworkMismatchError extends Error {},
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stub localStorage so the wallet starts in a disconnected state (skips auto-restore). */
function stubDisconnectedStorage() {
  vi.stubGlobal("window", {
    ...window,
    localStorage: {
      getItem: (key: string) =>
        key === "sororail:wallet-disconnected" ? "1" : null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
    clearInterval: vi.fn(),
    setInterval: vi.fn().mockReturnValue(42),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

/** Renders WalletProvider and returns the live wallet state via a ref. */
function renderWallet() {
  let captured: ReturnType<typeof useWallet> | null = null;

  function Consumer() {
    captured = useWallet();
    return null;
  }

  render(
    <WalletProvider>
      <Consumer />
    </WalletProvider>,
  );

  return () => captured!;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WalletProvider connect and disconnect flows (#279)", () => {
  beforeEach(() => {
    mockFreighterConnect.mockResolvedValue(mockSigner);
    stubDisconnectedStorage();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("starts with no address and no error", () => {
    const getState = renderWallet();
    expect(getState().address).toBeNull();
    expect(getState().error).toBeNull();
    expect(getState().connecting).toBe(false);
  });

  it("sets address and clears connecting after a successful connect()", async () => {
    const getState = renderWallet();

    await act(async () => {
      await getState().connect();
    });

    expect(mockFreighterConnect).toHaveBeenCalledTimes(1);
    expect(getState().address).toBe(PUBLIC_KEY);
    expect(getState().connecting).toBe(false);
    expect(getState().error).toBeNull();
  });

  it("sets error and clears connecting when FreighterSigner.connect() rejects", async () => {
    mockFreighterConnect.mockRejectedValueOnce(new Error("User rejected"));
    const getState = renderWallet();

    await act(async () => {
      await getState().connect();
    });

    expect(getState().address).toBeNull();
    expect(getState().connecting).toBe(false);
    expect(getState().error).toBeInstanceOf(Error);
    expect(getState().error?.message).toContain("wallet");
  });

  it("clears address after disconnect()", async () => {
    const getState = renderWallet();

    await act(async () => {
      await getState().connect();
    });
    expect(getState().address).toBe(PUBLIC_KEY);

    act(() => {
      getState().disconnect();
    });

    expect(getState().address).toBeNull();
    expect(getState().error).toBeNull();
  });
});
