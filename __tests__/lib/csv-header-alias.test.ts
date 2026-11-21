import { describe, it, expect } from 'vitest'
import { parseCsvBatch } from '@/lib/csv-parser'

/**
 * Tests for CSV header alias detection in parseCsvBatch().
 * Verifies that different supported alias spellings for the same logical column
 * all map to the same internal field correctly.
 */
describe('parseCsvBatch - header alias detection', () => {
  describe('recipient field aliases', () => {
    it('maps "recipient" to recipient field', () => {
      const csv = ['recipient,amount,start_time,end_time', 'GABC,1000,1000,2000'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.errors).toHaveLength(0)
      expect(result.headerMapping?.recipient).toBe(0)
      expect(result.rows[0].recipient).toBe('GABC')
    })

    it('maps "recipient_address" to recipient field', () => {
      const csv = ['recipient_address,amount,start_time,end_time', 'GXYZ,1000,1000,2000'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.errors).toHaveLength(0)
      expect(result.headerMapping?.recipient).toBe(0)
      expect(result.rows[0].recipient).toBe('GXYZ')
    })

    it('maps "address" to recipient field', () => {
      const csv = ['address,amount,start_time,end_time', 'GDEF,1000,1000,2000'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.errors).toHaveLength(0)
      expect(result.headerMapping?.recipient).toBe(0)
      expect(result.rows[0].recipient).toBe('GDEF')
    })

    it('maps "to" to recipient field', () => {
      const csv = ['to,amount,start_time,end_time', 'GHIJ,1000,1000,2000'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.errors).toHaveLength(0)
      expect(result.headerMapping?.recipient).toBe(0)
      expect(result.rows[0].recipient).toBe('GHIJ')
    })
  })

  describe('amount field aliases', () => {
    it('maps "amount" to amount field', () => {
      const csv = ['recipient,amount,start_time,end_time', 'GABC,1000,1000,2000'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.headerMapping?.amount).toBe(1)
      expect(result.rows[0].amount).toBe('1000')
    })

    it('maps "total_amount" to amount field', () => {
      const csv = ['recipient,total_amount,start_time,end_time', 'GABC,2500,1000,2000'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.headerMapping?.amount).toBe(1)
      expect(result.rows[0].amount).toBe('2500')
    })

    it('maps "stream_amount" to amount field', () => {
      const csv = ['recipient,stream_amount,start_time,end_time', 'GABC,5000,1000,2000'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.headerMapping?.amount).toBe(1)
      expect(result.rows[0].amount).toBe('5000')
    })
  })

  describe('start_time field aliases', () => {
    it('maps "start_time" to start_time field', () => {
      const csv = ['recipient,amount,start_time,end_time', 'GABC,1000,1000,2000'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.headerMapping?.start_time).toBe(2)
      expect(result.rows[0].start_time).toBe('1000')
    })

    it('maps "start_date" to start_time field', () => {
      const csv = ['recipient,amount,start_date,end_time', 'GABC,1000,1500,2000'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.headerMapping?.start_time).toBe(2)
      expect(result.rows[0].start_time).toBe('1500')
    })

    it('maps "start_timestamp" to start_time field', () => {
      const csv = ['recipient,amount,start_timestamp,end_time', 'GABC,1000,1234,2000'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.headerMapping?.start_time).toBe(2)
      expect(result.rows[0].start_time).toBe('1234')
    })
  })

  describe('end_time field aliases', () => {
    it('maps "end_time" to end_time field', () => {
      const csv = ['recipient,amount,start_time,end_time', 'GABC,1000,1000,2000'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.headerMapping?.end_time).toBe(3)
      expect(result.rows[0].end_time).toBe('2000')
    })

    it('maps "end_date" to end_time field', () => {
      const csv = ['recipient,amount,start_time,end_date', 'GABC,1000,1000,3000'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.headerMapping?.end_time).toBe(3)
      expect(result.rows[0].end_time).toBe('3000')
    })

    it('maps "end_timestamp" to end_time field', () => {
      const csv = ['recipient,amount,start_time,end_timestamp', 'GABC,1000,1000,4000'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.headerMapping?.end_time).toBe(3)
      expect(result.rows[0].end_time).toBe('4000')
    })
  })

  describe('cliff_time field aliases', () => {
    it('maps "cliff_time" to cliff_time field', () => {
      const csv = ['recipient,amount,start_time,end_time,cliff_time', 'GABC,1000,1000,2000,1500'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.headerMapping?.cliff_time).toBe(4)
      expect(result.rows[0].cliff_time).toBe('1500')
    })

    it('maps "cliff_date" to cliff_time field', () => {
      const csv = ['recipient,amount,start_time,end_time,cliff_date', 'GABC,1000,1000,2000,1600'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.headerMapping?.cliff_time).toBe(4)
      expect(result.rows[0].cliff_time).toBe('1600')
    })

    it('maps "cliff_timestamp" to cliff_time field', () => {
      const csv = ['recipient,amount,start_time,end_time,cliff_timestamp', 'GABC,1000,1000,2000,1700'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.headerMapping?.cliff_time).toBe(4)
      expect(result.rows[0].cliff_time).toBe('1700')
    })
  })

  describe('cliff_duration field aliases', () => {
    it('maps "cliff_duration" to cliff_duration field', () => {
      const csv = ['recipient,amount,start_time,end_time,cliff_duration', 'GABC,1000,1000,2000,30d'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.headerMapping?.cliff_duration).toBe(4)
      expect(result.rows[0].cliff_duration).toBe('30d')
    })

    it('maps "cliff_period" to cliff_duration field', () => {
      const csv = ['recipient,amount,start_time,end_time,cliff_period', 'GABC,1000,1000,2000,7d'].join('\n')
      const result = parseCsvBatch(csv)
      expect(result.headerMapping?.cliff_duration).toBe(4)
      expect(result.rows[0].cliff_duration).toBe('7d')
    })
  })

  describe('mixed aliases in single CSV', () => {
    it('correctly maps different aliases for each field', () => {
      const csv = ['to,stream_amount,start_date,end_timestamp,cliff_period', 'GABC,5000,1000,3000,14d'].join('\n')
      const result = parseCsvBatch(csv)
      
      expect(result.errors).toHaveLength(0)
      expect(result.headerMapping?.recipient).toBe(0)
      expect(result.headerMapping?.amount).toBe(1)
      expect(result.headerMapping?.start_time).toBe(2)
      expect(result.headerMapping?.end_time).toBe(3)
      expect(result.headerMapping?.cliff_duration).toBe(4)
      
      expect(result.rows[0].recipient).toBe('GABC')
      expect(result.rows[0].amount).toBe('5000')
      expect(result.rows[0].start_time).toBe('1000')
      expect(result.rows[0].end_time).toBe('3000')
      expect(result.rows[0].cliff_duration).toBe('14d')
    })
  })

  describe('case insensitivity', () => {
    it('matches aliases regardless of case', () => {
      const csv = ['RECIPIENT,AMOUNT,START_TIME,END_TIME', 'GABC,1000,1000,2000'].join('\n')
      const result = parseCsvBatch(csv)
      
      expect(result.errors).toHaveLength(0)
      expect(result.rows[0].recipient).toBe('GABC')
      expect(result.rows[0].amount).toBe('1000')
    })

    it('matches mixed case aliases', () => {
      const csv = ['Recipient_Address,Total_Amount,Start_Date,End_Date', 'GXYZ,2000,1000,3000'].join('\n')
      const result = parseCsvBatch(csv)
      
      expect(result.errors).toHaveLength(0)
      expect(result.rows[0].recipient).toBe('GXYZ')
      expect(result.rows[0].amount).toBe('2000')
    })
  })

  describe('whitespace handling in headers', () => {
    it('trims whitespace from headers before matching', () => {
      const csv = ['  recipient  ,  amount  ,  start_time  ,  end_time  ', 'GABC,1000,1000,2000'].join('\n')
      const result = parseCsvBatch(csv)
      
      expect(result.errors).toHaveLength(0)
      expect(result.rows[0].recipient).toBe('GABC')
    })
  })

  describe('multiple rows with aliases', () => {
    it('correctly parses multiple rows using aliases', () => {
      const csv = [
        'to,total_amount,start_date,end_date',
        'GABC,1000,1000,2000',
        'GXYZ,2000,1500,3000',
        'GDEF,1500,2000,4000',
      ].join('\n')
      
      const result = parseCsvBatch(csv)
      
      expect(result.errors).toHaveLength(0)
      expect(result.rows).toHaveLength(3)
      expect(result.rows[0].recipient).toBe('GABC')
      expect(result.rows[1].recipient).toBe('GXYZ')
      expect(result.rows[2].recipient).toBe('GDEF')
      expect(result.rows[1].amount).toBe('2000')
    })
  })
})
