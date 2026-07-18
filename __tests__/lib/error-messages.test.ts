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
