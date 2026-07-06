'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { fetchStream, fetchStreamsForAddress } from '@/lib/contract'
import type { StreamData } from '@/types/stream'

interface StreamPollingOptions {
  enabled?: boolean
  pollInterval?: number
  onUpdate?: (stream: StreamData) => void
  onError?: (error: Error) => void
}

interface StreamsDashboardPollingOptions {
  enabled?: boolean
  pollInterval?: number
  onUpdate?: (streams: StreamData[]) => void
  onError?: (error: Error) => void
}

const DEFAULT_ACTIVE_POLL_INTERVAL = 5000 // 5 seconds for active streams
const DEFAULT_DASHBOARD_POLL_INTERVAL = 30000 // 30 seconds for dashboard
const RETRY_DELAY = 3000 // 3 seconds before retry on error
const MAX_RETRIES = 3

function isStreamActive(stream: StreamData): boolean {
  const now = BigInt(Math.floor(Date.now() / 1000))
  return !stream.cancelled && now < stream.endTime
}

export function useStreamPolling(
  streamId: string | null,
  options?: StreamPollingOptions,
): { stream: StreamData | null; loading: boolean; error: Error | null } {
  const [stream, setStream] = useState<StreamData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef(0)

  const {
    enabled = true,
    pollInterval = DEFAULT_ACTIVE_POLL_INTERVAL,
    onUpdate,
    onError,
  } = options ?? {}

  const poll = useCallback(async () => {
    if (!streamId) return

    try {
      const data = await fetchStream(streamId)
      if (data) {
        setStream(data)
        setError(null)
        retryCountRef.current = 0
        onUpdate?.(data)

        // Adjust polling interval based on stream activity
        const now = BigInt(Math.floor(Date.now() / 1000))
        if (data.cancelled || now >= data.endTime) {
          // Stop polling completed or cancelled streams
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Polling failed')
      setError(error)
      onError?.(error)

      retryCountRef.current += 1
      if (retryCountRef.current >= MAX_RETRIES) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
      }
    }
  }, [streamId, onUpdate, onError])

  useEffect(() => {
    if (!enabled || !streamId) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      return
    }

    // Initial poll
    setLoading(true)
    poll().finally(() => setLoading(false))

    // Set up periodic polling
    pollIntervalRef.current = setInterval(poll, pollInterval)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [enabled, streamId, poll, pollInterval])

  return { stream, loading, error }
}

export function useStreamsDashboardPolling(
  address: string | null,
  options?: StreamsDashboardPollingOptions,
): { streams: StreamData[]; loading: boolean; error: Error | null } {
  const [streams, setStreams] = useState<StreamData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef(0)

  const {
    enabled = true,
    pollInterval = DEFAULT_DASHBOARD_POLL_INTERVAL,
    onUpdate,
    onError,
  } = options ?? {}

  const poll = useCallback(async () => {
    if (!address) return

    try {
      const data = await fetchStreamsForAddress(address)
      setStreams(data)
      setError(null)
      retryCountRef.current = 0
      onUpdate?.(data)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Dashboard polling failed')
      setError(error)
      onError?.(error)

      retryCountRef.current += 1
      if (retryCountRef.current >= MAX_RETRIES) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
      }
    }
  }, [address, onUpdate, onError])

  useEffect(() => {
    if (!enabled || !address) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      return
    }

    // Initial poll
    setLoading(true)
    poll().finally(() => setLoading(false))

    // Set up periodic polling
    pollIntervalRef.current = setInterval(poll, pollInterval)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [enabled, address, poll, pollInterval])

  return { streams, loading, error }
}

export function useAdaptiveStreamPolling(
  streamId: string | null,
  options?: StreamPollingOptions & { adaptiveInterval?: boolean },
): { stream: StreamData | null; loading: boolean; error: Error | null } {
  const [stream, setStream] = useState<StreamData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [currentInterval, setCurrentInterval] = useState(DEFAULT_ACTIVE_POLL_INTERVAL)

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef(0)

  const {
    enabled = true,
    pollInterval = DEFAULT_ACTIVE_POLL_INTERVAL,
    adaptiveInterval = true,
    onUpdate,
    onError,
  } = options ?? {}

  const poll = useCallback(async () => {
    if (!streamId) return

    try {
      const data = await fetchStream(streamId)
      if (data) {
        setStream(data)
        setError(null)
        retryCountRef.current = 0
        onUpdate?.(data)

        // Adapt polling interval based on stream activity
        if (adaptiveInterval) {
          const now = BigInt(Math.floor(Date.now() / 1000))
          if (data.cancelled || now >= data.endTime) {
            // Stop polling completed or cancelled streams
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current)
              pollIntervalRef.current = null
            }
          } else if (now >= data.cliffTime && now < data.endTime) {
            // Active streaming: use 5 second interval
            setCurrentInterval(DEFAULT_ACTIVE_POLL_INTERVAL)
          } else {
            // Before cliff or waiting for start: use 30 second interval
            setCurrentInterval(DEFAULT_DASHBOARD_POLL_INTERVAL)
          }
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Polling failed')
      setError(error)
      onError?.(error)

      retryCountRef.current += 1
      if (retryCountRef.current >= MAX_RETRIES) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
      }
    }
  }, [streamId, adaptiveInterval, onUpdate, onError])

  useEffect(() => {
    if (!enabled || !streamId) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      return
    }

    // Initial poll
    setLoading(true)
    poll().finally(() => setLoading(false))

    // Set up periodic polling with current interval
    pollIntervalRef.current = setInterval(poll, currentInterval)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [enabled, streamId, currentInterval, poll])

  return { stream, loading, error }
}
