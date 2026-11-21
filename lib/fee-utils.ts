// NOTE: There is intentionally NO hardcoded XLM_PRICE fallback constant in
// this module. Prior versions used a default of 0.12, but that stale estimate
// misled users when a live price was unavailable. The canonical XLM/USD price
// now comes from the live `useTokenPrice('XLM')` hook and must be passed
// explicitly to `calculateFeeBreakdown`. When the live price is unavailable,
// `estimatedUsd` is simply omitted from the fee breakdown rather than showing
// a fabricated estimate.

export interface FeeBreakdown {
  minFee: number;
  bufferFee: number;
  totalEstimated: number;
  estimatedUsd?: number;
}

/**
 * Calculate fee breakdown from transaction simulation
 * @param minResourceFee Minimum resource fee from simulation in stroops
 * @param xlmPrice Current XLM/USD price. Pass the live value from useTokenPrice;
 *                 omit (or pass undefined) when no price is available and USD
 *                 estimate should be suppressed.
 * @returns Fee breakdown: base estimate, safety buffer, and total
 */
export function calculateFeeBreakdown(
  minResourceFee: number,
  xlmPrice?: number,
): FeeBreakdown {
  // Apply 15% buffer to ensure inclusion
  const bufferMultiplier = 1.15;
  const totalFee = Math.ceil(minResourceFee * bufferMultiplier);
  const bufferFee = totalFee - minResourceFee;

  const totalXlm = totalFee / 1e7;
  const estimatedUsd =
    xlmPrice !== undefined ? totalXlm * xlmPrice : undefined;

  return {
    minFee: minResourceFee,
    bufferFee,
    totalEstimated: totalFee,
    estimatedUsd,
  };
}

/**
 * Estimate typical fees for common operations
 */
export const TYPICAL_FEES = {
  createStream: { min: 50000, typical: 80000, unit: "stroops" },
  withdraw: { min: 30000, typical: 50000, unit: "stroops" },
  transfer: { min: 20000, typical: 35000, unit: "stroops" },
  cancel: { min: 40000, typical: 65000, unit: "stroops" },
  topUp: { min: 35000, typical: 60000, unit: "stroops" },
  batch: { min: 100000, typical: 150000, unit: "stroops" },
};

/**
 * Check if a fee is considered high (more than 2x the average)
 */
export function isHighFee(fee: number, averageFee: number): boolean {
  return fee > averageFee * 2;
}

/**
 * Format fee amount for display
 */
export function formatFee(stroops: number, decimals: number = 7): string {
  const xlm = stroops / 1e7;
  return xlm.toFixed(Math.min(decimals, 7));
}

/**
 * Calculate batch operation total fees
 */
export function calculateBatchFees(
  operationCount: number,
  feePerOperation: number,
): FeeBreakdown {
  const totalFee = feePerOperation * operationCount;
  return calculateFeeBreakdown(totalFee);
}
