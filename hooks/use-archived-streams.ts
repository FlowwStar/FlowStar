'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchArchivedSentStreamIds, fetchArchivedReceivedStreamIds } from '@/lib/contract'
import { useNetwork } from '@/components/providers/network-provider'
import { captureError } from '@/lib/sentry'

/**
 * Issue #688: paginated archived (cancelled/fully-withdrawn) stream IDs for
 * `address`, backed by the contract's `get_archived_sent_streams` /
 * `get_archived_received_streams`. Call the returned `refetch` after a write
 * that affects the archive (e.g. `cleanup_stream`) to refresh the list.
 */
export function useArchivedStreams(address: string | null) {
  const { network } = useNetwork()
  const [sent, setSent] = useState<string[]>([])
  const [received, setReceived] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const requestIdRef = useRef(0)

  const fetch = useCallback(async () => {
    requestIdRef.current += 1
    const req = requestIdRef.current

    if (!address) {
      setSent([])
      setReceived([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [sentIds, receivedIds] = await Promise.all([
        fetchArchivedSentStreamIds(network, address),
        fetchArchivedReceivedStreamIds(network, address),
      ])
      if (req !== requestIdRef.current) return
      setSent(sentIds)
      setReceived(receivedIds)
    } catch (e) {
      if (req !== requestIdRef.current) return
      captureError(e, { operation: 'use-archived-streams:fetch' })
    } finally {
      if (req === requestIdRef.current) setLoading(false)
    }
  }, [address, network])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { sent, received, loading, refetch: fetch }
}
