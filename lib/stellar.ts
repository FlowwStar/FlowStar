import { rpc, StrKey } from '@stellar/stellar-sdk'
import { captureError } from './sentry'

/**
 * The two networks FlowStar supports.
 * - `'testnet'` — Stellar Testnet (SDF-operated); used for development and QA.
 * - `'mainnet'` — Stellar Public Network; used for real-value production streams.
 */
export type NetworkName = 'testnet' | 'mainnet'

/**
 * Full configuration for a single Stellar network, including the deployed
 * FlowStar streaming contract address and the list of tokens shown in the UI
 * by default.
 *
 * `streamContractId` is kept separate from {@link NETWORKS} so the static
 * network map can be defined at build time while the contract ID is injected
 * at runtime via `NEXT_PUBLIC_STREAM_CONTRACT_ID_TESTNET` /
 * `NEXT_PUBLIC_STREAM_CONTRACT_ID_MAINNET`. See {@link getNetworkConfig}.
 */
export interface NetworkConfig {
  name: NetworkName
  passphrase: string
  rpcUrl: string
  horizonUrl: string
  streamContractId: string
  knownTokens: readonly { address: string; symbol: string; decimals: number }[]
}

// ─── Address Validation ────────────────────────────────────────────────────────

/**
 * Returns `true` when `address` is a structurally and checksum-valid
 * Stellar Ed25519 public key (starts with `'G'`).
 */
export function isValidStellarAddress(address: string): boolean {
  return StrKey.isValidEd25519PublicKey(address.trim())
}

/**
 * Matches the shape of a Stellar Ed25519 public key (`G` + 55 base32
 * characters) without verifying the embedded CRC-16 checksum. Used by
 * {@link validateStellarAddress} to tell a near-miss (right shape, wrong
 * checksum — e.g. a single mistyped character) apart from a value that
 * isn't even trying to be a G-address.
 */
const ED25519_SHAPE_RE = /^G[A-Z2-7]{55}$/

/**
 * Result of {@link validateStellarAddress}.
 *
 * - `reason: 'checksum'` — the value has the correct length, prefix, and
 *   base32 alphabet of a Stellar Ed25519 address, but the CRC-16 checksum
 *   encoded in its last two bytes doesn't match (a classic single-typo
 *   near-miss).
 * - `reason: 'format'` — the value doesn't even match the basic shape of a
 *   Stellar G-address (wrong prefix, wrong length, or invalid characters).
 */
export type StellarAddressValidation =
  { valid: true } | { valid: false; reason: 'checksum' | 'format' }

/**
 * Validates `address` as a Stellar Ed25519 public key and, when invalid,
 * distinguishes a bad checksum (right shape, mistyped character) from a
 * value that is the wrong shape entirely. This lets callers show a more
 * actionable error than a single generic "invalid address" message.
 */
export function validateStellarAddress(address: string): StellarAddressValidation {
  const trimmed = address.trim()
  if (StrKey.isValidEd25519PublicKey(trimmed)) return { valid: true }
  if (ED25519_SHAPE_RE.test(trimmed)) return { valid: false, reason: 'checksum' }
  return { valid: false, reason: 'format' }
}

/**
 * Static per-network configuration map (RPC endpoints, Horizon URLs, network
 * passphrases, and built-in known tokens). Does **not** include the streaming
 * contract ID — call {@link getNetworkConfig} to get a complete
 * {@link NetworkConfig} with the contract ID merged in from environment
 * variables.
 *
 * ### Known tokens (per network)
 * | Symbol | Network |
 * |--------|---------|
 * | XLM    | testnet + mainnet |
 * | USDC   | testnet only |
 * | EURC   | testnet + mainnet |
 */
export const NETWORKS: Record<NetworkName, Omit<NetworkConfig, 'streamContractId'>> = {
  testnet: {
    name: 'testnet',
    passphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    knownTokens: [
      {
        address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        symbol: 'XLM',
        decimals: 7,
      },
      {
        address: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
        symbol: 'USDC',
        decimals: 7,
      },
      {
        address: 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUEZHRST6OAH3GZP5C7VZ6CK',
        symbol: 'EURC',
        decimals: 7,
      },
    ],
  },
  mainnet: {
    name: 'mainnet',
    passphrase: 'Public Global Stellar Network ; September 2015',
    rpcUrl: 'https://soroban.stellar.org',
    horizonUrl: 'https://horizon.stellar.org',
    knownTokens: [
      {
        address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        symbol: 'XLM',
        decimals: 7,
      },
      {
        address: 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUEZHRST6OAH3GZP5C7VZ6CK',
        symbol: 'EURC',
        decimals: 7,
      },
    ],
  },
}

/**
 * Returns the full {@link NetworkConfig} for the given network, merging the
 * static entry from {@link NETWORKS} with the streaming contract ID read from
 * environment variables at runtime:
 *
 * - **testnet** → `NEXT_PUBLIC_STREAM_CONTRACT_ID_TESTNET`
 * - **mainnet** → `NEXT_PUBLIC_STREAM_CONTRACT_ID_MAINNET`
 *
 * If the relevant env variable is absent, `streamContractId` is an empty
 * string and the app runs in mock mode (see `lib/contract.ts`).
 */
export function getNetworkConfig(network: NetworkName): NetworkConfig {
  const base = NETWORKS[network]
  const contractId =
    network === 'testnet'
      ? (process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID_TESTNET ?? '')
      : (process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID_MAINNET ?? '')

  return {
    ...base,
    streamContractId: contractId,
  }
}

/**
 * Flat list of every known token across all networks (testnet ∪ mainnet).
 * Used by {@link isVerifiedToken} and token-picker components to quickly
 * validate or look up a token address without specifying a network.
 */
export const KNOWN_TOKENS = [...NETWORKS.testnet.knownTokens, ...NETWORKS.mainnet.knownTokens]

/**
 * The active network for the current deployment, resolved once at module
 * load time from `NEXT_PUBLIC_STELLAR_NETWORK`.
 *
 * - Set `NEXT_PUBLIC_STELLAR_NETWORK=mainnet` in `.env.production` to point
 *   the app at the Stellar Public Network.
 * - Omit the variable (or set it to anything else) to default to `'testnet'`.
 *
 * Because this is a `NEXT_PUBLIC_` variable it is inlined by the Next.js
 * compiler and cannot be changed at runtime without a rebuild.
 */
export const NETWORK: NetworkName =
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK as NetworkName | undefined) ?? 'testnet'

const CUSTOM_TOKENS_KEY = 'flowstar:custom-tokens'
const FAVORITE_TOKENS_KEY = 'flowstar:favorite-tokens'

/**
 * Returns `true` if `address` matches one of the tokens in {@link KNOWN_TOKENS}
 * (the built-in set across all networks). Does not check user-added custom
 * tokens — use {@link getAllTokens} for a network-aware full list.
 */
export function isVerifiedToken(address: string): boolean {
  return KNOWN_TOKENS.some((t) => t.address === address)
}

// ─── Custom Tokens ────────────────────────────────────────────────────────────

const CUSTOM_TOKENS_KEY_PREFIX = 'flowstar:custom-tokens:'

/**
 * Reads the user's custom token list for `network` from `localStorage`.
 * Returns an empty array when called server-side (no `window`) or when no
 * custom tokens have been saved yet.
 */
export function getCustomTokens(
  network: NetworkName,
): { address: string; symbol: string; decimals: number }[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${CUSTOM_TOKENS_KEY_PREFIX}${network}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Persists a new custom token for `network` to `localStorage`.
 * Silently no-ops if the token address is already in the list.
 * The list is capped at 10 entries (most-recently-added first).
 */
export function saveCustomToken(
  network: NetworkName,
  token: { address: string; symbol: string; decimals: number },
) {
  const existing = getCustomTokens(network)
  if (existing.some((t) => t.address === token.address)) return
  const updated = [token, ...existing].slice(0, 10)
  localStorage.setItem(`${CUSTOM_TOKENS_KEY_PREFIX}${network}`, JSON.stringify(updated))
}

/**
 * Builds a link to the [stellar.expert](https://stellar.expert) block explorer
 * for the given `network`, `type`, and `id`.
 *
 * @param network - `'testnet'` or `'mainnet'`
 * @param type    - `'account'`, `'contract'`, or `'tx'`
 * @param id      - The Stellar address, contract ID, or transaction hash
 * @returns A fully-qualified `https://stellar.expert/explorer/…` URL string
 */
export function explorerUrl(
  network: NetworkName,
  type: 'account' | 'contract' | 'tx',
  id: string,
): string {
  const explorerNetwork = network === 'testnet' ? 'testnet' : 'public'
  return `https://stellar.expert/explorer/${explorerNetwork}/${type}/${id}`
}

// ─── Token Favorites ──────────────────────────────────────────────────────────

/**
 * Reads the user's list of favourite token addresses from `localStorage`.
 * Returns an empty array when called server-side or when nothing has been saved.
 */
export function getFavoriteTokens(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(FAVORITE_TOKENS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Toggles `address` in the user's favourite token list (adds it if absent,
 * removes it if present) and persists the updated list to `localStorage`.
 */
export function toggleFavoriteToken(address: string) {
  const favorites = getFavoriteTokens()
  const index = favorites.indexOf(address)
  if (index >= 0) {
    favorites.splice(index, 1)
  } else {
    favorites.push(address)
  }
  localStorage.setItem(FAVORITE_TOKENS_KEY, JSON.stringify(favorites))
}

/**
 * Returns `true` if `address` is in the user's favourite token list.
 */
export function isFavoriteToken(address: string): boolean {
  return getFavoriteTokens().includes(address)
}

/**
 * Returns the combined token list for `network`: the built-in
 * {@link NetworkConfig.knownTokens} from {@link NETWORKS} plus any tokens the
 * user has added via {@link saveCustomToken}. This is the canonical source of
 * selectable tokens in the create-stream and token-picker UI.
 */
export function getAllTokens(
  network: NetworkName,
): { address: string; symbol: string; decimals: number }[] {
  const config = getNetworkConfig(network)
  return [...config.knownTokens, ...getCustomTokens(network)]
}

/**
 * Creates and returns a Soroban RPC {@link rpc.Server} instance configured
 * for `network`. Used by `lib/contract.ts` for all on-chain interactions.
 * HTTP is disallowed (`allowHttp: false`) to prevent accidental plaintext RPC
 * calls in production.
 */
export function getServer(network: NetworkName): rpc.Server {
  const config = getNetworkConfig(network)
  return new rpc.Server(config.rpcUrl, { allowHttp: false })
}

// ─── Account Validation ────────────────────────────────────────────────────────

/**
 * Result returned by {@link checkAccountInfo}.
 *
 * - `exists`           — `true` if the account was found on Horizon.
 * - `funded`           — `true` if the account exists and has been activated
 *                        (synonymous with `exists` here).
 * - `transactionCount` — number of data entries on the account (used as a
 *                        rough activity proxy; not the true transaction count).
 * - `error`            — human-readable error message, present only on failure.
 */
export interface AccountInfo {
  exists: boolean
  funded: boolean
  transactionCount: number
  error?: string
}

/**
 * Shape of a Horizon /accounts/{id} API response.
 * `data` is present only for checkAccountInfo's use case but included optionally.
 */
interface HorizonAccountResponse {
  id: string
  account_id: string
  sequence: string
  balances: Array<{ balance: string; asset_type: string }>
  signers: Array<{ key: string; type: string; weight: number }>
  data: Record<string, string>
}

/**
 * Queries the Horizon REST API to check whether `address` exists and has been
 * funded on `network`. Useful for validating a recipient address before
 * creating a stream (unfunded accounts cannot receive tokens).
 *
 * Returns an {@link AccountInfo} object. Never throws — network or HTTP errors
 * are caught and surfaced through the `error` field.
 */
export async function checkAccountInfo(
  address: string,
  network: NetworkName,
): Promise<AccountInfo> {
  const config = getNetworkConfig(network)
  const horizonUrl = config.horizonUrl

  try {
    const response = await fetch(`${horizonUrl}/accounts/${address}`)
    if (!response.ok) {
      if (response.status === 404) {
        return { exists: false, funded: false, transactionCount: 0 }
      }
      return { exists: false, funded: false, transactionCount: 0, error: 'Failed to query account' }
    }

    const data = (await response.json()) as HorizonAccountResponse
    return {
      exists: true,
      funded: true,
      transactionCount: Object.keys(data.data ?? {}).length,
    }
  } catch (error) {
    void captureError(error, { operation: 'checkAccountInfo' })
    return { exists: false, funded: false, transactionCount: 0, error: 'Network error' }
  }
}

/**
 * Fetches the native XLM balance for `address` on `network` via Horizon.
 * Returns the balance as a `bigint` in **stroops** (1 XLM = 10,000,000 stroops),
 * matching the precision used throughout the rest of the app for token amounts.
 * Returns `null` if the account does not exist or a network error occurs.
 */
export async function getXlmBalance(address: string, network: NetworkName): Promise<bigint | null> {
  const config = getNetworkConfig(network)
  const horizonUrl = config.horizonUrl

  try {
    const response = await fetch(`${horizonUrl}/accounts/${address}`)
    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as Omit<HorizonAccountResponse, 'data'>
    const balances = data.balances
    if (!balances) return null

    // Find native (XLM) balance
    const nativeBalance = balances.find(
      (b: { asset_type: string; balance: string }) => b.asset_type === 'native',
    )
    if (!nativeBalance) return null

    // Convert to stroops (multiply by 10,000,000)
    const xlmAmount = parseFloat(nativeBalance.balance)
    return BigInt(Math.floor(xlmAmount * 1e7))
  } catch (error) {
    void captureError(error, { operation: 'getXlmBalance' })
    return null
  }
}
