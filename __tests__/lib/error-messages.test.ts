import { describe, it, expect } from 'vitest'
import {
  mapError,
  categoryLabel,
  categoryColor,
  type ErrorCategory,
} from '@/lib/error-messages'

describe('mapError', () => {
  describe('Soroban contract errors (codes 1-20)', () => {
    // 1 - InvalidAmount
    it('maps Error(Contract, #1) to InvalidAmount', () => {
      const result = mapError('Error(Contract, #1)')
      expect(result.message).toBe('Invalid stream amount')
      expect(result.category).toBe('contract')
      expect(result.suggestion).toContain('positive')
    })

    // 2 - InvalidTimeRange
    it('maps Error(Contract, #2) to InvalidTimeRange', () => {
      const result = mapError('Error(Contract, #2)')
      expect(result.message).toBe('Invalid time range')
      expect(result.category).toBe('contract')
      expect(result.suggestion).toContain('start and end times')
    })

    // 3 - InvalidCliff
    it('maps Error(Contract, #3) to InvalidCliff', () => {
      const result = mapError('Error(Contract, #3)')
      expect(result.message).toBe('Invalid cliff configuration')
      expect(result.category).toBe('contract')
      expect(result.suggestion).toContain('between start and end')
    })

    // 4 - SelfStream
    it('maps Error(Contract, #4) to SelfStream', () => {
      const result = mapError('Error(Contract, #4)')
      expect(result.message).toBe('Cannot create self-directed stream')
      expect(result.category).toBe('user')
      expect(result.suggestion).toContain('different recipient')
    })

    // 5 - StreamNotFound
    it('maps Error(Contract, #5) to StreamNotFound', () => {
      const result = mapError('Error(Contract, #5)')
      expect(result.message).toBe('Stream not found')
      expect(result.category).toBe('contract')
      expect(result.suggestion).toContain('does not exist')
    })

    // 6 - StreamCancelled
    it('maps Error(Contract, #6) to StreamCancelled', () => {
      const result = mapError('Error(Contract, #6)')
      expect(result.message).toBe('Stream has been cancelled')
      expect(result.category).toBe('contract')
      expect(result.suggestion).toContain('withdrawals or modifications')
    })

    // 7 - Unauthorized
    it('maps Error(Contract, #7) to Unauthorized', () => {
      const result = mapError('Error(Contract, #7)')
      expect(result.message).toBe('Unauthorized operation')
      expect(result.category).toBe('user')
      expect(result.suggestion).toContain('permission')
    })

    // 8 - InsufficientFunds
    it('maps Error(Contract, #8) to InsufficientFunds', () => {
      const result = mapError('Error(Contract, #8)')
      expect(result.message).toBe('Insufficient funds in stream')
      expect(result.category).toBe('user')
      expect(result.suggestion).toContain('Top up')
    })

    // 9 - StreamEnded
    it('maps Error(Contract, #9) to StreamEnded', () => {
      const result = mapError('Error(Contract, #9)')
      expect(result.message).toBe('Stream has ended')
      expect(result.category).toBe('contract')
      expect(result.suggestion).toContain('withdraw remaining')
    })

    // 10 - SameRecipient
    it('maps Error(Contract, #10) to SameRecipient', () => {
      const result = mapError('Error(Contract, #10)')
      expect(result.message).toBe('Recipient already set')
      expect(result.category).toBe('user')
      expect(result.suggestion).toContain('same address')
    })

    // 11 - BatchSizeExceeded
    it('maps Error(Contract, #11) to BatchSizeExceeded', () => {
      const result = mapError('Error(Contract, #11)')
      expect(result.message).toBe('Batch size exceeds maximum')
      expect(result.category).toBe('user')
      expect(result.suggestion).toContain('maximum of 20')
    })

    // 12 - BatchEmpty
    it('maps Error(Contract, #12) to BatchEmpty', () => {
      const result = mapError('Error(Contract, #12)')
      expect(result.message).toBe('Batch cannot be empty')
      expect(result.category).toBe('user')
      expect(result.suggestion).toContain('at least one')
    })

    // 13 - ArithmeticOverflow
    it('maps Error(Contract, #13) to ArithmeticOverflow', () => {
      const result = mapError('Error(Contract, #13)')
      expect(result.message).toBe('Arithmetic overflow in calculation')
      expect(result.category).toBe('contract')
      expect(result.suggestion).toContain('reducing the amount')
    })

    // 14 - AlreadyInitialized
    it('maps Error(Contract, #14) to AlreadyInitialized', () => {
      const result = mapError('Error(Contract, #14)')
      expect(result.message).toBe('Contract already initialized')
      expect(result.category).toBe('contract')
      expect(result.suggestion).toContain('only happen once')
    })

    // 15 - NotInitialized
    it('maps Error(Contract, #15) to NotInitialized', () => {
      const result = mapError('Error(Contract, #15)')
      expect(result.message).toBe('Contract not initialized')
      expect(result.category).toBe('contract')
      expect(result.suggestion).toContain('not been initialized')
    })

    // 16 - ContractPaused
    it('maps Error(Contract, #16) to ContractPaused', () => {
      const result = mapError('Error(Contract, #16)')
      expect(result.message).toBe('Contract is paused')
      expect(result.category).toBe('network')
      expect(result.suggestion).toContain('maintenance')
    })

    // 17 - DurationExceedsMaximum
    it('maps Error(Contract, #17) to DurationExceedsMaximum', () => {
      const result = mapError('Error(Contract, #17)')
      expect(result.message).toBe('Stream duration exceeds maximum')
      expect(result.category).toBe('user')
      expect(result.suggestion).toContain('shorter duration')
    })

    // 18 - InvalidRecipient
    it('maps Error(Contract, #18) to InvalidRecipient', () => {
      const result = mapError('Error(Contract, #18)')
      expect(result.message).toBe('Invalid recipient address')
      expect(result.category).toBe('user')
      expect(result.suggestion).toContain('invalid or cannot receive')
    })

    // 19 - RateIsZero
    it('maps Error(Contract, #19) to RateIsZero', () => {
      const result = mapError('Error(Contract, #19)')
      expect(result.message).toBe('Stream amount too small for duration')
      expect(result.category).toBe('user')
      expect(result.suggestion).toContain('Increase the amount')
    })

    // 20 - StreamNotEligibleForCleanup
    it('maps Error(Contract, #20) to StreamNotEligibleForCleanup', () => {
      const result = mapError('Error(Contract, #20)')
      expect(result.message).toBe('Stream not eligible for cleanup')
      expect(result.category).toBe('contract')
      expect(result.suggestion).toContain('cancelled or drained')
    })

    it('handles optional hash prefix in error codes', () => {
      const withHash = mapError('Error(Contract, #1)')
      const withoutHash = mapError('Error(Contract, 1)')
      expect(withHash.message).toBe(withoutHash.message)
      expect(withHash.category).toBe(withoutHash.category)
    })

    it('matches with varying whitespace before the code', () => {
      const result = mapError('Error(Contract,  #1)')
      expect(result.message).toBe('Invalid stream amount')
    })
  })

  describe('non-contract error patterns', () => {
    it('maps insufficient XLM balance patterns', () => {
      const cases = [
        'insufficient balance',
        'insufficient funds',
        'balance too low',
        'balance is too low',
        'not enough',
      ]
      for (const errorMsg of cases) {
        const result = mapError(errorMsg)
        expect(result.message).toBe('Insufficient XLM balance')
        expect(result.category).toBe('user')
        expect(result.suggestion).toContain('Top up')
      }
    })

    it('maps token approval expired patterns', () => {
      const cases = [
        'approval expired',
        'approval expiry date',
        'allowance expired',
        'allowance expiry',
        'expired approval',
        'expired allowance',
      ]
      for (const errorMsg of cases) {
        const result = mapError(errorMsg)
        expect(result.message).toBe('Token approval expired')
        expect(result.category).toBe('contract')
        expect(result.suggestion).toContain('approve')
      }
    })

    it('maps stream cancelled patterns (generic)', () => {
      const cases = [
        'stream has been cancelled',
        'cancel the stream',
        'stream is cancelled',
      ]
      for (const errorMsg of cases) {
        const result = mapError(errorMsg)
        expect(result.message).toBe('Stream has been cancelled')
        expect(result.category).toBe('contract')
        expect(result.suggestion).toContain('withdrawals')
      }
    })

    it('maps withdraw amount exceeded patterns', () => {
      const validCases = [
        'withdraw amount exceeds balance',
        'amount exceed the withdrawable amount',
        'exceeds withdrawable amount',
      ]
      for (const errorMsg of validCases) {
        const result = mapError(errorMsg)
        expect(result.message).toBe('Withdraw amount exceeds available balance')
        expect(result.category).toBe('user')
        expect(result.suggestion).toContain('less than or equal')
      }
    })

    it('maps simulation failed patterns', () => {
      const cases = [
        'simulation failed',
        'simulate error',
      ]
      for (const errorMsg of cases) {
        const result = mapError(errorMsg)
        expect(result.message).toBe('Transaction simulation failed')
        expect(result.category).toBe('contract')
        expect(result.suggestion).toContain('invalid')
      }
    })

    it('maps on-chain failure patterns', () => {
      const cases = [
        'failed on chain',
        'transaction failed onchain',
        'transaction failed on-chain',
      ]
      for (const errorMsg of cases) {
        const result = mapError(errorMsg)
        expect(result.message).toBe('Transaction rejected by the network')
        expect(result.category).toBe('contract')
        expect(result.suggestion).toContain('rejected')
      }
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
      const cases = [
        '503 Service Unavailable',
        'service unavailable',
        'server error',
        'rpc unavailable',
        'RPC is unavailable',
      ]
      for (const errorMsg of cases) {
        const result = mapError(errorMsg)
        expect(result.message).toBe('Stellar network temporarily unavailable')
        expect(result.category).toBe('network')
        expect(result.suggestion).toContain('minutes')
      }
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

/**
 * Tests for the categoryLabel utility function.
 * Covers all four ErrorCategory values: 'user', 'network', 'contract', 'wallet'.
 */
describe('categoryLabel', () => {
  it('returns "Input error" for the "user" category', () => {
    expect(categoryLabel('user')).toBe('Input error')
  })

  it('returns "Network error" for the "network" category', () => {
    expect(categoryLabel('network')).toBe('Network error')
  })

  it('returns "Contract error" for the "contract" category', () => {
    expect(categoryLabel('contract')).toBe('Contract error')
  })

  it('returns "Wallet error" for the "wallet" category', () => {
    expect(categoryLabel('wallet')).toBe('Wallet error')
  })

  it('covers all ErrorCategory values exhaustively', () => {
    const categories: ErrorCategory[] = ['user', 'network', 'contract', 'wallet']
    const labels = categories.map((c) => categoryLabel(c))
    expect(labels).toEqual([
      'Input error',
      'Network error',
      'Contract error',
      'Wallet error',
    ])
  })
})

/**
 * Tests for the categoryColor utility function.
 * Covers all four ErrorCategory values: 'user', 'network', 'contract', 'wallet'.
 */
describe('categoryColor', () => {
  it('returns amber color for the "user" category', () => {
    const color = categoryColor('user')
    expect(color).toContain('amber')
    expect(color).toMatch(/text-amber-\d+/)
  })

  it('returns blue color for the "network" category', () => {
    const color = categoryColor('network')
    expect(color).toContain('blue')
    expect(color).toMatch(/text-blue-\d+/)
  })

  it('returns destructive color for the "contract" category', () => {
    const color = categoryColor('contract')
    expect(color).toBe('text-destructive')
  })

  it('returns purple color for the "wallet" category', () => {
    const color = categoryColor('wallet')
    expect(color).toContain('purple')
    expect(color).toMatch(/text-purple-\d+/)
  })

  it('includes dark mode variants for user, network, and wallet', () => {
    expect(categoryColor('user')).toContain('dark:')
    expect(categoryColor('network')).toContain('dark:')
    expect(categoryColor('wallet')).toContain('dark:')
  })

  it('covers all ErrorCategory values exhaustively', () => {
    const categories: ErrorCategory[] = ['user', 'network', 'contract', 'wallet']
    const colors = categories.map((c) => categoryColor(c))
    // Each category has a distinct color
    expect(new Set(colors).size).toBe(4)
    // All return strings
    colors.forEach((c) => expect(typeof c).toBe('string'))
  })
})
