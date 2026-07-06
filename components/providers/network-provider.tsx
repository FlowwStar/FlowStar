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
import { type NetworkName, getNetworkConfig } from '@/lib/stellar'

const NETWORK_KEY = 'flowstar:network'

interface NetworkContextValue {
  network: NetworkName
  setNetwork: (network: NetworkName) => void
  config: ReturnType<typeof getNetworkConfig>
  isMockMode: boolean
}

const NetworkContext = createContext<NetworkContextValue | null>(null)

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<NetworkName>('testnet')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem(NETWORK_KEY) as NetworkName | null
    if (saved && ['testnet', 'mainnet'].includes(saved)) {
      setNetworkState(saved)
    }
  }, [])

  const setNetwork = useCallback((newNetwork: NetworkName) => {
    setNetworkState(newNetwork)
    localStorage.setItem(NETWORK_KEY, newNetwork)
  }, [])

  const config = useMemo(() => getNetworkConfig(network), [network])
  const isMockMode = !config.streamContractId

  // Startup check: warn (in non-production) when the contract ID is missing
  useEffect(() => {
    if (mounted && isMockMode && process.env.NODE_ENV !== 'production') {
      console.warn(
        `[FlowStar] No contract ID configured for ${network} — running in MOCK mode. ` +
          'Streams are kept in memory only and reset on reload. ' +
          'Copy .env.local.example to .env.local and set the appropriate contract ID.',
      )
    }
  }, [network, isMockMode, mounted])

  const value = useMemo<NetworkContextValue>(
    () => ({
      network,
      setNetwork,
      config,
      isMockMode,
    }),
    [network, setNetwork, config, isMockMode],
  )

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
}

export function useNetwork() {
  const ctx = useContext(NetworkContext)
  if (!ctx) throw new Error('useNetwork must be used within a NetworkProvider')
  return ctx
}
