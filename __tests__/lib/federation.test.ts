import { afterEach, describe, expect, it, vi } from 'vitest'
import { Federation } from '@stellar/stellar-sdk'
import { FederationLookupError, resolveFederationAddress } from '@/lib/federation'

const accountId = 'GB5XVAABEQMY63WTHDQ5RXADGYF345VWMNPTN2GFUDZT57D57ZQTJ7PS'

describe('resolveFederationAddress', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the account and memo data for a successful lookup', async () => {
    vi.spyOn(Federation.Server, 'resolve').mockResolvedValue({
      account_id: accountId,
      memo_type: 'text',
      memo: 'invoice-42',
    })

    await expect(resolveFederationAddress('alice*example.com')).resolves.toEqual({
      federationAddress: 'alice*example.com',
      accountId,
      memoType: 'text',
      memo: 'invoice-42',
    })
  })

  it('rejects malformed federation addresses before contacting the resolver', async () => {
    const resolve = vi.spyOn(Federation.Server, 'resolve')
    await expect(resolveFederationAddress('not-a-federation-address')).rejects.toMatchObject({
      name: 'FederationLookupError',
      message: expect.stringContaining('expected the form'),
    })
    expect(resolve).not.toHaveBeenCalled()
  })

  it('maps a missing federation record to FederationLookupError', async () => {
    vi.spyOn(Federation.Server, 'resolve').mockRejectedValue(new Error('404 Not Found'))

    const result = resolveFederationAddress('missing*example.com')
    await expect(result).rejects.toBeInstanceOf(FederationLookupError)
    await expect(result).rejects.toThrow('No Federation record found')
  })

  it('rejects a federation response containing an invalid account', async () => {
    vi.spyOn(Federation.Server, 'resolve').mockResolvedValue({
      account_id: 'not-a-stellar-account',
    })

    await expect(resolveFederationAddress('alice*example.com')).rejects.toThrow(
      'returned an invalid account',
    )
  })
})
