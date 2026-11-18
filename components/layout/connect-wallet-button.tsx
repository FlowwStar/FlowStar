'use client'

import { useState } from 'react'
import { Check, Copy, LogOut, Loader2, Wallet, ExternalLink } from 'lucide-react'
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
import { WALLET_OPTIONS, ADAPTERS } from '@/components/providers/wallet-provider'
import { shortenAddress } from '@/lib/stream-utils'
import { cn } from '@/lib/utils'
import { walletCopy as copy } from '@/lib/copy/wallet'
import { toast } from 'sonner'

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
      toast.success(copy.toasts.addressCopied, {
        description: copy.toasts.addressCopiedDescription,
      })
    } catch {
      toast.error(copy.toasts.copyFailed, {
        description: copy.toasts.copyFailedDescription,
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
              {copy.connectedWith(activeWallet?.name ?? copy.fallbackWalletName)}
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
            {copied ? copy.copied : copy.copyAddress}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={disconnect} variant="destructive">
            <LogOut className="size-4" />
            {copy.disconnect}
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
          {copy.connectWallet}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.dialog.title}</DialogTitle>
          <DialogDescription>{copy.dialog.description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 pt-2">
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {connecting && copy.connectingTo(WALLET_OPTIONS.find((w) => w.id === pendingId)?.name || copy.fallbackWalletName)}
          </div>
          {WALLET_OPTIONS.map((wallet) => {
            const isPending = connecting && pendingId === wallet.id
            const available = ADAPTERS[wallet.id]?.isAvailable() ?? true
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
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )}
                {!isPending && !available && (
                  wallet.installUrl ? (
                    <a
                      href={wallet.installUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {copy.notInstalled}
                      <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {copy.notInstalled}
                    </span>
                  )
                )}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
