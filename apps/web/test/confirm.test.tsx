// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Confirm } from "../src/components/Confirm";

function renderConfirm() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  render(
    <Confirm
      title="Send payment"
      lines={[
        { label: "Amount", value: "10 XLM" },
        { label: "Recipient", value: "GABC" },
      ]}
      irreversible="The transfer cannot be reversed."
      confirmLabel="Send"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );

  return { onConfirm, onCancel };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Confirm dialog", () => {
  it("moves focus into the dialog on open", async () => {
    renderConfirm();

    const cancel = screen.getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toHaveFocus());
  });

  it("cancels when Escape is pressed", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderConfirm();

    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls the confirm handler exactly once", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderConfirm();

    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
