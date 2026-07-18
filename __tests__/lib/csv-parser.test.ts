import { describe, it, expect } from 'vitest'
import { parseCsvBatch } from '@/lib/csv-parser'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HEADER = 'recipient,amount,start_time,end_time'

function makeRow(
  recipient = 'GABC',
  amount = '1000',
  start = '1000000',
  end = '2000000',
) {
  return `${recipient},${amount},${start},${end}`
}

// ─── parseCsvBatch ────────────────────────────────────────────────────────────

describe('parseCsvBatch', () => {
  describe('empty / trivial input', () => {
    it('returns empty rows and no errors for empty string', () => {
      const result = parseCsvBatch('')
      expect(result.rows).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
    })

    it('returns empty rows for whitespace-only input', () => {
      const result = parseCsvBatch('   \n  \n  ')
      expect(result.rows).toHaveLength(0)
    })
  })

  describe('header detection', () => {
    it('auto-detects a header row and skips it in output', () => {
      const csv = [HEADER, makeRow()].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.rows).toHaveLength(1)
    })

    it('includes header mapping when header detected', () => {
      const csv = [HEADER, makeRow()].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.headerMapping).toBeDefined()
      expect(result.headerMapping!.recipient).toBe(0)
      expect(result.headerMapping!.amount).toBe(1)
    })

    it('treats data as rows when no header present', () => {
      const csv = [makeRow(), makeRow('GDEF', '500', '100', '200')].join('\n')
      const result = parseCsvBatch(csv)
      // No header detected — both lines are data rows
      expect(result.rows).toHaveLength(2)
    })
  })

  describe('header aliases', () => {
    it('accepts "address" as an alias for recipient column', () => {
      const csv = ['address,amount,start_time,end_time', makeRow()].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.errors).toHaveLength(0)
      expect(result.rows[0].recipient).toBe('GABC')
    })

    it('accepts "total_amount" as an alias for amount column', () => {
      const csv = ['recipient,total_amount,start_time,end_time', makeRow()].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.errors).toHaveLength(0)
      expect(result.rows[0].amount).toBe('1000')
    })

    it('accepts "start_date" as alias for start_time', () => {
      const csv = ['recipient,amount,start_date,end_date', makeRow()].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('missing required columns', () => {
    it('returns an error when recipient column is missing', () => {
      const csv = ['amount,start_time,end_time', '1000,100,200'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('returns an error when amount column is missing', () => {
      const csv = ['recipient,start_time,end_time', 'GABC,100,200'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('returns an error when both start and end columns are missing', () => {
      const csv = ['recipient,amount', 'GABC,1000'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('returns zero rows when required columns are absent', () => {
      const csv = ['amount,start_time,end_time', '1000,100,200'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.rows).toHaveLength(0)
    })
  })

  describe('data parsing', () => {
    it('parses multiple data rows', () => {
      const csv = [HEADER, makeRow(), makeRow('GXYZ', '500', '2000', '3000')].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.rows).toHaveLength(2)
      expect(result.rows[0].recipient).toBe('GABC')
      expect(result.rows[1].recipient).toBe('GXYZ')
    })

    it('parses optional cliff_time column', () => {
      const csv = [
        'recipient,amount,start_time,end_time,cliff_time',
        'GABC,1000,1000,2000,1500',
      ].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.rows[0].cliff_time).toBe('1500')
    })

    it('parses optional cliff_amount column', () => {
      const csv = [
        'recipient,amount,start_time,end_time,cliff_amount',
        'GABC,1000,1000,2000,100',
      ].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.rows[0].cliff_amount).toBe('100')
    })

    it('handles CRLF line endings', () => {
      const csv = `${HEADER}\r\n${makeRow()}\r\n${makeRow('GXYZ', '500', '2000', '3000')}`
      const result = parseCsvBatch(csv)
      expect(result.rows).toHaveLength(2)
    })

    it('trims whitespace from values', () => {
      const csv = [HEADER, ' GABC , 1000 , 1000 , 2000 '].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.rows[0].recipient).toBe('GABC')
      expect(result.rows[0].amount).toBe('1000')
    })
  })

  describe('quoted fields', () => {
    it('handles quoted values containing commas', () => {
      const csv = [
        HEADER,
        '"GABC,rest",1000,1000,2000',
      ].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.rows[0].recipient).toBe('GABC,rest')
    })

    it('handles escaped double-quotes inside quoted fields', () => {
      const csv = [
        HEADER,
        '"GA""BC",1000,1000,2000',
      ].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.rows[0].recipient).toBe('GA"BC')
    })
  })

  describe('custom column mapping', () => {
    it('uses custom mapping when provided', () => {
      const csv = ['GABC', '1000', '1000', '2000'].join(',')
      const result = parseCsvBatch(csv, {
        recipient: 0,
        amount: 1,
        start_time: 2,
        end_time: 3,
      })
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].recipient).toBe('GABC')
      expect(result.rows[0].amount).toBe('1000')
    })
  })
})
