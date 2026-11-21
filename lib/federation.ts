import { Federation, StrKey } from '@stellar/stellar-sdk'

/**
 * Stellar Federation addresses look like `name*domain.com` — a human-readable
 * alias that resolves to a `G…` account via the domain's `stellar.toml` /
 * `federation.json` server.
 *
 * @see https://developers.stellar.org/docs/learn/encyclopedia/network-configuration/federation
 */
const FEDERATION_ADDRESS_RE = /^[^*\s]+\*[^*\s]+\.[^*\s]+$/

/** Returns `true` when `value` has the `name*domain.tld` shape of a Federation address. */
export function isFederationAddress(value: string): boolean {
  return FEDERATION_ADDRESS_RE.test(value.trim())
}

export interface FederationLookupResult {
  /** The original Federation address that was resolved (e.g. `alice*stellarx.com`). */
  federationAddress: string
  /** The resolved Stellar account ID (`G…`). */
  accountId: string
  /** Optional memo type the domain wants attached to payments (e.g. `'text'`, `'id'`). */
  memoType?: string
  /** Optional memo value that should accompany payments to this address. */
  memo?: string
}

/** Raised when a Federation address can't be resolved to an account. */
export class FederationLookupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FederationLookupError'
  }
}

/**
 * Resolves a Federation address (`name*domain.com`) to a Stellar account via
 * the standard Federation protocol: fetch `domain/.well-known/stellar.toml`,
 * find the `FEDERATION_SERVER` entry, then query it for the name.
 *
 * Throws {@link FederationLookupError} with a user-facing message on any
 * failure (invalid domain, name not found, network error, or a malformed
 * response).
 */
export async function resolveFederationAddress(value: string): Promise<FederationLookupResult> {
  const trimmed = value.trim()
  if (!isFederationAddress(trimmed)) {
    throw new FederationLookupError(
      'Not a valid Federation address — expected the form name*domain.com',
    )
  }

  let record
  try {
    record = await Federation.Server.resolve(trimmed)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/not\s*found|404/i.test(message)) {
      throw new FederationLookupError(`No Federation record found for "${trimmed}"`)
    }
    if (/toml|federation server/i.test(message)) {
      throw new FederationLookupError(
        `"${trimmed.split('*')[1]}" does not publish a Federation server (missing stellar.toml)`,
      )
    }
    throw new FederationLookupError(
      `Could not resolve "${trimmed}" — the domain may be unreachable`,
    )
  }

  if (!record?.account_id || !StrKey.isValidEd25519PublicKey(record.account_id)) {
    throw new FederationLookupError(`Federation server for "${trimmed}" returned an invalid account`)
  }

  return {
    federationAddress: trimmed,
    accountId: record.account_id,
    memoType: record.memo_type,
    memo: record.memo,
  }
}
