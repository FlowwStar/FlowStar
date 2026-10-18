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
  simulateCreateStreamPreview,
  withdrawFromStream,
} from '@/lib/contract'
import type { CreateStreamInput } from '@/types/stream'
import { getServer } from '@/lib/stellar'
import { nativeToScVal } from '@stellar/stellar-sdk'

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

  it('returns archived mock stream IDs for a matching sender', async () => {
    const id = await createMockStream()
    const cancelPromise = cancelStream(id, 'testnet')
    await vi.advanceTimersByTimeAsync(700)
    await cancelPromise

    await expect(fetchArchivedSentStreamIds('testnet', sender)).resolves.toContain(id)
  })
})

describe('getTokenMetadata', () => {
  const tokenAddress = NETWORKS.testnet.knownTokens[0]

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_STREAM_CONTRACT_ID_TESTNET', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('returns mock metadata without network calls when no contract ID is configured', async () => {
    const metadata = await getTokenMetadata('testnet', tokenAddress)

    expect(metadata).toMatchObject({
      address: tokenAddress,
      name: expect.any(String),
      symbol: expect.any(String),
      decimals: expect.any(Number),
    })
    expect(getServer).not.toHaveBeenCalled()
  })

  it('maps a successful simulation retval to token metadata', async () => {
    vi.stubEnv('NEXT_PUBLIC_STREAM_CONTRACT_ID_TESTNET', 'CTEST-CONTRACT')

    const simulateTransaction = vi.fn().mockResolvedValue({
      result: { retval: nativeToScVal({ name: 'Test Token', symbol: 'TST', decimals: 7 }) },
    })
    const getAccount = vi.fn().mockResolvedValue({ accountId: sender, sequenceNumber: () => '1' })
    vi.mocked(getServer).mockReturnValue({ getAccount, simulateTransaction } as never)

    const metadata = await getTokenMetadata('testnet', tokenAddress)

    expect(simulateTransaction).toHaveBeenCalledTimes(1)
    expect(metadata).toMatchObject({
      address: tokenAddress,
      name: 'Test Token',
      symbol: 'TST',
      decimals: 7,
    })
  })

  it('returns a sensible error when simulation fails', async () => {
    vi.stubEnv('NEXT_PUBLIC_STREAM_CONTRACT_ID_TESTNET', 'CTEST-CONTRACT')

    const simulateTransaction = vi.fn().mockResolvedValue({
      error: 'HostError: contract trapped',
    })
    const getAccount = vi.fn().mockResolvedValue({ accountId: sender, sequenceNumber: () => '1' })
    vi.mocked(getServer).mockReturnValue({ getAccount, simulateTransaction } as never)

    await expect(getTokenMetadata('testnet', tokenAddress)).rejects.toThrow(/Simulation failed/i)
  })
})
