import { describe, it, expect } from "vitest";
import { parseCsvBatch, parseDuration, resolveCliffTime } from "@/lib/csv-parser";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HEADER = "recipient,amount,start_time,end_time";

function makeRow(
  recipient = "GABC",
  amount = "1000",
  start = "1000000",
  end = "2000000",
) {
  return `${recipient},${amount},${start},${end}`;
}

// ─── parseCsvBatch ────────────────────────────────────────────────────────────

describe("parseCsvBatch", () => {
  describe("empty / trivial input", () => {
    it("returns empty rows and no errors for empty string", () => {
      const result = parseCsvBatch("");
      expect(result.rows).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("returns empty rows for whitespace-only input", () => {
      const result = parseCsvBatch("   \n  \n  ");
      expect(result.rows).toHaveLength(0);
    });
  });

  describe("header detection", () => {
    it("auto-detects a header row and skips it in output", () => {
      const csv = [HEADER, makeRow()].join("\n");
      const result = parseCsvBatch(csv);
      expect(result.rows).toHaveLength(1);
    });

    it("includes header mapping when header detected", () => {
      const csv = [HEADER, makeRow()].join("\n");
      const result = parseCsvBatch(csv);
      expect(result.headerMapping).toBeDefined();
      expect(result.headerMapping!.recipient).toBe(0);
      expect(result.headerMapping!.amount).toBe(1);
    });

    it("treats data as rows when no header present", () => {
      const csv = [makeRow(), makeRow("GDEF", "500", "100", "200")].join("\n");
      const result = parseCsvBatch(csv);
      // No header detected — both lines are data rows
      expect(result.rows).toHaveLength(2);
    });
  });

  describe("header aliases", () => {
    it('accepts "address" as an alias for recipient column', () => {
      const csv = ["address,amount,start_time,end_time", makeRow()].join("\n");
      const result = parseCsvBatch(csv);
      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].recipient).toBe("GABC");
    });

    it('accepts "total_amount" as an alias for amount column', () => {
      const csv = [
        "recipient,total_amount,start_time,end_time",
        makeRow(),
      ].join("\n");
      const result = parseCsvBatch(csv);
      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].amount).toBe("1000");
    });

    it('accepts "start_date" as alias for start_time', () => {
      const csv = ["recipient,amount,start_date,end_date", makeRow()].join(
        "\n",
      );
      const result = parseCsvBatch(csv);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("missing required columns", () => {
    it("returns an error when recipient column is missing", () => {
      const csv = ["amount,start_time,end_time", "1000,100,200"].join("\n");
      const result = parseCsvBatch(csv);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("returns an error when amount column is missing", () => {
      const csv = ["recipient,start_time,end_time", "GABC,100,200"].join("\n");
      const result = parseCsvBatch(csv);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("returns an error when both start and end columns are missing", () => {
      const csv = ["recipient,amount", "GABC,1000"].join("\n");
      const result = parseCsvBatch(csv);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("returns zero rows when required columns are absent", () => {
      const csv = ["amount,start_time,end_time", "1000,100,200"].join("\n");
      const result = parseCsvBatch(csv);
      expect(result.rows).toHaveLength(0);
    });
  });

  describe("data parsing", () => {
    it("parses multiple data rows", () => {
      const csv = [
        HEADER,
        makeRow(),
        makeRow("GXYZ", "500", "2000", "3000"),
      ].join("\n");
      const result = parseCsvBatch(csv);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].recipient).toBe("GABC");
      expect(result.rows[1].recipient).toBe("GXYZ");
    });

    it("parses optional cliff_time column", () => {
      const csv = [
        "recipient,amount,start_time,end_time,cliff_time",
        "GABC,1000,1000,2000,1500",
      ].join("\n");
      const result = parseCsvBatch(csv);
      expect(result.rows[0].cliff_time).toBe("1500");
    });

    it("parses optional cliff_amount column", () => {
      const csv = [
        "recipient,amount,start_time,end_time,cliff_amount",
        "GABC,1000,1000,2000,100",
      ].join("\n");
      const result = parseCsvBatch(csv);
      expect(result.rows[0].cliff_amount).toBe("100");
    });

    it("handles CRLF line endings", () => {
      const csv = `${HEADER}\r\n${makeRow()}\r\n${makeRow("GXYZ", "500", "2000", "3000")}`;
      const result = parseCsvBatch(csv);
      expect(result.rows).toHaveLength(2);
    });

    it("trims whitespace from values", () => {
      const csv = [HEADER, " GABC , 1000 , 1000 , 2000 "].join("\n");
      const result = parseCsvBatch(csv);
      expect(result.rows[0].recipient).toBe("GABC");
      expect(result.rows[0].amount).toBe("1000");
    });
  });

  describe("quoted fields", () => {
    it("handles quoted values containing commas", () => {
      const csv = [HEADER, '"GABC,rest",1000,1000,2000'].join("\n");
      const result = parseCsvBatch(csv);
      expect(result.rows[0].recipient).toBe("GABC,rest");
    });

    it("handles escaped double-quotes inside quoted fields", () => {
      const csv = [HEADER, '"GA""BC",1000,1000,2000'].join("\n");
      const result = parseCsvBatch(csv);
      expect(result.rows[0].recipient).toBe('GA"BC');
    });
  });

  describe("custom column mapping", () => {
    it("uses custom mapping when provided", () => {
      const csv = ["GABC", "1000", "1000", "2000"].join(",");
      const result = parseCsvBatch(csv, {
        recipient: 0,
        amount: 1,
        start_time: 2,
        end_time: 3,
      });
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].recipient).toBe("GABC");
      expect(result.rows[0].amount).toBe("1000");
    });
  });

  describe("cliff_duration column", () => {
    it("parses a cliff_duration column onto the row", () => {
      const csv = [
        "recipient,amount,start_time,end_time,cliff_duration",
        "GABC,1000,1000,2000,30d",
      ].join("\n");
      const result = parseCsvBatch(csv);
      expect(result.rows[0].cliff_duration).toBe("30d");
    });

    it('accepts "cliff_period" as an alias for cliff_duration', () => {
      const csv = [
        "recipient,amount,start_time,end_time,cliff_period",
        "GABC,1000,1000,2000,86400",
      ].join("\n");
      const result = parseCsvBatch(csv);
      expect(result.rows[0].cliff_duration).toBe("86400");
    });
  });
});

describe("parseDuration", () => {
  it("parses a plain integer as seconds", () => {
    expect(parseDuration("2592000")).toBe(2592000n);
    expect(parseDuration("0")).toBe(0n);
  });

  it("parses single unit suffixes into seconds", () => {
    expect(parseDuration("45s")).toBe(45n);
    expect(parseDuration("90m")).toBe(5400n);
    expect(parseDuration("12h")).toBe(43200n);
    expect(parseDuration("30d")).toBe(2592000n);
    expect(parseDuration("2w")).toBe(1209600n);
  });

  it("is case-insensitive and tolerates surrounding whitespace", () => {
    expect(parseDuration("  30D ")).toBe(2592000n);
    expect(parseDuration("12 H")).toBe(43200n);
  });

  it("returns null for empty or unparseable values", () => {
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("   ")).toBeNull();
    expect(parseDuration("30x")).toBeNull();
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("1.5d")).toBeNull();
    expect(parseDuration("-5d")).toBeNull();
  });
});

// ─── parseCsvLine (via parseCsvBatch with customColumnMapping) ────────────────
//
// parseCsvLine is private, so we exercise it through parseCsvBatch by providing
// a custom column mapping and a single data row — that way we're testing exactly
// the tokenisation logic without any header-detection noise.

describe('parseCsvLine', () => {
  // Helper: parse one raw data line using explicit column positions 0-3
  function tokenise(line: string): string[] {
    const result = parseCsvBatch(line, {
      recipient: 0,
      amount: 1,
      start_time: 2,
      end_time: 3,
    })
    const row = result.rows[0]
    return [row.recipient, row.amount, row.start_time, row.end_time]
  }

  it('splits plain comma-separated values', () => {
    const fields = tokenise('GABC,1000,1000000,2000000')
    expect(fields).toEqual(['GABC', '1000', '1000000', '2000000'])
  })

  it('handles a quoted field containing a comma', () => {
    // The recipient value "GABC,extra" is wrapped in double quotes so the
    // comma inside must NOT be treated as a field separator.
    const fields = tokenise('"GABC,extra",1000,1000000,2000000')
    expect(fields[0]).toBe('GABC,extra')
    expect(fields[1]).toBe('1000')
  })

  it('unescapes doubled double-quotes ("") inside a quoted field', () => {
    // RFC 4180: "" inside a quoted field represents a single literal "
    const fields = tokenise('"GA""BC",1000,1000000,2000000')
    expect(fields[0]).toBe('GA"BC')
  })

  it('handles multiple escaped quotes in the same field', () => {
    const fields = tokenise('"say ""hello"" world",1000,1000000,2000000')
    expect(fields[0]).toBe('say "hello" world')
  })

  it('trims surrounding whitespace from plain (unquoted) values', () => {
    const fields = tokenise('  GABC  ,  1000  ,  1000000  ,  2000000  ')
    expect(fields).toEqual(['GABC', '1000', '1000000', '2000000'])
  })

  it('preserves whitespace inside quoted fields after trimming outer quotes', () => {
    // The quoted value itself has internal spaces that must be kept.
    const fields = tokenise('" hello world ",1000,1000000,2000000')
    // parseCsvLine trims the result, so leading/trailing spaces are stripped
    expect(fields[0]).toBe('hello world')
  })

  it('returns an empty string for an empty (adjacent-comma) field', () => {
    // Middle field is empty: recipient,,start,end
    const result = parseCsvBatch('GABC,,1000000,2000000', {
      recipient: 0,
      amount: 1,
      start_time: 2,
      end_time: 3,
    })
    expect(result.rows[0].amount).toBe('')
  })

  it('returns an empty string for a trailing empty field', () => {
    // Four-column line where the last field is absent (trailing comma)
    const result = parseCsvBatch('GABC,1000,1000000,', {
      recipient: 0,
      amount: 1,
      start_time: 2,
      end_time: 3,
    })
    expect(result.rows[0].end_time).toBe('')
  })

  it('handles an empty quoted field (pair of double-quotes)', () => {
    const result = parseCsvBatch('GABC,"",1000000,2000000', {
      recipient: 0,
      amount: 1,
      start_time: 2,
      end_time: 3,
    })
    expect(result.rows[0].amount).toBe('')
  })
})
// ─── resolveCliffTime ─────────────────────────────────────────────────────────

/**
 * Minimal timestamp parser that mirrors the logic in batch/page.tsx:
 * accepts a unix-seconds integer string and returns it as a bigint.
 */
function parseTs(value: string): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return BigInt(trimmed);
  return null;
}

describe("resolveCliffTime", () => {
  const START = 1_000_000n;

  it("returns null when neither cliff_time nor cliff_duration is present", () => {
    expect(resolveCliffTime({}, START, parseTs)).toBeNull();
    expect(resolveCliffTime({ cliff_time: "", cliff_duration: "" }, START, parseTs)).toBeNull();
  });

  it("resolves cliff_time (absolute) to an absolute timestamp", () => {
    expect(resolveCliffTime({ cliff_time: "1500000" }, START, parseTs)).toBe(1_500_000n);
  });

  it("resolves cliff_duration (relative) by adding it to start_time", () => {
    // 30d = 2592000 s
    expect(resolveCliffTime({ cliff_duration: "30d" }, START, parseTs)).toBe(
      START + 2_592_000n,
    );
  });

  it("resolves cliff_duration expressed as plain seconds", () => {
    expect(resolveCliffTime({ cliff_duration: "86400" }, START, parseTs)).toBe(
      START + 86_400n,
    );
  });

  it("prefers cliff_time over cliff_duration when both are present", () => {
    const result = resolveCliffTime(
      { cliff_time: "1200000", cliff_duration: "30d" },
      START,
      parseTs,
    );
    expect(result).toBe(1_200_000n);
  });

  it("returns null for cliff_duration when start_time is null", () => {
    expect(resolveCliffTime({ cliff_duration: "30d" }, null, parseTs)).toBeNull();
  });

  it("returns null when cliff_time is unparseable", () => {
    expect(resolveCliffTime({ cliff_time: "not-a-date" }, START, parseTs)).toBeNull();
  });

  it("returns null when cliff_duration is unparseable", () => {
    expect(resolveCliffTime({ cliff_duration: "badval" }, START, parseTs)).toBeNull();
  });

  describe("cliff_duration round-trip via parseCsvBatch + resolveCliffTime", () => {
    it("a CSV with cliff_duration column produces a resolvable cliff", () => {
      const csv = [
        "recipient,amount,start_time,end_time,cliff_duration",
        "GABC,1000,1000000,3000000,30d",
      ].join("\n");
      const { rows } = parseCsvBatch(csv);
      expect(rows).toHaveLength(1);
      const cliffTime = resolveCliffTime(rows[0], BigInt(rows[0].start_time), parseTs);
      // 1 000 000 + 2 592 000 = 3 592 000 — but that is past end_time; the
      // test only asserts the value is resolved (non-null) and equals the expected sum.
      expect(cliffTime).toBe(1_000_000n + 2_592_000n);
    });

    it("a CSV with cliff_time column produces the correct absolute cliff", () => {
      const csv = [
        "recipient,amount,start_time,end_time,cliff_time",
        "GABC,1000,1000000,3000000,1500000",
      ].join("\n");
      const { rows } = parseCsvBatch(csv);
      const cliffTime = resolveCliffTime(rows[0], BigInt(rows[0].start_time), parseTs);
      expect(cliffTime).toBe(1_500_000n);
    });

    it("a CSV with no cliff column produces a null cliff", () => {
      const csv = [
        "recipient,amount,start_time,end_time",
        "GABC,1000,1000000,3000000",
      ].join("\n");
      const { rows } = parseCsvBatch(csv);
      const cliffTime = resolveCliffTime(rows[0], BigInt(rows[0].start_time), parseTs);
      expect(cliffTime).toBeNull();
    });

    it("a CSV with cliff_period alias (maps to cliff_duration) resolves correctly", () => {
      const csv = [
        "recipient,amount,start_time,end_time,cliff_period",
        "GABC,1000,1000000,3000000,1d",
      ].join("\n");
      const { rows } = parseCsvBatch(csv);
      const cliffTime = resolveCliffTime(rows[0], BigInt(rows[0].start_time), parseTs);
      expect(cliffTime).toBe(1_000_000n + 86_400n);
    });
  });
});
