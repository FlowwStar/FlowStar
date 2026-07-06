export interface FeeBreakdown {
  networkFee: number
  cpuFee: number
  memoryFee: number
  storageFee: number
  totalEstimated: number
  estimatedUsd?: number
  minFee: number
}

const NETWORK_BASE_FEE = 100 // stroops (minimum fee per operation)
const XLM_PRICE = 0.12 // Average XLM price in USD for estimation

/**
 * Calculate fee breakdown from transaction simulation
 * @param minResourceFee Minimum resource fee from simulation in stroops
 * @param xlmPrice Current XLM price in USD (optional)
 * @returns Fee breakdown with network, CPU, memory, and storage fees
 */
export function calculateFeeBreakdown(
  minResourceFee: number,
  xlmPrice: number = XLM_PRICE,
): FeeBreakdown {
  // Apply 15% buffer to ensure inclusion
  const bufferMultiplier = 1.15
  const totalFee = Math.ceil(minResourceFee * bufferMultiplier)

  // Estimate component breakdown (these are approximations)
  // In reality, these come from the RPC simulation response
  const networkFee = Math.max(NETWORK_BASE_FEE, Math.floor(totalFee * 0.1))
  const cpuFee = Math.floor(totalFee * 0.4)
  const memoryFee = Math.floor(totalFee * 0.3)
  const storageFee = totalFee - networkFee - cpuFee - memoryFee

  const totalXlm = totalFee / 1e7
  const estimatedUsd = totalXlm * xlmPrice

  return {
    networkFee,
    cpuFee,
    memoryFee,
    storageFee,
    totalEstimated: totalFee,
    estimatedUsd,
    minFee: minResourceFee,
  }
}

/**
 * Estimate typical fees for common operations
 */
export const TYPICAL_FEES = {
  createStream: { min: 50000, typical: 80000, unit: 'stroops' },
  withdraw: { min: 30000, typical: 50000, unit: 'stroops' },
  transfer: { min: 20000, typical: 35000, unit: 'stroops' },
  cancel: { min: 40000, typical: 65000, unit: 'stroops' },
  topUp: { min: 35000, typical: 60000, unit: 'stroops' },
  batch: { min: 100000, typical: 150000, unit: 'stroops' },
}

/**
 * Check if a fee is considered high (more than 2x the average)
 */
export function isHighFee(fee: number, averageFee: number): boolean {
  return fee > averageFee * 2
}

/**
 * Format fee amount for display
 */
export function formatFee(stroops: number, decimals: number = 7): string {
  const xlm = stroops / 1e7
  return xlm.toFixed(Math.min(decimals, 7))
}

/**
 * Calculate batch operation total fees
 */
export function calculateBatchFees(
  operationCount: number,
  feePerOperation: number,
): FeeBreakdown {
  const totalFee = feePerOperation * operationCount
  return calculateFeeBreakdown(totalFee)
}
