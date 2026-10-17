import { TESTNET_DEFAULTS } from "../src/index.js";

/**
 * Reads an optional variable, falling back when it is unset. An empty or
 * whitespace-only value counts as unset, so `RPC_URL= pnpm ...` uses the
 * default instead of handing an empty string to the client.
 */
export function optional(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

/**
 * Reads a variable the example cannot run without. When it is missing, prints
 * an error naming the variable and exits, instead of passing `undefined` on
 * and failing later with a confusing error.
 */
export function required(name: string, description?: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    const what = description ? ` (${description})` : "";
    console.error(
      `Missing environment variable ${name}${what}. Set it before running this example.`,
    );
    process.exit(1);
  }
  return value;
}

export const RPC_URL = optional("RPC_URL", TESTNET_DEFAULTS.rpcUrl);
export const NETWORK = optional(
  "NETWORK_PASSPHRASE",
  TESTNET_DEFAULTS.networkPassphrase,
);
export const TOKEN = optional("TOKEN_ID", TESTNET_DEFAULTS.nativeToken);
