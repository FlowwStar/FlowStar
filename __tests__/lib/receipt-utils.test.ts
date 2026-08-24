import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildReceiptData } from '@/lib/receipt-utils'
import type { StreamData } from '@/types/stream'

const TOKEN = { address: 'TADDR', symbol: 'USDC', decimals: 7 }

function makeStream(overrides?: Partial<StreamData>): StreamData {
  return {
    id: 'stream-123',
    sender: 'GSENDER123',
    recipient: 'GRECIPIENT456',
    token: TOKEN,
    depositedAmount: 1_000_000_000n, // 100 USDC at 7 decimals
    withdrawnAmount: 0n,
    startTime: 1000n,
    endTime: 2000n,
    cliffTime: 1000n,
    cliffAmount: 0n,
    amountPerSecond: 1_000_000n, // 0.1 USDC/s
    linearAmount: 1_000_000_000n,
    duration: 1000n,
    cancelled: false,
    ...overrides,
  }
}

describe('buildReceiptData', () => {
  beforeEach(() => {
    // Mock Date.now() to return a fixed timestamp for consistent testing
    vi.useFakeTimers()
    vi.setSystemTime(new Date(1500 * 1000)) // Set to midway (1500s)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('completed stream', () => {
    it('derives correct status for completed stream', () => {
      vi.setSystemTime(new Date(2500 * 1000)) // Set to after end time

      const stream = makeStream({
        startTime: 1000n,
        endTime: 2000n,
        cancelled: false,
      })

      const receipt = buildReceiptData(stream)

      expect(receipt.status).toBe('Completed')
    })

    it('calculates correct duration for completed stream', () => {
      const stream = makeStream({
        startTime: 1000n,
        endTime: 2000n, // 1000 seconds duration
      })

      const receipt = buildReceiptData(stream)

      // 1000 seconds = 16 minutes and 40 seconds
      expect(receipt.duration).toBe('16m')
    })

    it('includes all transaction hashes', () => {
      const stream = makeStream()

      const receipt = buildReceiptData(
        stream,
        'creation-tx-hash',
        ['withdraw-tx-1', 'withdraw-tx-2'],
        undefined,
      )

      expect(receipt.creationTx).toBe('creation-tx-hash')
      expect(receipt.withdrawalTxs).toEqual(['withdraw-tx-1', 'withdraw-tx-2'])
      expect(receipt.cancellationTx).toBeUndefined()
    })
  })

  describe('in-progress stream', () => {
    it('derives correct status for active stream', () => {
      vi.setSystemTime(new Date(1500 * 1000)) // Midway between start and end

      const stream = makeStream({
        startTime: 1000n,
        endTime: 2000n,
        cancelled: false,
      })

      const receipt = buildReceiptData(stream)

      expect(receipt.status).toBe('Active')
    })

    it('calculates remaining amount correctly', () => {
      const stream = makeStream({
        depositedAmount: 1_000_000_000n, // 100 USDC
        withdrawnAmount: 300_000_000n, // 30 USDC withdrawn
      })

      const receipt = buildReceiptData(stream)

      expect(receipt.remainingAmountRaw).toBe(700_000_000n)
      expect(receipt.remainingAmount).toBe('70') // 70 USDC
    })

    it('includes withdrawn amount', () => {
      const stream = makeStream({
        depositedAmount: 1_000_000_000n,
        withdrawnAmount: 500_000_000n,
      })

      const receipt = buildReceiptData(stream)

      expect(receipt.withdrawnAmountRaw).toBe(500_000_000n)
      expect(receipt.withdrawnAmount).toBe('50')
    })
  })

  describe('cancelled stream', () => {
    it('derives correct status for cancelled stream', () => {
      vi.setSystemTime(new Date(1200 * 1000))

      const stream = makeStream({
        cancelled: true,
      })

      const receipt = buildReceiptData(stream)

      expect(receipt.status).toBe('Cancelled')
    })

    it('includes cancellation transaction hash', () => {
      const stream = makeStream({ cancelled: true })

      const receipt = buildReceiptData(stream, 'creation-tx', [], 'cancellation-tx-hash')

      expect(receipt.cancellationTx).toBe('cancellation-tx-hash')
    })

    it('status is Cancelled even if current time is past end time', () => {
      vi.setSystemTime(new Date(3000 * 1000)) // Past end time

      const stream = makeStream({
        startTime: 1000n,
        endTime: 2000n,
        cancelled: true,
      })

      const receipt = buildReceiptData(stream)

      expect(receipt.status).toBe('Cancelled')
    })
  })

  describe('duration formatting', () => {
    it('formats duration with days, hours, and minutes', () => {
      const stream = makeStream({
        startTime: 0n,
        endTime: 90061n, // 1 day, 1 hour, 1 minute, 1 second
      })

      const receipt = buildReceiptData(stream)

      expect(receipt.duration).toBe('1d 1h 1m')
    })

    it('formats duration with only hours and minutes', () => {
      const stream = makeStream({
        startTime: 0n,
        endTime: 3661n, // 1 hour, 1 minute, 1 second
      })

      const receipt = buildReceiptData(stream)

      expect(receipt.duration).toBe('1h 1m')
    })

    it('formats duration with only minutes', () => {
      const stream = makeStream({
        startTime: 0n,
        endTime: 300n, // 5 minutes
      })

      const receipt = buildReceiptData(stream)

      expect(receipt.duration).toBe('5m')
    })

    it('formats zero duration', () => {
      const stream = makeStream({
        startTime: 1000n,
        endTime: 1000n, // Same start and end
      })

      const receipt = buildReceiptData(stream)

      expect(receipt.duration).toBe('0m')
    })
  })

  describe('basic fields mapping', () => {
    it('includes all basic stream information', () => {
      const stream = makeStream()

      const receipt = buildReceiptData(stream)

      expect(receipt.streamId).toBe('stream-123')
      expect(receipt.sender).toBe('GSENDER123')
      expect(receipt.recipient).toBe('GRECIPIENT456')
      expect(receipt.tokenSymbol).toBe('USDC')
      expect(receipt.tokenAddress).toBe('TADDR')
    })

    it('includes total amount formatted correctly', () => {
      const stream = makeStream({
        depositedAmount: 2_500_000_000n, // 250 USDC
      })

      const receipt = buildReceiptData(stream)

      expect(receipt.totalAmountRaw).toBe(2_500_000_000n)
      expect(receipt.totalAmount).toBe('250')
    })

    it('includes cliff amount when present', () => {
      const stream = makeStream({
        cliffAmount: 100_000_000n, // 10 USDC
      })

      const receipt = buildReceiptData(stream)

      expect(receipt.cliffAmount).toBe('10')
    })

    it('includes amount per second when present', () => {
      const stream = makeStream({
        amountPerSecond: 1_000_000n, // 0.1 USDC/s
      })

      const receipt = buildReceiptData(stream)

      expect(receipt.amountPerSecond).toBe('0.1')
    })

    it('excludes cliff amount when zero', () => {
      const stream = makeStream({
        cliffAmount: 0n,
      })

      const receipt = buildReceiptData(stream)

      expect(receipt.cliffAmount).toBeUndefined()
    })

    it('excludes amount per second when zero', () => {
      const stream = makeStream({
        amountPerSecond: 0n,
      })

      const receipt = buildReceiptData(stream)

      expect(receipt.amountPerSecond).toBeUndefined()
    })
  })

  describe('date formatting', () => {
    it('formats dates for all time fields', () => {
      const stream = makeStream({
        startTime: 1000n,
        endTime: 2000n,
        cliffTime: 1500n,
      })

      const receipt = buildReceiptData(stream)

      expect(receipt.startDate).toBeTruthy()
      expect(receipt.endDate).toBeTruthy()
      expect(receipt.cliffDate).toBeTruthy()
      expect(typeof receipt.startDate).toBe('string')
      expect(typeof receipt.endDate).toBe('string')
      expect(typeof receipt.cliffDate).toBe('string')
    })

    it('includes generation timestamp', () => {
      const stream = makeStream()

      const receipt = buildReceiptData(stream)

      expect(receipt.generatedDate).toBeTruthy()
      expect(typeof receipt.generatedDate).toBe('string')
    })
  })

  describe('withdrawal transaction handling', () => {
    it('includes empty withdrawal list when none provided', () => {
      const stream = makeStream()

      const receipt = buildReceiptData(stream)

      expect(receipt.withdrawalTxs).toEqual([])
    })

    it('includes multiple withdrawal transactions', () => {
      const stream = makeStream()
      const withdrawals = ['tx1', 'tx2', 'tx3']

      const receipt = buildReceiptData(stream, undefined, withdrawals)

      expect(receipt.withdrawalTxs).toEqual(withdrawals)
      expect(receipt.withdrawalTxs).toHaveLength(3)
    })
  })
})
