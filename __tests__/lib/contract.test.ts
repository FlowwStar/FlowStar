import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NETWORKS } from '@/lib/stellar'
import {
  cancelStream,
  createStream,
  createStreamsBatch,
  estimateCreateStreamFee,
  fetchStream,
  fetchStreamsForAddress,
  fetchArchivedSentStreamIds,
  getTokenMetadata,
  partialCancelStream,
  simulateCreateStreamPreview,
  withdrawFromStream,
  withdrawMaxFromStream,
} from '@/lib/contract'
import { getUnlockedAmount } from '@/lib/stream-utils'
import type { CreateStreamInput } from '@/types/stream'
import { getServer } from '@/lib/stellar'
import { Account, nativeToScVal } from '@stellar/stellar-sdk'

vi.mock('@/lib/stellar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stellar')>()
  return {
    ...actual,
    getServer: vi.fn(),
  }
})

const sender = 'GTEST-SENDER'
const recipient = 'GTEST-RECIPIENT'
const input: CreateStreamInput = {
  recipient,
  token: NETWORKS.testnet.knownTokens[0],
  totalAmount: 1_000n,
  startTime: 1_000n,
  endTime: 2_000n,
  cliffTime: 1_000n,
  cliffAmount: 0n,
}

async function createMockStream() {
  const promise = createStream(input, sender, 'testnet')
  await vi.advanceTimersByTimeAsync(700)
  return promise
}

describe('contract mock mode', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_STREAM_CONTRACT_ID_TESTNET', '')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('returns deterministic simulation and fee previews without network calls', async () => {
    expect((await simulateCreateStreamPreview('testnet', input, sender)).success).toBe(true)
    await expect(simulateCreateStreamPreview('testnet', input, sender)).resolves.toMatchObject({
      estimatedFeeXlm: '0.0115',
      estimatedFeeUsd: '~$0.001',
      cpuInstructions: 42_000,
      memoryBytes: 128,
    })
    await expect(estimateCreateStreamFee('testnet', input, sender)).resolves.toEqual({
      minFee: 100_000,
      estimatedFee: 115_000,
      estimatedFeeXlm: '0.0115',
    })
  })

  it('creates streams in the mock store and queries them by address', async () => {
    const id = await createMockStream()
    await expect(fetchStream('testnet', id)).resolves.toMatchObject({
      id,
      sender,
      recipient,
      depositedAmount: input.totalAmount,
      withdrawnAmount: 0n,
      cancelled: false,
    })

    const streams = await fetchStreamsForAddress('testnet', recipient)
    expect(streams.some((stream) => stream.id === id)).toBe(true)

    const batchIds = await createStreamsBatch([input, input], sender, 'testnet')
    expect(batchIds).toHaveLength(2)
    expect(new Set(batchIds).size).toBe(2)
  })

  it('updates and cancels streams through the delayed mock write paths', async () => {
    const id = await createMockStream()

    const withdrawPromise = withdrawFromStream(id, 125n, 'testnet')
    await vi.advanceTimersByTimeAsync(700)
    await expect(withdrawPromise).resolves.toBeNull()
    await expect(fetchStream('testnet', id)).resolves.toMatchObject({ withdrawnAmount: 125n })

    const cancelPromise = cancelStream(id, 'testnet')
    await vi.advanceTimersByTimeAsync(700)
    await expect(cancelPromise).resolves.toBeNull()
    await expect(fetchStream('testnet', id)).resolves.toMatchObject({ cancelled: true })
  })

  it('partially cancels a stream through the mock store, reclaiming part of the locked balance', async () => {
    const now = Math.floor(Date.now() / 1000)
    const partialInput: CreateStreamInput = {
      ...input,
      totalAmount: 1_000_000n,
      startTime: BigInt(now - 1_000),
      endTime: BigInt(now + 9_000),
      cliffTime: BigInt(now - 1_000),
      cliffAmount: 0n,
    }

    const createPromise = createStream(partialInput, sender, 'testnet')
    await vi.advanceTimersByTimeAsync(700)
    const id = await createPromise

    const before = await fetchStream('testnet', id)
    const locked = before!.depositedAmount - getUnlockedAmount(before!, now)
    expect(locked).toBeGreaterThan(0n)

    const reclaim = locked / 2n
    const partialCancelPromise = partialCancelStream(id, reclaim, 'testnet')
    await vi.advanceTimersByTimeAsync(700)
    await expect(partialCancelPromise).resolves.toBeNull()

    const after = await fetchStream('testnet', id)
    expect(after!.depositedAmount).toBe(before!.depositedAmount - reclaim)
    expect(after!.cancelled).toBe(false)
  it('withdrawMaxFromStream withdraws everything currently withdrawable, not a stale amount (#1146)', async () => {
    const id = await createMockStream()

    const withdrawPromise = withdrawMaxFromStream(id, 'testnet')
    await vi.advanceTimersByTimeAsync(700)
    await expect(withdrawPromise).resolves.toBeNull()
    await expect(fetchStream('testnet', id)).resolves.toMatchObject({
      withdrawnAmount: input.totalAmount,
    })
  })

  it('withdrawMaxFromStream resolves to null and withdraws nothing once fully drained', async () => {
    const id = await createMockStream()
    const first = withdrawMaxFromStream(id, 'testnet')
    await vi.advanceTimersByTimeAsync(700)
    await first

    await expect(withdrawMaxFromStream(id, 'testnet')).resolves.toBeNull()
    await expect(fetchStream('testnet', id)).resolves.toMatchObject({
      withdrawnAmount: input.totalAmount,
    })
  })

  it('withdrawMaxFromStream throws "Stream not found" for an unknown id', async () => {
    await expect(withdrawMaxFromStream('does-not-exist', 'testnet')).rejects.toThrow(
      'Stream not found',
    )
  })

  it('returns archived mock stream IDs for a matching sender', async () => {
    const id = await createMockStream()
    const cancelPromise = cancelStream(id, 'testnet')
    await vi.advanceTimersByTimeAsync(700)
    await cancelPromise

    await expect(fetchArchivedSentStreamIds('testnet', sender)).resolves.toContain(id)
  })
})

describe('getTokenMetadata', () => {
  const tokenAddress = NETWORKS.testnet.knownTokens[0].address
  const simulationAccount = new Account(
    'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI',
    '1',
  )

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_STREAM_CONTRACT_ID_TESTNET', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('maps symbol and decimals simulation results to token metadata', async () => {
    const simulateTransaction = vi
      .fn()
      .mockResolvedValueOnce({ result: { retval: nativeToScVal('TST') } })
      .mockResolvedValueOnce({ result: { retval: nativeToScVal(7) } })
    const getAccount = vi.fn().mockResolvedValue(simulationAccount)
    vi.mocked(getServer).mockReturnValue({ getAccount, simulateTransaction } as never)

    const metadata = await getTokenMetadata(tokenAddress, 'testnet')

    expect(getServer).toHaveBeenCalledWith('testnet')
    expect(simulateTransaction).toHaveBeenCalledTimes(2)
    expect(metadata).toEqual({ address: tokenAddress, symbol: 'TST', decimals: 7 })
  })

  it('returns null when simulation fails', async () => {
    const simulateTransaction = vi.fn().mockResolvedValue({
      error: 'HostError: contract trapped',
    })
    const getAccount = vi.fn().mockResolvedValue(simulationAccount)
    vi.mocked(getServer).mockReturnValue({ getAccount, simulateTransaction } as never)

    await expect(getTokenMetadata(tokenAddress, 'testnet')).resolves.toBeNull()
  })

  it('returns null when the RPC account lookup fails', async () => {
    const getAccount = vi.fn().mockRejectedValue(new Error('RPC unavailable'))
    vi.mocked(getServer).mockReturnValue({ getAccount } as never)

    await expect(getTokenMetadata(tokenAddress, 'testnet')).resolves.toBeNull()
  })
})
