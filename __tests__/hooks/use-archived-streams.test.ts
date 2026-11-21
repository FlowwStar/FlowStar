import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchSent = vi.hoisted(() => vi.fn())
const fetchReceived = vi.hoisted(() => vi.fn())
const captureError = vi.hoisted(() => vi.fn())

vi.mock('@/lib/contract', () => ({
  fetchArchivedSentStreamIds: fetchSent,
  fetchArchivedReceivedStreamIds: fetchReceived,
}))
vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: () => ({ network: 'testnet' }),
}))
vi.mock('@/lib/sentry', () => ({ captureError }))

import { useArchivedStreams } from '@/hooks/use-archived-streams'

describe('useArchivedStreams', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchSent.mockResolvedValue(['sent-1', 'sent-2'])
    fetchReceived.mockResolvedValue(['received-1'])
  })

  it('loads archived sent and received IDs for an address', async () => {
    const { result } = renderHook(() => useArchivedStreams('GADDRESS'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchSent).toHaveBeenCalledWith('testnet', 'GADDRESS')
    expect(fetchReceived).toHaveBeenCalledWith('testnet', 'GADDRESS')
    expect(result.current.sent).toEqual(['sent-1', 'sent-2'])
    expect(result.current.received).toEqual(['received-1'])
  })

  it('clears results and does not fetch when the address is null', async () => {
    const { result } = renderHook(() => useArchivedStreams(null))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.sent).toEqual([])
    expect(result.current.received).toEqual([])
    expect(fetchSent).not.toHaveBeenCalled()
    expect(fetchReceived).not.toHaveBeenCalled()
  })

  it('refetches both archive lists on demand', async () => {
    const { result } = renderHook(() => useArchivedStreams('GADDRESS'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    fetchSent.mockResolvedValueOnce(['sent-3'])
    fetchReceived.mockResolvedValueOnce(['received-2'])

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.sent).toEqual(['sent-3'])
    expect(result.current.received).toEqual(['received-2'])
    expect(fetchSent).toHaveBeenCalledTimes(2)
    expect(fetchReceived).toHaveBeenCalledTimes(2)
  })

  it('reports a failed archive query and clears loading', async () => {
    const error = new Error('RPC unavailable')
    fetchSent.mockRejectedValueOnce(error)

    const { result } = renderHook(() => useArchivedStreams('GADDRESS'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(captureError).toHaveBeenCalledWith(error, {
      operation: 'use-archived-streams:fetch',
    })
  })
})
