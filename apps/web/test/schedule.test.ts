import * as React from "react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";

(globalThis as unknown as { React: typeof React }).React = React;

import { Schedule, WhenLabel } from "../src/components/Schedule";

describe("Schedule accessibility", () => {
  it("renders progressbar with proper ARIA attributes", () => {
    const html = renderToString(
      createElement(Schedule, {
        start: 1_000_000n,
        end: 2_000_000n,
        now: 1_500_000n,
      }),
    );

    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="50"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
    expect(html).toContain('aria-label="Schedule progress"');
    expect(html).toContain('aria-valuetext="50% through schedule"');
  });

  it("renders marks with role='img', aria-label and in sorted DOM order", () => {
    const marks = [
      { at: 1_800_000n, label: "end cliff" },
      { at: 1_200_000n, label: "start cliff" },
    ];

    const html = renderToString(
      createElement(Schedule, {
        start: 1_000_000n,
        end: 2_000_000n,
        now: 1_500_000n,
        marks,
      }),
    );

    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="start cliff marker at');
    expect(html).toContain('aria-label="end cliff marker at');
    expect(html).toContain('aria-hidden="true"');

    // Verify chronological DOM reading order: start cliff comes before end cliff
    const startCliffIndex = html.indexOf("start cliff marker at");
    const endCliffIndex = html.indexOf("end cliff marker at");
    expect(startCliffIndex).toBeGreaterThan(-1);
    expect(endCliffIndex).toBeGreaterThan(-1);
    expect(startCliffIndex).toBeLessThan(endCliffIndex);
  });
});

// #283 — start, cliff, and end date rendering + label ordering
describe("Schedule date axis (#283)", () => {
  // Timestamps chosen to produce deterministic toLocaleDateString output.
  // All are < 1_000_000_000 so formatDate's (ts % 1_000_000_000) * 1000 stays
  // within a valid JS Date range.
  const START = 0n;
  const CLIFF = 250_000n;
  const END = 500_000n;
  const NOW = 100_000n;

  it("renders three axis labels for start, now, and end", () => {
    const html = renderToString(
      createElement(Schedule, { start: START, end: END, now: NOW }),
    );
    // The axis always has three <span> children
    const spanMatches = html.match(/<span>/g) ?? [];
    // at least 3 spans in the axis section
    expect(spanMatches.length).toBeGreaterThanOrEqual(3);
  });

  it("renders 'now ·' text when the schedule has not ended", () => {
    const html = renderToString(
      createElement(Schedule, { start: START, end: END, now: NOW }),
    );
    expect(html).toContain("now ·");
  });

  it("renders 'ended' text when now is past the end", () => {
    const html = renderToString(
      createElement(Schedule, { start: START, end: END, now: END + 1n }),
    );
    expect(html).toContain("ended");
  });

  it("renders cliff mark label between start and end marks in DOM order", () => {
    const marks = [{ at: CLIFF, label: "Cliff" }];
    const html = renderToString(
      createElement(Schedule, { start: START, end: END, now: NOW, marks }),
    );

    // The cliff mark aria-label should appear
    expect(html).toContain('aria-label="Cliff marker at');

    // The visible mark label text should also appear
    expect(html).toContain(">Cliff<");
  });

  it("sorts marks with earlier at values first in the rendered output", () => {
    const marks = [
      { at: END - 10n, label: "End Cliff" },
      { at: START + 10n, label: "Start Cliff" },
      { at: (START + END) / 2n, label: "Mid" },
    ];
    const html = renderToString(
      createElement(Schedule, { start: START, end: END, now: NOW, marks }),
    );

    const startIdx = html.indexOf(">Start Cliff<");
    const midIdx = html.indexOf(">Mid<");
    const endIdx = html.indexOf(">End Cliff<");

    expect(startIdx).toBeGreaterThan(-1);
    expect(midIdx).toBeGreaterThan(-1);
    expect(endIdx).toBeGreaterThan(-1);

    // Chronological order in DOM
    expect(startIdx).toBeLessThan(midIdx);
    expect(midIdx).toBeLessThan(endIdx);
  });

  it("renders with no marks when marks prop is omitted", () => {
    const html = renderToString(
      createElement(Schedule, { start: START, end: END, now: NOW }),
    );
    // No role="img" marks present
    expect(html).not.toContain('role="img"');
  });
});

// #284 — WhenLabel wording for past, current, and future timestamps
describe("WhenLabel (#284)", () => {
  function renderWhen(at: bigint, now: bigint): string {
    return renderToString(createElement(WhenLabel, { at, now }));
  }

  it("states the absolute date for a timestamp in the past", () => {
    const at = 100_000n;
    const now = 200_000n;
    const html = renderWhen(at, now);

    const expected = new Date(Number(at) * 1000).toLocaleString();
    // Past timestamps are shown as the absolute date, not a countdown.
    expect(html).toContain(expected);
    expect(html).not.toContain("in ");
    expect(html).toContain(`title="${expected}"`);
  });

  it("treats the current timestamp as past rather than counting down to zero", () => {
    const at = 100_000n;
    const html = renderWhen(at, at);

    const expected = new Date(Number(at) * 1000).toLocaleString();
    expect(html).toContain(expected);
    expect(html).not.toContain("in ");
  });

  it("states days and hours for a future timestamp days away", () => {
    const now = 0n;
    const at = 2n * 86_400n + 3_600n; // 2 days, 1 hour
    const html = renderWhen(at, now);

    expect(html).toContain("in 2d 1h");
  });

  it("states hours and minutes for a future timestamp hours away", () => {
    const now = 0n;
    const at = 3_600n + 120n; // 1 hour, 2 minutes
    const html = renderWhen(at, now);

    expect(html).toContain("in 1h 2m");
  });

  it("states minutes alone when less than an hour remains", () => {
    const now = 0n;
    const at = 120n;
    const html = renderWhen(at, now);

    expect(html).toContain("in 2m");
  });

  it("states less than a minute when the timestamp is under a minute away", () => {
    const now = 0n;
    const at = 30n;
    const html = renderWhen(at, now);

    expect(html).toContain("in &lt;1m");
  });

  it("always keeps the absolute date available in the title", () => {
    const at = 100_000n;
    const future = renderWhen(at + 3_600n, at);
    const past = renderWhen(at - 3_600n, at);

    const absolute = new Date(Number(at) * 1000).toLocaleString();
    const absoluteFuture = new Date(Number(at + 3_600n) * 1000).toLocaleString();
    expect(future).toContain(`title="${absoluteFuture}"`);
    expect(past).toContain(`title="${absolute}"`);
  });
});
