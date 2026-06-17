'use client'

import { useState, useCallback } from 'react'
import {
  createStream as createStreamCall,
  withdrawFromStream,
  cancelStream as cancelStreamCall,
} from '@/lib/contract'
import { invalidateStreams } from '@/hooks/use-streams'
import { useWallet } from '@/hooks/use-wallet'
import type { CreateStreamInput } from '@/types/stream'

export function useContract() {
  const { address, isConnected } = useWallet()
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
    (input: CreateStreamInput) => run(() => createStreamCall(input, address!)),
    [run, address],
  )

  const withdraw = useCallback(
    (id: string, amount: bigint) => run(() => withdrawFromStream(id, amount)),
    [run],
  )

  const cancel = useCallback(
    (id: string) => run(() => cancelStreamCall(id)),
    [run],
  )

  return { createStream, withdraw, cancel, pending, error }
}
