import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NETWORKS, checkAccountInfo, getXlmBalance } from '@/lib/stellar'

// Issue #938: coverage for the Horizon account lookups in lib/stellar.ts.

const captureErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/sentry', () => ({ captureError: captureErrorMock }))

const ADDRESS = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function accountBody(overrides: Record<string, unknown> = {}) {
  return {
    id: ADDRESS,
    account_id: ADDRESS,
    sequence: '123',
    balances: [
      { balance: '42.5000000', asset_type: 'credit_alphanum4' },
      { balance: '1234.5678901', asset_type: 'native' },
    ],
    signers: [{ key: ADDRESS, type: 'ed25519_public_key', weight: 1 }],
    data: {},
    ...overrides,
  }
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  captureErrorMock.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  fetchMock.mockReset()
})

describe('getXlmBalance', () => {
  it('returns the native balance in stroops', async () => {
    fetchMock.mockResolvedValue(jsonResponse(accountBody()))
    await expect(getXlmBalance(ADDRESS, 'testnet')).resolves.toBe(12_345_678_901n)
  })

  it('queries the Horizon accounts endpoint for the selected network', async () => {
    fetchMock.mockResolvedValue(jsonResponse(accountBody()))

    await getXlmBalance(ADDRESS, 'testnet')
    expect(fetchMock).toHaveBeenCalledWith(`${NETWORKS.testnet.horizonUrl}/accounts/${ADDRESS}`)

    await getXlmBalance(ADDRESS, 'mainnet')
    expect(fetchMock).toHaveBeenLastCalledWith(`${NETWORKS.mainnet.horizonUrl}/accounts/${ADDRESS}`)
  })

  it('returns 0n for a funded account with a zero native balance', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(accountBody({ balances: [{ balance: '0.0000000', asset_type: 'native' }] })),
    )
    await expect(getXlmBalance(ADDRESS, 'testnet')).resolves.toBe(0n)
  })

  it('returns null for an unfunded (404) account', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 404, title: 'Resource Missing' }, 404))
    await expect(getXlmBalance(ADDRESS, 'testnet')).resolves.toBeNull()
  })

  it('returns null when Horizon responds with a server error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ title: 'Internal Server Error' }, 500))
    await expect(getXlmBalance(ADDRESS, 'testnet')).resolves.toBeNull()
  })

  it('returns null when there is no native balance entry', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        accountBody({ balances: [{ balance: '5.0000000', asset_type: 'credit_alphanum4' }] }),
      ),
    )
    await expect(getXlmBalance(ADDRESS, 'testnet')).resolves.toBeNull()
  })

  it('returns null when the response has no balances array', async () => {
    fetchMock.mockResolvedValue(jsonResponse(accountBody({ balances: undefined })))
    await expect(getXlmBalance(ADDRESS, 'testnet')).resolves.toBeNull()
  })

  it('returns null and logs on a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(getXlmBalance(ADDRESS, 'testnet')).resolves.toBeNull()
    expect(captureErrorMock).toHaveBeenCalledWith(expect.any(TypeError), {
      operation: 'getXlmBalance',
    })
  })
})

describe('checkAccountInfo', () => {
  it('reports an existing, funded account', async () => {
    fetchMock.mockResolvedValue(jsonResponse(accountBody()))
    await expect(checkAccountInfo(ADDRESS, 'testnet')).resolves.toEqual({
      exists: true,
      funded: true,
      transactionCount: 0,
    })
    expect(fetchMock).toHaveBeenCalledWith(`${NETWORKS.testnet.horizonUrl}/accounts/${ADDRESS}`)
  })

  it('counts data entries as transactionCount', async () => {
    fetchMock.mockResolvedValue(jsonResponse(accountBody({ data: { a: 'MQ==', b: 'Mg==' } })))
    await expect(checkAccountInfo(ADDRESS, 'testnet')).resolves.toMatchObject({
      exists: true,
      transactionCount: 2,
    })
  })

  it('treats a missing data field as zero entries', async () => {
    fetchMock.mockResolvedValue(jsonResponse(accountBody({ data: undefined })))
    await expect(checkAccountInfo(ADDRESS, 'testnet')).resolves.toMatchObject({
      exists: true,
      transactionCount: 0,
    })
  })

  it('reports an unfunded (404) account without an error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 404 }, 404))
    const info = await checkAccountInfo(ADDRESS, 'testnet')
    expect(info).toEqual({ exists: false, funded: false, transactionCount: 0 })
    expect(info).not.toHaveProperty('error')
  })

  it('surfaces a query error for non-404 HTTP failures', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ title: 'Too Many Requests' }, 429))
    await expect(checkAccountInfo(ADDRESS, 'testnet')).resolves.toEqual({
      exists: false,
      funded: false,
      transactionCount: 0,
      error: 'Failed to query account',
    })
  })

  it('surfaces a network error without throwing', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(checkAccountInfo(ADDRESS, 'mainnet')).resolves.toEqual({
      exists: false,
      funded: false,
      transactionCount: 0,
      error: 'Network error',
    })
    expect(captureErrorMock).toHaveBeenCalledWith(expect.any(TypeError), {
      operation: 'checkAccountInfo',
    })
  })
})
