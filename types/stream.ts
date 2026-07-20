/**
 * StreamData mirrors the struct returned by the Soroban streaming contract.
 *
 * All token amounts and timestamps are stored as `bigint` to match the
 * contract's i128 / u64 types exactly (no precision loss). Timestamps are
 * UNIX seconds. Amounts are in the token's smallest unit (stroops-like),
 * scaled by `decimals`.
 *
 * When you wire the real contract, map the contract return value into this
 * shape inside `lib/contract.ts`.
 */
export interface StreamData {
  id: string
  /** Address that funded and owns the stream (can cancel). */
  sender: string
  /** Address that receives the unlocking funds (can withdraw). */
  recipient: string
  /** Token contract address. */
  token: TokenInfo
  /** Total amount deposited into the stream (smallest unit). */
  depositedAmount: bigint
  /** Amount already withdrawn by the recipient (smallest unit). */
  withdrawnAmount: bigint
  /** Stream start time (UNIX seconds). */
  startTime: bigint
  /** Stream end time (UNIX seconds). */
  endTime: bigint
  /** Cliff time before which nothing (beyond cliffAmount) unlocks. */
  cliffTime: bigint
  /** Amount unlocked immediately at the cliff (smallest unit). */
  cliffAmount: bigint
  /** Linear unlock rate after the cliff (smallest unit per second). */
  amountPerSecond: bigint
  /** Total amount unlocked linearly after the cliff (smallest unit). Used with `duration` to reproduce the contract's exact unlock math. */
  linearAmount: bigint
  /** Length of the linear unlock period in seconds (matches the contract's `duration`). */
  duration: bigint
  /** Whether the sender has cancelled the stream. */
  cancelled: boolean
  /** Optional metadata attached to the stream. */
  metadata?: StreamMetadata
}

export interface TokenInfo {
  /** Token contract address on Stellar. */
  address: string
  symbol: string
  /** Number of decimals used to display the raw amount. */
  decimals: number
}

export interface StreamMetadata {
  name: string
  category: string
  memo: string
}

export type StreamStatus = 'scheduled' | 'streaming' | 'completed' | 'cancelled'

export interface CreateStreamInput {
  recipient: string
  token: TokenInfo
  totalAmount: bigint
  startTime: bigint
  endTime: bigint
  cliffTime: bigint
  cliffAmount: bigint
  metadata?: StreamMetadata
}
