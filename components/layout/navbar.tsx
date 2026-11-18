'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, Moon, Sun, Monitor, Network, AlertTriangle, WifiOff } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Brand } from '@/components/brand'
import { useNetwork } from '@/components/providers/network-provider'
import { useWalletContext } from '@/components/providers/wallet-provider'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConnectWalletButton } from '@/components/layout/connect-wallet-button'
import { NotificationBell } from '@/components/layout/notification-bell'
import { navigationCopy } from '@/lib/copy/navigation'
import { cn } from '@/lib/utils'
import { navbarCopy } from '@/lib/copy/navigation'

const NAV_LINKS = [
  { href: '/app', label: navbarCopy.navLinks.dashboard },
  { href: '/app/streams', label: navbarCopy.navLinks.streams },
  { href: '/app/analytics', label: navbarCopy.navLinks.analytics },
  { href: '/app/settings', label: navbarCopy.navLinks.settings },
  { href: '/app', label: navigationCopy.links.dashboard },
  { href: '/app/streams', label: navigationCopy.links.streams },
  { href: '/app/analytics', label: navigationCopy.links.analytics },
  { href: '/app/settings', label: navigationCopy.links.settings },
]

export function Navbar() {
  const pathname = usePathname()
  const { setTheme } = useTheme()
  const { network, setNetwork } = useNetwork()
  const { networkMismatch, walletNetwork, isConnected } = useWalletContext()
  const isOnline = useOnlineStatus()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Brand href="/app" />

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === '/app' ? pathname === '/app' : pathname.startsWith(link.href)
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
          {!isOnline && (
            <span
              role="status"
              title={navbarCopy.offlineTitle}
              className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400"
            >
              <WifiOff className="size-3.5" />
              <span className="hidden sm:inline">{navbarCopy.offlineLabel}</span>
              title={navigationCopy.offline.title}
              className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400"
            >
              <WifiOff className="size-3.5" />
              <span className="hidden sm:inline">{navigationCopy.offline.label}</span>
            </span>
          )}
          {networkMismatch ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              disabled
              aria-label={navbarCopy.newStreamDisabledAriaLabel}
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">{navbarCopy.newStreamButton}</span>
              aria-label={navigationCopy.newStream.unavailableAriaLabel}
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">{navigationCopy.newStream.label}</span>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link href="/app/create">
                <Plus className="size-4" />
                <span className="hidden sm:inline">{navbarCopy.newStreamButton}</span>
                <span className="hidden sm:inline">{navigationCopy.newStream.label}</span>
              </Link>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Network className="size-4" />
                <span className="hidden sm:inline">
                  {network === 'mainnet' ? navbarCopy.network.mainnet : navbarCopy.network.testnet}
                  {network === 'mainnet'
                    ? navigationCopy.network.mainnet
                    : navigationCopy.network.testnet}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setNetwork('testnet')}>
                {navbarCopy.network.testnet}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setNetwork('mainnet')}>
                {navbarCopy.network.mainnet}
                {navigationCopy.network.testnet}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setNetwork('mainnet')}>
                {navigationCopy.network.mainnet}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Sun className="size-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute size-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">{navbarCopy.theme.toggleSrLabel}</span>
                <span className="sr-only">{navigationCopy.theme.toggle}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="mr-2 size-4" />
                {navbarCopy.theme.light}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="mr-2 size-4" />
                {navbarCopy.theme.dark}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="mr-2 size-4" />
                {navbarCopy.theme.system}
                {navigationCopy.theme.light}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="mr-2 size-4" />
                {navigationCopy.theme.dark}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="mr-2 size-4" />
                {navigationCopy.theme.system}
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
            {navbarCopy.networkMismatch.prefix} <strong>{walletNetwork}</strong>{' '}
            {navbarCopy.networkMismatch.middle} <strong>{network}</strong>{' '}
            {navbarCopy.networkMismatch.suffix}
            {navigationCopy.networkMismatch.before}
            <strong>{walletNetwork}</strong>
            {navigationCopy.networkMismatch.switchTo}
            <strong>{network}</strong>
            {navigationCopy.networkMismatch.after}
          </span>
        </div>
      )}

      {/* Mobile nav */}
      <nav className="overflow-x-auto border-t border-border px-4 py-2 md:hidden">
        <div className="flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === '/app' ? pathname === '/app' : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
                  active
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </header>
  )
}
