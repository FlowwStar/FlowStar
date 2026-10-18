import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { explorerUrl, isValidStellarAddress } from '@/lib/stellar'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  explorerUrl,
  isValidStellarAddress,
  getCustomTokens,
  saveCustomToken,
  getFavoriteTokens,
  toggleFavoriteToken,
  isFavoriteToken,
} from '@/lib/stellar'

beforeEach(() => {
  localStorage.clear()
})

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
      expect(url.endsWith(id)).toBe(true)
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
          expect(url.endsWith(testId)).toBe(true)
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

// A known built-in token address used across the verified-token tests.
const KNOWN_TOKEN_ADDRESS = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
const UNKNOWN_TOKEN_ADDRESS = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4'

const VERIFIED_TOKENS_FIXTURE = [
  {
    address: KNOWN_TOKEN_ADDRESS,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 7,
  },
]

/**
 * The verified-token list is cached at module scope, so each test must load a
 * fresh copy of the module (after configuring mocks) to avoid cache leakage.
 */
async function importStellar() {
  vi.resetModules()
  return import('@/lib/stellar')
}

function mockFetchJson(payload: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(payload),
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('verified token helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  describe('loadVerifiedTokens', () => {
    it('loads verified tokens from the remote list', async () => {
      const fetchMock = mockFetchJson({ tokens: VERIFIED_TOKENS_FIXTURE })
      const { loadVerifiedTokens } = await importStellar()

      const tokens = await loadVerifiedTokens()

      expect(fetchMock).toHaveBeenCalled()
      expect(tokens).toHaveLength(VERIFIED_TOKENS_FIXTURE.length)
      expect(tokens[0]).toMatchObject({
        address: KNOWN_TOKEN_ADDRESS,
        symbol: 'USDC',
      })
    })

    it('falls back gracefully when the request rejects', async () => {
      const captureError = vi.fn()
      vi.doMock('@/lib/sentry', () => ({ captureError }))
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
      const { loadVerifiedTokens } = await importStellar()

      await expect(loadVerifiedTokens()).resolves.toEqual([])
      expect(captureError).toHaveBeenCalled()
    })

    it('falls back gracefully when the response is not ok', async () => {
      const captureError = vi.fn()
      vi.doMock('@/lib/sentry', () => ({ captureError }))
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
        }),
      )
      const { loadVerifiedTokens } = await importStellar()

      await expect(loadVerifiedTokens()).resolves.toEqual([])
      expect(captureError).toHaveBeenCalled()
    })
  })

  describe('isVerifiedToken', () => {
    it('returns true for a known verified token address', async () => {
      mockFetchJson({ tokens: VERIFIED_TOKENS_FIXTURE })
      const { loadVerifiedTokens, isVerifiedToken } = await importStellar()

      await loadVerifiedTokens()

      expect(isVerifiedToken(KNOWN_TOKEN_ADDRESS)).toBe(true)
    })

    it('returns false for an unknown token address', async () => {
      mockFetchJson({ tokens: VERIFIED_TOKENS_FIXTURE })
      const { loadVerifiedTokens, isVerifiedToken } = await importStellar()

      await loadVerifiedTokens()

      expect(isVerifiedToken(UNKNOWN_TOKEN_ADDRESS)).toBe(false)
    })
  })

  describe('getAllTokens', () => {
    it('merges built-in, verified and custom tokens without duplicates', async () => {
      mockFetchJson({ tokens: VERIFIED_TOKENS_FIXTURE })
      const { loadVerifiedTokens, getAllTokens } = await importStellar()

      await loadVerifiedTokens()

      const customTokens = [
        {
          address: 'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
          symbol: 'CSTM',
          name: 'Custom Token',
          decimals: 7,
        },
        // Overlaps with the verified token; must not be duplicated.
        {
          address: KNOWN_TOKEN_ADDRESS,
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 7,
        },
      ]
      localStorage.setItem('customTokens', JSON.stringify(customTokens))

      const tokens = getAllTokens('testnet')
      const addresses = tokens.map((t) => t.address)

      // No duplicate addresses.
      expect(new Set(addresses).size).toBe(addresses.length)

      // Verified token is present exactly once.
      expect(addresses.filter((a) => a === KNOWN_TOKEN_ADDRESS)).toHaveLength(1)

      // Custom-only token is included.
      expect(addresses).toContain(customTokens[0].address)
    })

    it('returns the network tokens when there are no custom tokens', async () => {
      mockFetchJson({ tokens: VERIFIED_TOKENS_FIXTURE })
      const { loadVerifiedTokens, getAllTokens } = await importStellar()

      await loadVerifiedTokens()

      const tokens = getAllTokens('testnet')
      const addresses = tokens.map((t) => t.address)

      expect(addresses).toContain(KNOWN_TOKEN_ADDRESS)
      expect(new Set(addresses).size).toBe(addresses.length)
    })
describe('custom token storage', () => {
  it('returns an empty array when storage is empty', () => {
    expect(getCustomTokens('testnet')).toEqual([])
  })

  it('saves a token and reads it back', () => {
    saveCustomToken('testnet', { address: 'CABC', symbol: 'TKN', decimals: 7 })
    expect(getCustomTokens('testnet')).toEqual([
      { address: 'CABC', symbol: 'TKN', decimals: 7 },
    ])
  })

  it('does not store duplicates', () => {
    saveCustomToken('testnet', { address: 'CABC', symbol: 'TKN', decimals: 7 })
    saveCustomToken('testnet', { address: 'CABC', symbol: 'TKN', decimals: 7 })
    expect(getCustomTokens('testnet')).toHaveLength(1)
  })

  it('handles corrupt JSON gracefully', () => {
    localStorage.setItem('flowstar:custom-tokens:testnet', '{not valid json')
    expect(() => getCustomTokens('testnet')).not.toThrow()
    expect(getCustomTokens('testnet')).toEqual([])
  })

  it('isolates tokens by network', () => {
    saveCustomToken('testnet', { address: 'CABC', symbol: 'TKN', decimals: 7 })
    expect(getCustomTokens('mainnet')).toEqual([])
  })
})

describe('favorite tokens', () => {
  it('starts empty and reports no favorites', () => {
    expect(getFavoriteTokens()).toEqual([])
    expect(isFavoriteToken('CABC')).toBe(false)
  })

  it('toggles a token on', () => {
    toggleFavoriteToken('CABC')
    expect(isFavoriteToken('CABC')).toBe(true)
    expect(getFavoriteTokens()).toContain('CABC')
  })

  it('toggles a token off', () => {
    toggleFavoriteToken('CABC')
    toggleFavoriteToken('CABC')
    expect(isFavoriteToken('CABC')).toBe(false)
    expect(getFavoriteTokens()).not.toContain('CABC')
  })

  it('persists favorites across reads', () => {
    toggleFavoriteToken('CABC')
    toggleFavoriteToken('CXYZ')
    expect(getFavoriteTokens()).toEqual(expect.arrayContaining(['CABC', 'CXYZ']))
    expect(getFavoriteTokens()).toHaveLength(2)
  })
})
