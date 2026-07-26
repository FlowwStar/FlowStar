import { describe, it, expect } from 'vitest'
import { parseCsvBatch } from '../csv-parser'

// FlowwStar/FlowStar#340 — add unit tests for parseCsvLine via the public
// parseCsvBatch entry point. Each test exercises one parseCsvLine branch
// through a representative input the caller actually relies on.

describe('parseCsvBatch / parseCsvLine edge cases', () => {
  it('parses a plain comma-separated row', () => {
    const csv = [
      'recipient,amount,start_time,end_time',
      'GA,1000,2026-01-01T00:00:00Z,2026-12-31T23:59:59Z',
    ].join('\n')

    const result = parseCsvBatch(csv)
    expect(result.rows).toHaveLength(1)
    expect(result.errors).toEqual([])
    expect(result.rows[0]).toMatchObject({
      recipient: 'GA',
      amount: '1000',
      start_time: '2026-01-01T00:00:00Z',
      end_time: '2026-12-31T23:59:59Z',
    })
  })

  it('preserves commas inside quoted fields', () => {
    const csv = [
      'recipient,amount,start_time,end_time',
      '"GA,Attr-1",1000,2026-01-01T00:00:00Z,2026-12-31T23:59:59Z',
    ].join('\n')

    const result = parseCsvBatch(csv)
    expect(result.rows).toHaveLength(1)
    expect(result.errors).toEqual([])
    expect(result.rows[0].recipient).toBe('GA,Attr-1')
  })

  it('un-escapes an embedded double-quote pair inside a quoted field', () => {
    const csv = [
      'recipient,amount,start_time,end_time',
      '"GA""Spec",1000,2026-01-01T00:00:00Z,2026-12-31T23:59:59Z',
    ].join('\n')

    const result = parseCsvBatch(csv)
    expect(result.rows).toHaveLength(1)
    expect(result.errors).toEqual([])
    expect(result.rows[0].recipient).toBe('GA"Spec')
  })

  it('parses empty trailing cells as empty strings', () => {
    const csv = [
      'recipient,amount,start_time,end_time,cliff_time',
      'GA,1000,2026-01-01T00:00:00Z,2026-12-31T23:59:59Z,',
    ].join('\n')

    const result = parseCsvBatch(csv)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].recipient).toBe('GA')
    expect(result.rows[0].cliff_time).toBe('')
  })

  it('parses the optional duration row shape with quoted commas', () => {
    const csv = [
      'recipient,amount,start_time,cliff_time,cliff_amount,cliff_duration',
      '"GA,Wallet-One",500000,1700000000,1700003600,250000,30d',
    ].join('\n')

    const result = parseCsvBatch(csv)
    expect(result.rows).toHaveLength(1)
    expect(result.errors).toEqual([])
    expect(result.rows[0]).toMatchObject({
      recipient: 'GA,Wallet-One',
      amount: '500000',
      cliff_amount: '250000',
      cliff_duration: '30d',
    })
  })
})
