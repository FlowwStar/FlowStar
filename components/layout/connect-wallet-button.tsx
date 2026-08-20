'use client'

import { useState } from 'react'
import { Check, Copy, LogOut, Loader2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useWallet } from '@/hooks/use-wallet'
import { WALLET_OPTIONS } from '@/components/providers/wallet-provider'
import { shortenAddress } from '@/lib/stream-utils'
import { cn } from '@/lib/utils'

export function ConnectWalletButton({ className }: { className?: string }) {
  const { address, isConnected, connecting, connect, disconnect, walletId } =
    useWallet()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function handleConnect(id: string) {
    setPendingId(id)
    try {
      await connect(id)
      setOpen(false)
    } finally {
      setPendingId(null)
    }
  }

  async function copyAddress() {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast.success('Address copied', {
        description: 'Wallet address copied to clipboard.',
      })
    } catch (error) {
      console.error('Failed to copy address:', error)
      toast.error('Copy failed', {
        description: 'Could not copy the address. Please copy it manually.',
      })
    }
  }

  if (isConnected && address) {
    const activeWallet = WALLET_OPTIONS.find((w) => w.id === walletId)
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" className={cn('gap-2', className)}>
            <span className="size-2 rounded-full bg-primary" aria-hidden />
            <span className="font-mono">{shortenAddress(address)}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5">
            <p className="text-xs text-muted-foreground">
              Connected with {activeWallet?.name ?? 'wallet'}
            </p>
            <p className="truncate font-mono text-sm">{shortenAddress(address, 8)}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={copyAddress}>
            {copied ? (
              <Check className="size-4 text-primary" />
            ) : (
              <Copy className="size-4" />
            )}
            {copied ? 'Copied' : 'Copy address'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={disconnect} variant="destructive">
            <LogOut className="size-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={cn('gap-2', className)}>
          <Wallet className="size-4" />
          Connect wallet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect a wallet</DialogTitle>
          <DialogDescription>
            Choose a Stellar wallet to continue. You&apos;ll sign transactions
            from your wallet — FlowStar never holds your keys.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 pt-2">
          {WALLET_OPTIONS.map((wallet) => {
            const isPending = connecting && pendingId === wallet.id
            return (
              <button
                key={wallet.id}
                type="button"
                disabled={connecting}
                onClick={() => handleConnect(wallet.id)}
                className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-left transition-colors hover:bg-secondary disabled:opacity-60"
              >
                <span className="flex size-9 items-center justify-center rounded-md bg-background font-semibold text-primary">
                  {wallet.name.charAt(0)}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">{wallet.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {wallet.detail}
                  </span>
                </span>
                {isPending && (
                  <span className="relative" aria-live="polite">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    <span className="sr-only">Connecting to {wallet.name}...</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
