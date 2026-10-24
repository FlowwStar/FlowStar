import { describe, it, expect, vi, beforeEach } from 'vitest'
import { probeSep41TokenContract, getTokenMetadata } from '@/lib/contract'
import { isVerifiedToken } from '@/lib/stellar'
import * as stellarSdk from '@stellar/stellar-sdk'

const VALID_CONTRACT_ADDRESS = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
const UNVERIFIED_CUSTOM_ADDRESS = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI99'

vi.mock(import('@/lib/stellar'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getServer: vi.fn(),
    withRetry: vi.fn((fn) => fn()),
  }
})

describe('probeSep41TokenContract', () => {
  let mockServer: any

  beforeEach(async () => {
    const { getServer } = await import('@/lib/stellar')
    mockServer = {
      getAccount: vi.fn().mockResolvedValue({
        accountId: () => 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        sequenceNumber: () => '100',
        incrementSequenceNumber: vi.fn(),
      }),
      simulateTransaction: vi.fn(),
    }
    vi.mocked(getServer).mockReturnValue(mockServer)
  })

  it('validates a valid SEP-41 contract returning name, symbol, decimals', async () => {
    mockServer.simulateTransaction
      .mockResolvedValueOnce({
        result: { retval: stellarSdk.nativeToScVal('My Custom Token') },
      })
      .mockResolvedValueOnce({
        result: { retval: stellarSdk.nativeToScVal('MCT') },
      })
      .mockResolvedValueOnce({
        result: { retval: stellarSdk.nativeToScVal(7, { type: 'u32' }) },
      })

    const result = await probeSep41TokenContract(VALID_CONTRACT_ADDRESS)
    expect(result.valid).toBe(true)
    expect(result.name).toBe('My Custom Token')
    expect(result.symbol).toBe('MCT')
    expect(result.decimals).toBe(7)
  })

  it('fails validation when contract returns simulation error', async () => {
    mockServer.simulateTransaction.mockResolvedValue({
      error: 'HostError: Error(Contract, #1)',
    })

    const result = await probeSep41TokenContract(VALID_CONTRACT_ADDRESS)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('does not appear to implement valid SEP-41')
  })

  it('fails validation when simulation fails to respond or drops calls', async () => {
    mockServer.simulateTransaction
      .mockResolvedValueOnce({
        result: { retval: stellarSdk.nativeToScVal('Token Name') },
      })
      .mockRejectedValueOnce(new Error('Contract method symbol not found'))

    const result = await probeSep41TokenContract(VALID_CONTRACT_ADDRESS)
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('integrates cleanly with getTokenMetadata wrapper', async () => {
    mockServer.simulateTransaction
      .mockResolvedValueOnce({
        result: { retval: stellarSdk.nativeToScVal('USD Coin') },
      })
      .mockResolvedValueOnce({
        result: { retval: stellarSdk.nativeToScVal('USDC') },
      })
      .mockResolvedValueOnce({
        result: { retval: stellarSdk.nativeToScVal(7, { type: 'u32' }) },
      })

    const meta = await getTokenMetadata(VALID_CONTRACT_ADDRESS)
    expect(meta).toEqual({
      address: VALID_CONTRACT_ADDRESS,
      symbol: 'USDC',
      decimals: 7,
    })
  })

  it('correctly discriminates between verified and unverified tokens for warning banner', () => {
    expect(isVerifiedToken(VALID_CONTRACT_ADDRESS)).toBe(true)
    expect(isVerifiedToken(UNVERIFIED_CUSTOM_ADDRESS)).toBe(false)
  })
})
