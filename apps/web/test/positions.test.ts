import {
  addPosition,
  getPositionCountsSnapshot,
  subscribePositions,
} from "../src/lib/positions";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makePosition } from "./fixtures";

describe("position persistence", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("dispatches the registry event after a successful localStorage write", () => {
    const dispatchEvent = vi.fn();
    const position = makePosition();
    vi.stubGlobal("window", {
      localStorage: { getItem: () => null, setItem: vi.fn() },
      dispatchEvent,
    });

    expect(addPosition(position.kind, position.contractId, position.label)).toBe(true);
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it("does not dispatch an update when localStorage rejects the write", () => {
    const dispatchEvent = vi.fn();
    const position = makePosition();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => { throw new Error("quota exceeded"); },
      },
      dispatchEvent,
    });

    expect(addPosition(position.kind, position.contractId, position.label)).toBe(false);
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});

// Helper: builds a minimal window stub that captures storage event handlers
// so tests can trigger them directly without a real DOM.
function makeWindowStub(getItemImpl: () => string | null) {
  const storageHandlers: Array<(e: Partial<StorageEvent>) => void> = [];
  const stub = {
    localStorage: { getItem: getItemImpl, setItem: vi.fn() },
    addEventListener: (type: string, fn: unknown) => {
      if (type === "storage")
        storageHandlers.push(fn as (e: Partial<StorageEvent>) => void);
    },
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
  return { stub, storageHandlers };
}

// Fire a fake storage event for the positions key through all captured handlers,
// which calls emit() → invalidateSnapshot() inside the module.
function firePositionsStorageEvent(
  handlers: Array<(e: Partial<StorageEvent>) => void>,
) {
  handlers.forEach((fn) => fn({ key: "sororail.positions.v2" }));
}

describe("subscribePositions unsubscribe (#276)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("stops calling the listener after the returned unsubscribe is invoked", () => {
    const { stub, storageHandlers } = makeWindowStub(() => null);
    vi.stubGlobal("window", stub);

    const listener = vi.fn();
    const unsubscribe = subscribePositions(listener);

    // Storage event fires → listener is notified once
    firePositionsStorageEvent(storageHandlers);
    expect(listener).toHaveBeenCalledTimes(1);

    // After unsubscribing, further storage events must not reach the listener
    unsubscribe();
    firePositionsStorageEvent(storageHandlers);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("getPositionCountsSnapshot (#277)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports all three kinds present with zero counts when the registry is empty", () => {
    const { stub, storageHandlers } = makeWindowStub(() => null);
    vi.stubGlobal("window", stub);

    // Invalidate any snapshot left over from earlier tests
    const noop = subscribePositions(() => {});
    firePositionsStorageEvent(storageHandlers);
    noop();

    const counts = getPositionCountsSnapshot();
    expect(counts).toEqual({ stream: 0, vesting: 0, escrow: 0 });
    expect(Object.keys(counts)).toHaveLength(3);
  });
});

describe("storage corruption (#278)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads with an empty registry instead of crashing when localStorage contains garbage", () => {
    const { stub, storageHandlers } = makeWindowStub(() => "}}}}not-valid-json{{{{");
    vi.stubGlobal("window", stub);

    // Invalidate any snapshot left over from earlier tests
    const noop = subscribePositions(() => {});
    firePositionsStorageEvent(storageHandlers);
    noop();

    expect(() => getPositionCountsSnapshot()).not.toThrow();
    const counts = getPositionCountsSnapshot();
    expect(counts).toEqual({ stream: 0, vesting: 0, escrow: 0 });
  });
});
