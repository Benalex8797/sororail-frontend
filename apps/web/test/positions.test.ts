import { addPosition } from "../src/lib/positions";
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
