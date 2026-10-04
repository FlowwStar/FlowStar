/**
 * Tests for app/app/settings/page.tsx — Settings page
 *
 * Strategy
 * ─────────
 * SettingsPage is a page-level composition component that:
 *   1. Wraps content in RequireWallet gate
 *   2. Renders Display, Notifications, Webhooks, AddressBook, and DangerZone sections
 *
 * We test the composition and wallet gating. Heavy child components
 * (UsdToggle, WebhookSettings, etc.) are stubbed; tested separately.
 *
 * Mocked boundaries
 * ─────────────────
 * • useWallet            — controls wallet connection state
 * • RequireWallet        — composition wrapper tested separately
 * • UsdToggle            — stubbed; tested separately
 * • NotificationPreferencesSettings — stubbed
 * • WebhookSettings      — stubbed; tested separately
 * • AddressBookSettings  — stubbed
 * • ClearLocalData       — stubbed
 * • lib/copy/settings    — returns static copy
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// ─── Mock hooks and components ────────────────────────────────────────────────

const mockUseWallet = vi.fn()

vi.mock('@/hooks/use-wallet', () => ({
  useWallet: () => mockUseWallet(),
}))

vi.mock('@/components/layout/require-wallet', () => ({
  RequireWallet: ({ children }: { children: React.ReactNode }) => {
    const { isConnected, reconnecting } = mockUseWallet()
    if (reconnecting) return null
    if (!isConnected) {
      return (
        <div data-testid="wallet-gate">
          <h2>Connect your wallet</h2>
        </div>
      )
    }
    return <>{children}</>
  },
}))

vi.mock('@/app/app/settings/usd-toggle', () => ({
  UsdToggle: () => <div data-testid="usd-toggle">USD Toggle</div>,
}))

vi.mock('@/components/notifications/notification-preferences', () => ({
  NotificationPreferencesSettings: () => (
    <div data-testid="notification-prefs">Notification Preferences</div>
  ),
}))

vi.mock('@/components/webhooks/webhook-settings', () => ({
  WebhookSettings: () => <div data-testid="webhook-settings">Webhook Settings</div>,
}))

vi.mock('@/components/settings/address-book-settings', () => ({
  AddressBookSettings: () => <div data-testid="address-book">Address Book</div>,
}))

vi.mock('@/components/settings/clear-local-data', () => ({
  ClearLocalData: () => <div data-testid="clear-data">Clear Data</div>,
}))

vi.mock('@/lib/copy/settings', () => ({
  settingsCopy: {
    metadata: {
      title: 'Settings',
      description: 'Manage your FlowStar preferences',
    },
    page: {
      title: 'Settings',
      subtitle: 'Manage your preferences and integrations',
      sections: {
        display: {
          title: 'Display',
        },
        notifications: {
          title: 'Notifications',
          description: 'Control how you receive updates',
        },
        webhooks: {
          title: 'Webhooks',
          description: 'Set up webhook integrations',
        },
        addressBook: {
          title: 'Address Book',
          description: 'Manage saved addresses',
        },
        dangerZone: {
          title: 'Danger Zone',
        },
      },
    },
  },
}))

import SettingsPage from '@/app/app/settings/page'

describe('Settings Page', () => {
  describe('with connected wallet', () => {
    beforeEach(() => {
      mockUseWallet.mockReturnValue({
        isConnected: true,
        reconnecting: false,
        address: 'GADDRESS123',
      })
    })

    it('renders the page title and subtitle', () => {
      render(<SettingsPage />)
      expect(screen.getByText('Settings')).toBeInTheDocument()
      expect(screen.getByText('Manage your preferences and integrations')).toBeInTheDocument()
    })

    it('renders Display section with USD toggle', () => {
      render(<SettingsPage />)
      expect(screen.getByText('Display')).toBeInTheDocument()
      expect(screen.getByTestId('usd-toggle')).toBeInTheDocument()
    })

    it('renders Notifications section with notification preferences', () => {
      render(<SettingsPage />)
      expect(screen.getByText('Notifications')).toBeInTheDocument()
      expect(screen.getByText('Control how you receive updates')).toBeInTheDocument()
      expect(screen.getByTestId('notification-prefs')).toBeInTheDocument()
    })

    it('renders Webhooks section with webhook settings', () => {
      render(<SettingsPage />)
      expect(screen.getByText('Webhooks')).toBeInTheDocument()
      expect(screen.getByText('Set up webhook integrations')).toBeInTheDocument()
      expect(screen.getByTestId('webhook-settings')).toBeInTheDocument()
    })

    it('renders Address Book section', () => {
      render(<SettingsPage />)
      expect(screen.getByRole('heading', { name: 'Address Book' })).toBeInTheDocument()
      expect(screen.getByText('Manage saved addresses')).toBeInTheDocument()
      expect(screen.getByTestId('address-book')).toBeInTheDocument()
    })

    it('renders Danger Zone section with clear data option', () => {
      render(<SettingsPage />)
      expect(screen.getByText('Danger Zone')).toBeInTheDocument()
      expect(screen.getByTestId('clear-data')).toBeInTheDocument()
    })

    it('does not show wallet gate when connected', () => {
      render(<SettingsPage />)
      expect(screen.queryByTestId('wallet-gate')).not.toBeInTheDocument()
    })
  })

  describe('with disconnected wallet', () => {
    beforeEach(() => {
      mockUseWallet.mockReturnValue({
        isConnected: false,
        reconnecting: false,
      })
    })

    it('shows wallet gate instead of settings sections', () => {
      render(<SettingsPage />)
      expect(screen.getByTestId('wallet-gate')).toBeInTheDocument()
      expect(screen.getByText('Connect your wallet')).toBeInTheDocument()
    })

    it('does not render Display section when disconnected', () => {
      render(<SettingsPage />)
      expect(screen.queryByTestId('usd-toggle')).not.toBeInTheDocument()
    })

    it('does not render Webhooks section when disconnected', () => {
      render(<SettingsPage />)
      expect(screen.queryByTestId('webhook-settings')).not.toBeInTheDocument()
    })

    it('does not render other sections when disconnected', () => {
      render(<SettingsPage />)
      expect(screen.queryByTestId('notification-prefs')).not.toBeInTheDocument()
      expect(screen.queryByTestId('address-book')).not.toBeInTheDocument()
      expect(screen.queryByTestId('clear-data')).not.toBeInTheDocument()
    })
  })

  describe('reconnecting state', () => {
    it('renders nothing while reconnecting', () => {
      mockUseWallet.mockReturnValue({
        isConnected: false,
        reconnecting: true,
      })

      const { container } = render(<SettingsPage />)
      expect(container).toBeEmptyDOMElement()
    })
  })
})
