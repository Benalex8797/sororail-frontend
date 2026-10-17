import { describe, expect, it } from "vitest";

import * as sdk from "../src/index.js";

/**
 * The public runtime exports of `@sororail/sdk`, as of the committed snapshot.
 *
 * #252: removing or renaming a public export must fail CI unless this list is
 * updated on purpose. Type-only exports (interfaces and type aliases) do not
 * exist at runtime, so they are guarded separately by the generated declaration
 * snapshot checked with `pnpm --filter @sororail/sdk api:check` (#253).
 *
 * Kept in source order: the assertion sorts both sides, so merely reshuffling
 * the re-exports in `src/index.ts` is not treated as a change to the surface.
 */
const PUBLIC_EXPORTS = [
  // clients
  "BaseClient",
  "PreparedCall",
  "EscrowClient",
  "StreamClient",
  "VestingClient",
  "RecurringClient",
  "BatchPayoutClient",
  // config
  "TESTNET_DEFAULTS",
  // errors
  "ContractError",
  "NetworkError",
  "SororailError",
  "ValidationError",
  "ErrorCode",
  "contractForCode",
  "decodeError",
  "errorCodeNames",
  "errorMessages",
  "extractErrorCode",
  "throwDecoded",
  // signers
  "FreighterSigner",
  "KeypairSigner",
  "NetworkMismatchError",
  "SigningError",
  // types with runtime values
  "EscrowState",
  "isTerminalEscrowState",
  "terminalEscrowStates",
  // amounts
  "STROOPS_DECIMALS",
  "formatAmount",
  "fromStroops",
  "requirePositive",
  "toStroops",
  // batching
  "batchRead",
  "batchReadSafe",
];

describe("public API surface", () => {
  it("matches the committed export snapshot", () => {
    // `__esModule` (and other double-underscore helpers) can be injected by the
    // module runner for interop; they are not part of the SDK's surface.
    const exported = Object.keys(sdk)
      .filter((name) => !name.startsWith("__"))
      .sort();
    expect(exported).toEqual([...PUBLIC_EXPORTS].sort());
  });

  it("lists no export twice", () => {
    expect(new Set(PUBLIC_EXPORTS).size).toBe(PUBLIC_EXPORTS.length);
  });
});
