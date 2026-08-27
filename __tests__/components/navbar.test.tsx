import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Navbar } from '@/components/layout/navbar'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/app' }))
vi.mock('next-themes', () => ({ useTheme: () => ({ setTheme: vi.fn() }) }))
vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: () => ({ network: 'testnet', setNetwork: vi.fn() }),
}))
vi.mock('@/components/layout/notification-bell', () => ({ NotificationBell: () => null }))
vi.mock('@/components/layout/connect-wallet-button', () => ({ ConnectWalletButton: () => null }))

const useWalletContextMock = vi.fn()
vi.mock('@/components/providers/wallet-provider', () => ({
  useWalletContext: () => useWalletContextMock(),
}))

describe('Navbar — "New stream" link during a network mismatch', () => {
  it('renders a real Link when the wallet network matches', () => {
    useWalletContextMock.mockReturnValue({
      networkMismatch: false,
      walletNetwork: 'testnet',
      isConnected: true,
    })

    render(<Navbar />)

    const link = screen.getByRole('link', { name: /new stream/i })
    expect(link).toHaveAttribute('href', '/app/create')
  })

  it('renders a real disabled <button> (no href) instead of a Link when the wallet is on the wrong network', () => {
    // A `disabled` prop on a Base UI `Button asChild` wrapping a `<Link>` does
    // not give the resulting <a> real disabled semantics: `:disabled` CSS
    // never matches an anchor, it stays in the tab order, and its `href`
    // remains live for middle-click/ctrl-click to open in a new tab. Render
    // a real disabled <button> instead so the control has no href at all.
    useWalletContextMock.mockReturnValue({
      networkMismatch: true,
      walletNetwork: 'mainnet',
      isConnected: true,
    })

    render(<Navbar />)

    expect(screen.queryByRole('link', { name: /new stream/i })).not.toBeInTheDocument()

    const button = screen.getByRole('button', { name: /new stream/i })
    expect(button.tagName).toBe('BUTTON')
    expect(button).toBeDisabled()
    expect(button).not.toHaveAttribute('href')
  })
})
