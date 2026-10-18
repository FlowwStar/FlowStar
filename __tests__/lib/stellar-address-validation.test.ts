import { describe, it, expect } from 'vitest'
import { validateStellarAddress } from '@/lib/stellar'

// A real, checksum-valid ed25519 public key.
const VALID = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI'

describe('validateStellarAddress', () => {
  it('accepts a valid ed25519 public key', () => {
    expect(validateStellarAddress(VALID)).toEqual({ valid: true })
  })

  it('trims surrounding whitespace before validating', () => {
    expect(validateStellarAddress(`  ${VALID}  `)).toEqual({ valid: true })
  })

  it('flags a near-miss (right shape, mistyped character) as a checksum error', () => {
    // Same length (56) and 'G' + base32 shape as a real key, but not a
    // real checksum-valid key — this is the "one mistyped character"
    // scenario issue #143 is about.
    const nearMiss = 'G' + 'A'.repeat(55)
    expect(nearMiss).toHaveLength(56)
    expect(validateStellarAddress(nearMiss)).toEqual({ valid: false, reason: 'checksum' })
  })

  it('flags a single-character mutation of a valid address as a checksum error', () => {
    const mutated = VALID.slice(0, -1) + (VALID.at(-1) === 'A' ? 'B' : 'A')
    expect(validateStellarAddress(mutated)).toEqual({ valid: false, reason: 'checksum' })
  })

  it('flags an address that is too short as a format error', () => {
    expect(validateStellarAddress(VALID.slice(0, -1))).toEqual({ valid: false, reason: 'format' })
  })

  it('flags an address that is too long as a format error', () => {
    expect(validateStellarAddress(VALID + 'A')).toEqual({ valid: false, reason: 'format' })
  })

  it('flags an address with the wrong prefix as a format error', () => {
    // Contract addresses start with 'C', not 'G'.
    expect(
      validateStellarAddress('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'),
    ).toEqual({ valid: false, reason: 'format' })
  })

  it('flags an address with invalid base32 characters as a format error', () => {
    // '0', '1', '8', '9' are not in the base32 alphabet used by StrKey.
    expect(validateStellarAddress('G' + '0'.repeat(55))).toEqual({
      valid: false,
      reason: 'format',
    })
  })

  it('flags an empty string as a format error', () => {
    expect(validateStellarAddress('')).toEqual({ valid: false, reason: 'format' })
  })

  it('flags an arbitrary non-address string as a format error', () => {
    expect(validateStellarAddress('not-a-stellar-address')).toEqual({
      valid: false,
      reason: 'format',
    })
  })
})
