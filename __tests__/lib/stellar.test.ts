import { describe, it, expect } from 'vitest'
import { explorerUrl, isValidStellarAddress } from '@/lib/stellar'

describe('isValidStellarAddress', () => {
  it('accepts a valid ed25519 public key', () => {
    expect(isValidStellarAddress('GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI')).toBe(
      true,
    )
  })

  it('rejects a correctly-shaped address with a bad checksum', () => {
    // Same length and prefix as a real key, but the checksum is wrong.
    expect(isValidStellarAddress('G' + 'A'.repeat(55))).toBe(false)
  })

  it('rejects an address that is too short', () => {
    expect(isValidStellarAddress('GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMAD')).toBe(
      false,
    )
  })

  it('rejects an address that is too long', () => {
    expect(isValidStellarAddress('GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADIX')).toBe(
      false,
    )
  })

  it('rejects an address with the wrong prefix', () => {
    expect(isValidStellarAddress('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC')).toBe(
      false,
    )
  })

  it('rejects an empty string', () => {
    expect(isValidStellarAddress('')).toBe(false)
  })

  it('trims surrounding whitespace before validating', () => {
    expect(
      isValidStellarAddress('  GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI  '),
    ).toBe(true)
  })
})

describe('explorerUrl', () => {
  describe('testnet URL generation', () => {
    it('generates correct URL for testnet account', () => {
      const url = explorerUrl('testnet', 'account', 'GABC123')
      expect(url).toBe('https://stellar.expert/explorer/testnet/account/GABC123')
    })

    it('generates correct URL for testnet contract', () => {
      const url = explorerUrl('testnet', 'contract', 'CABC123')
      expect(url).toBe('https://stellar.expert/explorer/testnet/contract/CABC123')
    })

    it('generates correct URL for testnet transaction', () => {
      const url = explorerUrl('testnet', 'tx', 'abc123txhash')
      expect(url).toBe('https://stellar.expert/explorer/testnet/tx/abc123txhash')
    })
  })

  describe('mainnet URL generation', () => {
    it('generates correct URL for mainnet account', () => {
      const url = explorerUrl('mainnet', 'account', 'GXYZ789')
      expect(url).toBe('https://stellar.expert/explorer/public/account/GXYZ789')
    })

    it('generates correct URL for mainnet contract', () => {
      const url = explorerUrl('mainnet', 'contract', 'CXYZ789')
      expect(url).toBe('https://stellar.expert/explorer/public/contract/CXYZ789')
    })

    it('generates correct URL for mainnet transaction', () => {
      const url = explorerUrl('mainnet', 'tx', 'xyz789txhash')
      expect(url).toBe('https://stellar.expert/explorer/public/tx/xyz789txhash')
    })
  })

  describe('URL structure', () => {
    it('includes stellar.expert domain', () => {
      const url = explorerUrl('testnet', 'account', 'GABC')
      expect(url).toContain('stellar.expert')
    })

    it('includes explorer path segment', () => {
      const url = explorerUrl('testnet', 'account', 'GABC')
      expect(url).toContain('/explorer/')
    })

    it('includes network segment (testnet or public)', () => {
      const testnetUrl = explorerUrl('testnet', 'account', 'GABC')
      const mainnetUrl = explorerUrl('mainnet', 'account', 'GXYZ')

      expect(testnetUrl).toContain('/testnet/')
      expect(mainnetUrl).toContain('/public/')
    })

    it('includes type segment', () => {
      const accountUrl = explorerUrl('testnet', 'account', 'GABC')
      const contractUrl = explorerUrl('testnet', 'contract', 'CABC')
      const txUrl = explorerUrl('testnet', 'tx', 'hash123')

      expect(accountUrl).toContain('/account/')
      expect(contractUrl).toContain('/contract/')
      expect(txUrl).toContain('/tx/')
    })

    it('ends with the provided ID', () => {
      const id = 'GABC123XYZ'
      const url = explorerUrl('testnet', 'account', id)
      expect(url).toEndWith(id)
    })
  })

  describe('all type combinations', () => {
    const networks = ['testnet', 'mainnet'] as const
    const types = ['account', 'contract', 'tx'] as const
    const testId = 'TEST123'

    it('generates valid URLs for all network and type combinations', () => {
      for (const network of networks) {
        for (const type of types) {
          const url = explorerUrl(network, type, testId)

          expect(url).toContain('https://stellar.expert/explorer/')
          expect(url).toContain(network === 'testnet' ? '/testnet/' : '/public/')
          expect(url).toContain(`/${type}/`)
          expect(url).toEndWith(testId)
        }
      }
    })
  })

  describe('special characters in ID', () => {
    it('handles IDs with numbers', () => {
      const url = explorerUrl('testnet', 'account', 'GABC123456789')
      expect(url).toBe('https://stellar.expert/explorer/testnet/account/GABC123456789')
    })

    it('handles long transaction hashes', () => {
      const longHash = 'a'.repeat(64)
      const url = explorerUrl('testnet', 'tx', longHash)
      expect(url).toBe(`https://stellar.expert/explorer/testnet/tx/${longHash}`)
    })

    it('handles IDs with uppercase letters', () => {
      const url = explorerUrl('mainnet', 'account', 'GABCDEFGHIJKLMNOP')
      expect(url).toBe('https://stellar.expert/explorer/public/account/GABCDEFGHIJKLMNOP')
    })
  })

  describe('network mapping', () => {
    it('maps testnet to testnet explorer path', () => {
      const url = explorerUrl('testnet', 'account', 'GABC')
      expect(url).not.toContain('/public/')
      expect(url).toContain('/testnet/')
    })

    it('maps mainnet to public explorer path', () => {
      const url = explorerUrl('mainnet', 'account', 'GABC')
      expect(url).not.toContain('/testnet/')
      expect(url).toContain('/public/')
    })
  })
})
