import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useContractPaused } from '@/hooks/use-contract-paused'
import { isPaused } from '@/lib/contract'

// Issue #1144: polls is_paused() every 60s, pausing while the tab is hidden.

const mockUseNetwork = vi.fn()

vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: () => mockUseNetwork(),
}))

vi.mock('@/lib/contract', () => ({
  isPaused: vi.fn(),
}))

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
}

function fireVisibilityChange() {
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useContractPaused', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUseNetwork.mockReturnValue({ network: 'testnet' })
    vi.mocked(isPaused).mockResolvedValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.clearAllMocks()
    setDocumentHidden(false)
  })

  it('checks is_paused immediately on mount', async () => {
    renderHook(() => useContractPaused())
    await act(async () => {})
    expect(isPaused).toHaveBeenCalledWith('testnet')
  })

  it('returns true once is_paused resolves true', async () => {
    vi.mocked(isPaused).mockResolvedValue(true)
    const { result } = renderHook(() => useContractPaused())
    await act(async () => {})
    expect(result.current).toBe(true)
  })

  it('polls again every 60s', async () => {
    renderHook(() => useContractPaused())
    await act(async () => {})
    expect(isPaused).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(isPaused).toHaveBeenCalledTimes(2)

    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(isPaused).toHaveBeenCalledTimes(3)
  })

  it('stops polling while the tab is hidden', async () => {
    renderHook(() => useContractPaused())
    await act(async () => {})
    expect(isPaused).toHaveBeenCalledTimes(1)

    setDocumentHidden(true)
    act(() => {
      fireVisibilityChange()
    })

    await act(async () => {
      vi.advanceTimersByTime(120_000)
    })
    // No additional calls while hidden.
    expect(isPaused).toHaveBeenCalledTimes(1)
  })

  it('re-checks immediately and resumes polling when the tab becomes visible again', async () => {
    renderHook(() => useContractPaused())
    await act(async () => {})
    expect(isPaused).toHaveBeenCalledTimes(1)

    setDocumentHidden(true)
    act(() => {
      fireVisibilityChange()
    })

    setDocumentHidden(false)
    await act(async () => {
      fireVisibilityChange()
    })
    // Immediate re-check on resume.
    expect(isPaused).toHaveBeenCalledTimes(2)

    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(isPaused).toHaveBeenCalledTimes(3)
  })

  it('stops polling on unmount', async () => {
    const { unmount } = renderHook(() => useContractPaused())
    await act(async () => {})
    expect(isPaused).toHaveBeenCalledTimes(1)

    unmount()

    await act(async () => {
      vi.advanceTimersByTime(120_000)
    })
    expect(isPaused).toHaveBeenCalledTimes(1)
  })
})
