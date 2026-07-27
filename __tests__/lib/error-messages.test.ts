import { describe, it, expect } from 'vitest'
import { mapError, categoryLabel, categoryColor } from '@/lib/error-messages'
import type { ErrorCategory } from '@/lib/error-messages'

// ─── mapError ─────────────────────────────────────────────────────────────────

describe('mapError', () => {
  it('maps insufficient balance error', () => {
    const result = mapError(new Error('insufficient balance'))
    expect(result.message).toBe('Insufficient XLM balance')
    expect(result.category).toBe('user')
    expect(result.suggestion).toBeTruthy()
  })

  it('maps insufficient funds variant', () => {
    const result = mapError(new Error('insufficient funds for tx'))
    expect(result.message).toBe('Insufficient XLM balance')
    expect(result.category).toBe('user')
  })

  it('maps user rejected wallet error', () => {
    const result = mapError(new Error('user rejected the request'))
    expect(result.message).toBe('Transaction rejected in wallet')
    expect(result.category).toBe('wallet')
  })

  it('maps user denied variant', () => {
    const result = mapError(new Error('transaction rejected: user denied'))
    expect(result.message).toBe('Transaction rejected in wallet')
    expect(result.category).toBe('wallet')
  })

  it('maps network timeout error', () => {
    const result = mapError(new Error('network timeout after 30s'))
    expect(result.message).toBe('Network request timed out')
    expect(result.category).toBe('network')
  })

  it('maps timed out variant', () => {
    const result = mapError(new Error('connection timed out'))
    expect(result.message).toBe('Network request timed out')
    expect(result.category).toBe('network')
  })

  it('maps 429 rate limit error', () => {
    const result = mapError(new Error('HTTP 429'))
    expect(result.message).toBe('Rate limit reached')
    expect(result.category).toBe('network')
  })

  it('maps "too many requests" variant', () => {
    const result = mapError(new Error('too many requests'))
    expect(result.message).toBe('Rate limit reached')
    expect(result.category).toBe('network')
  })

  it('maps 503 service unavailable error', () => {
    const result = mapError(new Error('503 service unavailable'))
    expect(result.message).toBe('Stellar network temporarily unavailable')
    expect(result.category).toBe('network')
  })

  it('maps stream cancelled error', () => {
    const result = mapError(new Error('stream is cancelled'))
    expect(result.message).toBe('Stream has been cancelled')
    expect(result.category).toBe('contract')
  })

  it('maps withdraw exceeds balance error', () => {
    const result = mapError(new Error('withdraw amount exceeds withdrawable'))
    expect(result.message).toBe('Withdraw amount exceeds available balance')
    expect(result.category).toBe('user')
  })

  it('maps token approval expired error', () => {
    const result = mapError(new Error('approval expired'))
    expect(result.message).toBe('Token approval expired')
    expect(result.category).toBe('contract')
  })

  it('maps wallet not connected error', () => {
    const result = mapError(new Error('wallet not connected'))
    expect(result.message).toBe('Wallet not connected')
    expect(result.category).toBe('wallet')
  })

  it('maps simulation failed error', () => {
    const result = mapError(new Error('Simulation failed: bad params'))
    expect(result.message).toBe('Transaction simulation failed')
    expect(result.category).toBe('contract')
  })

  it('maps on-chain failure error', () => {
    const result = mapError(new Error('failed on-chain'))
    expect(result.message).toBe('Transaction rejected by the network')
    expect(result.category).toBe('contract')
  })

  it('returns generic fallback for unknown errors', () => {
    const result = mapError(new Error('completely unrecognized xyz error'))
    expect(result.message).toBe('Transaction failed')
    expect(result.category).toBe('contract')
    expect(result.details).toContain('unrecognized xyz error')
  })

  it('handles plain string errors', () => {
    const result = mapError('rate limit exceeded')
    expect(result.message).toBe('Rate limit reached')
  })

  it('handles non-Error objects', () => {
    const result = mapError({ code: 503 })
    // Falls through to generic since the serialized value doesn't match patterns
    expect(result.message).toBeDefined()
    expect(result.category).toBeDefined()
  })

  it('populates details field with original message', () => {
    const originalMsg = 'insufficient balance on account GABCDEF'
    const result = mapError(new Error(originalMsg))
    expect(result.details).toBe(originalMsg)
  })

  it('fallback error also populates details', () => {
    const result = mapError(new Error('mystery error'))
    expect(result.details).toBe('mystery error')
  })

  // Soroban contract error codes
  it('maps Error(Contract, 1) - InvalidAmount', () => {
    const result = mapError(new Error('Error(Contract, 1)'))
    expect(result.message).toBe('Invalid stream amount')
    expect(result.category).toBe('contract')
  })

  it('maps Error(Contract, 2) - InvalidTimeRange', () => {
    const result = mapError(new Error('Error(Contract, 2)'))
    expect(result.message).toBe('Invalid time range')
    expect(result.category).toBe('contract')
  })

  it('maps Error(Contract, 3) - InvalidCliff', () => {
    const result = mapError(new Error('Error(Contract, 3)'))
    expect(result.message).toBe('Invalid cliff configuration')
    expect(result.category).toBe('contract')
  })

  it('maps Error(Contract, 4) - SelfStream', () => {
    const result = mapError(new Error('Error(Contract, 4)'))
    expect(result.message).toBe('Cannot create self-directed stream')
    expect(result.category).toBe('user')
  })

  it('maps Error(Contract, 5) - StreamNotFound', () => {
    const result = mapError(new Error('Error(Contract, 5)'))
    expect(result.message).toBe('Stream not found')
    expect(result.category).toBe('contract')
  })

  it('maps Error(Contract, 6) - StreamCancelled', () => {
    const result = mapError(new Error('Error(Contract, 6)'))
    expect(result.message).toBe('Stream has been cancelled')
    expect(result.category).toBe('contract')
  })

  it('maps Error(Contract, 7) - Unauthorized', () => {
    const result = mapError(new Error('Error(Contract, 7)'))
    expect(result.message).toBe('Unauthorized operation')
    expect(result.category).toBe('user')
  })

  it('maps Error(Contract, 8) - InsufficientFunds', () => {
    const result = mapError(new Error('Error(Contract, 8)'))
    expect(result.message).toBe('Insufficient funds in stream')
    expect(result.category).toBe('user')
  })

  it('maps Error(Contract, 9) - StreamEnded', () => {
    const result = mapError(new Error('Error(Contract, 9)'))
    expect(result.message).toBe('Stream has ended')
    expect(result.category).toBe('contract')
  })

  it('maps Error(Contract, 10) - SameRecipient', () => {
    const result = mapError(new Error('Error(Contract, 10)'))
    expect(result.message).toBe('Recipient already set')
    expect(result.category).toBe('user')
  })

  it('maps Error(Contract, 11) - BatchSizeExceeded', () => {
    const result = mapError(new Error('Error(Contract, 11)'))
    expect(result.message).toBe('Batch size exceeds maximum')
    expect(result.category).toBe('user')
  })

  it('maps Error(Contract, 12) - BatchEmpty', () => {
    const result = mapError(new Error('Error(Contract, 12)'))
    expect(result.message).toBe('Batch cannot be empty')
    expect(result.category).toBe('user')
  })

  it('maps Error(Contract, 13) - ArithmeticOverflow', () => {
    const result = mapError(new Error('Error(Contract, 13)'))
    expect(result.message).toBe('Arithmetic overflow in calculation')
    expect(result.category).toBe('contract')
  })

  it('maps Error(Contract, 14) - AlreadyInitialized', () => {
    const result = mapError(new Error('Error(Contract, 14)'))
    expect(result.message).toBe('Contract already initialized')
    expect(result.category).toBe('contract')
  })

  it('maps Error(Contract, 15) - NotInitialized', () => {
    const result = mapError(new Error('Error(Contract, 15)'))
    expect(result.message).toBe('Contract not initialized')
    expect(result.category).toBe('contract')
  })

  it('maps Error(Contract, 16) - ContractPaused', () => {
    const result = mapError(new Error('Error(Contract, 16)'))
    expect(result.message).toBe('Contract is paused')
    expect(result.category).toBe('network')
  })

  it('maps Error(Contract, 17) - DurationExceedsMaximum', () => {
    const result = mapError(new Error('Error(Contract, 17)'))
    expect(result.message).toBe('Stream duration exceeds maximum')
    expect(result.category).toBe('user')
  })

  it('maps Error(Contract, 18) - InvalidRecipient', () => {
    const result = mapError(new Error('Error(Contract, 18)'))
    expect(result.message).toBe('Invalid recipient address')
    expect(result.category).toBe('user')
  })

  it('maps Error(Contract, 19) - RateIsZero', () => {
    const result = mapError(new Error('Error(Contract, 19)'))
    expect(result.message).toBe('Stream amount too small for duration')
    expect(result.category).toBe('user')
  })

  it('maps Error(Contract, 20) - StreamNotEligibleForCleanup', () => {
    const result = mapError(new Error('Error(Contract, 20)'))
    expect(result.message).toBe('Stream not eligible for cleanup')
    expect(result.category).toBe('contract')
  })

  it('handles soroban error with extra whitespace', () => {
    const result = mapError(new Error('Error(Contract,   1  )'))
    expect(result.message).toBe('Invalid stream amount')
    expect(result.category).toBe('contract')
  })
})

// ─── categoryLabel ────────────────────────────────────────────────────────────

describe('categoryLabel', () => {
  const cases: [ErrorCategory, string][] = [
    ['user', 'Input error'],
    ['network', 'Network error'],
    ['contract', 'Contract error'],
    ['wallet', 'Wallet error'],
  ]

  it.each(cases)('returns "%s" label for category "%s"', (category, expected) => {
    expect(categoryLabel(category)).toBe(expected)
  })
})

// ─── categoryColor ────────────────────────────────────────────────────────────

describe('categoryColor', () => {
  it('returns a non-empty string for every category', () => {
    const categories: ErrorCategory[] = ['user', 'network', 'contract', 'wallet']
    for (const cat of categories) {
      const color = categoryColor(cat)
      expect(typeof color).toBe('string')
      expect(color.length).toBeGreaterThan(0)
    }
  })

  it('returns distinct colors for distinct categories', () => {
    const colors = (['user', 'network', 'contract', 'wallet'] as ErrorCategory[]).map(
      categoryColor,
    )
    const unique = new Set(colors)
    expect(unique.size).toBe(4)
  })
})
