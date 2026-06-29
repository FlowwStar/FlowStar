import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('@/lib/contract', () => ({
  getTokenMetadata: vi.fn(),
}))

vi.mock('@/lib/stellar', () => ({
  isVerifiedToken: vi.fn(() => false),
  isFavoriteToken: vi.fn(() => false),
  toggleFavoriteToken: vi.fn(),
}))

import { getTokenMetadata } from '@/lib/contract'
import { isVerifiedToken } from '@/lib/stellar'
import { useTokenVerification } from '@/hooks/use-token-verification'

const VALID_TOKEN = { address: 'CUSDC', symbol: 'USDC', decimals: 7 }

describe('useTokenVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getTokenMetadata).mockResolvedValue(VALID_TOKEN)
  })

  it('returns loading true while verifying', async () => {
    const { result } = renderHook(() => useTokenVerification('CUSDC'))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it('returns valid metadata for a valid token', async () => {
    const { result } = renderHook(() => useTokenVerification('CUSDC'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isValid).toBe(true)
    expect(result.current.metadata).toEqual(VALID_TOKEN)
    expect(result.current.error).toBeNull()
  })

  it('shows warning for unverified custom token', async () => {
    vi.mocked(isVerifiedToken).mockReturnValue(false)
    const { result } = renderHook(() => useTokenVerification('CUSTOM123'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isVerified).toBe(false)
    expect(result.current.warning).toContain('not verified')
  })

  it('marks token as verified when in verified list', async () => {
    vi.mocked(isVerifiedToken).mockReturnValue(true)
    const { result } = renderHook(() => useTokenVerification('CUSDC'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isVerified).toBe(true)
    expect(result.current.warning).toBeNull()
  })

  it('sets error when getTokenMetadata returns null', async () => {
    vi.mocked(getTokenMetadata).mockResolvedValue(null)
    const { result } = renderHook(() => useTokenVerification('INVALID'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isValid).toBe(false)
    expect(result.current.error).toBeTruthy()
  })

  it('sets error when getTokenMetadata throws', async () => {
    vi.mocked(getTokenMetadata).mockRejectedValue(new Error('RPC error'))
    const { result } = renderHook(() => useTokenVerification('BADADDR'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isValid).toBe(false)
    expect(result.current.error).toBe('RPC error')
  })

  it('does nothing for empty address', async () => {
    const { result } = renderHook(() => useTokenVerification(''))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getTokenMetadata).not.toHaveBeenCalled()
    expect(result.current.metadata).toBeNull()
  })
})
