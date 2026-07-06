'use client'

import { useState, useEffect, useRef } from 'react'
import type { StreamData } from '@/types/stream'

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

export function formatUsd(value: number): string {
  if (value < 1) {
    return '$' + value.toFixed(4)
  }
  if (value < 1000) {
    return '$' + value.toFixed(2)
  }
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

/** Format a USD value with context-aware decimal places. */
export function formatUsd(value: number): string {
  if (value < 1) {
    return '$' + value.toFixed(4)
  }
  if (value < 1000) {
    return '$' + value.toFixed(2)
  }
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface PortfolioValue {
  totalUsd: number | null
  loading: boolean
  stale: boolean
}

// Internal hook to get price for a single symbol — called conditionally per unique symbol.
// We collect unique symbols and call useTokenPrice for each (hooks must not be called conditionally,
// so we support up to a fixed set of known symbols).
// We support a fixed set of symbols to avoid conditional hook calls.
const KNOWN_SYMBOLS = ['XLM', 'USDC', 'EURC']

export function usePortfolioValue(streams: StreamData[]): PortfolioValue {
  const xlm = useTokenPrice('XLM')
  const usdc = useTokenPrice('USDC')
  const eurc = useTokenPrice('EURC')

  const priceMap: Record<string, TokenPrice> = { XLM: xlm, USDC: usdc, EURC: eurc }

  const usedSymbols = [...new Set(streams.map((s) => s.token.symbol))]

  const loading = usedSymbols.some((sym) => KNOWN_SYMBOLS.includes(sym) && priceMap[sym]?.loading)
  const stale = usedSymbols.some((sym) => KNOWN_SYMBOLS.includes(sym) && priceMap[sym]?.stale)

  let totalUsd: number | null = 0
  for (const stream of streams) {
    const tp = priceMap[stream.token.symbol]
    if (!tp || tp.usdPrice === null) {
      totalUsd = null
      break
    }
    const locked = stream.depositedAmount - stream.withdrawnAmount
    const human = Number(locked) / Math.pow(10, stream.token.decimals)
    totalUsd = (totalUsd ?? 0) + human * tp.usdPrice
  }

  return { totalUsd, loading, stale }
}
