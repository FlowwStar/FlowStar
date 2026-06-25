'use client'

import type { ReactNode } from 'react'
import { Wallet } from 'lucide-react'
import { useWallet } from '@/hooks/use-wallet'
import { ConnectWalletButton } from '@/components/layout/connect-wallet-button'

/**
 * Gates app content behind a wallet connection. Shows a connect prompt when
 * no wallet is connected.
 */
export function RequireWallet({ children }: { children: ReactNode }) {
  const { isConnected, reconnecting } = useWallet()

  if (reconnecting) return null

  if (!isConnected) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
          <Wallet className="size-6" />
        </span>
        <h2 className="mt-5 text-xl font-semibold tracking-tight">
          Connect your wallet
        </h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground text-pretty">
          Connect a Stellar wallet to view your streams, create new ones, and
          withdraw unlocked funds.
        </p>
        <div className="mt-6">
          <ConnectWalletButton />
        </div>
      </div>
    )
  }

  return <>{children}</>
}
