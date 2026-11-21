'use client'

import { ToggleLeft, ToggleRight } from 'lucide-react'
import { toast } from 'sonner'
import {
  useNotificationPreferences,
  type NotificationType,
} from '@/hooks/use-notification-preferences'

const NOTIFICATION_TYPES: { value: NotificationType; label: string; description: string }[] = [
  {
    value: 'stream_created',
    label: 'Stream created',
    description: 'When a new stream is created to or from your wallet.',
  },
  {
    value: 'stream_cancelled',
    label: 'Stream cancelled',
    description: 'When one of your streams is cancelled.',
  },
  {
    value: 'withdrawal',
    label: 'Withdrawal',
    description: 'When funds are withdrawn from one of your streams.',
  },
]

export function NotificationPreferencesSettings() {
  const { preferences, setPreference } = useNotificationPreferences(() =>
    toast.warning("Notification preferences aren't being saved", {
      description: 'Storage is full or unavailable — your changes may not persist.',
    }),
  )

  return (
    <div className="space-y-2">
      {NOTIFICATION_TYPES.map((n) => {
        const enabled = preferences[n.value]
        return (
          <div
            key={n.value}
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{n.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={`${enabled ? 'Disable' : 'Enable'} ${n.label} notifications`}
              onClick={() => setPreference(n.value, !enabled)}
              className="shrink-0"
            >
              {enabled ? (
                <ToggleRight className="size-6 text-primary" />
              ) : (
                <ToggleLeft className="size-6 text-muted-foreground" />
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
