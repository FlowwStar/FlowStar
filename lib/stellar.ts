import { rpc } from '@stellar/stellar-sdk'

export type NetworkName = 'testnet' | 'mainnet'

export interface NetworkConfig {
  name: NetworkName
  passphrase: string
  rpcUrl: string
  horizonUrl: string
  streamContractId: string
  knownTokens: readonly { address: string; symbol: string; decimals: number }[]
}

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

export function getNetworkConfig(network: NetworkName): NetworkConfig {
  const base = NETWORKS[network]
  const contractId =
    network === 'testnet'
      ? process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID_TESTNET ?? ''
      : process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID_MAINNET ?? ''
  
  return {
    ...base,
    streamContractId: contractId,
  }
}
const FAVORITE_TOKENS_KEY = 'flowstar:favorite-tokens'

// ─── Verified Token List ──────────────────────────────────────────────────────
interface VerifiedTokenEntry {
  address: string
  symbol: string
  name: string
  decimals: number
  verified: boolean
  category: string
}

let verifiedTokensCache: VerifiedTokenEntry[] | null = null

async function loadVerifiedTokens(): Promise<VerifiedTokenEntry[]> {
  if (verifiedTokensCache) return verifiedTokensCache

  try {
    const response = await fetch('/lib/tokens.json')
    if (!response.ok) throw new Error('Failed to load verified tokens')
    const data = await response.json() as { tokens: VerifiedTokenEntry[] }
    verifiedTokensCache = data.tokens
    return data.tokens
  } catch (error) {
    console.warn('Failed to load verified tokens list:', error)
    return []
  }
}

export function isVerifiedToken(address: string): boolean {
  return KNOWN_TOKENS.some((t) => t.address === address)
}

export function getVerifiedTokenInfo(address: string): VerifiedTokenEntry | null {
  const entry = verifiedTokensCache?.find((t) => t.address === address)
  return entry || null
}

// ─── Custom Tokens ────────────────────────────────────────────────────────────

const CUSTOM_TOKENS_KEY_PREFIX = 'flowstar:custom-tokens:'

export function getCustomTokens(network: NetworkName): { address: string; symbol: string; decimals: number }[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${CUSTOM_TOKENS_KEY_PREFIX}${network}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveCustomToken(network: NetworkName, token: { address: string; symbol: string; decimals: number }) {
  const existing = getCustomTokens(network)
  if (existing.some((t) => t.address === token.address)) return
  const updated = [token, ...existing].slice(0, 10)
  localStorage.setItem(`${CUSTOM_TOKENS_KEY_PREFIX}${network}`, JSON.stringify(updated))
}

export function removeCustomToken(network: NetworkName, address: string) {
  const updated = getCustomTokens(network).filter((t) => t.address !== address)
  localStorage.setItem(`${CUSTOM_TOKENS_KEY_PREFIX}${network}`, JSON.stringify(updated))
}

export function explorerUrl(network: NetworkName, type: 'account' | 'contract' | 'tx', id: string): string {
  const explorerNetwork = network === 'testnet' ? 'testnet' : 'public'
  return `https://stellar.expert/explorer/${explorerNetwork}/${type}/${id}`
}
// ─── Token Favorites ──────────────────────────────────────────────────────────

export function getFavoriteTokens(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(FAVORITE_TOKENS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

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

export function isFavoriteToken(address: string): boolean {
  return getFavoriteTokens().includes(address)
}

export function getAllTokens(network: NetworkName): { address: string; symbol: string; decimals: number }[] {
  const config = getNetworkConfig(network)
  return [...config.knownTokens, ...getCustomTokens(network)]
}

export function getServer(network: NetworkName): rpc.Server {
  const config = getNetworkConfig(network)
  return new rpc.Server(config.rpcUrl, { allowHttp: false })
}
