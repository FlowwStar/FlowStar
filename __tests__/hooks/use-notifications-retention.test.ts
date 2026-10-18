import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useNotifications } from '@/hooks/use-notifications'

const mockFetchStreamsForAddress = vi.fn()
vi.mock('@/lib/contract', () => ({
  fetchStreamsForAddress: (...args: unknown[]) => mockFetchStreamsForAddress(...args),
}))

const mockIsNotificationTypeEnabled = vi.fn(() => true)
vi.mock('@/hooks/use-notification-preferences', () => ({
  isNotificationTypeEnabled: (...args: unknown[]) => mockIsNotificationTypeEnabled(...args),
}))

const mockUseNetwork = vi.fn()
vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: () => mockUseNetwork(),
}))

const STORAGE_KEY = 'flowstar:last-seen-ledger'

function mockRpcResponses(responses: {
  getEvents?: { events?: unknown[]; latestLedger?: number; error?: { message: string } }
  getHealth?: { oldestLedger?: number } | null
  getLatestLedger?: { sequence?: number } | null
}) {
  global.fetch = vi.fn((url, options) => {
    const body = JSON.parse((options?.body as string) || '{}')
    
    if (body.method === 'getEvents') {
      if (responses.getEvents?.error) {
        return Promise.resolve({
          json: () => Promise.resolve({ error: responses.getEvents.error }),
        })
      }
      return Promise.resolve({
        json: () => Promise.resolve({
          result: {
            events: responses.getEvents?.events || [],
            latestLedger: responses.getEvents?.latestLedger || 1000,
          },
        }),
      })
    }
    
    if (body.method === 'getHealth') {
      if (responses.getHealth === null) {
        return Promise.reject(new Error('RPC unreachable'))
      }
      return Promise.resolve({
        json: () => Promise.resolve({
          result: responses.getHealth,
        }),
      })
    }
    
    if (body.method === 'getLatestLedger') {
      if (responses.getLatestLedger === null) {
        return Promise.reject(new Error('RPC unreachable'))
      }
      return Promise.resolve({
        json: () => Promise.resolve({
          result: responses.getLatestLedger,
        }),
      })
    }
    
    return Promise.reject(new Error('Unknown method'))
  }) as typeof fetch
}

describe('useNotifications — retention error recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    mockUseNetwork.mockReturnValue({
      network: 'testnet',
      config: {
        rpcUrl: 'https://rpc.example.com',
        streamContractId: 'CONTRACT123',
      },
    })
    mockFetchStreamsForAddress.mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('retention error + getHealth OK → cursor reset to oldestLedger - 1', async () => {
    localStorage.setItem(STORAGE_KEY, '500') // Ledger that's too old

    mockRpcResponses({
      getEvents: {
        error: { message: 'Start sequence before oldest ledger' },
      },
      getHealth: {
        oldestLedger: 900,
      },
    })

    renderHook(() => useNotifications('GUSER123'))
    
    await vi.runOnlyPendingTimersAsync()
    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe('899')
    })
  })

  it('retention error + getHealth fails → falls back to latest ledger', async () => {
    localStorage.setItem(STORAGE_KEY, '500')

    mockRpcResponses({
      getEvents: {
        error: { message: 'oldest ledger retention error' },
      },
      getHealth: null, // getHealth fails
      getLatestLedger: {
        sequence: 1200,
      },
    })

    renderHook(() => useNotifications('GUSER123'))
    
    await vi.runOnlyPendingTimersAsync()
    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe('1199')
    })
  })

  it('both fail → cursor unchanged', async () => {
    localStorage.setItem(STORAGE_KEY, '500')

    mockRpcResponses({
      getEvents: {
        error: { message: 'before oldest ledger' },
      },
      getHealth: null, // getHealth fails
      getLatestLedger: null, // getLatestLedger also fails
    })

    renderHook(() => useNotifications('GUSER123'))
    
    await vi.runOnlyPendingTimersAsync()
    
    // Give it time to process but cursor should remain unchanged
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(localStorage.getItem(STORAGE_KEY)).toBe('500')
  })

  it('retention error message variations are recognized', async () => {
    localStorage.setItem(STORAGE_KEY, '500')

    const messages = [
      'oldest ledger',
      'retention',
      'before oldest ledger',
    ]

    for (const message of messages) {
      mockRpcResponses({
        getEvents: {
          error: { message },
        },
        getHealth: {
          oldestLedger: 900,
        },
      })

      renderHook(() => useNotifications('GUSER123'))
      
      await vi.runOnlyPendingTimersAsync()
      await waitFor(() => {
        expect(localStorage.getItem(STORAGE_KEY)).toBe('899')
      })

      // Reset for next iteration
      localStorage.setItem(STORAGE_KEY, '500')
    }
  })
})
