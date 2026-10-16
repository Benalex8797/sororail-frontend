// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Confirm } from "../src/components/Confirm";

function renderConfirm(overrides: Partial<ComponentProps<typeof Confirm>> = {}) {
  const onConfirm = overrides.onConfirm ?? vi.fn();
  const onCancel = overrides.onCancel ?? vi.fn();

  const view = render(
    <>
      <button type="button">trigger</button>
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
        {...overrides}
      />
    </>,
  );

  return { ...view, onConfirm, onCancel };
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

describe("Confirm keyboard navigation (#287)", () => {
  it("wraps Tab from the last control back to the first", async () => {
    renderConfirm();

    const dialog = await screen.findByRole("dialog");
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Send" });

    await waitFor(() => expect(cancel).toHaveFocus());

    confirm.focus();
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(window, { key: "Tab" });
    expect(cancel).toHaveFocus();
  });

  it("wraps Shift+Tab from the first control to the last", async () => {
    renderConfirm();

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Send" });

    await waitFor(() => expect(cancel).toHaveFocus());

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(confirm).toHaveFocus();
  });

  it("keeps focus inside the dialog when Tab is pressed on the last control", async () => {
    renderConfirm();

    const dialog = await screen.findByRole("dialog");
    const confirm = screen.getByRole("button", { name: "Send" });

    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    confirm.focus();
    fireEvent.keyDown(window, { key: "Tab" });

    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("returns focus to the element that opened it on close", async () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = renderConfirm();
    await screen.findByRole("dialog");

    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("does not cancel on Escape while busy", async () => {
    const onCancel = vi.fn();
    const { rerender } = renderConfirm({ onCancel });

    await screen.findByRole("dialog");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(
      <>
        <button type="button">trigger</button>
        <Confirm
          title="Send payment"
          lines={[
            { label: "Amount", value: "10 XLM" },
            { label: "Recipient", value: "GABC" },
          ]}
          irreversible="The transfer cannot be reversed."
          confirmLabel="Send"
          busy
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />
      </>,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
