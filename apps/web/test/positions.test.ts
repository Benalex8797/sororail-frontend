import {
  addPosition,
  getPositionCountsSnapshot,
  removePosition,
  restorePosition,
  subscribePositions,
  type Position,
} from "../src/lib/positions";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { POSITION_ADDRESS, makePosition } from "./fixtures";

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

  it("notifies same-tab subscribers when the registry changes", () => {
    const handlers = new Map<string, EventListener>();
    vi.stubGlobal("window", {
      addEventListener: (type: string, listener: EventListener) => {
        handlers.set(type, listener);
      },
      removeEventListener: (type: string) => {
        handlers.delete(type);
      },
    });
    const listener = vi.fn();
    const unsubscribe = subscribePositions(listener);

    handlers.get("sororail:positions")?.(new Event("sororail:positions"));

    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    expect(handlers.size).toBe(0);
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

const REGISTRY_KEY = "sororail.positions.v2";
// Native XLM's contract on testnet: a valid `C…` strkey distinct from the fixture.
const OTHER_CONTRACT_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

// Backs the registry with an in-memory localStorage and a real EventTarget, so
// writes persist between calls and reach subscribers as they do in a browser.
// Cleanup is registered per test, so a failed assertion cannot leak a listener.
function stubRegistry(initial: Position[] = []) {
  const store = new Map([[REGISTRY_KEY, JSON.stringify(initial)]]);
  const events = new EventTarget();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  });
  const listener = vi.fn();
  const unsubscribe = subscribePositions(listener);
  onTestFinished(() => {
    unsubscribe();
    vi.unstubAllGlobals();
  });
  return {
    listener,
    stored: (): Position[] => JSON.parse(store.get(REGISTRY_KEY) ?? "[]"),
  };
}

describe("addPosition (#269)", () => {
  it("stores a new position and notifies the listener once", () => {
    const { listener, stored } = stubRegistry();
    const position = makePosition();

    expect(
      addPosition(position.kind, position.contractId, position.label, position.network),
    ).toBe(true);

    expect(stored()).toEqual([{ ...position, addedAt: expect.any(Number) }]);
    expect(listener).toHaveBeenCalledOnce();
  });

  it.each([
    ["the same contract ID", POSITION_ADDRESS],
    ["a differently cased, padded contract ID", `  ${POSITION_ADDRESS.toLowerCase()}  `],
  ])("rejects %s without writing or notifying", (_, contractId) => {
    const position = makePosition();
    const { listener, stored } = stubRegistry([position]);

    expect(addPosition("vesting", contractId, "Duplicate", position.network)).toBe(false);

    expect(stored()).toEqual([position]);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("removePosition (#270)", () => {
  it("removes the matching position and notifies subscribers once", () => {
    const position = makePosition();
    const other = makePosition({ kind: "escrow", contractId: OTHER_CONTRACT_ID });
    const { listener, stored } = stubRegistry([position, other]);

    removePosition(position.contractId);

    expect(stored()).toEqual([other]);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("is a no-op for an unknown contract ID and notifies subscribers once", () => {
    const position = makePosition();
    const { listener, stored } = stubRegistry([position]);

    removePosition(OTHER_CONTRACT_ID);

    expect(stored()).toEqual([position]);
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe("restorePosition (#271)", () => {
  it("places a removed position back in the registry", () => {
    const position = makePosition();
    const { listener, stored } = stubRegistry([position]);

    removePosition(position.contractId);
    restorePosition(position);

    expect(stored()).toEqual([position]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("does not duplicate a position that is already registered", () => {
    const position = makePosition();
    const { listener, stored } = stubRegistry([position]);

    restorePosition({ ...position, contractId: position.contractId.toLowerCase() });

    expect(stored()).toEqual([position]);
    expect(listener).not.toHaveBeenCalled();
  });
});
