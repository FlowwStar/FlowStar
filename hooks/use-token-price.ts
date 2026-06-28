'use client'

import { useState, useEffect, useRef } from 'react'

interface TokenPrice {
  usdPrice: number | null
  lastUpdated: number | null
  loading: boolean
  stale: boolean
}

const PRICE_CACHE: Record<string, { price: number; fetchedAt: number }> = {}
const STALE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes
const STALENESS_WARNING_MS = 2 * 60 * 1000 // warn if price is >2 min old on display

async function fetchXlmUsdPrice(): Promise<number> {
  const res = await fetch(
    'https://api.stellar.expert/explorer/public/asset/XLM/price',
    { next: { revalidate: 60 } }
  )
  if (!res.ok) throw new Error('price fetch failed')
  const json = await res.json()
  return Number(json.price ?? json.close ?? json.last)
}

export function useTokenPrice(symbol: string): TokenPrice {
  const [price, setPrice] = useState<number | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isStablecoin = symbol === 'USDC' || symbol === 'EURC'

  useEffect(() => {
    if (isStablecoin) {
      setPrice(1)
      setFetchedAt(Date.now())
      return
    }

    if (symbol !== 'XLM') {
      setPrice(null)
      setFetchedAt(null)
      return
    }

    const cached = PRICE_CACHE[symbol]
    if (cached && Date.now() - cached.fetchedAt < STALE_THRESHOLD_MS) {
      setPrice(cached.price)
      setFetchedAt(cached.fetchedAt)
      return
    }

    setLoading(true)

    fetchXlmUsdPrice()
      .then((p) => {
        PRICE_CACHE[symbol] = { price: p, fetchedAt: Date.now() }
        setPrice(p)
        setFetchedAt(Date.now())
      })
      .catch(() => {
        setPrice(null)
      })
      .finally(() => setLoading(false))

    timerRef.current = setTimeout(() => {
      setPrice(null)
      setFetchedAt(null)
    }, STALE_THRESHOLD_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [symbol, isStablecoin])

  const stale = fetchedAt !== null && Date.now() - fetchedAt > STALENESS_WARNING_MS

  return { usdPrice: price, lastUpdated: fetchedAt, loading, stale }
}
