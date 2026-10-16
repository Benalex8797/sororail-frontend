// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  EmptyState,
  ErrorNotice,
  SuccessNotice,
} from "../src/components/Feedback";

afterEach(cleanup);

describe("Feedback components announce themselves", () => {
  it("renders ErrorNotice with an assertive alert role", () => {
    render(<ErrorNotice error={new Error("boom")} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
  });

  it("renders SuccessNotice with a polite status role", () => {
    render(<SuccessNotice>Saved</SuccessNotice>);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Saved");
  });

  it("renders EmptyState with a status role", () => {
    render(
      <EmptyState title="No streams tracked yet">Add one to begin.</EmptyState>,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("No streams tracked yet");
  });
});
