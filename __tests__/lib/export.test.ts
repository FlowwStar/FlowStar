import { describe, it, expect } from 'vitest'
import { streamsToCSV, webhookHistoryToCSV } from '@/lib/export'
import type { StreamData } from '@/types/stream'

const TOKEN = { address: 'CUSDC', symbol: 'USDC', decimals: 7 }

function makeStream(overrides?: Partial<StreamData>): StreamData {
  return {
    id: 'stream-1',
    sender: 'GSEND123',
    recipient: 'GRCPT456',
    token: TOKEN,
    depositedAmount: 100_000_000n, // 10 USDC
    withdrawnAmount: 50_000_000n, // 5 USDC
    startTime: 1_700_000_000n,
    endTime: 1_700_086_400n,
    cliffTime: 1_700_000_000n,
    cliffAmount: 0n,
    amountPerSecond: 1_157n,
    linearAmount: 100_000_000n,
    duration: 86_400n,
    cancelled: false,
    ...overrides,
  }
}

describe('streamsToCSV', () => {
  it('includes a header row', () => {
    const csv = streamsToCSV([makeStream()])
    const first = csv.split('\n')[0]
    expect(first).toContain('Stream ID')
    expect(first).toContain('Sender')
    expect(first).toContain('Recipient')
    expect(first).toContain('Token')
  })

  it('includes stream data in rows', () => {
    const csv = streamsToCSV([makeStream()])
    expect(csv).toContain('stream-1')
    expect(csv).toContain('GSEND123')
    expect(csv).toContain('GRCPT456')
    expect(csv).toContain('USDC')
  })

  it('returns only header for empty array', () => {
    const csv = streamsToCSV([])
    const lines = csv.split('\n').filter(Boolean)
    expect(lines).toHaveLength(1)
  })

  it('generates one row per stream', () => {
    const csv = streamsToCSV([makeStream(), makeStream({ id: 'stream-2' })])
    const lines = csv.split('\n').filter(Boolean)
    expect(lines).toHaveLength(3) // header + 2 data rows
  })

  it('shows "cancelled" status for cancelled stream', () => {
    const csv = streamsToCSV([makeStream({ cancelled: true })], 1_700_043_200)
    expect(csv).toContain('cancelled')
  })

  it('omits cliff date when cliffTime equals startTime', () => {
    const s = makeStream({ cliffTime: 1_700_000_000n, startTime: 1_700_000_000n })
    const csv = streamsToCSV([s])
    const dataRow = csv.split('\n')[1]
    // cliff column should be empty string
    const cols = dataRow.split(',')
    const cliffIdx = csv.split('\n')[0].split(',').indexOf('Cliff Date')
    expect(cols[cliffIdx]).toBe('')
  })

  it('escapes values containing commas', () => {
    const s = makeStream({ id: 'id,with,commas' })
    const csv = streamsToCSV([s])
    expect(csv).toContain('"id,with,commas"')
  })

  it('formats rate per day and per month columns', () => {
    const csv = streamsToCSV([makeStream()])
    const header = csv.split('\n')[0]
    expect(header).toContain('Rate (per day)')
    expect(header).toContain('Rate (per month)')
  })
})

interface WebhookDelivery {
  webhookId: string
  eventType: string
  statusCode: number | null
  deliveredAt: string
  success: boolean
}

function makeDelivery(overrides?: Partial<WebhookDelivery>): WebhookDelivery {
  return {
    webhookId: 'wh-1',
    eventType: 'stream.created',
    statusCode: 200,
    deliveredAt: '2024-01-01T00:00:00.000Z',
    success: true,
    ...overrides,
  }
}

describe('webhookHistoryToCSV', () => {
  it('includes the expected header row', () => {
    const csv = webhookHistoryToCSV([makeDelivery()])
    expect(csv.split('\n')[0]).toBe('Webhook ID,Event Type,Status Code,Delivered At,Success')
  })

  it('generates one row per delivery', () => {
    const history = [
      makeDelivery(),
      makeDelivery({ webhookId: 'wh-2', eventType: 'stream.cancelled', statusCode: 500 }),
    ]
    const csv = webhookHistoryToCSV(history)
    const lines = csv.split('\n').filter(Boolean)
    expect(lines).toHaveLength(history.length + 1)
    expect(lines[1]).toContain('wh-1')
    expect(lines[1]).toContain('stream.created')
    expect(lines[1]).toContain('200')
    expect(lines[2]).toContain('wh-2')
    expect(lines[2]).toContain('stream.cancelled')
    expect(lines[2]).toContain('500')
  })

  it('renders a null status code as an empty field', () => {
    const csv = webhookHistoryToCSV([makeDelivery({ statusCode: null })])
    const cols = csv.split('\n')[1].split(',')
    expect(cols[2]).toBe('')
  })

  it('renders success as true/false', () => {
    const csv = webhookHistoryToCSV([
      makeDelivery({ success: true }),
      makeDelivery({ webhookId: 'wh-2', success: false }),
    ])
    const lines = csv.split('\n')
    expect(lines[1].split(',')[4]).toBe('true')
    expect(lines[2].split(',')[4]).toBe('false')
  })

  it('escapes values containing commas', () => {
    const csv = webhookHistoryToCSV([makeDelivery({ webhookId: 'id,with,commas' })])
    expect(csv).toContain('"id,with,commas"')
  })

  it('escapes values containing double quotes', () => {
    const csv = webhookHistoryToCSV([makeDelivery({ eventType: 'he said "hi"' })])
    expect(csv).toContain('"he said ""hi"""')
  })
})
