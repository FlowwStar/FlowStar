import { describe, it, expect } from "vitest";
import {
  calculateFeeBreakdown,
  isHighFee,
  formatFee,
  calculateBatchFees,
  TYPICAL_FEES,
} from "@/lib/fee-utils";

describe("calculateFeeBreakdown", () => {
  it("applies 15% buffer to minResourceFee", () => {
    const result = calculateFeeBreakdown(100_000);
    expect(result.totalEstimated).toBe(Math.ceil(100_000 * 1.15));
  });

  it("minFee plus bufferFee equals total", () => {
    const result = calculateFeeBreakdown(100_000);
    expect(result.minFee + result.bufferFee).toBe(result.totalEstimated);
  });

  it("minFee is the original value", () => {
    const result = calculateFeeBreakdown(80_000);
    expect(result.minFee).toBe(80_000);
  });

  it("calculates estimatedUsd with custom xlmPrice", () => {
    const result = calculateFeeBreakdown(10_000_000, 0.5); // 1 XLM at $0.50
    expect(result.estimatedUsd).toBeCloseTo(
      (0.5 * Math.ceil(10_000_000 * 1.15)) / 1e7,
      5,
    );
  });

  it("does not fabricate per-resource fees", () => {
    const result = calculateFeeBreakdown(100_000);
    expect(result).not.toHaveProperty("cpuFee");
    expect(result).not.toHaveProperty("memoryFee");
    expect(result).not.toHaveProperty("storageFee");
    expect(result).not.toHaveProperty("networkFee");
  });
});

describe("isHighFee", () => {
  it("returns true when fee > 2x average", () => {
    expect(isHighFee(300, 100)).toBe(true);
  });

  it("returns false when fee <= 2x average", () => {
    expect(isHighFee(200, 100)).toBe(false);
    expect(isHighFee(150, 100)).toBe(false);
  });
});

describe("formatFee", () => {
  it("converts stroops to XLM string", () => {
    expect(formatFee(10_000_000)).toBe("1.0000000");
  });

  it("respects decimals parameter", () => {
    expect(formatFee(10_000_000, 2)).toBe("1.00");
  });

  it("handles small fees", () => {
    expect(formatFee(100)).toBe("0.0000100");
  });
});

describe("calculateBatchFees", () => {
  it("multiplies fee per operation by count", () => {
    const result = calculateBatchFees(5, 50_000);
    expect(result.minFee).toBe(250_000);
  });

  it("returns a valid FeeBreakdown", () => {
    const result = calculateBatchFees(3, 40_000);
    expect(result.totalEstimated).toBeGreaterThan(0);
    expect(result.minFee + result.bufferFee).toBe(result.totalEstimated);
  });
});

describe("TYPICAL_FEES", () => {
  it("has entries for all expected operations", () => {
    expect(TYPICAL_FEES.createStream).toBeDefined();
    expect(TYPICAL_FEES.withdraw).toBeDefined();
    expect(TYPICAL_FEES.cancel).toBeDefined();
    expect(TYPICAL_FEES.batch).toBeDefined();
  });

  it("typical >= min for all operations", () => {
    for (const op of Object.values(TYPICAL_FEES)) {
      expect(op.typical).toBeGreaterThanOrEqual(op.min);
    }
  });
});
