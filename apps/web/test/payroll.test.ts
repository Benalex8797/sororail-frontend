import { describe, expect, it } from "vitest";

import {
  parseCsv,
  removeCsvLines,
  splitCsvLine,
  splitPayrollPayments,
  type ParsedLine,
} from "../src/lib/payroll";

const VALID_ADDR = "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY3NXMOCLWEZDTWE47XLNZT7";
const ANOTHER_ADDR = "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY3NXMOCLWEZDTWE47XLNZT7";

describe("parseCsv", () => {
  it("parses valid CSV with address and amount", () => {
    const result = parseCsv(`${VALID_ADDR},10`);
    expect(result).toHaveLength(1);
    expect(result[0]!.stroops).toBe(100_000_000n);
    expect(result[0]!.error).toBeUndefined();
  });

  it("validates address format", () => {
    const result = parseCsv("invalid,10");
    expect(result).toHaveLength(1);
    expect(result[0]!.error).toBe("Not a valid account address (G…)");
  });

  it("validates amount is positive", () => {
    const result = parseCsv(`${VALID_ADDR},0`);
    expect(result).toHaveLength(1);
    expect(result[0]!.error).toBe("Amount must be greater than zero");
  });

  it("detects extra columns and reports error", () => {
    const result = parseCsv(`${VALID_ADDR},10,extra`);
    expect(result).toHaveLength(1);
    expect(result[0]!.error).toContain("Row has 3 columns");
  });

  it("detects multiple extra columns", () => {
    const result = parseCsv(`${VALID_ADDR},10,extra,more`);
    expect(result).toHaveLength(1);
    expect(result[0]!.error).toContain("Row has 4 columns");
  });

  it("ignores comments and empty lines", () => {
    const csv = `# comment
${VALID_ADDR},10

${ANOTHER_ADDR},20
# another comment`;
    const result = parseCsv(csv);
    expect(result).toHaveLength(2);
    expect(result[0]!.stroops).toBe(100_000_000n);
    expect(result[1]!.stroops).toBe(200_000_000n);
  });

  it("trims whitespace around address and amount", () => {
    const result = parseCsv(`  ${VALID_ADDR}  ,  10  `);
    expect(result).toHaveLength(1);
    expect(result[0]!.stroops).toBe(100_000_000n);
  });

  it("preserves original line numbers", () => {
    const csv = `# comment
${VALID_ADDR},10

${ANOTHER_ADDR},20`;
    const result = parseCsv(csv);
    expect(result[0]!.line).toBe(2);
    expect(result[1]!.line).toBe(4);
  });

  it("handles fractional amounts", () => {
    const result = parseCsv(`${VALID_ADDR},1.5`);
    expect(result).toHaveLength(1);
    expect(result[0]!.stroops).toBe(15_000_000n);
  });

  it("detects invalid amounts", () => {
    const result = parseCsv(`${VALID_ADDR},abc`);
    expect(result).toHaveLength(1);
    expect(result[0]!.error).toBeDefined();
    expect(result[0]!.error).not.toContain("Row has");
  });

  it("handles multiple valid entries mixed with invalid ones", () => {
    const csv = `${VALID_ADDR},10
invalid,20
${ANOTHER_ADDR},30`;
    const result = parseCsv(csv);
    expect(result).toHaveLength(3);
    expect(result[0]!.error).toBeUndefined();
    expect(result[1]!.error).toBeDefined();
    expect(result[2]!.error).toBeUndefined();
  });

  it("provides address and amount on error lines for operator to see", () => {
    const csv = `invalid,10`;
    const result = parseCsv(csv);
    expect(result[0]!.to).toBe("invalid");
    expect(result[0]!.amount).toBe("10");
    expect(result[0]!.error).toBeDefined();
  });

  it("handles quoted fields from spreadsheet exports", () => {
    const csv = `"${VALID_ADDR}","12.50"`;
    const result = parseCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0]!.to).toBe(VALID_ADDR);
    expect(result[0]!.amount).toBe("12.50");
    expect(result[0]!.stroops).toBe(125_000_000n);
    expect(result[0]!.error).toBeUndefined();
  });

  it("handles quoted fields with spaces", () => {
    const csv = `  "${VALID_ADDR}"  ,  "10"  `;
    const result = parseCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0]!.to).toBe(VALID_ADDR);
    expect(result[0]!.amount).toBe("10");
    expect(result[0]!.stroops).toBe(100_000_000n);
  });
});

describe("splitCsvLine", () => {
  it("splits simple comma-separated values", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted fields containing commas", () => {
    expect(splitCsvLine('"a,b",c')).toEqual(["a,b", "c"]);
    expect(splitCsvLine('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
  });

  it("handles escaped double quotes within quoted fields", () => {
    expect(splitCsvLine('"a""b",c')).toEqual(['a"b', "c"]);
    expect(splitCsvLine('a,"b""c""d",e')).toEqual(["a", 'b"c"d', "e"]);
  });

  it("trims whitespace around fields", () => {
    expect(splitCsvLine("  a  ,  b  ,  c  ")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted fields with surrounding whitespace", () => {
    expect(splitCsvLine('  "a"  ,  "b"  ')).toEqual(["a", "b"]);
  });

  it("handles empty fields", () => {
    expect(splitCsvLine("a,,c")).toEqual(["a", "", "c"]);
    expect(splitCsvLine(",b,")).toEqual(["", "b", ""]);
  });

  it("handles quoted empty fields", () => {
    expect(splitCsvLine('"",b,""')).toEqual(["", "b", ""]);
  });

  it("handles single quoted field", () => {
    expect(splitCsvLine('"hello world"')).toEqual(["hello world"]);
  });

  it("handles complex real-world CSV line with address and amount", () => {
    const addr = "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY3NXMOCLWEZDTWE47XLNZT7";
    expect(splitCsvLine(`"${addr}","100.50"`)).toEqual([addr, "100.50"]);
  });

  it("handles comma in quoted field with escaped quotes", () => {
    expect(splitCsvLine('"value, with, commas ""and"" quotes"')).toEqual([
      'value, with, commas "and" quotes',
    ]);
  });
});

describe("removeCsvLines", () => {
  it("removes paid rows and preserves comments, blanks, and unpaid rows", () => {
    const csv = [
      "# September payroll",
      `${VALID_ADDR},10`,
      "",
      `${ANOTHER_ADDR},20`,
    ].join("\n");

    expect(removeCsvLines(csv, [2])).toBe(
      ["# September payroll", "", `${ANOTHER_ADDR},20`].join("\n"),
    );
  });

  it("removes the first line", () => {
    const csv = ["line1", "line2", "line3"].join("\n");
    expect(removeCsvLines(csv, [1])).toBe(["line2", "line3"].join("\n"));
  });

  it("removes the last line", () => {
    const csv = ["line1", "line2", "line3"].join("\n");
    expect(removeCsvLines(csv, [3])).toBe(["line1", "line2"].join("\n"));
  });

  it("removes the only remaining line", () => {
    const csv = "line1";
    expect(removeCsvLines(csv, [1])).toBe("");
  });

  it("handles out-of-range line numbers gracefully", () => {
    const csv = ["line1", "line2", "line3"].join("\n");
    expect(removeCsvLines(csv, [10, 20, 30])).toBe(csv);
  });

  it("removes multiple lines at once", () => {
    const csv = ["line1", "line2", "line3", "line4", "line5"].join("\n");
    expect(removeCsvLines(csv, [2, 4])).toBe(
      ["line1", "line3", "line5"].join("\n"),
    );
  });

  it("preserves empty lines when they are not removed", () => {
    const csv = ["line1", "", "line3"].join("\n");
    expect(removeCsvLines(csv, [1])).toBe(["", "line3"].join("\n"));
  });

  it("handles empty CSV string", () => {
    expect(removeCsvLines("", [])).toBe("");
  });

  it("removes all lines when all line numbers are provided", () => {
    const csv = ["line1", "line2", "line3"].join("\n");
    expect(removeCsvLines(csv, [1, 2, 3])).toBe("");
  });
});

describe("splitPayrollPayments", () => {
  const payments = [
    { to: VALID_ADDR, amount: 1n },
    { to: ANOTHER_ADDR, amount: 2n },
    { to: VALID_ADDR, amount: 3n },
  ];

  it("does not create sendable batches until the contract cap is known", () => {
    expect(splitPayrollPayments(payments, null)).toBeNull();
  });

  it("splits payments so no batch exceeds the contract cap", () => {
    expect(splitPayrollPayments(payments, 2)).toEqual([
      payments.slice(0, 2),
      payments.slice(2),
    ]);
  });
});
