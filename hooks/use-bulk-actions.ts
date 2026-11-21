'use client'

import { useState, useCallback } from 'react'

export type BulkActionStatus = 'idle' | 'running' | 'done'

export interface BulkActionResult {
  id: string
  success: boolean
  error?: string
}

/**
 * Runs an async action over a list of ids sequentially, tracking
 * per-item success/failure so callers can render a result summary.
 */
export function useBulkActions() {
  const [status, setStatus] = useState<BulkActionStatus>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState<BulkActionResult[]>([])

  const runBulk = useCallback(async (ids: string[], action: (id: string) => Promise<void>) => {
    setStatus('running')
    setProgress({ done: 0, total: ids.length })
    setResults([])

    const out: BulkActionResult[] = []

    for (const id of ids) {
      try {
        await action(id)
        out.push({ id, success: true })
      } catch (err) {
        out.push({ id, success: false, error: (err as Error).message })
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }))
      setResults([...out])
    }

    setStatus('done')
    return out
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setProgress({ done: 0, total: 0 })
    setResults([])
  }, [])

  const succeeded = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  return { status, progress, results, succeeded, failed, runBulk, reset }
}
