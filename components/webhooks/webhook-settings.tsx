'use client'

import { useState } from 'react'
import {
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Send,
  CheckCircle2,
  XCircle,
  Webhook,
  RotateCcw,
  Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatTimeAgo } from '@/lib/stream-utils'
import { downloadCSV, downloadJSON, webhookHistoryToCSV } from '@/lib/export'
import { useWebhooks, type WebhookEventType } from '@/hooks/use-webhooks'
import { settingsCopy } from '@/lib/copy/settings'

const ALL_EVENTS: { value: WebhookEventType; label: string }[] = [
  { value: 'stream.created', label: settingsCopy.webhooks.eventLabels.streamCreated },
  { value: 'stream.withdrawal', label: settingsCopy.webhooks.eventLabels.withdrawal },
  { value: 'stream.cancelled', label: settingsCopy.webhooks.eventLabels.cancelled },
  { value: 'stream.completed', label: settingsCopy.webhooks.eventLabels.completed },
  { value: 'stream.topped_up', label: settingsCopy.webhooks.eventLabels.toppedUp },
  { value: 'stream.transferred', label: settingsCopy.webhooks.eventLabels.transferred },
]

export function WebhookSettings() {
  // Issue #677: surface webhook-config save failures instead of letting
  // localStorage.setItem throw uncaught / fail silently.
  const { webhooks, history, addWebhook, removeWebhook, toggleWebhook, testWebhook, resendDelivery } = useWebhooks(
    () =>
      toast.warning(settingsCopy.webhooks.toasts.storageWarningTitle, {
        description: settingsCopy.webhooks.toasts.storageWarningDescription,
      }),
  )

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
  const [resending, setResending] = useState<number | null>(null)
  const [newSecret, setNewSecret] = useState<string | null>(null)

  function toggleEvent(event: WebhookEventType) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    )
    if (eventsError) setEventsError('')
  }

  function handleAdd() {
    if (!url.trim()) {
      setUrlError(settingsCopy.webhooks.validation.urlRequired)
      return
    }
    try {
      new URL(url.trim())
      setUrlError('')
    } catch {
      setUrlError(settingsCopy.webhooks.validation.urlInvalid)
      return
    }
    if (selectedEvents.length === 0) {
      setEventsError(settingsCopy.webhooks.validation.eventsRequired)
      return
    }
    const secret = addWebhook(url.trim(), selectedEvents)
    setUrl('')
    setNewSecret(secret)
    toast.success(settingsCopy.webhooks.toasts.registeredTitle, {
      description: settingsCopy.webhooks.toasts.registeredDescription,
    })
  }

  async function handleTest(id: string) {
    setTesting(id)
    try {
      const ok = await testWebhook(id)
      if (ok) toast.success(settingsCopy.webhooks.toasts.testSuccess)
      else toast.error(settingsCopy.webhooks.toasts.testFailedTitle, { description: settingsCopy.webhooks.toasts.testFailedDescription })
    } finally {
      setTesting(null)
    }
  }

  async function handleResend(index: number) {
    setResending(index)
    try {
      const ok = await resendDelivery(history[index])
      if (ok) toast.success(settingsCopy.webhooks.toasts.resendSuccess)
      else toast.error(settingsCopy.webhooks.toasts.resendFailedTitle, { description: settingsCopy.webhooks.toasts.resendFailedDescription })
    } finally {
      setResending(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Add webhook */}
      <div id="register-webhook" className="rounded-lg border border-border p-4 space-y-4">
        <h2 className="font-medium">{settingsCopy.webhooks.register.title}</h2>

        <div className="space-y-1.5">
          <Label htmlFor="webhook-url">{settingsCopy.webhooks.register.urlLabel}</Label>
          <Input
            id="webhook-url"
            type="url"
            placeholder={settingsCopy.webhooks.register.urlPlaceholder}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              if (urlError) setUrlError('')
            }}
          />
          {urlError && <p className="text-sm text-destructive">{urlError}</p>}
        </div>

        <div className="space-y-2">
          <Label>{settingsCopy.webhooks.register.eventsLabel}</Label>
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
          {settingsCopy.webhooks.register.button}
        </Button>

        {newSecret && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-1.5">
            <p className="text-sm font-medium">{settingsCopy.webhooks.secret.title}</p>
            <p className="text-xs text-muted-foreground">
              {settingsCopy.webhooks.secret.description}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
                {newSecret}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(newSecret)
                  toast.success(settingsCopy.webhooks.secret.copiedToast)
                }}
              >
                {settingsCopy.webhooks.secret.copyButton}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setNewSecret(null)}>
                {settingsCopy.webhooks.secret.dismissButton}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Registered webhooks */}
      <div className="space-y-3">
        {webhooks.length > 0 && <h2 className="font-medium">{settingsCopy.webhooks.registered.title}</h2>}
        {webhooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-secondary text-primary">
              <Webhook className="size-6" />
            </span>
            <h3 className="mt-4 font-medium">{settingsCopy.webhooks.registered.emptyTitle}</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground text-pretty">
              {settingsCopy.webhooks.registered.emptyDescription}
            </p>
            <Button nativeButton={false} asChild className="mt-5 gap-1.5">
              <a href="#register-webhook">
                <Plus className="size-4" />
                {settingsCopy.webhooks.registered.emptyButton}
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
                      aria-label={hook.enabled ? settingsCopy.webhooks.registered.toggleDisableAria : settingsCopy.webhooks.registered.toggleEnableAria}
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
                      aria-label={settingsCopy.webhooks.registered.sendTestAria}
                      disabled={testing === hook.id}
                      onClick={() => handleTest(hook.id)}
                    >
                      <Send className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      aria-label={settingsCopy.webhooks.registered.removeAria}
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
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium">{settingsCopy.webhooks.history.title}</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto gap-1.5 px-2 py-1 text-xs text-muted-foreground"
                onClick={() =>
                  downloadCSV(webhookHistoryToCSV(history), 'flowstar-webhook-history.csv')
                }
              >
                <Download className="size-3.5" />
                {settingsCopy.webhooks.history.exportCsv}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto gap-1.5 px-2 py-1 text-xs text-muted-foreground"
                onClick={() => downloadJSON(history, 'flowstar-webhook-history.json')}
              >
                <Download className="size-3.5" />
                {settingsCopy.webhooks.history.exportJson}
              </Button>
            </div>
          </div>
          <div className="rounded-lg border border-border divide-y divide-border">
            {history.slice(0, 20).map((d, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {d.success ? (
                    <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="size-4 text-destructive shrink-0" />
                  )}
                  <span className="truncate text-muted-foreground">{d.eventType}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-muted-foreground text-xs">
                  {d.statusCode && <span>{d.statusCode}</span>}
                  <span>{formatTimeAgo(d.deliveredAt)}</span>
                  {!d.success && d.payload && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      aria-label={settingsCopy.webhooks.history.resendAria}
                      disabled={resending === i}
                      onClick={() => handleResend(i)}
                    >
                      <RotateCcw className={`size-3.5${resending === i ? ' animate-spin' : ''}`} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
