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
import { type NetworkName, getNetworkConfig } from '@/lib/stellar'
import { setSentryUser } from '@/lib/sentry'
import { useNetwork } from './network-provider'

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
  reconnecting: boolean
  isConnected: boolean
  connect: (walletId: string) => Promise<void>
  disconnect: () => void
  signTransaction: (xdr: string, network?: NetworkName) => Promise<string>
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

async function signWithFreighter(xdr: string, networkPassphrase: string): Promise<string> {
  const { signTransaction } = await import('@stellar/freighter-api')
  const result = await signTransaction(xdr, {
    networkPassphrase,
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

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [walletId, setWalletId] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [reconnecting, setReconnecting] = useState(true)
  const { network } = useNetwork()

  // Auto-reconnect on mount using persisted walletId
  useEffect(() => {
    const saved = localStorage.getItem('walletId')
    if (!saved) { setReconnecting(false); return }
    connectWallet(saved)
      .then(addr => { setAddress(addr); setWalletId(saved) })
      .catch(() => { localStorage.removeItem('walletId') })
      .finally(() => setReconnecting(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const connect = useCallback(async (id: string) => {
    setConnecting(true)
    try {
      const addr = await connectWallet(id)
      setAddress(addr)
      setWalletId(id)
      localStorage.setItem('walletId', id)
      setSentryUser(addr)
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setAddress(null)
    setWalletId(null)
    localStorage.removeItem('walletId')
    setSentryUser(null)
  }, [])

  const signTransaction = useCallback(
    async (xdr: string, customNetwork?: NetworkName): Promise<string> => {
      if (!walletId) throw new Error('No wallet connected')
      const config = getNetworkConfig(customNetwork || network)
      switch (walletId) {
        case 'freighter': return signWithFreighter(xdr, config.passphrase)
        default: throw new Error(`Signing not implemented for ${walletId}`)
      }
    },
    [walletId, network],
  )

  // Keep contract layer in sync
  useEffect(() => {
    setSignTransaction((xdr: string) => signTransaction(xdr))
  }, [signTransaction])

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      walletId,
      connecting,
      reconnecting,
      isConnected: address !== null,
      connect,
      disconnect,
      signTransaction,
    }),
    [address, walletId, connecting, reconnecting, connect, disconnect, signTransaction],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWalletContext() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider')
  return ctx
}
