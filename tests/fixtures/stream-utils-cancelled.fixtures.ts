import type { StreamData } from '@/types/stream'

/**
 * Non-test fixture data for cancelled streams.
 *
 * These fixtures describe the values returned by the current pure helpers in
 * `lib/stream-utils.ts`. See `docs/STREAM_CANCELLED_SEMANTICS.md` for the
 * intended behaviour and the known cancelled-display caveat.
 *
 * Amounts use 7 decimals, so 1_000_000_000n = 100 USDC.
 */
export const CANCELLED_STREAM_BASE: StreamData = {
  id: 'cancelled-1',
  sender: 'GSEND',
  recipient: 'GRCPT',
  token: { address: 'T', symbol: 'USDC', decimals: 7 },
  depositedAmount: 1_000_000_000n,
  withdrawnAmount: 0n,
  startTime: 1000n,
  endTime: 2000n,
  cliffTime: 1500n,
  cliffAmount: 100_000_000n,
  amountPerSecond: 900_000n,
  linearAmount: 900_000_000n,
  duration: 1000n,
  cancelled: true,
}

/** Build a cancelled stream fixture, overriding only the fields under test. */
export function makeCancelledStream(overrides: Partial<StreamData> = {}): StreamData {
  return { ...CANCELLED_STREAM_BASE, ...overrides }
}

export interface CancelledStreamFixture {
  /** Lifecycle phase the snapshot represents. */
  name: 'before cliff' | 'mid-stream' | 'after end'
  stream: StreamData
  /** Fixed clock value passed to the pure helpers (UNIX seconds). */
  nowSeconds: number
  /** Expected values from getUnlockedAmount / getWithdrawableAmount /
   * getLockedAmount / getStreamProgress at `nowSeconds`. */
  expected: {
    unlocked: bigint
    withdrawable: bigint
    locked: bigint
    progress: number
  }
}

/** Cancelled before the cliff: no payout yet, so withdrawnAmount is 0. */
export const cancelledBeforeCliff: CancelledStreamFixture = {
  name: 'before cliff',
  stream: makeCancelledStream(),
  nowSeconds: 1200,
  expected: {
    unlocked: 0n,
    withdrawable: 0n,
    locked: 1_000_000_000n,
    progress: 0,
  },
}

/**
 * Cancelled mid-stream: at now=1500 the cliff (100_000_000n) has vested along
 * with 500s × 900_000_000n / 1000s = 450_000_000n of linear amount, so the
 * cancel payout of 550_000_000n is folded into withdrawnAmount (ADR-014).
 */
export const cancelledMidStream: CancelledStreamFixture = {
  name: 'mid-stream',
  stream: makeCancelledStream({ withdrawnAmount: 550_000_000n }),
  nowSeconds: 1500,
  expected: {
    unlocked: 550_000_000n,
    withdrawable: 0n,
    locked: 450_000_000n,
    progress: 0.55,
  },
}

/** Cancelled after end: everything is unlocked and already paid out. */
export const cancelledAfterEnd: CancelledStreamFixture = {
  name: 'after end',
  stream: makeCancelledStream({ withdrawnAmount: 1_000_000_000n }),
  nowSeconds: 2500,
  expected: {
    unlocked: 1_000_000_000n,
    withdrawable: 0n,
    locked: 0n,
    progress: 1,
  },
}

/** All three cancelled phases, for table-driven assertions. */
export const cancelledStreamFixtures = [
  cancelledBeforeCliff,
  cancelledMidStream,
  cancelledAfterEnd,
] as const
