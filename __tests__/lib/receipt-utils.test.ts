import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  buildReceiptData,
  generateReceiptCSV,
  generateReceiptHTML,
  downloadFile,
} from '@/lib/receipt-utils'
import type { StreamData } from '@/types/stream'
import type { ReceiptData } from '@/lib/receipt-utils'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TOKEN = { address: 'CUSDC', symbol: 'USDC', decimals: 7 }

// Timestamps as BigInt Unix seconds
const START = BigInt(1_700_000_000) // ~ Nov 2023
const END = BigInt(1_700_000_000 + 86_400) // +1 day
const CLIFF = BigInt(1_700_000_000 + 3_600) // +1 hour

function makeStream(overrides: Partial<StreamData> = {}): StreamData {
  return {
    id: '42',
    sender: 'GSENDER111',
    recipient: 'GRECIPIENT222',
    token: TOKEN,
    depositedAmount: 1_000_0000000n, // 1000 USDC
    withdrawnAmount: 100_0000000n, // 100 USDC
    startTime: START,
    endTime: END,
    cliffTime: CLIFF,
    cliffAmount: 50_0000000n, // 50 USDC cliff
    amountPerSecond: 10_416n, // approx 1 USDC / 1000s
    linearAmount: 950_0000000n, // depositedAmount - cliffAmount
    duration: 86_400n,
    cancelled: false,
    ...overrides,
  }
}

// ─── buildReceiptData ─────────────────────────────────────────────────────────

describe('buildReceiptData', () => {
  it('maps stream id', () => {
    const receipt = buildReceiptData(makeStream())
    expect(receipt.streamId).toBe('42')
  })

  it('maps sender and recipient', () => {
    const receipt = buildReceiptData(makeStream())
    expect(receipt.sender).toBe('GSENDER111')
    expect(receipt.recipient).toBe('GRECIPIENT222')
  })

  it('maps token symbol and address', () => {
    const receipt = buildReceiptData(makeStream())
    expect(receipt.tokenSymbol).toBe('USDC')
    expect(receipt.tokenAddress).toBe('CUSDC')
  })

  it('computes remainingAmountRaw as deposited minus withdrawn', () => {
    const stream = makeStream()
    const receipt = buildReceiptData(stream)
    expect(receipt.remainingAmountRaw).toBe(stream.depositedAmount - stream.withdrawnAmount)
  })

  it('formats totalAmount as human-readable string', () => {
    const receipt = buildReceiptData(makeStream())
    // 1000 USDC with 7 decimals → "1000.00000000"
    expect(receipt.totalAmount).toContain('1000')
  })

  it('formats withdrawnAmount', () => {
    const receipt = buildReceiptData(makeStream())
    expect(receipt.withdrawnAmount).toContain('100')
  })

  it('includes cliffAmount string when cliff > 0', () => {
    const receipt = buildReceiptData(makeStream())
    expect(receipt.cliffAmount).toBeDefined()
    expect(receipt.cliffAmount).toContain('50')
  })

  it('omits cliffAmount string when cliff is 0', () => {
    const stream = makeStream({ cliffAmount: 0n })
    const receipt = buildReceiptData(stream)
    expect(receipt.cliffAmount).toBeUndefined()
  })

  it('includes amountPerSecond when > 0', () => {
    const receipt = buildReceiptData(makeStream())
    expect(receipt.amountPerSecond).toBeDefined()
  })

  it('omits amountPerSecond when 0', () => {
    const stream = makeStream({ amountPerSecond: 0n })
    const receipt = buildReceiptData(stream)
    expect(receipt.amountPerSecond).toBeUndefined()
  })

  it('status is "Active" for ongoing non-cancelled stream', () => {
    const futureEnd = BigInt(Math.floor(Date.now() / 1000) + 86_400)
    const receipt = buildReceiptData(makeStream({ endTime: futureEnd, cancelled: false }))
    expect(receipt.status).toBe('Active')
  })

  it('status is "Cancelled" for cancelled stream', () => {
    const receipt = buildReceiptData(makeStream({ cancelled: true }))
    expect(receipt.status).toBe('Cancelled')
  })

  it('status is "Completed" for past stream', () => {
    const pastEnd = BigInt(Math.floor(Date.now() / 1000) - 1)
    const receipt = buildReceiptData(makeStream({ endTime: pastEnd }))
    expect(receipt.status).toBe('Completed')
  })

  it('calculates duration in days/hours/minutes', () => {
    const receipt = buildReceiptData(makeStream())
    // END - START = 86400 seconds = 1 day exactly
    expect(receipt.duration).toContain('1d')
  })

  it('includes creationTx when provided', () => {
    const receipt = buildReceiptData(makeStream(), 'TX_CREATION_HASH')
    expect(receipt.creationTx).toBe('TX_CREATION_HASH')
  })

  it('includes withdrawalTxs when provided', () => {
    const receipt = buildReceiptData(makeStream(), undefined, ['TX_WITHDRAW_1', 'TX_WITHDRAW_2'])
    expect(receipt.withdrawalTxs).toEqual(['TX_WITHDRAW_1', 'TX_WITHDRAW_2'])
  })

  it('returns empty withdrawalTxs when not provided', () => {
    const receipt = buildReceiptData(makeStream())
    expect(receipt.withdrawalTxs).toEqual([])
  })

  it('includes cancellationTx when provided', () => {
    const receipt = buildReceiptData(
      makeStream({ cancelled: true }),
      undefined,
      undefined,
      'TX_CANCEL_HASH',
    )
    expect(receipt.cancellationTx).toBe('TX_CANCEL_HASH')
  })

  it('includes generatedDate', () => {
    const receipt = buildReceiptData(makeStream())
    expect(typeof receipt.generatedDate).toBe('string')
    expect(receipt.generatedDate.length).toBeGreaterThan(0)
  })
})

// ─── generateReceiptCSV ───────────────────────────────────────────────────────

describe('generateReceiptCSV', () => {
  let receipt: ReceiptData

  beforeEach(() => {
    receipt = buildReceiptData(makeStream(), 'TX_CREATE', ['TX_W1'], 'TX_CANCEL')
  })

  it('includes stream ID', () => {
    const csv = generateReceiptCSV(receipt)
    expect(csv).toContain('42')
  })

  it('includes sender address', () => {
    const csv = generateReceiptCSV(receipt)
    expect(csv).toContain('GSENDER111')
  })

  it('includes recipient address', () => {
    const csv = generateReceiptCSV(receipt)
    expect(csv).toContain('GRECIPIENT222')
  })

  it('includes token symbol', () => {
    const csv = generateReceiptCSV(receipt)
    expect(csv).toContain('USDC')
  })

  it('includes creation tx hash', () => {
    const csv = generateReceiptCSV(receipt)
    expect(csv).toContain('TX_CREATE')
  })

  it('includes withdrawal tx hash', () => {
    const csv = generateReceiptCSV(receipt)
    expect(csv).toContain('TX_W1')
  })

  it('includes cancellation tx hash', () => {
    const csv = generateReceiptCSV(receipt)
    expect(csv).toContain('TX_CANCEL')
  })

  it('returns newline-separated lines', () => {
    const csv = generateReceiptCSV(receipt)
    expect(csv.split('\n').length).toBeGreaterThan(5)
  })
})

// ─── generateReceiptHTML ──────────────────────────────────────────────────────

describe('generateReceiptHTML', () => {
  let receipt: ReceiptData

  beforeEach(() => {
    receipt = buildReceiptData(makeStream(), 'TX_CREATE')
  })

  it('returns a string starting with <!DOCTYPE html>', () => {
    const html = generateReceiptHTML(receipt)
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/i)
  })

  it('contains the stream ID', () => {
    const html = generateReceiptHTML(receipt)
    expect(html).toContain('42')
  })

  it('contains sender address', () => {
    const html = generateReceiptHTML(receipt)
    expect(html).toContain('GSENDER111')
  })

  it('contains recipient address', () => {
    const html = generateReceiptHTML(receipt)
    expect(html).toContain('GRECIPIENT222')
  })

  it('contains token symbol', () => {
    const html = generateReceiptHTML(receipt)
    expect(html).toContain('USDC')
  })

  it('embeds logo when logoBase64 provided', () => {
    const html = generateReceiptHTML(receipt, 'data:image/png;base64,ABC123')
    expect(html).toContain('data:image/png;base64,ABC123')
  })

  it('omits img tag when no logo provided', () => {
    const html = generateReceiptHTML(receipt)
    expect(html).not.toContain('<img src=')
  })
})

// ─── downloadFile ─────────────────────────────────────────────────────────────

describe('downloadFile', () => {
  it('creates and clicks an anchor element', () => {
    // Mock URL.createObjectURL and URL.revokeObjectURL
    const mockUrl = 'blob:mock-url'
    const createObjectURL = vi.fn(() => mockUrl)
    const revokeObjectURL = vi.fn()
    Object.defineProperty(globalThis, 'URL', {
      value: { createObjectURL, revokeObjectURL },
      writable: true,
    })

    const clickSpy = vi.fn()
    const mockAnchor = { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement
    vi.spyOn(document, 'createElement').mockReturnValueOnce(mockAnchor)

    downloadFile('hello world', 'test.txt', 'text/plain')

    expect(mockAnchor.download).toBe('test.txt')
    expect(mockAnchor.href).toBe(mockUrl)
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith(mockUrl)
  })
})
