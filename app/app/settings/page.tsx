import type { Metadata } from 'next'
import { RequireWallet } from '@/components/layout/require-wallet'
import { WebhookSettings } from '@/components/webhooks/webhook-settings'
import { UsdToggle } from './usd-toggle'

export const metadata: Metadata = {
  title: 'Settings — FlowStar',
  description: 'Configure webhooks and notification preferences.',
}

export default function SettingsPage() {
  return (
    <RequireWallet>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure webhooks and notification preferences for your streams.
          </p>
        </div>

        <section>
          <h2 className="text-lg font-medium mb-4">Display</h2>
          <UsdToggle />
        </section>

        <section>
          <h2 className="text-lg font-medium mb-4">Webhooks</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Register webhook URLs to receive HTTP POST notifications when stream events occur.
            Webhooks are stored per-wallet in your browser. Use{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">--no-verify</code> or the
            toggle to temporarily disable a webhook without deleting it.
          </p>
          <WebhookSettings />
        </section>
      </div>
    </RequireWallet>
  )
}
