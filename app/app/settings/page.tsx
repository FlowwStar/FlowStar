import type { Metadata } from 'next'
import { RequireWallet } from '@/components/layout/require-wallet'
import { WebhookSettings } from '@/components/webhooks/webhook-settings'
import { NotificationPreferencesSettings } from '@/components/notifications/notification-preferences'
import { AddressBookSettings } from '@/components/settings/address-book-settings'
import { ClearLocalData } from '@/components/settings/clear-local-data'
import { settingsCopy } from '@/lib/copy/settings'
import { UsdToggle } from './usd-toggle'

export const metadata: Metadata = {
  title: settingsCopy.metadata.title,
  description: settingsCopy.metadata.description,
}

export default function SettingsPage() {
  return (
    <RequireWallet>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{settingsCopy.page.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {settingsCopy.page.subtitle}
          </p>
        </div>

        <section>
          <h2 className="text-lg font-medium mb-4">{settingsCopy.page.sections.display.title}</h2>
          <UsdToggle />
        </section>

        <section>
          <h2 className="text-lg font-medium mb-4">{settingsCopy.page.sections.notifications.title}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {settingsCopy.page.sections.notifications.description}
          </p>
          <NotificationPreferencesSettings />
        </section>

        <section>
          <h2 className="text-lg font-medium mb-4">{settingsCopy.page.sections.webhooks.title}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {settingsCopy.page.sections.webhooks.description}
          </p>
          <WebhookSettings />
        </section>

        <section>
          <h2 className="text-lg font-medium mb-4">{settingsCopy.page.sections.addressBook.title}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {settingsCopy.page.sections.addressBook.description}
          </p>
          <AddressBookSettings />
        </section>

        <section>
          <h2 className="text-lg font-medium mb-4">{settingsCopy.page.sections.dangerZone.title}</h2>
          <ClearLocalData />
        </section>
      </div>
    </RequireWallet>
  )
}
