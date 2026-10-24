export interface FeeBreakdown {
  minFee: number;
  bufferFee: number;
  totalEstimated: number;
  estimatedUsd?: number;
  xlmPriceUsed?: number;
  priceLastUpdated?: number;
  priceStale?: boolean;
}

export const DEFAULT_FALLBACK_XLM_PRICE = 0.12;
export const XLM_PRICE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const XLM_PRICE_API_TIMEOUT_MS = 10_000; // 10 seconds

export interface LiveXlmPriceResult {
  price: number;
  stale: boolean;
  fetchedAt: number;
  source: "live" | "cache" | "fallback";
}

let cachedPriceEntry: { price: number; fetchedAt: number } | null = null;

export async function fetchLiveXlmPrice(): Promise<LiveXlmPriceResult> {
  const now = Date.now();
  if (cachedPriceEntry && now - cachedPriceEntry.fetchedAt < XLM_PRICE_CACHE_TTL_MS) {
    return {
      price: cachedPriceEntry.price,
      stale: false,
      fetchedAt: cachedPriceEntry.fetchedAt,
      source: "cache",
    };
  }

  try {
    const res = await fetch(
      "https://api.stellar.expert/explorer/public/asset/XLM/price",
      {
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(XLM_PRICE_API_TIMEOUT_MS),
      },
    );
    if (!res.ok) throw new Error("price fetch failed");
    const json = await res.json();
    const price = Number(json.price ?? json.close ?? json.last);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("invalid price");
    }
    cachedPriceEntry = { price, fetchedAt: now };
    return {
      price,
      stale: false,
      fetchedAt: now,
      source: "live",
    };
  } catch {
    if (cachedPriceEntry) {
      return {
        price: cachedPriceEntry.price,
        stale: true,
        fetchedAt: cachedPriceEntry.fetchedAt,
        source: "cache",
      };
    }
    return {
      price: DEFAULT_FALLBACK_XLM_PRICE,
      stale: true,
      fetchedAt: now,
      source: "fallback",
    };
  }
}

export function clearFeePriceCacheForTesting(): void {
  cachedPriceEntry = null;
}

/**
 * Calculate fee breakdown from transaction simulation
 * @param minResourceFee Minimum resource fee from simulation in stroops
 * @param xlmPrice Current XLM price in USD (optional)
 * @returns Fee breakdown: base estimate, safety buffer, and total
 */
export function calculateFeeBreakdown(
  minResourceFee: number,
  xlmPrice: number = DEFAULT_FALLBACK_XLM_PRICE,
): FeeBreakdown {
  // Apply 15% buffer to ensure inclusion
  const bufferMultiplier = 1.15;
  const totalFee = Math.ceil(minResourceFee * bufferMultiplier);
  const bufferFee = totalFee - minResourceFee;

  const totalXlm = totalFee / 1e7;
  const estimatedUsd = totalXlm * xlmPrice;

  return {
    minFee: minResourceFee,
    bufferFee,
    totalEstimated: totalFee,
    estimatedUsd,
    xlmPriceUsed: xlmPrice,
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
