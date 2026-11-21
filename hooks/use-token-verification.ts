'use client'

import { useState, useEffect, useCallback } from 'react'
import { getTokenMetadata } from '@/lib/contract'
import { isVerifiedToken, isFavoriteToken, toggleFavoriteToken } from '@/lib/stellar'
import type { TokenInfo } from '@/types/stream'

/**
 * Result returned by {@link useTokenVerification}.
 *
 * The hook exposes two distinct notions of "verified":
 *
 * - `isValid` reflects whether the token address could be resolved to usable
 *   on-chain metadata. It is `true` only when metadata was fetched successfully
 *   and no error was recorded (e.g. a missing symbol or 0 decimals marks the
 *   token as invalid).
 * - `isVerified` reflects whether the address is present in the app's curated
 *   allow-list of trusted tokens (see `isVerifiedToken`). A token can be valid
 *   without being verified, and vice versa.
 *
 * Callers should gate UI on these flags as follows:
 *
 * - While `loading` is `true`, show a spinner/skeleton and avoid acting on the
 *   token.
 * - If `error` is set, surface the message and block stream creation.
 * - If `warning` is set, the token is valid but unverified or malformed; prompt
 *   the user to confirm before proceeding.
 * - Only allow the user to continue when `isValid` is `true` and, for trusted
 *   flows, when `isVerified` is also `true`.
 */
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

/**
 * Verifies a Stellar token address and exposes its metadata, trust status, and
 * favorite state for use in stream-creation flows.
 *
 * On mount (and whenever `address` changes) the hook fetches token metadata via
 * `getTokenMetadata`. "Verified" here means the address is in the curated
 * allow-list of trusted tokens (`isVerifiedToken`), which is separate from
 * `isValid`, which only indicates that usable metadata was resolved without
 * error. The returned `warning` string is populated when a token is valid but
 * unverified or malformed, so callers can ask the user to confirm.
 *
 * Callers should use the result to drive their UI: render a loading state while
 * `loading` is `true`, show `error` and block submission when it is set, and
 * only enable stream creation when `isValid` is `true` (and `isVerified` when
 * the flow requires a trusted token). `toggleFavorite` persists the favorite
 * flag for the current address.
 *
 * @param address - The Stellar token/contract address to verify. An empty
 *   string clears the metadata and skips verification.
 * @returns The {@link TokenVerificationResult} describing the token's validity,
 *   verification, favorite state, metadata, and loading/error status.
 */
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
