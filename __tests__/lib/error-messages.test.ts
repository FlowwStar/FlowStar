import { describe, it, expect } from 'vitest'
import { mapError } from '@/lib/error-messages'

describe('mapError', () => {
  describe('Soroban contract errors', () => {
    it('maps Error(Contract, 1) to InvalidAmount', () => {
      const result = mapError('Error(Contract, 1)')
      expect(result.message).toBe('Invalid stream amount')
      expect(result.category).toBe('contract')
      expect(result.suggestion).toContain('positive')
    })

    it('maps Error(Contract, 4) to SelfStream', () => {
      const result = mapError('Error(Contract, 4)')
      expect(result.message).toBe('Cannot create self-directed stream')
      expect(result.category).toBe('user')
      expect(result.suggestion).toContain('different recipient')
    })

    it('maps Error(Contract, 7) to Unauthorized', () => {
      const result = mapError('Error(Contract, 7)')
      expect(result.message).toBe('Unauthorized operation')
      expect(result.category).toBe('user')
      expect(result.suggestion).toContain('permission')
    })

    it('maps Error(Contract, 16) to ContractPaused', () => {
      const result = mapError('Error(Contract, 16)')
      expect(result.message).toBe('Contract is paused')
      expect(result.category).toBe('network')
      expect(result.suggestion).toContain('maintenance')
    })
  })

  describe('wallet errors', () => {
    it('maps user rejection patterns', () => {
      const cases = [
        'user rejected transaction',
        'rejected by user',
        'user denied',
        'transaction rejected',
        'user cancel',
      ]

      for (const errorMsg of cases) {
        const result = mapError(errorMsg)
        expect(result.message).toBe('Transaction rejected in wallet')
        expect(result.category).toBe('wallet')
        expect(result.suggestion).toContain('approve')
      }
    })

    it('maps wallet not connected patterns', () => {
      const result = mapError('wallet not connected')
      expect(result.message).toBe('Wallet not connected')
      expect(result.category).toBe('wallet')
      expect(result.suggestion).toContain('Connect')
    })
  })

  describe('network errors', () => {
    it('maps timeout patterns', () => {
      const cases = ['timeout', 'timed out', 'connection timeout', 'network timeout']

      for (const errorMsg of cases) {
        const result = mapError(errorMsg)
        expect(result.message).toBe('Network request timed out')
        expect(result.category).toBe('network')
        expect(result.suggestion).toContain('connection')
      }
    })

    it('maps rate limit errors', () => {
      const result = mapError('429 Too Many Requests')
      expect(result.message).toBe('Rate limit reached')
      expect(result.category).toBe('network')
      expect(result.suggestion).toContain('Wait')
    })

    it('maps service unavailable errors', () => {
      const result = mapError('503 Service Unavailable')
      expect(result.message).toBe('Stellar network temporarily unavailable')
      expect(result.category).toBe('network')
      expect(result.suggestion).toContain('minutes')
    })
  })

  describe('user input errors', () => {
    it('maps insufficient balance patterns', () => {
      const result = mapError('insufficient balance')
      expect(result.message).toBe('Insufficient XLM balance')
      expect(result.category).toBe('user')
      expect(result.suggestion).toContain('Top up')
    })

    it('maps withdraw amount exceeded', () => {
      const result = mapError('withdraw amount exceeds balance')
      expect(result.message).toBe('Withdraw amount exceeds available balance')
      expect(result.category).toBe('user')
      expect(result.suggestion).toContain('less than or equal')
    })
  })

  describe('fallback behavior', () => {
    it('returns generic error for unmatched patterns', () => {
      const result = mapError('some random unknown error')
      expect(result.message).toBe('Transaction failed')
      expect(result.category).toBe('contract')
      expect(result.suggestion).toContain('unexpected')
      expect(result.details).toBe('some random unknown error')
    })

    it('handles Error objects', () => {
      const error = new Error('custom error message')
      const result = mapError(error)
      expect(result.details).toBe('custom error message')
    })

    it('handles non-string, non-Error values', () => {
      const result = mapError(123)
      expect(result.details).toBe('123')
    })
  })

  describe('case insensitivity', () => {
    it('matches patterns regardless of case', () => {
      const lower = mapError('user rejected')
      const upper = mapError('USER REJECTED')
      const mixed = mapError('UsEr ReJeCtEd')

      expect(lower.message).toBe(upper.message)
      expect(upper.message).toBe(mixed.message)
      expect(lower.category).toBe('wallet')
    })
  })

  describe('details field', () => {
    it('includes original error message in details', () => {
      const originalMessage = 'Error(Contract, 1) - Invalid amount provided'
      const result = mapError(originalMessage)
      expect(result.details).toBe(originalMessage)
    })
  })
})
