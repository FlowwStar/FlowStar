import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockContextValue = {
  address: 'GSENDER',
  isConnected: true,
  connect: vi.fn(),
  disconnect: vi.fn(),
}

const mockUseWalletContext = vi.hoisted(() => vi.fn())

vi.mock('@/components/providers/wallet-provider', () => ({
  useWalletContext: mockUseWalletContext,
}))

import { useWallet } from '@/hooks/use-wallet'

describe('useWallet', () => {
  it('returns the value from useWalletContext', () => {
    mockUseWalletContext.mockReturnValue(mockContextValue)
    const { result } = renderHook(() => useWallet())
    expect(result.current).toBe(mockContextValue)
  })

  it('reflects disconnected state from the provider', () => {
    mockUseWalletContext.mockReturnValue({
      address: null,
      isConnected: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
    })
    const { result } = renderHook(() => useWallet())
    expect(result.current.isConnected).toBe(false)
    expect(result.current.address).toBeNull()
  })
})
