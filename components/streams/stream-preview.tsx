'use client'

import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { TokenInfo } from '@/types/stream'
import { formatTokenAmount, SECONDS_PER_DAY } from '@/lib/stream-utils'
import { createFormCopy as copy } from '@/lib/copy/create-form'

interface StreamPreviewProps {
  amount: string
  token: TokenInfo
  startDate: string
  endDate: string
  hasCliff: boolean
  cliffDate: string
  cliffAmount: string
}

function toUnix(dt: string): number {
  const ms = new Date(dt).getTime()
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0
}

function formatDuration(seconds: number): string {
  const { duration } = copy.streamPreview
  if (seconds <= 0) return duration.none
  const days = Math.floor(seconds / SECONDS_PER_DAY)
  const hours = Math.floor((seconds % SECONDS_PER_DAY) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (days > 0) parts.push(duration.days(days))
  if (hours > 0) parts.push(duration.hours(hours))
  if (minutes > 0 && days === 0) parts.push(duration.minutes(minutes))
  return parts.join(', ') || duration.belowOneMinute
}

const SVG_W = 280
const SVG_H = 80
const PAD = { left: 4, right: 4, top: 8, bottom: 4 }
const CW = SVG_W - PAD.left - PAD.right
const CH = SVG_H - PAD.top - PAD.bottom

export function StreamPreview({
  amount,
  token,
  startDate,
  endDate,
  hasCliff,
  cliffDate,
  cliffAmount,
}: StreamPreviewProps) {
  const preview = useMemo(() => {
    const totalNum = parseFloat(amount) || 0
    const startUnix = toUnix(startDate)
    const endUnix = toUnix(endDate)
    const durationSec = endUnix - startUnix

    if (totalNum <= 0 || durationSec <= 0) return null

    const cliffUnix = hasCliff ? toUnix(cliffDate) : startUnix
    const cliffAmt = hasCliff && cliffAmount ? parseFloat(cliffAmount) || 0 : 0
    const linearAmount = totalNum - cliffAmt

    const perSecond = durationSec > 0 ? linearAmount / durationSec : 0
    const perDay = perSecond * SECONDS_PER_DAY
    const perMonth = perSecond * 2592000
    const perHour = perSecond * 3600

    // Check for low rate (< 1 token/hour)
    const isLowRate = linearAmount > 0 && perHour < 1

    const cliffFracX = durationSec > 0 ? (cliffUnix - startUnix) / durationSec : 0
    const cliffFracY = totalNum > 0 ? cliffAmt / totalNum : 0

    const points: string[] = []
    const x0 = PAD.left
    const y0 = PAD.top + CH
    points.push(`${x0},${y0}`)

    if (hasCliff && cliffFracX > 0) {
      const cx = PAD.left + cliffFracX * CW
      points.push(`${cx},${y0}`)
      points.push(`${cx},${PAD.top + CH * (1 - cliffFracY)}`)
    }

    const endX = PAD.left + CW
    const endY = PAD.top
    points.push(`${endX},${endY}`)

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`).join(' ')

    return {
      durationSec,
      perDay,
      perMonth,
      perHour,
      isLowRate,
      cliffAmt,
      cliffDurationSec: hasCliff ? cliffUnix - startUnix : 0,
      linePath,
      totalNum,
    }
  }, [amount, token, startDate, endDate, hasCliff, cliffDate, cliffAmount])

  if (!preview) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-center text-sm text-muted-foreground">
        {copy.streamPreview.emptyState}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        {copy.streamPreview.title}
      </h2>

      {/* Low rate warning */}
      {preview.isLowRate && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{copy.streamPreview.lowRateWarning(preview.perHour.toFixed(6), token.symbol)}</span>
        </div>
      )}

      {/* Mini chart */}
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto" aria-hidden="true">
        <path
          d={preview.linePath + ` L${PAD.left + CW},${PAD.top + CH} L${PAD.left},${PAD.top + CH} Z`}
          fill="currentColor"
          className="text-primary/10"
        />
        <path
          d={preview.linePath}
          fill="none"
          stroke="currentColor"
          className="text-primary"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </svg>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">{copy.streamPreview.totalDurationLabel}</p>
          <p className="font-medium">{formatDuration(preview.durationSec)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{copy.streamPreview.unlockRateLabel}</p>
          <p className="font-mono font-medium">
            {preview.perHour < 0.01
              ? `${preview.perMonth.toFixed(4)} ${copy.streamPreview.perMonthSuffix}`
              : preview.perDay < 0.01
                ? `${preview.perHour.toFixed(4)} ${copy.streamPreview.perHourSuffix}`
                : `${preview.perDay.toFixed(2)} ${copy.streamPreview.perDaySuffix}`}
          </p>
        </div>
        {preview.cliffAmt > 0 && (
          <>
            <div>
              <p className="text-xs text-muted-foreground">{copy.streamPreview.cliffAmountLabel}</p>
              <p className="font-mono font-medium">
                {preview.cliffAmt.toLocaleString()} {token.symbol}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{copy.streamPreview.cliffWaitLabel}</p>
              <p className="font-medium">{formatDuration(preview.cliffDurationSec)}</p>
            </div>
          </>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">{copy.streamPreview.timelineLabel}</p>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded bg-secondary px-2 py-0.5 font-medium">
            {copy.streamPreview.startLabel}
          </span>
          {preview.cliffAmt > 0 && (
            <>
              <span className="text-muted-foreground">→</span>
              <span className="rounded bg-secondary px-2 py-0.5 font-medium">
                {copy.streamPreview.cliffLabel(formatDuration(preview.cliffDurationSec))}
              </span>
            </>
          )}
          <span className="text-muted-foreground">→</span>
          <span className="rounded bg-primary/10 text-primary px-2 py-0.5 font-medium">
            {copy.streamPreview.endLabel(formatDuration(preview.durationSec))}
          </span>
        </div>
      </div>
    </div>
  )
}
