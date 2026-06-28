'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, Moon, Sun, Monitor, Network, AlertTriangle } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Brand } from '@/components/brand'
import { useNetwork } from '@/components/providers/network-provider'
import { useWalletContext } from '@/components/providers/wallet-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConnectWalletButton } from '@/components/layout/connect-wallet-button'
import { NotificationBell } from '@/components/layout/notification-bell'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/app', label: 'Dashboard' },
  { href: '/app/streams', label: 'Streams' },
  { href: '/app/analytics', label: 'Analytics' },
  { href: '/app/settings', label: 'Settings' },
]

export function Navbar() {
  const pathname = usePathname()
  const { setTheme } = useTheme()
  const { network, setNetwork } = useNetwork()
  const { networkMismatch, walletNetwork, isConnected } = useWalletContext()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Brand href="/app" />

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === '/app'
                ? pathname === '/app'
                : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="gap-1.5"
            disabled={networkMismatch}
          >
            <Link href="/app/create">
              <Plus className="size-4" />
              <span className="hidden sm:inline">New stream</span>
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Network className="size-4" />
                <span className="hidden sm:inline">{network === 'mainnet' ? 'Mainnet' : 'Testnet'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setNetwork('testnet')}>
                Testnet
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setNetwork('mainnet')}>
                Mainnet
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Sun className="size-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute size-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="mr-2 size-4" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="mr-2 size-4" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="mr-2 size-4" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <NotificationBell />
          <ConnectWalletButton />
        </div>
      </div>

      {/* Network mismatch banner */}
      {isConnected && networkMismatch && (
        <div className="flex items-center gap-2 border-t border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            Your wallet is on <strong>{walletNetwork}</strong> — please switch to{' '}
            <strong>{network}</strong> in Freighter settings. Transactions are disabled until you switch.
          </span>
        </div>
      )}

      {/* Mobile nav */}
      <nav className="flex items-center gap-1 border-t border-border px-4 py-2 md:hidden">
        {NAV_LINKS.map((link) => {
          const active =
            link.href === '/app'
              ? pathname === '/app'
              : pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
