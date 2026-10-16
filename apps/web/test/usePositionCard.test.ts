// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePositionCard } from "../src/hooks/usePositionCard";
import { RPC_URL } from "../src/lib/network";
import type { Position } from "../src/lib/positions";

const ADDRESS = "GCKFBEIYTKP5RDBQMUQ5G5NB5Z7F6T5XHKXVZX4MKZVNQPRJVKQKJT3L";

const position: Position = {
  kind: "stream",
  contractId: "CA" + "A".repeat(54),
  label: "Test stream",
  addedAt: Date.now(),
  network: RPC_URL,
};

// Mirrors the hook's (unexported) ClientOptions so a stub client is accepted
// structurally.
interface ClientOptionsShape {
  contractId: string;
  rpcUrl: string;
  networkPassphrase: string;
  publicKey?: string;
}

function makeClient(getImpl: () => Promise<unknown>) {
  const created: ClientOptionsShape[] = [];
  class Client {
    get = getImpl;
    constructor(options: ClientOptionsShape) {
      created.push(options);
    }
  }
  return { Client, created };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("usePositionCard", () => {
  it("reads the position from the chain and stops loading", async () => {
    const get = vi.fn(async () => ({ value: 42n }));
    const { Client } = makeClient(get);

    const { result } = renderHook(() =>
      usePositionCard(Client, position, ADDRESS),
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ value: 42n });
    expect(result.current.loadError).toBeNull();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("builds the client from the position's contract and the connected key", async () => {
    const get = vi.fn(async () => null);
    const { Client, created } = makeClient(get);

    renderHook(() => usePositionCard(Client, position, ADDRESS));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));

    expect(created[0]).toMatchObject({
      contractId: position.contractId,
      rpcUrl: RPC_URL,
      publicKey: ADDRESS,
    });
  });

  it("omits the public key when no wallet is connected", async () => {
    const get = vi.fn(async () => null);
    const { Client, created } = makeClient(get);

    renderHook(() => usePositionCard(Client, position, null));

    expect(created[0]).not.toHaveProperty("publicKey");
    expect(get).not.toHaveBeenCalled();
  });

  it("does not read from the chain until a wallet is connected", () => {
    const get = vi.fn(async () => ({ value: 1n }));
    const { Client } = makeClient(get);

    const { result } = renderHook(() =>
      usePositionCard(Client, position, null),
    );

    expect(get).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it("skips a position that belongs to a different network", () => {
    const get = vi.fn(async () => null);
    const { Client } = makeClient(get);

    renderHook(() =>
      usePositionCard(
        Client,
        { ...position, network: "https://other.example" },
        ADDRESS,
      ),
    );

    expect(get).not.toHaveBeenCalled();
  });

  it("re-reads the position when refresh is called", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ value: 1n })
      .mockResolvedValueOnce({ value: 2n });
    const { Client } = makeClient(get);

    const { result } = renderHook(() =>
      usePositionCard(Client, position, ADDRESS),
    );
    await waitFor(() => expect(result.current.data).toEqual({ value: 1n }));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.data).toEqual({ value: 2n });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("invokes onRefresh with the client once the data has loaded", async () => {
    const get = vi.fn(async () => ({ value: 1n }));
    const { Client } = makeClient(get);
    const onRefresh = vi.fn(
      async (_client: unknown, _isCurrent: () => boolean) => {},
    );

    renderHook(() => usePositionCard(Client, position, ADDRESS, onRefresh));

    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    expect(onRefresh.mock.calls[0]?.[0]).toBeDefined();
    expect(onRefresh.mock.calls[0]?.[1]).toBeInstanceOf(Function);
  });

  it("ignores a stale response from an earlier request", async () => {
    const pending: Array<(value: unknown) => void> = [];
    const get = vi.fn(
      () => new Promise<unknown>((resolve) => pending.push(resolve)),
    );
    const { Client } = makeClient(get);

    const { result } = renderHook(() =>
      usePositionCard(Client, position, ADDRESS),
    );
    await waitFor(() => expect(pending).toHaveLength(1));

    let second: Promise<void> | undefined;
    act(() => {
      second = result.current.refresh();
    });
    await waitFor(() => expect(pending).toHaveLength(2));

    await act(async () => {
      pending[1]!("second");
    });
    await waitFor(() => expect(result.current.data).toBe("second"));

    await act(async () => {
      pending[0]!("first");
    });
    expect(result.current.data).toBe("second");

    await second;
  });
});

describe("usePositionCard error state", () => {
  it("exposes the failure and stops loading when the read rejects", async () => {
    const failure = new Error("RPC unavailable");
    const get = vi.fn(async () => {
      throw failure;
    });
    const { Client } = makeClient(get);

    const { result } = renderHook(() =>
      usePositionCard(Client, position, ADDRESS),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadError).toBe(failure);
    expect(result.current.data).toBeNull();
  });

  it("does not run onRefresh when the read fails", async () => {
    const get = vi.fn(async () => {
      throw new Error("boom");
    });
    const { Client } = makeClient(get);
    const onRefresh = vi.fn(async () => {});

    const { result } = renderHook(() =>
      usePositionCard(Client, position, ADDRESS, onRefresh),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadError).toBeInstanceOf(Error);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("clears a previous error once a later refresh succeeds", async () => {
    const failure = new Error("RPC unavailable");
    let shouldFail = true;
    const get = vi.fn(async () => {
      if (shouldFail) throw failure;
      return { value: 7n };
    });
    const { Client } = makeClient(get);

    const { result } = renderHook(() =>
      usePositionCard(Client, position, ADDRESS),
    );
    await waitFor(() => expect(result.current.loadError).toBe(failure));

    shouldFail = false;
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.loadError).toBeNull();
    expect(result.current.data).toEqual({ value: 7n });
  });

  it("keeps reporting the failure when a retry also fails", async () => {
    const failure = new Error("RPC unavailable");
    const get = vi.fn(async () => {
      throw failure;
    });
    const { Client } = makeClient(get);

    const { result } = renderHook(() =>
      usePositionCard(Client, position, ADDRESS),
    );
    await waitFor(() => expect(result.current.loadError).toBe(failure));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.loadError).toBe(failure);
    expect(result.current.isLoading).toBe(false);
  });
});
