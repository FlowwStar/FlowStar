'use client'

import { useState, useCallback } from 'react'
import {
  createStream as createStreamCall,
  withdrawFromStream,
  cancelStream as cancelStreamCall,
  estimateCreateStreamFee,
} from '@/lib/contract'
import { useNetwork } from '@/components/providers/network-provider'
import type { FeeEstimate } from '@/lib/contract'
import { invalidateStreams } from '@/hooks/use-streams'
import { useWallet } from '@/hooks/use-wallet'
import { getWithdrawableAmount } from '@/lib/stream-utils'
import type { CreateStreamInput, StreamData } from '@/types/stream'

export interface WithdrawAllResult {
  succeeded: number
  failed: number
}

export function useContract() {
  const { address, isConnected } = useWallet()
  const { network } = useNetwork()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      if (!isConnected || !address) throw new Error('Connect a wallet first.')
      setPending(true)
      setError(null)
      try {
        const result = await fn()
        invalidateStreams() // re-fetch all stream hooks after any write
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Transaction failed'
        setError(message)
        throw err
      } finally {
        setPending(false)
      }
    },
    [address, isConnected],
  )

  const createStream = useCallback(
    (input: CreateStreamInput) => run(() => createStreamCall(input, address!, network)),
    [run, address, network],
  )

  const withdraw = useCallback(
    (id: string, amount: bigint) => run(() => withdrawFromStream(id, amount, network)),
    [run, network],
  )

  const cancel = useCallback(
    (id: string) => run(() => cancelStreamCall(id, network)),
    [run, network],
  )

  const estimateFee = useCallback(
    async (input: CreateStreamInput): Promise<FeeEstimate | null> => {
      if (!isConnected || !address) return null
      try {
        return await estimateCreateStreamFee(network, input, address)
      } catch {
        return null
      }
    },
    [address, isConnected, network],
  )

  const withdrawAll = useCallback(
    async (
      streams: StreamData[],
      onProgress?: (current: number, total: number) => void,
    ): Promise<WithdrawAllResult> => {
      if (!isConnected || !address) throw new Error('Connect a wallet first.')

      const now = Math.floor(Date.now() / 1000)
      const withdrawable = streams.filter((s) => getWithdrawableAmount(s, now) > 0n)
      if (withdrawable.length === 0) return { succeeded: 0, failed: 0 }

      setPending(true)
      setError(null)

      let succeeded = 0
      let failed = 0

      for (let i = 0; i < withdrawable.length; i++) {
        onProgress?.(i + 1, withdrawable.length)
        const s = withdrawable[i]
        try {
          const amount = getWithdrawableAmount(s, Math.floor(Date.now() / 1000))
          await withdrawFromStream(s.id, amount, network)
          succeeded++
        } catch {
          failed++
        }
      }

      invalidateStreams()
      setPending(false)

      if (failed > 0 && succeeded === 0) {
        setError('All withdrawals failed.')
      }

      return { succeeded, failed }
    },
    [address, isConnected, network],
  )

  return { createStream, withdraw, cancel, withdrawAll, estimateFee, pending, error }
}
