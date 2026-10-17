// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AddPositionForm,
  PositionBackup,
  PositionHeader,
  usePositionPolling,
} from "../src/components/PositionRegistry";
import type { Position } from "../src/lib/positions";

// Mock @/lib/positions while keeping real functions available and spied
vi.mock("@/lib/positions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/positions")>();
  return {
    ...actual,
    addPosition: vi.fn(actual.addPosition),
    removePosition: vi.fn(actual.removePosition),
    restorePosition: vi.fn(actual.restorePosition),
    renamePosition: vi.fn(actual.renamePosition),
    exportPositions: vi.fn(actual.exportPositions),
    importPositions: vi.fn(actual.importPositions),
  };
});

import {
  addPosition,
  exportPositions,
  importPositions,
  removePosition,
  renamePosition,
  restorePosition,
} from "../src/lib/positions";

// Valid testnet contract IDs (from README & network defaults)
const VALID_CONTRACT_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const ANOTHER_VALID_CONTRACT_ID = "CDKJ56S7K7QC4LG6SFF2OGDTG6N4QBCJOVRWHY7MKCWD5JPQ6MDAHRAM";

const TEST_POSITION: Position = {
  kind: "stream",
  contractId: VALID_CONTRACT_ID,
  label: "Engineering Payroll",
  addedAt: 1_700_000_000,
  network: "https://soroban-testnet.stellar.org",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("AddPositionForm (#295)", () => {
  it("rejects non-contract IDs with an error message and prevents addition", async () => {
    const user = userEvent.setup();
    render(<AddPositionForm kind="stream" noun="stream" />);

    const idInput = screen.getByLabelText("Contract address");
    const submitButton = screen.getByRole("button", { name: "Track stream" });

    // 1. Invalid string format
    await user.type(idInput, "not-a-contract-address");
    await user.click(submitButton);

    expect(
      screen.getByText(
        "That does not look like a contract address. It should start with C and be 56 characters with a valid checksum.",
      ),
    ).toBeInTheDocument();
    expect(addPosition).not.toHaveBeenCalled();

    // 2. Stellar Account Public Key (starts with G, not C)
    await user.clear(idInput);
    await user.type(idInput, "GCKFBEIYTKP5RDBQMUQ5G5NB5Z7F6T5XHKXVZX4MKZVNQPRJVKQKJT3L");
    await user.click(submitButton);

    expect(
      screen.getByText(
        "That does not look like a contract address. It should start with C and be 56 characters with a valid checksum.",
      ),
    ).toBeInTheDocument();
    expect(addPosition).not.toHaveBeenCalled();

    // 3. 56 chars starting with C but invalid StrKey checksum
    await user.clear(idInput);
    await user.type(idInput, "C" + "A".repeat(55));
    await user.click(submitButton);

    expect(
      screen.getByText(
        "That does not look like a contract address. It should start with C and be 56 characters with a valid checksum.",
      ),
    ).toBeInTheDocument();
    expect(addPosition).not.toHaveBeenCalled();
  });

  it("accepts a valid contract ID and clears the form inputs", async () => {
    const user = userEvent.setup();
    vi.mocked(addPosition).mockReturnValue(true);

    render(<AddPositionForm kind="stream" noun="stream" />);

    const idInput = screen.getByLabelText("Contract address") as HTMLInputElement;
    const labelInput = screen.getByLabelText("Name (optional)") as HTMLInputElement;
    const submitButton = screen.getByRole("button", { name: "Track stream" });

    await user.type(idInput, VALID_CONTRACT_ID);
    await user.type(labelInput, "Team Stream");
    await user.click(submitButton);

    expect(addPosition).toHaveBeenCalledWith("stream", VALID_CONTRACT_ID, "Team Stream");
    expect(idInput.value).toBe("");
    expect(labelInput.value).toBe("");
    expect(
      screen.queryByText(/That does not look like a contract address/),
    ).not.toBeInTheDocument();
  });

  it("shows an error message when the contract is already tracked or cannot be saved", async () => {
    const user = userEvent.setup();
    vi.mocked(addPosition).mockReturnValue(false);

    render(<AddPositionForm kind="stream" noun="stream" />);

    const idInput = screen.getByLabelText("Contract address");
    const submitButton = screen.getByRole("button", { name: "Track stream" });

    await user.type(idInput, VALID_CONTRACT_ID);
    await user.click(submitButton);

    expect(addPosition).toHaveBeenCalledWith("stream", VALID_CONTRACT_ID, "");
    expect(
      screen.getByText("Could not save in this browser, or this contract is already tracked."),
    ).toBeInTheDocument();
  });
});

describe("usePositionPolling (#298)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("stops polling on unmount and removes event listeners", () => {
    const refresh = vi.fn();
    const { unmount } = renderHook(() => usePositionPolling(refresh));

    expect(refresh).not.toHaveBeenCalled();

    // Advance 15s to verify polling works when mounted
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    // Unmount hook
    unmount();

    // Advancing timers further should NOT trigger refresh
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    // Visibilitychange events should NOT trigger refresh after unmount
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not run two refreshes in parallel while a previous refresh is in-flight", async () => {
    let resolveRefresh!: () => void;
    const refresh = vi.fn().mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolveRefresh = resolve;
      });
    });

    renderHook(() => usePositionPolling(refresh));

    // First poll triggers
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    // Advance another 15s while the first promise is still pending
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    // Should NOT have run another refresh concurrently
    expect(refresh).toHaveBeenCalledTimes(1);

    // Tab visibility changes while first promise is still pending
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    // Still locked; no parallel refresh
    expect(refresh).toHaveBeenCalledTimes(1);

    // Resolve the active in-flight refresh
    await act(async () => {
      resolveRefresh();
    });

    // Next interval after resolution triggers cleanly
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});

describe("PositionBackup (#297)", () => {
  it("triggers file download on export with the serialized JSON positions", async () => {
    const user = userEvent.setup();
    const mockJson = JSON.stringify([TEST_POSITION], null, 2);
    vi.mocked(exportPositions).mockReturnValue(mockJson);

    const createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/test-uuid");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });

    let clickedDownload = "";
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clickedDownload = this.download;
    });

    render(<PositionBackup />);

    const exportButton = screen.getByRole("button", { name: "Export as JSON" });
    await user.click(exportButton);

    expect(exportPositions).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const firstCall = createObjectURL.mock.calls[0];
    expect(firstCall).toBeDefined();
    const blobArg = firstCall?.[0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe("application/json");

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(clickedDownload).toBe("sororail-positions.json");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/test-uuid");

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("shows an error message when a bad file is imported", async () => {
    render(<PositionBackup />);

    const fileInput = screen.getByLabelText("Import positions backup file");

    // 1. Invalid JSON syntax
    const corruptFile = new File(["not-valid-json{{}"], "corrupt.json", {
      type: "application/json",
    });
    fireEvent.change(fileInput, { target: { files: [corruptFile] } });

    await waitFor(() => {
      expect(screen.getByText("That file is not valid JSON.")).toBeInTheDocument();
    });

    // 2. Valid JSON but not an array
    const notArrayFile = new File([JSON.stringify({ not: "an array" })], "not-array.json", {
      type: "application/json",
    });
    fireEvent.change(fileInput, { target: { files: [notArrayFile] } });

    await waitFor(() => {
      expect(screen.getByText("Expected a JSON array of positions.")).toBeInTheDocument();
    });

    // 3. Array but contains no valid position objects
    const emptyArrayFile = new File([JSON.stringify([{ invalid: true }])], "invalid.json", {
      type: "application/json",
    });
    fireEvent.change(fileInput, { target: { files: [emptyArrayFile] } });

    await waitFor(() => {
      expect(screen.getByText("No valid positions found in that file.")).toBeInTheDocument();
    });

    // 4. File read error
    const errorFile = new File(["some-content"], "error.json", { type: "application/json" });
    const originalReadAsText = FileReader.prototype.readAsText;
    FileReader.prototype.readAsText = function () {
      setTimeout(() => this.onerror?.(new ProgressEvent("error")), 0);
    };

    fireEvent.change(fileInput, { target: { files: [errorFile] } });

    await waitFor(() => {
      expect(screen.getByText("Could not read that file.")).toBeInTheDocument();
    });

    FileReader.prototype.readAsText = originalReadAsText;
  });

  it("shows a success message when a valid backup file is imported", async () => {
    vi.mocked(importPositions).mockReturnValue({ added: 2, skipped: 1 });

    render(<PositionBackup />);

    const fileInput = screen.getByLabelText("Import positions backup file");
    const validFile = new File([JSON.stringify([TEST_POSITION])], "valid.json", {
      type: "application/json",
    });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(
        screen.getByText("Imported 2 positions (1 already tracked)."),
      ).toBeInTheDocument();
    });
  });
});

describe("PositionHeader (#296)", () => {
  it("allows renaming a position and cancels edits without changes", async () => {
    const user = userEvent.setup();
    render(<PositionHeader position={TEST_POSITION} />);

    expect(screen.getByText("Engineering Payroll")).toBeInTheDocument();

    // Enter edit mode
    await user.click(screen.getByRole("button", { name: "Rename" }));
    const renameInput = screen.getByLabelText("Rename position") as HTMLInputElement;
    expect(renameInput).toBeInTheDocument();
    expect(renameInput.value).toBe("Engineering Payroll");

    // Cancel edit
    await user.clear(renameInput);
    await user.type(renameInput, "Cancelled Name");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Rename position")).not.toBeInTheDocument();
    expect(renamePosition).not.toHaveBeenCalled();

    // Re-enter and save rename
    await user.click(screen.getByRole("button", { name: "Rename" }));
    const renameInputSecond = screen.getByLabelText("Rename position");
    await user.clear(renameInputSecond);
    await user.type(renameInputSecond, "Executive Payroll");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(renamePosition).toHaveBeenCalledWith(TEST_POSITION.contractId, "Executive Payroll");
    expect(screen.queryByLabelText("Rename position")).not.toBeInTheDocument();
  });

  it("removes the position and provides an undo option", async () => {
    const user = userEvent.setup();
    render(<PositionHeader position={TEST_POSITION} />);

    const removeButton = screen.getByRole("button", { name: "Stop tracking" });
    await user.click(removeButton);

    expect(removePosition).toHaveBeenCalledWith(TEST_POSITION.contractId);

    // Verify undo status notification
    const statusBanner = screen.getByRole("status");
    expect(statusBanner).toHaveTextContent(
      /Stopped tracking “Engineering Payroll”\. The contract is untouched\./,
    );

    // Click Undo
    const undoButton = screen.getByRole("button", { name: "Undo" });
    await user.click(undoButton);

    expect(restorePosition).toHaveBeenCalledWith(TEST_POSITION);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Engineering Payroll")).toBeInTheDocument();
  });

  it("auto-dismisses the undo status notice after the undo window expires", () => {
    vi.useFakeTimers();

    render(<PositionHeader position={TEST_POSITION} />);

    const removeButton = screen.getByRole("button", { name: "Stop tracking" });
    fireEvent.click(removeButton);

    expect(screen.getByRole("status")).toBeInTheDocument();

    // Advance 6000ms (UNDO_WINDOW_MS)
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("falls back to the contract ID when label is empty or blank", () => {
    // Empty string label
    const positionWithoutLabel: Position = {
      ...TEST_POSITION,
      contractId: ANOTHER_VALID_CONTRACT_ID,
      label: "",
    };

    const { unmount } = render(<PositionHeader position={positionWithoutLabel} />);
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toHaveTextContent(ANOTHER_VALID_CONTRACT_ID);

    unmount();

    // Whitespace-only label
    const positionWhitespaceLabel: Position = {
      ...TEST_POSITION,
      contractId: ANOTHER_VALID_CONTRACT_ID,
      label: "   ",
    };

    render(<PositionHeader position={positionWhitespaceLabel} />);
    const whitespaceHeading = screen.getByRole("heading", { level: 3 });
    expect(whitespaceHeading).toHaveTextContent(ANOTHER_VALID_CONTRACT_ID);
  });

  it("uses the fallback contract ID in the removal notice when label is blank", async () => {
    const user = userEvent.setup();
    const positionWithoutLabel: Position = {
      ...TEST_POSITION,
      contractId: ANOTHER_VALID_CONTRACT_ID,
      label: "",
    };

    render(<PositionHeader position={positionWithoutLabel} />);

    await user.click(screen.getByRole("button", { name: "Stop tracking" }));

    const statusBanner = screen.getByRole("status");
    expect(statusBanner).toHaveTextContent(
      new RegExp(`Stopped tracking “${ANOTHER_VALID_CONTRACT_ID}”\\. The contract is untouched\\.`),
    );
  });
});
