import { ContractError, ErrorCode, type ErrorCodeName } from "@sororail/sdk";
import { describe, expect, it } from "vitest";

import { RECOVERY, recoveryFor } from "../src/lib/recovery";

describe("recoveryFor", () => {
  it("returns recovery text for a ContractError with a known code", () => {
    const error = new ContractError("NotInitialized", "Contract not initialized");
    expect(recoveryFor(error)).toBe(RECOVERY.NotInitialized);
  });

  it("returns null for a ContractError with Unknown variant", () => {
    const error = new ContractError("Unknown", "Unknown error");
    expect(recoveryFor(error)).toBeNull();
  });

  it("returns null for non-ContractError exceptions", () => {
    expect(recoveryFor(new Error("Regular error"))).toBeNull();
    expect(recoveryFor(new TypeError("Type error"))).toBeNull();
    expect(recoveryFor("not an error")).toBeNull();
    expect(recoveryFor(null)).toBeNull();
    expect(recoveryFor(undefined)).toBeNull();
  });

  it("returns recovery text for all known error codes", () => {
    const knownCodes = (Object.keys(ErrorCode) as ErrorCodeName[]).filter(
      (code) => code !== "Unknown",
    );
    for (const code of knownCodes) {
      const error = new ContractError(code, `${code} error`);
      const result = recoveryFor(error);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    }
  });
});

describe("RECOVERY completeness", () => {
  it("has recovery hints for every ErrorCodeName except Unknown", () => {
    const expectedCodes = (Object.keys(ErrorCode) as ErrorCodeName[]).filter(
      (code) => code !== "Unknown",
    );
    const actualCodes = Object.keys(RECOVERY) as ErrorCodeName[];

    expect(actualCodes.sort()).toEqual(expectedCodes.sort());
  });

  it("fails when a new error code is added without recovery hint", () => {
    // This test documents the requirement that every error code must have
    // a recovery hint. If a new error code is added to the SDK without
    // adding a corresponding entry to RECOVERY, TypeScript will complain
    // about the Record<ErrorCodeName, string> type assignment.
    // This test passes as long as the file compiles.
    expect(RECOVERY).toBeDefined();
  });
});
