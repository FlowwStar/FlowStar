import type { CreateStreamInput, StreamData, StreamMetadata } from '@/types/stream'
import { NETWORKS } from '@/lib/stellar'
import { SECONDS_PER_DAY, getUnlockedAmount } from '@/lib/stream-utils'

/**
 * In-memory mock store standing in for on-chain state.
 *
 * This exists ONLY so the frontend is fully interactive before the Soroban
 * contracts are wired up. `lib/contract.ts` reads/writes through this store in
 * mock mode. When you connect the real contract, the store is no longer used —
 * the hooks read directly from chain data.
 */

const KNOWN_TOKENS = NETWORKS.testnet.knownTokens
const XLM = KNOWN_TOKENS[0]
const USDC = KNOWN_TOKENS[1]
const EURC = KNOWN_TOKENS[2]

export const DEMO_ADDRESS = 'GBQ2X7KFY3R4VZ6N5LJ7WQH3M2PD8C9SAUTV4EXAMPLE0WALLET00ADDR'

const now = Math.floor(Date.now() / 1000)
const HOUR = 3600
const DAY = SECONDS_PER_DAY

function makeStream(partial: Partial<StreamData> & Pick<StreamData, 'id'>): StreamData {
  const start = partial.startTime ?? BigInt(now - DAY)
  const end = partial.endTime ?? BigInt(now + DAY * 29)
  const deposited = partial.depositedAmount ?? 100_000n * 10n ** 7n
  const cliffAmount = partial.cliffAmount ?? 0n
  const duration = end - start
  const linearAmount = partial.linearAmount ?? deposited - cliffAmount
  const perSecond = partial.amountPerSecond ?? (duration > 0n ? linearAmount / duration : 0n)
  return {
    sender: DEMO_ADDRESS,
    recipient: 'GD7HQ...RECIPIENT...4FJ2K',
    token: XLM,
    depositedAmount: deposited,
    withdrawnAmount: 0n,
    startTime: start,
    endTime: end,
    cliffTime: partial.cliffTime ?? start,
    cliffAmount,
    amountPerSecond: perSecond,
    linearAmount,
    duration,
    cancelled: false,
    ...partial,
  }
}

let streams: StreamData[] = [
  makeStream({
    id: '1',
    recipient: 'GD7HQZX4...PAYROLL...4FJ2K',
    token: USDC,
    depositedAmount: 48_000n * 10n ** 7n,
    withdrawnAmount: 6_200n * 10n ** 7n,
    startTime: BigInt(now - DAY * 12),
    endTime: BigInt(now + DAY * 78),
  }),
  makeStream({
    id: '2',
    sender: 'GCEO...COFOUNDER...9XQ2',
    recipient: DEMO_ADDRESS,
    token: XLM,
    depositedAmount: 1_200_000n * 10n ** 7n,
    withdrawnAmount: 150_000n * 10n ** 7n,
    startTime: BigInt(now - DAY * 90),
    endTime: BigInt(now + DAY * 275),
    cliffTime: BigInt(now - DAY * 30),
    cliffAmount: 100_000n * 10n ** 7n,
  }),
  makeStream({
    id: '3',
    recipient: 'GADVISOR...GRANT...K3MZ',
    token: EURC,
    depositedAmount: 25_000n * 10n ** 7n,
    withdrawnAmount: 25_000n * 10n ** 7n,
    startTime: BigInt(now - DAY * 120),
    endTime: BigInt(now - DAY * 5),
  }),
  makeStream({
    id: '4',
    sender: 'GTREASURY...DAO...PL7X',
    recipient: DEMO_ADDRESS,
    token: USDC,
    depositedAmount: 12_000n * 10n ** 7n,
    withdrawnAmount: 0n,
    startTime: BigInt(now + DAY * 3),
    endTime: BigInt(now + DAY * 33),
    cliffTime: BigInt(now + DAY * 3),
  }),
  makeStream({
    id: '5',
    recipient: 'GCONTRACT...VENDOR...88QW',
    token: XLM,
    depositedAmount: 5_000n * 10n ** 7n,
    withdrawnAmount: 1_000n * 10n ** 7n,
    startTime: BigInt(now - HOUR * 6),
    endTime: BigInt(now + HOUR * 18),
    cancelled: true,
  }),
]

type Listener = () => void
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((l) => l())
}

// Issue #1141: mirrors the contract's separate `DataKey::Delegate(id)`
// storage entry — the delegate is not a field on the stream struct itself.
const delegates = new Map<string, string>()

export const mockStore = {
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getAll(): StreamData[] {
    return streams
  },
  getById(id: string): StreamData | undefined {
    return streams.find((s) => s.id === id)
  },
  create(input: CreateStreamInput, sender: string): StreamData {
    const id = String(Math.max(0, ...streams.map((s) => Number(s.id))) + 1)
    const duration = input.endTime - input.startTime
    const linearAmount = input.totalAmount - input.cliffAmount
    const amountPerSecond = duration > 0n ? linearAmount / duration : 0n
    const stream: StreamData = {
      id,
      sender,
      recipient: input.recipient,
      token: input.token,
      depositedAmount: input.totalAmount,
      withdrawnAmount: 0n,
      startTime: input.startTime,
      endTime: input.endTime,
      cliffTime: input.cliffTime,
      cliffAmount: input.cliffAmount,
      amountPerSecond,
      linearAmount,
      duration,
      cancelled: false,
    }
    streams = [stream, ...streams]
    emit()
    return stream
  },
  withdraw(id: string, amount: bigint) {
    streams = streams.map((s) =>
      s.id === id ? { ...s, withdrawnAmount: s.withdrawnAmount + amount } : s,
    )
    emit()
  },
  cancel(id: string) {
    streams = streams.map((s) => (s.id === id ? { ...s, cancelled: true } : s))
    emit()
  },
  /**
   * Issue #1135: mirrors the contract's `top_up` — adds `amount` to
   * `depositedAmount` and recalculates the unlock rate over the remaining
   * duration, same as `top_up` in contracts/streaming/src/lib.rs.
   */
  topUp(id: string, amount: bigint) {
    streams = streams.map((s) => {
      if (s.id !== id) return s
      const nowSec = BigInt(Math.floor(Date.now() / 1000))
      const depositedAmount = s.depositedAmount + amount
      const remainingSeconds = s.endTime > nowSec ? s.endTime - nowSec : 0n

      if (nowSec >= s.cliffTime) {
        const alreadyUnlocked = getUnlockedAmount(s, Number(nowSec))
        const remaining = depositedAmount - alreadyUnlocked
        const newRate = remainingSeconds > 0n ? remaining / remainingSeconds : 0n
        return {
          ...s,
          depositedAmount,
          cliffTime: nowSec,
          cliffAmount: alreadyUnlocked,
          startTime: nowSec,
          linearAmount: remaining,
          duration: remainingSeconds,
          amountPerSecond: newRate,
        }
      }

      const linearAmount = s.linearAmount + amount
      const newRate = s.duration > 0n ? linearAmount / s.duration : 0n
      return { ...s, depositedAmount, linearAmount, amountPerSecond: newRate }
    })
    emit()
  },
  /** Issue #1137: mirrors the contract's `transfer_stream`. */
  transfer(id: string, newRecipient: string) {
    streams = streams.map((s) => (s.id === id ? { ...s, recipient: newRecipient } : s))
  /** Issue #1143: update a stream's name/category/memo at any time. */
  updateMetadata(id: string, metadata: StreamMetadata) {
    streams = streams.map((s) => (s.id === id ? { ...s, metadata } : s))
    emit()
  },
  /** Issue #1138: reassign a stream's recipient. */
  transfer(id: string, newRecipient: string) {
    streams = streams.map((s) => (s.id === id ? { ...s, recipient: newRecipient } : s))
  /**
   * Issue #1139/#1140: reclaim `amount` of a stream's still-locked balance
   * back to the sender while leaving the stream active. Mirrors the
   * `partial_cancel` contract entrypoint (contracts/streaming/src/lib.rs):
   * reduces `depositedAmount` by `amount`, then re-bases the unlock curve
   * from `now` so the recipient's already-unlocked amount is preserved and
   * the remaining balance unlocks linearly over the time left.
   */
  partialCancel(id: string, amount: bigint, nowSeconds: number = Math.floor(Date.now() / 1000)) {
    const stream = streams.find((s) => s.id === id)
    if (!stream) throw new Error('Stream not found')
    if (stream.cancelled) throw new Error('Stream is cancelled')

    const now = BigInt(nowSeconds)
    if (now >= stream.endTime) throw new Error('Stream has ended')

    const unlocked = getUnlockedAmount(stream, nowSeconds)
    const locked = stream.depositedAmount - unlocked
    if (amount <= 0n || amount > locked) throw new Error('Invalid amount')

    const depositedAmount = stream.depositedAmount - amount
    const remainingSeconds = stream.endTime - now

    let updated: StreamData
    if (now >= stream.cliffTime) {
      const remaining = depositedAmount - unlocked
      const newRate = remainingSeconds > 0n ? remaining / remainingSeconds : 0n
      if (newRate === 0n && remaining > 0n) throw new Error('Resulting rate is zero')

      updated = {
        ...stream,
        depositedAmount,
        cliffTime: now,
        cliffAmount: unlocked,
        startTime: now,
        linearAmount: remaining,
        duration: remainingSeconds,
        amountPerSecond: newRate,
      }
    } else {
      const linearAmount = stream.linearAmount - amount
      const newRate = stream.duration > 0n ? linearAmount / stream.duration : 0n
      if (newRate === 0n && linearAmount > 0n) throw new Error('Resulting rate is zero')

      updated = {
        ...stream,
        depositedAmount,
        linearAmount,
        amountPerSecond: newRate,
      }
    }

    streams = streams.map((s) => (s.id === id ? updated : s))
    emit()
  },
  /** Streams that are terminal — cancelled, or fully withdrawn past end_time. */
  getArchived(address: string): StreamData[] {
    const nowSec = Math.floor(Date.now() / 1000)
    return streams.filter(
      (s) =>
        (s.sender === address || s.recipient === address) &&
        (s.cancelled || (s.withdrawnAmount >= s.depositedAmount && nowSec >= Number(s.endTime))),
    )
  },
  /** Issue #689: permanently remove a stream (mirrors cleanup_stream on-chain). */
  cleanup(id: string) {
    streams = streams.filter((s) => s.id !== id)
    emit()
  },
  /** Issue #1141: set (or replace) the withdrawal delegate for a stream. */
  setDelegate(id: string, delegate: string) {
    delegates.set(id, delegate)
    emit()
  },
  /** Issue #1141: clear the withdrawal delegate for a stream. */
  removeDelegate(id: string) {
    delegates.delete(id)
    emit()
  },
  /** Issue #1141: read the withdrawal delegate for a stream, if any. */
  getDelegate(id: string): string | null {
    return delegates.get(id) ?? null
  },
}
