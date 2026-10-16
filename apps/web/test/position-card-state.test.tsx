// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PositionCardState } from "../src/components/PositionCardState";
import type { Position } from "../src/lib/positions";

vi.mock("@/components/PositionRegistry", () => ({
  PositionHeader: ({ position }: { position: Position }) => (
    <h2>{position.label}</h2>
  ),
}));

const POSITION: Position = {
  kind: "vesting",
  contractId: "CVESTINGCONTRACT",
  label: "Ada's grant",
  addedAt: 1,
  network: "testnet",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PositionCardState (#290)", () => {
  it("asks for a wallet when there is no address", () => {
    render(
      <PositionCardState
        position={POSITION}
        address={null}
        loadError={null}
        isLoading={false}
        noun="vesting"
      >
        <p>loaded content</p>
      </PositionCardState>,
    );

    expect(screen.getByText("Ada's grant")).toBeInTheDocument();
    expect(
      screen.getByText("Connect a wallet to read this vesting."),
    ).toBeInTheDocument();
    expect(screen.queryByText("loaded content")).not.toBeInTheDocument();
  });

  it("shows the load error with a working retry when one is set", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <PositionCardState
        position={POSITION}
        address="GCKFBEIYTKP5RDBQMUQ5G5NB5Z7F6T5XHKXVZX4MKZVNQPRJVKQKJT3L"
        loadError={new Error("RPC unavailable")}
        isLoading={false}
        onRetry={onRetry}
        noun="vesting"
      >
        <p>loaded content</p>
      </PositionCardState>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("loaded content")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("reports that it is reading from the chain while loading", () => {
    render(
      <PositionCardState
        position={POSITION}
        address="GCKFBEIYTKP5RDBQMUQ5G5NB5Z7F6T5XHKXVZX4MKZVNQPRJVKQKJT3L"
        loadError={null}
        isLoading
        noun="vesting"
      >
        <p>loaded content</p>
      </PositionCardState>,
    );

    expect(screen.getByText("Reading from the chain…")).toBeInTheDocument();
    expect(screen.queryByText("loaded content")).not.toBeInTheDocument();
  });

  it("renders the loaded content once the position is read", () => {
    render(
      <PositionCardState
        position={POSITION}
        address="GCKFBEIYTKP5RDBQMUQ5G5NB5Z7F6T5XHKXVZX4MKZVNQPRJVKQKJT3L"
        loadError={null}
        isLoading={false}
        noun="vesting"
      >
        <p>loaded content</p>
      </PositionCardState>,
    );

    expect(screen.getByText("loaded content")).toBeInTheDocument();
    expect(
      screen.queryByText("Reading from the chain…"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
