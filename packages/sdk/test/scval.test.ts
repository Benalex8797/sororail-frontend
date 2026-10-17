import { Keypair, StrKey, scValToNative, xdr } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { ValidationError } from "../src/errors/index.js";
import {
  addr,
  asVoid,
  i128,
  optionAddress,
  some,
  u32,
  vec,
} from "../src/utils/scval.js";

const ACCOUNT = Keypair.random().publicKey();
const CONTRACT = StrKey.encodeContract(Buffer.alloc(32, 7));
const VOID = xdr.ScVal.scvVoid().toXDR("base64");

/** Compares by encoded bytes, which is what the contract actually receives. */
const encoded = (value: xdr.ScVal) => value.toXDR("base64");

describe("addr", () => {
  it("encodes an account address", () => {
    expect(scValToNative(addr(ACCOUNT))).toBe(ACCOUNT);
  });

  it("encodes a contract address", () => {
    expect(scValToNative(addr(CONTRACT))).toBe(CONTRACT);
  });

  it.each([
    ["an empty string", ""],
    ["plain text", "not-an-address"],
    ["a truncated account", ACCOUNT.slice(0, -1)],
    [
      "an account with a bad checksum",
      `${ACCOUNT.slice(0, -1)}${ACCOUNT.endsWith("A") ? "B" : "A"}`,
    ],
    ["a lowercased account", ACCOUNT.toLowerCase()],
    ["a secret key", Keypair.random().secret()],
  ])("throws for %s", (_label, input) => {
    expect(() => addr(input)).toThrow();
  });
});

describe("optionAddress", () => {
  it("encodes null and undefined as void", () => {
    expect(encoded(optionAddress(null))).toBe(VOID);
    expect(encoded(optionAddress(undefined))).toBe(VOID);
  });

  it("encodes a present address the same way addr does", () => {
    const value = optionAddress(ACCOUNT);
    expect(encoded(value)).toBe(encoded(addr(ACCOUNT)));
    expect(scValToNative(value)).toBe(ACCOUNT);
  });

  it("does not treat an empty string as absent", () => {
    // Only null/undefined mean `None`; an empty string is an invalid address.
    expect(() => optionAddress("")).toThrow();
  });

  it("throws for an invalid address string", () => {
    expect(() => optionAddress("not-an-address")).toThrow();
  });
});

describe("vec", () => {
  it("encodes an empty vector", () => {
    const value = vec([]);
    expect(encoded(value)).toBe(encoded(xdr.ScVal.scvVec([])));
    expect(encoded(value)).not.toBe(VOID);
    expect(scValToNative(value)).toEqual([]);
  });

  it("keeps the elements in order", () => {
    expect(scValToNative(vec([u32(1), u32(2), u32(3)]))).toEqual([1, 2, 3]);
  });

  it("can nest vectors and mix element types", () => {
    const value = vec([vec([]), addr(ACCOUNT), i128(5n)]);
    expect(scValToNative(value)).toEqual([[], ACCOUNT, 5n]);
  });
});

describe("some", () => {
  it("encodes null as void", () => {
    expect(encoded(some(null))).toBe(VOID);
  });

  it("encodes undefined as void", () => {
    expect(encoded(some(undefined))).toBe(VOID);
  });

  it("passes a present value through unchanged", () => {
    const inner = u32(42);
    expect(some(inner)).toBe(inner);
  });

  it("passes an explicit void value through as void", () => {
    const inner = xdr.ScVal.scvVoid();
    expect(some(inner)).toBe(inner);
  });

  it("passes an empty vector through rather than treating it as absent", () => {
    const value = some(vec([]));
    expect(encoded(value)).not.toBe(VOID);
    expect(scValToNative(value)).toEqual([]);
  });
});

describe("asVoid", () => {
  it("accepts undefined, which is what a call with no return value parses to", () => {
    expect(asVoid(undefined)).toBeUndefined();
    expect(asVoid()).toBeUndefined();
  });

  it("accepts null, which is what scvVoid decodes to", () => {
    expect(asVoid(null)).toBeUndefined();
    expect(asVoid(scValToNative(xdr.ScVal.scvVoid()))).toBeUndefined();
  });

  it.each([
    ["zero", 0],
    ["false", false],
    ["an empty string", ""],
    ["a string", "done"],
    ["a bigint", 5n],
    ["an empty array", []],
    ["an empty object", {}],
  ])("throws a ValidationError for %s", (_label, input) => {
    expect(() => asVoid(input)).toThrow(ValidationError);
  });

  it("names the unexpected value in the error", () => {
    expect(() => asVoid(5n)).toThrow(/Expected no return value, got "5"/);
    expect(() => asVoid({ ok: true })).toThrow(/\{"ok":true\}/);
  });
});
