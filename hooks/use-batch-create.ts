'use client'

import { useState, useCallback, useRef } from 'react'
import { createStreamsBatch as createStreamsBatchCall } from '@/lib/contract'
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

      try {
        const batchIds = await createStreamsBatchCall(
          streams.map((stream) => ({
            recipient: stream.recipient,
            token: stream.token,
            totalAmount: stream.totalAmount,
            startTime: stream.startTime,
            endTime: stream.endTime,
            cliffTime: stream.cliffTime,
            cliffAmount: stream.cliffAmount,
          })),
          address,
          network,
        )

        newProgress.successIds.push(...batchIds)
        newProgress.completed = streams.length
        newProgress.failed = 0
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        streams.forEach((_, index) => {
          newProgress.errors.set(index, message)
        })
        newProgress.failed = streams.length
      }

      setProgress({ ...newProgress })
      onProgress?.({ ...newProgress })

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

      const retryStreams = failedIndices.map((index) => streams[index])

      try {
        const batchIds = await createStreamsBatchCall(
          retryStreams.map((stream) => ({
            recipient: stream.recipient,
            token: stream.token,
            totalAmount: stream.totalAmount,
            startTime: stream.startTime,
            endTime: stream.endTime,
            cliffTime: stream.cliffTime,
            cliffAmount: stream.cliffAmount,
          })),
          address,
          network,
        )

        newProgress.successIds.push(...batchIds)
        newProgress.completed = retryStreams.length
        newProgress.failed = 0
        retryStreams.forEach((_, index) => {
          newProgress.errors.delete(failedIndices[index])
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        failedIndices.forEach((index) => {
          newProgress.errors.set(index, message)
        })
        newProgress.failed = failedIndices.length
      }

      setProgress({ ...newProgress })
      onProgress?.({ ...newProgress })

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
