import { describe, it, expect } from 'vitest'
import { streamsToCSV } from '@/lib/export'
import type { StreamData } from '@/types/stream'

const TOKEN = { address: 'CUSDC', symbol: 'USDC', decimals: 7 }

function makeStream(overrides?: Partial<StreamData>): StreamData {
  return {
    id: 'stream-1',
    sender: 'GSEND123',
    recipient: 'GRCPT456',
    token: TOKEN,
    depositedAmount: 100_000_000n,
    withdrawnAmount: 50_000_000n,
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

function remainingColumn(csv: string): string {
  const [header, dataRow] = csv.split('\n')
  const index = header.split(',').indexOf('Remaining Amount')
  return dataRow.split(',')[index]
}

describe('streamsToCSV remaining amount', () => {
  it('reports zero for a cancelled stream', () => {
    const csv = streamsToCSV([makeStream({ cancelled: true })], 1_700_043_200)
    expect(remainingColumn(csv)).toBe('0')
  })

  it('keeps the deposited-minus-withdrawn amount for an active stream', () => {
    const csv = streamsToCSV([makeStream()], 1_700_043_200)
    expect(remainingColumn(csv)).toBe('5')
  })
})
