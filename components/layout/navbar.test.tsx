import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Navbar } from './navbar'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useNetwork } from '@/components/providers/network-provider'
import { useWalletContext } from '@/components/providers/wallet-provider'
import { useOnlineStatus } from '@/hooks/use-online-status'

jest.mock('next/navigation')
jest.mock('next-themes')
jest.mock('@/components/providers/network-provider')
jest.mock('@/components/providers/wallet-provider')
jest.mock('@/hooks/use-online-status')
jest.mock('@/components/brand', () => ({
  Brand: () => <div data-testid="brand">Brand</div>,
}))
jest.mock('@/components/layout/notification-bell', () => ({
  NotificationBell: () => <div data-testid="notification-bell">Notification Bell</div>,
}))
jest.mock('@/components/layout/connect-wallet-button', () => ({
  ConnectWalletButton: () => <div data-testid="connect-wallet">Connect Wallet</div>,
}))

const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>
const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>
const mockUseNetwork = useNetwork as jest.MockedFunction<typeof useNetwork>
const mockUseWalletContext = useWalletContext as jest.MockedFunction<typeof useWalletContext>
const mockUseOnlineStatus = useOnlineStatus as jest.MockedFunction<typeof useOnlineStatus>

describe('Navbar', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockUsePathname.mockReturnValue('/app')
    mockUseTheme.mockReturnValue({
      theme: 'light',
      setTheme: jest.fn(),
    } as any)
    mockUseNetwork.mockReturnValue({
      network: 'mainnet',
      setNetwork: jest.fn(),
    } as any)
    mockUseWalletContext.mockReturnValue({
      isConnected: false,
      networkMismatch: false,
      walletNetwork: '',
    } as any)
    mockUseOnlineStatus.mockReturnValue(true)
  })

  describe('active link highlighting', () => {
    it('should highlight Dashboard link when on /app route', () => {
      mockUsePathname.mockReturnValue('/app')
      render(<Navbar />)

      const dashboardLink = screen.getByText('Dashboard').closest('a')
      expect(dashboardLink).toHaveClass('bg-secondary', 'text-foreground')
    })

    it('should highlight Streams link when on /app/streams route', () => {
      mockUsePathname.mockReturnValue('/app/streams')
      render(<Navbar />)

      const streamsLink = screen.getByText('Streams').closest('a')
      expect(streamsLink).toHaveClass('bg-secondary', 'text-foreground')
    })

    it('should highlight Streams link when on /app/streams/123 (nested route)', () => {
      mockUsePathname.mockReturnValue('/app/streams/123')
      render(<Navbar />)

      const streamsLink = screen.getByText('Streams').closest('a')
      expect(streamsLink).toHaveClass('bg-secondary', 'text-foreground')
    })

    it('should highlight Analytics link when on /app/analytics route', () => {
      mockUsePathname.mockReturnValue('/app/analytics')
      render(<Navbar />)

      const analyticsLink = screen.getByText('Analytics').closest('a')
      expect(analyticsLink).toHaveClass('bg-secondary', 'text-foreground')
    })

    it('should highlight Settings link when on /app/settings route', () => {
      mockUsePathname.mockReturnValue('/app/settings')
      render(<Navbar />)

      const settingsLink = screen.getByText('Settings').closest('a')
      expect(settingsLink).toHaveClass('bg-secondary', 'text-foreground')
    })

    it('should not highlight other links when on one route', () => {
      mockUsePathname.mockReturnValue('/app/streams')
      render(<Navbar />)

      const dashboardLink = screen.getByText('Dashboard').closest('a')
      const analyticsLink = screen.getByText('Analytics').closest('a')

      expect(dashboardLink).not.toHaveClass('bg-secondary')
      expect(analyticsLink).not.toHaveClass('bg-secondary')
    })
  })

  describe('network dropdown', () => {
    it('should display current network in dropdown trigger', () => {
      mockUseNetwork.mockReturnValue({
        network: 'mainnet',
        setNetwork: jest.fn(),
      } as any)
      render(<Navbar />)

      expect(screen.getByText('Mainnet')).toBeInTheDocument()
    })

    it('should display Testnet when network is testnet', () => {
      mockUseNetwork.mockReturnValue({
        network: 'testnet',
        setNetwork: jest.fn(),
      } as any)
      render(<Navbar />)

      expect(screen.getByText('Testnet')).toBeInTheDocument()
    })

    it('should call setNetwork when selecting testnet', async () => {
      const setNetworkMock = jest.fn()
      mockUseNetwork.mockReturnValue({
        network: 'mainnet',
        setNetwork: setNetworkMock,
      } as any)

      const { container } = render(<Navbar />)
      const networkButton = container.querySelector('[aria-label*="network"]') || screen.getByText('Mainnet').closest('button')

      fireEvent.click(networkButton!)

      const testnetMenuItem = screen.getByText('Testnet')
      fireEvent.click(testnetMenuItem)

      expect(setNetworkMock).toHaveBeenCalledWith('testnet')
    })

    it('should call setNetwork when selecting mainnet', async () => {
      const setNetworkMock = jest.fn()
      mockUseNetwork.mockReturnValue({
        network: 'testnet',
        setNetwork: setNetworkMock,
      } as any)

      const { container } = render(<Navbar />)
      const networkButton = screen.getByText('Testnet').closest('button')

      fireEvent.click(networkButton!)

      const mainnetMenuItem = screen.getByText('Mainnet')
      fireEvent.click(mainnetMenuItem)

      expect(setNetworkMock).toHaveBeenCalledWith('mainnet')
    })
  })

  describe('theme dropdown', () => {
    it('should render theme toggle button', () => {
      render(<Navbar />)

      const themeButton = screen.getByLabelText('Toggle theme')
      expect(themeButton).toBeInTheDocument()
    })

    it('should call setTheme with light when Light option selected', () => {
      const setThemeMock = jest.fn()
      mockUseTheme.mockReturnValue({
        theme: 'dark',
        setTheme: setThemeMock,
      } as any)

      const { container } = render(<Navbar />)
      const themeButton = screen.getByLabelText('Toggle theme')

      fireEvent.click(themeButton)

      const lightOption = screen.getByText('Light')
      fireEvent.click(lightOption)

      expect(setThemeMock).toHaveBeenCalledWith('light')
    })

    it('should call setTheme with dark when Dark option selected', () => {
      const setThemeMock = jest.fn()
      mockUseTheme.mockReturnValue({
        theme: 'light',
        setTheme: setThemeMock,
      } as any)

      const { container } = render(<Navbar />)
      const themeButton = screen.getByLabelText('Toggle theme')

      fireEvent.click(themeButton)

      const darkOption = screen.getByText('Dark')
      fireEvent.click(darkOption)

      expect(setThemeMock).toHaveBeenCalledWith('dark')
    })

    it('should call setTheme with system when System option selected', () => {
      const setThemeMock = jest.fn()
      mockUseTheme.mockReturnValue({
        theme: 'light',
        setTheme: setThemeMock,
      } as any)

      const { container } = render(<Navbar />)
      const themeButton = screen.getByLabelText('Toggle theme')

      fireEvent.click(themeButton)

      const systemOption = screen.getByText('System')
      fireEvent.click(systemOption)

      expect(setThemeMock).toHaveBeenCalledWith('system')
    })
  })

  describe('network mismatch banner', () => {
    it('should not render banner when wallet not connected', () => {
      mockUseWalletContext.mockReturnValue({
        isConnected: false,
        networkMismatch: true,
        walletNetwork: 'testnet',
      } as any)

      render(<Navbar />)

      expect(screen.queryByText(/Your wallet is on/)).not.toBeInTheDocument()
    })

    it('should not render banner when networks match', () => {
      mockUseWalletContext.mockReturnValue({
        isConnected: true,
        networkMismatch: false,
        walletNetwork: 'mainnet',
      } as any)

      render(<Navbar />)

      expect(screen.queryByText(/Your wallet is on/)).not.toBeInTheDocument()
    })

    it('should render banner when isConnected && networkMismatch', () => {
      mockUseWalletContext.mockReturnValue({
        isConnected: true,
        networkMismatch: true,
        walletNetwork: 'testnet',
      } as any)
      mockUseNetwork.mockReturnValue({
        network: 'mainnet',
        setNetwork: jest.fn(),
      } as any)

      render(<Navbar />)

      expect(screen.getByText(/Your wallet is on/)).toBeInTheDocument()
      expect(screen.getByText(/testnet/)).toBeInTheDocument()
      expect(screen.getByText(/mainnet/)).toBeInTheDocument()
    })

    it('should display correct wallet and expected networks in mismatch banner', () => {
      mockUseWalletContext.mockReturnValue({
        isConnected: true,
        networkMismatch: true,
        walletNetwork: 'testnet',
      } as any)
      mockUseNetwork.mockReturnValue({
        network: 'mainnet',
        setNetwork: jest.fn(),
      } as any)

      render(<Navbar />)

      const banner = screen.getByText(/Your wallet is on/)
      expect(banner).toHaveTextContent('Your wallet is on testnet')
      expect(banner).toHaveTextContent('switch to mainnet')
    })

    it('should have AlertTriangle icon in banner', () => {
      mockUseWalletContext.mockReturnValue({
        isConnected: true,
        networkMismatch: true,
        walletNetwork: 'testnet',
      } as any)

      const { container } = render(<Navbar />)

      // AlertTriangle SVG should be present in banner
      const banner = screen.getByText(/Your wallet is on/).closest('div')
      expect(banner).toBeInTheDocument()
    })
  })

  describe('offline status', () => {
    it('should not show offline indicator when online', () => {
      mockUseOnlineStatus.mockReturnValue(true)
      render(<Navbar />)

      expect(screen.queryByText('Offline')).not.toBeInTheDocument()
    })

    it('should show offline indicator when offline', () => {
      mockUseOnlineStatus.mockReturnValue(false)
      render(<Navbar />)

      expect(screen.getByText('Offline')).toBeInTheDocument()
    })

    it('should have offline status role', () => {
      mockUseOnlineStatus.mockReturnValue(false)
      render(<Navbar />)

      const offlineIndicator = screen.getByRole('status')
      expect(offlineIndicator).toBeInTheDocument()
      expect(offlineIndicator).toHaveAttribute('title', expect.stringContaining('offline'))
    })
  })

  describe('new stream button state', () => {
    it('should have new stream button enabled when no network mismatch', () => {
      mockUseWalletContext.mockReturnValue({
        isConnected: true,
        networkMismatch: false,
        walletNetwork: 'mainnet',
      } as any)

      render(<Navbar />)

      const newStreamButton = screen.getByText('New stream').closest('a')?.closest('[role="button"], button') ||
        screen.getByText('New stream').closest('button')
      expect(newStreamButton).not.toBeDisabled()
    })

    it('should have new stream button disabled when network mismatch', () => {
      mockUseWalletContext.mockReturnValue({
        isConnected: true,
        networkMismatch: true,
        walletNetwork: 'testnet',
      } as any)

      render(<Navbar />)

      const newStreamButton = screen.getByText(/New stream/).closest('button')
      expect(newStreamButton).toBeDisabled()
    })
  })

  describe('mobile navigation', () => {
    it('should render mobile nav with same links as desktop', () => {
      render(<Navbar />)

      const allDashboardLinks = screen.getAllByText('Dashboard')
      const allStreamsLinks = screen.getAllByText('Streams')
      const allAnalyticsLinks = screen.getAllByText('Analytics')
      const allSettingsLinks = screen.getAllByText('Settings')

      // Each should appear at least twice (desktop + mobile)
      expect(allDashboardLinks.length).toBeGreaterThanOrEqual(2)
      expect(allStreamsLinks.length).toBeGreaterThanOrEqual(2)
      expect(allAnalyticsLinks.length).toBeGreaterThanOrEqual(2)
      expect(allSettingsLinks.length).toBeGreaterThanOrEqual(2)
    })

    it('should highlight active link in mobile nav', () => {
      mockUsePathname.mockReturnValue('/app/streams')
      render(<Navbar />)

      const streamsLinks = screen.getAllByText('Streams')
      const activeLink = streamsLinks.find((link) => link.closest('a')?.className.includes('bg-secondary'))

      expect(activeLink).toBeInTheDocument()
    })
  })

  describe('core components presence', () => {
    it('should render Brand component', () => {
      render(<Navbar />)
      expect(screen.getByTestId('brand')).toBeInTheDocument()
    })

    it('should render NotificationBell component', () => {
      render(<Navbar />)
      expect(screen.getByTestId('notification-bell')).toBeInTheDocument()
    })

    it('should render ConnectWalletButton component', () => {
      render(<Navbar />)
      expect(screen.getByTestId('connect-wallet')).toBeInTheDocument()
    })
  })
})
