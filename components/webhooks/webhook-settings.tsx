'use client'

import { useState } from 'react'
import { Plus, Trash2, ToggleLeft, ToggleRight, Send, CheckCircle2, XCircle, Webhook } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatTimeAgo } from '@/lib/stream-utils'
import { useWebhooks, type WebhookEventType } from '@/hooks/use-webhooks'

const ALL_EVENTS: { value: WebhookEventType; label: string }[] = [
  { value: 'stream.created', label: 'Stream Created' },
  { value: 'stream.withdrawal', label: 'Withdrawal' },
  { value: 'stream.cancelled', label: 'Cancelled' },
  { value: 'stream.completed', label: 'Completed' },
  { value: 'stream.topped_up', label: 'Topped Up' },
  { value: 'stream.transferred', label: 'Transferred' },
]

export function WebhookSettings() {
  const { webhooks, history, addWebhook, removeWebhook, toggleWebhook, testWebhook } = useWebhooks()

  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState('')
  const [eventsError, setEventsError] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>([
    'stream.created',
    'stream.withdrawal',
    'stream.cancelled',
    'stream.completed',
  ])
  const [testing, setTesting] = useState<string | null>(null)

  function toggleEvent(event: WebhookEventType) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    )
    if (eventsError) setEventsError('')
  }

  function handleAdd() {
    if (!url.trim()) {
      setUrlError('URL is required')
      return
    }
    try {
      new URL(url.trim())
      setUrlError('')
    } catch {
      setUrlError('Please enter a valid webhook URL')
      return
    }
    if (selectedEvents.length === 0) {
      setEventsError('Select at least one event type')
      return
    }
    addWebhook(url.trim(), selectedEvents)
    setUrl('')
    toast.success('Webhook registered')
  }

  async function handleTest(id: string) {
    setTesting(id)
    try {
      const ok = await testWebhook(id)
      if (ok) toast.success('Test delivered successfully')
      else toast.error('Test delivery failed', { description: 'Check the URL and try again.' })
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Add webhook */}
      <div id="register-webhook" className="rounded-lg border border-border p-4 space-y-4">
        <h2 className="font-medium">Register a webhook</h2>

        <div className="space-y-1.5">
          <Label htmlFor="webhook-url">Webhook URL</Label>
          <Input
            id="webhook-url"
            type="url"
            placeholder="https://your-service.com/webhook"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              if (urlError) setUrlError('')
            }}
          />
          {urlError && <p className="text-sm text-destructive">{urlError}</p>}
        </div>

        <div className="space-y-2">
          <Label>Event types</Label>
          <div className="flex flex-wrap gap-2">
            {ALL_EVENTS.map((ev) => {
              const isSelected = selectedEvents.includes(ev.value)
              return (
                <button
                  key={ev.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleEvent(ev.value)}
                  className={
                    isSelected
                      ? 'rounded-full border border-primary bg-primary px-3 py-1 text-xs text-primary-foreground transition-colors'
                      : 'rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground'
                  }
                >
                  {ev.label}
                </button>
              )
            })}
          </div>
          {eventsError && <p className="text-sm text-destructive">{eventsError}</p>}
        </div>

        <Button onClick={handleAdd} className="gap-1.5">
          <Plus className="size-4" />
          Register webhook
        </Button>
      </div>

      {/* Registered webhooks */}
      <div className="space-y-3">
        <h2 className="font-medium">Registered webhooks</h2>
        {webhooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-secondary text-primary">
              <Webhook className="size-6" />
            </span>
            <h3 className="mt-4 font-medium">No webhooks registered yet</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground text-pretty">
              Register a webhook above to start receiving real-time event notifications for your streams.
            </p>
            <Button asChild className="mt-5 gap-1.5">
              <a href="#register-webhook">
                <Plus className="size-4" />
                Register your first webhook
              </a>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((hook) => (
              <div key={hook.id} className="rounded-lg border border-border p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-mono">{hook.url}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {hook.events
                      .map((e) => ALL_EVENTS.find((x) => x.value === e)?.label)
                      .join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={hook.enabled ? 'Disable' : 'Enable'}
                    onClick={() => toggleWebhook(hook.id)}
                  >
                    {hook.enabled ? (
                      <ToggleRight className="size-4 text-primary" />
                    ) : (
                      <ToggleLeft className="size-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Send test"
                    disabled={testing === hook.id}
                    onClick={() => handleTest(hook.id)}
                  >
                    <Send className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    aria-label="Remove"
                    onClick={() => removeWebhook(hook.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delivery history */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-medium">Recent deliveries</h2>
          <div className="rounded-lg border border-border divide-y divide-border">
            {history.slice(0, 20).map((d, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  {d.success ? (
                    <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="size-4 text-destructive shrink-0" />
                  )}
                  <span className="text-muted-foreground">{d.eventType}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground text-xs">
                  {d.statusCode && <span>{d.statusCode}</span>}
                  <span>{formatTimeAgo(d.deliveredAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
