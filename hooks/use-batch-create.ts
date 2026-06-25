'use client'

import { useState, useCallback, useRef } from 'react'
import { createStream as createStreamCall } from '@/lib/contract'
import { invalidateStreams } from '@/hooks/use-streams'
import { useWallet } from '@/hooks/use-wallet'
import { useNetwork } from '@/components/providers/network-provider'
import type { CreateStreamInput, TokenInfo } from '@/types/stream'

export interface BatchStreamInput {
  recipient: string
  token: TokenInfo
  totalAmount: bigint
  startTime: bigint
  endTime: bigint
  cliffTime: bigint
  cliffAmount: bigint
}

export interface BatchCreateProgress {
  total: number
  completed: number
  failed: number
  current: number
  successIds: string[]
  errors: Map<number, string>
  isRunning: boolean
}

const DEFAULT_BATCH_DELAY = 2000 // 2 seconds between streams to avoid rate limiting

export function useBatchCreate() {
  const { address, isConnected } = useWallet()
  const { network } = useNetwork()
  const [progress, setProgress] = useState<BatchCreateProgress>({
    total: 0,
    completed: 0,
    failed: 0,
    current: 0,
    successIds: [],
    errors: new Map(),
    isRunning: false,
  })

  const abortRef = useRef(false)

  const createBatch = useCallback(
    async (
      streams: BatchStreamInput[],
      options?: { batchDelay?: number; onProgress?: (p: BatchCreateProgress) => void },
    ): Promise<BatchCreateProgress> => {
      if (!isConnected || !address) {
        throw new Error('Wallet not connected')
      }

      if (streams.length === 0) {
        throw new Error('No streams to create')
      }

      if (streams.length > 100) {
        throw new Error('Batch size exceeds maximum of 100 streams')
      }

      const { batchDelay = DEFAULT_BATCH_DELAY, onProgress } = options ?? {}

      abortRef.current = false

      const newProgress: BatchCreateProgress = {
        total: streams.length,
        completed: 0,
        failed: 0,
        current: 0,
        successIds: [],
        errors: new Map(),
        isRunning: true,
      }

      setProgress(newProgress)

      for (let i = 0; i < streams.length; i += 1) {
        if (abortRef.current) break

        const stream = streams[i]
        newProgress.current = i + 1

        try {
          const streamId = await createStreamCall(
            {
              recipient: stream.recipient,
              token: stream.token,
              totalAmount: stream.totalAmount,
              startTime: stream.startTime,
              endTime: stream.endTime,
              cliffTime: stream.cliffTime,
              cliffAmount: stream.cliffAmount,
            },
            address,
          )

          newProgress.successIds.push(streamId)
          newProgress.completed += 1
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          newProgress.errors.set(i, message)
          newProgress.failed += 1
        }

        setProgress({ ...newProgress })
        onProgress?.({ ...newProgress })

        // Delay before next stream creation (except for last one)
        if (i < streams.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, batchDelay))
        }
      }

      newProgress.isRunning = false
      setProgress(newProgress)
      onProgress?.(newProgress)

      // Invalidate streams to refresh UI
      invalidateStreams()

      return newProgress
    },
    [address, isConnected],
  )

  const retryFailed = useCallback(
    async (
      streams: BatchStreamInput[],
      failedIndices: number[],
      options?: { batchDelay?: number; onProgress?: (p: BatchCreateProgress) => void },
    ): Promise<BatchCreateProgress> => {
      if (!isConnected || !address) {
        throw new Error('Wallet not connected')
      }

      const { batchDelay = DEFAULT_BATCH_DELAY, onProgress } = options ?? {}

      abortRef.current = false

      const newProgress: BatchCreateProgress = {
        total: failedIndices.length,
        completed: 0,
        failed: 0,
        current: 0,
        successIds: [],
        errors: new Map(),
        isRunning: true,
      }

      setProgress(newProgress)

      for (let i = 0; i < failedIndices.length; i += 1) {
        if (abortRef.current) break

        const originalIndex = failedIndices[i]
        const stream = streams[originalIndex]
        newProgress.current = i + 1

        try {
          const streamId = await createStreamCall(
            {
              recipient: stream.recipient,
              token: stream.token,
              totalAmount: stream.totalAmount,
              startTime: stream.startTime,
              endTime: stream.endTime,
              cliffTime: stream.cliffTime,
              cliffAmount: stream.cliffAmount,
            },
            address,
          )

          newProgress.successIds.push(streamId)
          newProgress.completed += 1
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          newProgress.errors.set(originalIndex, message)
          newProgress.failed += 1
        }

        setProgress({ ...newProgress })
        onProgress?.({ ...newProgress })

        if (i < failedIndices.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, batchDelay))
        }
      }

      newProgress.isRunning = false
      setProgress(newProgress)
      onProgress?.(newProgress)

      invalidateStreams()

      return newProgress
    },
    [address, isConnected],
  )

  const cancel = useCallback(() => {
    abortRef.current = true
  }, [])

  return { progress, createBatch, retryFailed, cancel }
}
