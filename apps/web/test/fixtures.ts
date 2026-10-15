import type { Position } from "../src/lib/positions";

export const POSITION_ADDRESS = "CABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV";

export function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    kind: "stream",
    contractId: POSITION_ADDRESS,
    label: "Test stream",
    addedAt: 1_700_000_000,
    network: "https://soroban-testnet.stellar.org",
    ...overrides,
  };
}
