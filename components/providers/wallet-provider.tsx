'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { setSignTransaction } from '@/lib/contract'
import { NETWORK } from '@/lib/stellar'

// ─── Wallet options ───────────────────────────────────────────────────────────

export interface WalletOption {
  id: string
  name: string
  detail: string
}

export const WALLET_OPTIONS: WalletOption[] = [
  { id: 'freighter', name: 'Freighter', detail: 'Browser extension · stellar.org' },
  { id: 'xbull',     name: 'xBull',     detail: 'Extension & web' },
  { id: 'lobstr',    name: 'LOBSTR',    detail: 'Mobile & extension' },
  { id: 'albedo',    name: 'Albedo',    detail: 'Web signer' },
]

// ─── Context ──────────────────────────────────────────────────────────────────

interface WalletContextValue {
  address: string | null
  walletId: string | null
  connecting: boolean
  isConnected: boolean
  connect: (walletId: string) => Promise<void>
  disconnect: () => void
  signTransaction: (xdr: string) => Promise<string>
}

const WalletContext = createContext<WalletContextValue | null>(null)

// ─── Wallet adapters ─────────────────────────────────────────────────────────

async function connectFreighter(): Promise<string> {
  const { isConnected, getAddress, requestAccess } = await import('@stellar/freighter-api')
  const connected = await isConnected()
  if (!connected.isConnected) {
    throw new Error('Freighter is not installed. Please install the Freighter extension.')
  }
  // Request access prompts the user to approve
  await requestAccess()
  const result = await getAddress()
  if (result.error) throw new Error(result.error)
  return result.address
}

async function signWithFreighter(xdr: string): Promise<string> {
  const { signTransaction } = await import('@stellar/freighter-api')
  const result = await signTransaction(xdr, {
    networkPassphrase: NETWORK.passphrase,
  })
  if (result.error) throw new Error(result.error)
  return result.signedTxXdr
}

// Stubs for wallets that need a dedicated SDK — shows a helpful message
async function connectStub(name: string): Promise<string> {
  throw new Error(
    `${name} connection requires the ${name} browser extension. Install it and refresh.`,
  )
}

async function connectWallet(id: string): Promise<string> {
  switch (id) {
    case 'freighter': return connectFreighter()
    case 'xbull':     return connectStub('xBull')
    case 'lobstr':    return connectStub('LOBSTR')
    case 'albedo':    return connectStub('Albedo')
    default:          throw new Error(`Unknown wallet: ${id}`)
  }
}

async function signWithWallet(id: string, xdr: string): Promise<string> {
  switch (id) {
    case 'freighter': return signWithFreighter(xdr)
    default: throw new Error(`Signing not implemented for ${id}`)
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [walletId, setWalletId] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  const connect = useCallback(async (id: string) => {
    setConnecting(true)
    try {
      const addr = await connectWallet(id)
      setAddress(addr)
      setWalletId(id)
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setAddress(null)
    setWalletId(null)
  }, [])

  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      if (!walletId) throw new Error('No wallet connected')
      return signWithWallet(walletId, xdr)
    },
    [walletId],
  )

  // Keep contract layer in sync
  useEffect(() => {
    setSignTransaction(signTransaction)
  }, [signTransaction])

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      walletId,
      connecting,
      isConnected: address !== null,
      connect,
      disconnect,
      signTransaction,
    }),
    [address, walletId, connecting, connect, disconnect, signTransaction],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWalletContext() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider')
  return ctx
}
