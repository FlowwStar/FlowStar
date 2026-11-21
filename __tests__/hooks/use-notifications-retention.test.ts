import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNotifications } from '@/hooks/use-notifications'

const mockFetchStreamsForAddress = vi.fn((..._args: unknown[]) => Promise.resolve([]))
vi.mock('@/lib/contract', () => ({
  fetchStreamsForAddress: (...args: unknown[]) => mockFetchStreamsForAddress(...args),
}))

const mockIsNotificationTypeEnabled = vi.fn((..._args: unknown[]) => true)
vi.mock('@/hooks/use-notification-preferences', () => ({
  isNotificationTypeEnabled: (...args: unknown[]) => mockIsNotificationTypeEnabled(...args),
}))

const mockUseNetwork = vi.fn()
vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: () => mockUseNetwork(),
}))

const STORAGE_KEY = 'flowstar:last-seen-ledger'

async function flushAsync() {
  for (let i = 0; i < 20; i += 1) {
    await Promise.resolve()
  }
}

function mockRpcResponses(responses: {
  getEvents?: { events?: unknown[]; latestLedger?: number; error?: { message: string } }
  getHealth?: { oldestLedger?: number } | null
  getLatestLedger?: { sequence?: number } | null
}) {
  global.fetch = vi.fn(async (_url, options) => {
    const body = JSON.parse((options?.body as string) || '{}')

    if (body.method === 'getEvents') {
      const getEvents = responses.getEvents
      if (getEvents?.error) {
        return {
          json: async () => ({ error: getEvents.error }),
        } as Response
      }
      return {
        json: async () => ({
          result: {
            events: getEvents?.events || [],
            latestLedger: getEvents?.latestLedger || 1000,
          },
        }),
      } as Response
    }

    if (body.method === 'getHealth') {
      if (responses.getHealth === null) {
        throw new Error('RPC unreachable')
      }
      return {
        json: async () => ({
          result: responses.getHealth,
        }),
      } as Response
    }

    if (body.method === 'getLatestLedger') {
      if (responses.getLatestLedger === null) {
        throw new Error('RPC unreachable')
      }
      return {
        json: async () => ({
          result: responses.getLatestLedger,
        }),
      } as Response
    }

    throw new Error('Unknown method')
  }) as unknown as typeof fetch
}

describe('useNotifications — retention error recovery', () => {
  beforeEach(() => {
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

    const { unmount } = renderHook(() => useNotifications('GUSER123'))

    await flushAsync()

    expect(localStorage.getItem(STORAGE_KEY)).toBe('899')
    unmount()
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

    const { unmount } = renderHook(() => useNotifications('GUSER123'))

    await flushAsync()

    expect(localStorage.getItem(STORAGE_KEY)).toBe('1199')
    unmount()
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

    const { unmount } = renderHook(() => useNotifications('GUSER123'))

    await flushAsync()

    expect(localStorage.getItem(STORAGE_KEY)).toBe('500')
    unmount()
  })

  it('retention error message variations are recognized', async () => {
    const messages = ['oldest ledger', 'retention', 'before oldest ledger']

    for (const message of messages) {
      localStorage.setItem(STORAGE_KEY, '500')
      mockRpcResponses({
        getEvents: {
          error: { message },
        },
        getHealth: {
          oldestLedger: 900,
        },
      })

      const { unmount } = renderHook(() => useNotifications('GUSER123'))

      await flushAsync()

      expect(localStorage.getItem(STORAGE_KEY)).toBe('899')
      unmount()
    }
  })
})
