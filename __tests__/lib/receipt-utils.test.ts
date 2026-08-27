import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildReceiptData, generateReceiptCSV } from '@/lib/receipt-utils'
import type { StreamData } from '@/types/stream'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const TOKEN = { address: 'TADDR', symbol: 'USDC', decimals: 7 }

/** Canonical base stream: 1000s duration, 100 USDC deposited, nothing withdrawn. */
function makeStream(overrides?: Partial<StreamData>): StreamData {
  return {
    id: 'stream-123',
    sender: 'GSENDER123',
    recipient: 'GRECIPIENT456',
    token: TOKEN,
    depositedAmount: 1_000_000_000n, // 100 USDC (7 decimals)
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

// ---------------------------------------------------------------------------
// buildReceiptData
// ---------------------------------------------------------------------------

describe('buildReceiptData', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(1500 * 1000)) // midway through the stream
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // --- status ---------------------------------------------------------------

  describe('status derivation', () => {
    it('returns Active for an in-progress stream', () => {
      const receipt = buildReceiptData(makeStream())
      expect(receipt.status).toBe('Active')
    })

    it('returns Completed when now >= endTime', () => {
      vi.setSystemTime(new Date(2500 * 1000))
      const receipt = buildReceiptData(makeStream())
      expect(receipt.status).toBe('Completed')
    })

    it('returns Cancelled when cancelled flag is true', () => {
      const receipt = buildReceiptData(makeStream({ cancelled: true }))
      expect(receipt.status).toBe('Cancelled')
    })

    it('prefers Cancelled over Completed when both conditions hold', () => {
      vi.setSystemTime(new Date(3000 * 1000))
      const receipt = buildReceiptData(makeStream({ cancelled: true }))
      expect(receipt.status).toBe('Cancelled')
    })
  })

  // --- duration formatting --------------------------------------------------

  describe('duration formatting', () => {
    it('shows days + hours + minutes for multi-day streams', () => {
      const receipt = buildReceiptData(
        makeStream({ startTime: 0n, endTime: 90061n }), // 1d 1h 1m 1s
      )
      expect(receipt.duration).toBe('1d 1h 1m')
    })

    it('shows hours + minutes when less than one day', () => {
      const receipt = buildReceiptData(
        makeStream({ startTime: 0n, endTime: 3661n }), // 1h 1m 1s
      )
      expect(receipt.duration).toBe('1h 1m')
    })

    it('shows only minutes when less than one hour', () => {
      const receipt = buildReceiptData(
        makeStream({ startTime: 0n, endTime: 300n }), // 5m
      )
      expect(receipt.duration).toBe('5m')
    })

    it('returns 0m for a zero-length stream', () => {
      const receipt = buildReceiptData(makeStream({ startTime: 1000n, endTime: 1000n }))
      expect(receipt.duration).toBe('0m')
    })

    it('calculates 1000s as 16m', () => {
      // 1000s = 0 days, 0 hours, 16 minutes (remainder 40s ignored)
      const receipt = buildReceiptData(makeStream())
      expect(receipt.duration).toBe('16m')
    })
  })

  // --- basic field mapping --------------------------------------------------

  describe('field mapping', () => {
    it('copies identity fields from the stream', () => {
      const receipt = buildReceiptData(makeStream())
      expect(receipt.streamId).toBe('stream-123')
      expect(receipt.sender).toBe('GSENDER123')
      expect(receipt.recipient).toBe('GRECIPIENT456')
      expect(receipt.tokenSymbol).toBe('USDC')
      expect(receipt.tokenAddress).toBe('TADDR')
    })

    it('formats totalAmount correctly for 100 USDC', () => {
      const receipt = buildReceiptData(makeStream())
      expect(receipt.totalAmountRaw).toBe(1_000_000_000n)
      expect(receipt.totalAmount).toBe('100')
    })

    it('formats totalAmount for a non-round value (250 USDC)', () => {
      const receipt = buildReceiptData(makeStream({ depositedAmount: 2_500_000_000n }))
      expect(receipt.totalAmountRaw).toBe(2_500_000_000n)
      expect(receipt.totalAmount).toBe('250')
    })

    it('computes remainingAmount as deposited minus withdrawn', () => {
      const receipt = buildReceiptData(
        makeStream({ depositedAmount: 1_000_000_000n, withdrawnAmount: 300_000_000n }),
      )
      expect(receipt.remainingAmountRaw).toBe(700_000_000n)
      expect(receipt.remainingAmount).toBe('70')
    })

    it('formats withdrawnAmount correctly', () => {
      const receipt = buildReceiptData(
        makeStream({ depositedAmount: 1_000_000_000n, withdrawnAmount: 500_000_000n }),
      )
      expect(receipt.withdrawnAmountRaw).toBe(500_000_000n)
      expect(receipt.withdrawnAmount).toBe('50')
    })

    it('remaining is zero when fully withdrawn', () => {
      const receipt = buildReceiptData(
        makeStream({ depositedAmount: 1_000_000_000n, withdrawnAmount: 1_000_000_000n }),
      )
      expect(receipt.remainingAmountRaw).toBe(0n)
      expect(receipt.remainingAmount).toBe('0')
    })
  })

  // --- cliff / amountPerSecond optional fields ------------------------------

  describe('optional amount fields', () => {
    it('includes cliffAmount when non-zero', () => {
      const receipt = buildReceiptData(makeStream({ cliffAmount: 100_000_000n })) // 10 USDC
      expect(receipt.cliffAmount).toBe('10')
    })

    it('omits cliffAmount when zero', () => {
      const receipt = buildReceiptData(makeStream({ cliffAmount: 0n }))
      expect(receipt.cliffAmount).toBeUndefined()
    })

    it('includes amountPerSecond when non-zero', () => {
      const receipt = buildReceiptData(makeStream({ amountPerSecond: 1_000_000n }))
      // 1_000_000 / 10^7 = 0.1
      expect(receipt.amountPerSecond).toBe('0.1')
    })

    it('omits amountPerSecond when zero', () => {
      const receipt = buildReceiptData(makeStream({ amountPerSecond: 0n }))
      expect(receipt.amountPerSecond).toBeUndefined()
    })
  })

  // --- date fields ----------------------------------------------------------

  describe('date fields', () => {
    it('produces non-empty strings for startDate, endDate, cliffDate', () => {
      const receipt = buildReceiptData(makeStream({ cliffTime: 1500n }))
      expect(typeof receipt.startDate).toBe('string')
      expect(receipt.startDate.length).toBeGreaterThan(0)
      expect(typeof receipt.endDate).toBe('string')
      expect(receipt.endDate.length).toBeGreaterThan(0)
      expect(typeof receipt.cliffDate).toBe('string')
      expect(receipt.cliffDate.length).toBeGreaterThan(0)
    })

    it('includes a generatedDate string', () => {
      const receipt = buildReceiptData(makeStream())
      expect(typeof receipt.generatedDate).toBe('string')
      expect(receipt.generatedDate.length).toBeGreaterThan(0)
    })
  })

  // --- transaction hashes ---------------------------------------------------

  describe('transaction hashes', () => {
    it('defaults withdrawalTxs to an empty array when omitted', () => {
      const receipt = buildReceiptData(makeStream())
      expect(receipt.withdrawalTxs).toEqual([])
    })

    it('stores creationTx when provided', () => {
      const receipt = buildReceiptData(makeStream(), 'creation-tx-hash')
      expect(receipt.creationTx).toBe('creation-tx-hash')
    })

    it('stores multiple withdrawalTxs', () => {
      const hashes = ['tx1', 'tx2', 'tx3']
      const receipt = buildReceiptData(makeStream(), undefined, hashes)
      expect(receipt.withdrawalTxs).toEqual(hashes)
      expect(receipt.withdrawalTxs).toHaveLength(3)
    })

    it('stores cancellationTx when provided', () => {
      const receipt = buildReceiptData(makeStream({ cancelled: true }), 'creation-tx', [], 'cancel-tx')
      expect(receipt.cancellationTx).toBe('cancel-tx')
    })

    it('leaves creationTx and cancellationTx undefined when not provided', () => {
      const receipt = buildReceiptData(makeStream())
      expect(receipt.creationTx).toBeUndefined()
      expect(receipt.cancellationTx).toBeUndefined()
    })

    it('includes all hashes together', () => {
      const receipt = buildReceiptData(
        makeStream(),
        'creation-tx-hash',
        ['withdraw-tx-1', 'withdraw-tx-2'],
        undefined,
      )
      expect(receipt.creationTx).toBe('creation-tx-hash')
      expect(receipt.withdrawalTxs).toEqual(['withdraw-tx-1', 'withdraw-tx-2'])
      expect(receipt.cancellationTx).toBeUndefined()
    })
  })
})

// ---------------------------------------------------------------------------
// generateReceiptCSV
// ---------------------------------------------------------------------------

describe('generateReceiptCSV', () => {
  // Build a reusable receipt so each CSV test can share common setup.
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(1500 * 1000))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function makeReceipt(streamOverrides?: Partial<StreamData>) {
    const stream = makeStream(streamOverrides)
    return buildReceiptData(stream, 'creation-tx', ['withdraw-tx-1'], 'cancel-tx')
  }

  // --- structure ------------------------------------------------------------

  describe('header and structure', () => {
    it('starts with FlowStar Stream Receipt header', () => {
      const csv = generateReceiptCSV(makeReceipt())
      const lines = csv.split('\n')
      expect(lines[0]).toBe('FlowStar Stream Receipt')
    })

    it('includes a Generated timestamp on the second line', () => {
      const csv = generateReceiptCSV(makeReceipt())
      const lines = csv.split('\n')
      expect(lines[1]).toMatch(/^Generated:/)
    })

    it('contains section headings for all major sections', () => {
      const csv = generateReceiptCSV(makeReceipt())
      expect(csv).toContain('Stream Information')
      expect(csv).toContain('Parties')
      expect(csv).toContain('Token Details')
      expect(csv).toContain('Schedule')
      expect(csv).toContain('Amounts')
      expect(csv).toContain('Transaction Hashes')
    })

    it('uses newlines as line separators', () => {
      const csv = generateReceiptCSV(makeReceipt())
      // Must contain at least one newline, and must NOT use CRLF
      expect(csv).toContain('\n')
    })
  })

  // --- stream information section ------------------------------------------

  describe('Stream Information section', () => {
    it('includes the stream ID', () => {
      const csv = generateReceiptCSV(makeReceipt())
      expect(csv).toContain('Stream ID,stream-123')
    })

    it('includes the status', () => {
      const csv = generateReceiptCSV(makeReceipt())
      expect(csv).toContain('Status,Active')
    })

    it('reflects Completed status', () => {
      vi.setSystemTime(new Date(3000 * 1000))
      const csv = generateReceiptCSV(makeReceipt())
      expect(csv).toContain('Status,Completed')
    })

    it('reflects Cancelled status', () => {
      const csv = generateReceiptCSV(makeReceipt({ cancelled: true }))
      expect(csv).toContain('Status,Cancelled')
    })
  })

  // --- parties section ------------------------------------------------------

  describe('Parties section', () => {
    it('includes sender address', () => {
      const csv = generateReceiptCSV(makeReceipt())
      expect(csv).toContain('Sender,GSENDER123')
    })

    it('includes recipient address', () => {
      const csv = generateReceiptCSV(makeReceipt())
      expect(csv).toContain('Recipient,GRECIPIENT456')
    })
  })

  // --- token details section ------------------------------------------------

  describe('Token Details section', () => {
    it('includes token symbol', () => {
      const csv = generateReceiptCSV(makeReceipt())
      expect(csv).toContain('Symbol,USDC')
    })

    it('includes token address', () => {
      const csv = generateReceiptCSV(makeReceipt())
      expect(csv).toContain('Address,TADDR')
    })
  })

  // --- schedule section -----------------------------------------------------

  describe('Schedule section', () => {
    it('includes start, end, and cliff date rows', () => {
      const csv = generateReceiptCSV(makeReceipt())
      expect(csv).toContain('Start Date,')
      expect(csv).toContain('End Date,')
      expect(csv).toContain('Cliff Date,')
    })

    it('includes duration', () => {
      const csv = generateReceiptCSV(makeReceipt())
      expect(csv).toContain('Duration,16m')
    })

    it('includes Cliff Amount row when cliffAmount is non-zero', () => {
      const csv = generateReceiptCSV(makeReceipt({ cliffAmount: 100_000_000n })) // 10 USDC
      expect(csv).toContain('Cliff Amount,10 USDC')
    })

    it('omits Cliff Amount row when cliffAmount is zero', () => {
      const csv = generateReceiptCSV(makeReceipt({ cliffAmount: 0n }))
      expect(csv).not.toContain('Cliff Amount')
    })
  })

  // --- amounts section ------------------------------------------------------

  describe('Amounts section', () => {
    it('includes Total Deposited with token symbol', () => {
      const csv = generateReceiptCSV(makeReceipt())
      expect(csv).toContain('Total Deposited,100 USDC')
    })

    it('includes Withdrawn amount with token symbol', () => {
      const csv = generateReceiptCSV(makeReceipt())
      expect(csv).toContain('Withdrawn,0 USDC')
    })

    it('includes Remaining amount with token symbol', () => {
      const csv = generateReceiptCSV(makeReceipt())
      expect(csv).toContain('Remaining,100 USDC')
    })

    it('reflects partial withdrawal correctly', () => {
      const csv = generateReceiptCSV(
        makeReceipt({ depositedAmount: 1_000_000_000n, withdrawnAmount: 500_000_000n }),
      )
      expect(csv).toContain('Withdrawn,50 USDC')
      expect(csv).toContain('Remaining,50 USDC')
    })
  })

  // --- unlock rate section --------------------------------------------------

  describe('Unlock Rate section', () => {
    it('includes Per Second rate when amountPerSecond is non-zero', () => {
      const csv = generateReceiptCSV(makeReceipt({ amountPerSecond: 1_000_000n }))
      expect(csv).toContain('Unlock Rate')
      expect(csv).toContain('Per Second,0.1 USDC')
    })

    it('omits Unlock Rate section when amountPerSecond is zero', () => {
      const csv = generateReceiptCSV(makeReceipt({ amountPerSecond: 0n }))
      expect(csv).not.toContain('Unlock Rate')
      expect(csv).not.toContain('Per Second')
    })
  })

  // --- transaction hashes section ------------------------------------------

  describe('Transaction Hashes section', () => {
    it('includes the Creation tx hash', () => {
      const stream = makeStream()
      const receipt = buildReceiptData(stream, 'creation-tx-hash')
      const csv = generateReceiptCSV(receipt)
      expect(csv).toContain('Creation,creation-tx-hash')
    })

    it('omits Creation row when creationTx is absent', () => {
      const receipt = buildReceiptData(makeStream())
      const csv = generateReceiptCSV(receipt)
      expect(csv).not.toContain('Creation,')
    })

    it('numbers multiple withdrawal transactions', () => {
      const receipt = buildReceiptData(makeStream(), undefined, ['hash-a', 'hash-b', 'hash-c'])
      const csv = generateReceiptCSV(receipt)
      expect(csv).toContain('Withdrawal 1,hash-a')
      expect(csv).toContain('Withdrawal 2,hash-b')
      expect(csv).toContain('Withdrawal 3,hash-c')
    })

    it('omits withdrawal rows when list is empty', () => {
      const receipt = buildReceiptData(makeStream(), undefined, [])
      const csv = generateReceiptCSV(receipt)
      expect(csv).not.toContain('Withdrawal 1')
    })

    it('includes the Cancellation tx hash', () => {
      const receipt = buildReceiptData(makeStream({ cancelled: true }), undefined, [], 'cancel-hash')
      const csv = generateReceiptCSV(receipt)
      expect(csv).toContain('Cancellation,cancel-hash')
    })

    it('omits Cancellation row when cancellationTx is absent', () => {
      const receipt = buildReceiptData(makeStream())
      const csv = generateReceiptCSV(receipt)
      expect(csv).not.toContain('Cancellation,')
    })

    it('includes all three hash types together', () => {
      const receipt = buildReceiptData(makeStream(), 'c-tx', ['w-tx'], 'x-tx')
      const csv = generateReceiptCSV(receipt)
      expect(csv).toContain('Creation,c-tx')
      expect(csv).toContain('Withdrawal 1,w-tx')
      expect(csv).toContain('Cancellation,x-tx')
    })
  })

  // --- edge cases -----------------------------------------------------------

  describe('edge cases', () => {
    it('returns a non-empty string for a minimal stream', () => {
      const receipt = buildReceiptData(makeStream())
      const csv = generateReceiptCSV(receipt)
      expect(typeof csv).toBe('string')
      expect(csv.length).toBeGreaterThan(0)
    })

    it('handles a fully-withdrawn stream without errors', () => {
      const csv = generateReceiptCSV(
        makeReceipt({ depositedAmount: 1_000_000_000n, withdrawnAmount: 1_000_000_000n }),
      )
      expect(csv).toContain('Withdrawn,100 USDC')
      expect(csv).toContain('Remaining,0 USDC')
    })

    it('handles a stream with no optional fields', () => {
      const receipt = buildReceiptData(
        makeStream({ cliffAmount: 0n, amountPerSecond: 0n }),
      )
      const csv = generateReceiptCSV(receipt)
      expect(csv).not.toContain('Cliff Amount')
      expect(csv).not.toContain('Unlock Rate')
    })

    it('includes the generated date from the receipt in the CSV', () => {
      const receipt = buildReceiptData(makeStream())
      const csv = generateReceiptCSV(receipt)
      // The Generated line must contain the same value stored in the receipt
      expect(csv).toContain(receipt.generatedDate)
    })
  })
})
