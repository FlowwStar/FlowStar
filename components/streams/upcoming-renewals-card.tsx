'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  getUpcomingRenewals,
  removeRecurringRule,
  createRenewalPreset,
  type RecurringRule,
} from '@/lib/recurring'
import { formatTokenAmount, shortenAddress, formatDateTime } from '@/lib/stream-utils'
import { getFederationNameForAddress } from '@/lib/address-book'
import { getAllTokens } from '@/lib/stellar'
import { useNetwork } from '@/components/providers/network-provider'
import { createFormCopy } from '@/lib/copy/create-form'
import { dashboardCopy } from '@/lib/copy/dashboard'

const copy = dashboardCopy.upcomingRenewals

/**
 * Dashboard card listing recurring-stream rules due to renew soon (issue
 * #1145). `saveRecurringRule`/`getUpcomingRenewals` were already wired up and
 * tested from the create form's "Recurring cadence" option, but nothing in
 * the UI ever surfaced them — users had no way to see or act on an upcoming
 * renewal before now.
 *
 * Renders nothing when there are no upcoming renewals.
 */
export function UpcomingRenewalsCard() {
  const router = useRouter()
  const { network } = useNetwork()
  const [renewals, setRenewals] = useState<RecurringRule[]>([])

  const refresh = useCallback(() => {
    setRenewals(getUpcomingRenewals())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (renewals.length === 0) return null

  const tokens = getAllTokens(network)

  function handleRemove(streamId: string) {
    removeRecurringRule(streamId)
    refresh()
  }

  function handleCreateNow(rule: RecurringRule) {
    // `createRenewalPreset` both builds the prefill values and reschedules
    // this rule's `nextRunAt` from today, so acting on the renewal now
    // doesn't leave a stale, already-handled entry still due "soon".
    createRenewalPreset(
      {
        id: rule.streamId,
        recipient: rule.recipient,
        token: { symbol: rule.tokenSymbol },
        depositedAmount: BigInt(rule.amount),
      },
      rule.cadence,
    )
    refresh()

    const token = tokens.find((t) => t.symbol === rule.tokenSymbol)
    const params = new URLSearchParams({
      recipient: rule.recipient,
      // The create form's `amount` field is a human-readable decimal, while
      // RecurringRule stores raw smallest-unit amounts — convert using the
      // matched token's decimals when we can resolve one.
      amount: token
        ? (Number(BigInt(rule.amount)) / 10 ** token.decimals).toString()
        : rule.amount,
    })
    if (token) params.set('token', token.address)
    router.push(`/app/create?${params.toString()}`)
  }

  return (
    <Card data-testid="upcoming-renewals-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4" aria-hidden />
          {copy.title}
        </CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {renewals.map((rule) => {
          const federationName = getFederationNameForAddress(rule.recipient)
          const token = tokens.find((t) => t.symbol === rule.tokenSymbol)
          const amountLabel = token
            ? formatTokenAmount(BigInt(rule.amount), token.decimals, 2)
            : rule.amount
          const cadenceLabel = createFormCopy.scheduleSection.recurrenceOptions[rule.cadence]

          return (
            <div
              key={rule.streamId}
              data-testid="upcoming-renewal-row"
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/50 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {federationName ?? shortenAddress(rule.recipient)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {amountLabel} {rule.tokenSymbol} · {cadenceLabel} ·{' '}
                  {copy.nextRun(formatDateTime(Math.floor(rule.nextRunAt / 1000)))}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button size="sm" variant="outline" onClick={() => handleCreateNow(rule)}>
                  {copy.createNow}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={copy.removeAriaLabel}
                  onClick={() => handleRemove(rule.streamId)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
