import type { CreateStreamInput, StreamData } from '@/types/stream'
import { NETWORKS } from '@/lib/stellar'

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

const DEMO_ME = 'GBME...DEMO_WALLET_ADDRESS...XK7QZ'
export const DEMO_ADDRESS =
  'GBQ2X7KFY3R4VZ6N5LJ7WQH3M2PD8C9SAUTV4EXAMPLE0WALLET00ADDR'

const now = Math.floor(Date.now() / 1000)
const HOUR = 3600
const DAY = 86400

function makeStream(partial: Partial<StreamData> & Pick<StreamData, 'id'>): StreamData {
  const start = partial.startTime ?? BigInt(now - DAY)
  const end = partial.endTime ?? BigInt(now + DAY * 29)
  const deposited = partial.depositedAmount ?? 100_000n * 10n ** 7n
  const cliffAmount = partial.cliffAmount ?? 0n
  const duration = end - start
  const perSecond =
    partial.amountPerSecond ??
    (duration > 0n ? (deposited - cliffAmount) / duration : 0n)
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
    const amountPerSecond =
      duration > 0n ? (input.totalAmount - input.cliffAmount) / duration : 0n
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
}

export { DEMO_ME }
