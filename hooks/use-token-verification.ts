'use client'

import { useState, useEffect, useCallback } from 'react'
import { getTokenMetadata } from '@/lib/contract'
import { isVerifiedToken, isFavoriteToken, toggleFavoriteToken } from '@/lib/stellar'
import type { TokenInfo } from '@/types/stream'

export interface TokenVerificationResult {
  isValid: boolean
  isVerified: boolean
  isFavorite: boolean
  metadata: TokenInfo | null
  warning: string | null
  loading: boolean
  error: string | null
  toggleFavorite: () => void
}

export function useTokenVerification(
  address: string,
): TokenVerificationResult {
  const [metadata, setMetadata] = useState<TokenInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const verified = isVerifiedToken(address)
  const favorite = isFavoriteToken(address)

  const verify = useCallback(async () => {
    if (!address || address.length === 0) {
      setMetadata(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const info = await getTokenMetadata(address)
      if (!info) {
        setError('Invalid token address or contract')
        setMetadata(null)
        return
      }

      setMetadata(info)

      if (info.decimals === 0) {
        setError('Token has 0 decimals - may not be a valid SEP-41 token')
      } else if (!info.symbol || info.symbol.length === 0) {
        setError('Token has no symbol - may not be a valid SEP-41 token')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to verify token'
      setError(message)
      setMetadata(null)
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    verify()
  }, [verify])

  const toggleFavorite = useCallback(() => {
    toggleFavoriteToken(address)
  }, [address])

  let warning: string | null = null
  if (metadata && !verified) {
    if (metadata.decimals === 0 || !metadata.symbol) {
      warning = 'This token appears to be invalid or malformed. Verify the address is correct before creating a stream.'
    } else {
      warning = 'This token is not verified. Only proceed if you trust this token address.'
    }
  }

  return {
    isValid: error === null && metadata !== null,
    isVerified: verified,
    isFavorite: favorite,
    metadata,
    warning,
    loading,
    error,
    toggleFavorite,
  }
}
