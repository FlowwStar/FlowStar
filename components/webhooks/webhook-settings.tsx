'use client'

import { useState } from 'react'
import { Plus, Trash2, ToggleLeft, ToggleRight, Send, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useWebhooks, type WebhookEventType } from '@/hooks/use-webhooks'

const ALL_EVENTS: { value: WebhookEventType; label: string }[] = [
  { value: 'stream.created', label: 'Stream Created' },
  { value: 'stream.withdrawal', label: 'Withdrawal' },
  { value: 'stream.cancelled', label: 'Cancelled' },
  { value: 'stream.completed', label: 'Completed' },
  { value: 'stream.topped_up', label: 'Topped Up' },
  { value: 'stream.transferred', label: 'Transferred' },
]

function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export function WebhookSettings() {
  const { webhooks, history, addWebhook, removeWebhook, toggleWebhook, testWebhook } =
    useWebhooks()

  const [url, setUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>([
    'stream.created',
    'stream.withdrawal',
    'stream.cancelled',
    'stream.completed',
  ])
  const [testing, setTesting] = useState<string | null>(null)

  function toggleEvent(event: WebhookEventType) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    )
  }

  function handleAdd() {
    if (!url.trim()) return
    try {
      new URL(url.trim())
    } catch {
      toast.error('Invalid URL', { description: 'Please enter a valid webhook URL.' })
      return
    }
    if (selectedEvents.length === 0) {
      toast.error('Select at least one event type.')
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
      <div className="rounded-lg border border-border p-4 space-y-4">
        <h2 className="font-medium">Register a webhook</h2>

        <div className="space-y-1.5">
          <Label htmlFor="webhook-url">Webhook URL</Label>
          <Input
            id="webhook-url"
            type="url"
            placeholder="https://your-service.com/webhook"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Event types</Label>
          <div className="flex flex-wrap gap-2">
            {ALL_EVENTS.map((ev) => (
              <button
                key={ev.value}
                type="button"
                onClick={() => toggleEvent(ev.value)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  selectedEvents.includes(ev.value)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-foreground'
                }`}
              >
                {ev.label}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleAdd} className="gap-1.5">
          <Plus className="size-4" />
          Register webhook
        </Button>
      </div>

      {/* Registered webhooks */}
      {webhooks.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-medium">Registered webhooks</h2>
          {webhooks.map((hook) => (
            <div key={hook.id} className="rounded-lg border border-border p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-mono">{hook.url}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {hook.events.map((e) => ALL_EVENTS.find((x) => x.value === e)?.label).join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    title={hook.enabled ? 'Disable' : 'Enable'}
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
                    title="Send test"
                    disabled={testing === hook.id}
                    onClick={() => handleTest(hook.id)}
                  >
                    <Send className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    title="Remove"
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
                  <span>{formatRelative(d.deliveredAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
