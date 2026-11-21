'use client'

import { useMemo } from 'react'
import type { StreamData } from '@/types/stream'
import { formatTokenAmount, SECONDS_PER_DAY } from '@/lib/stream-utils'

interface UnlockChartProps {
  stream: StreamData
  nowSeconds: number
  className?: string
}

interface Point {
  x: number
  y: number
}

const PADDING = { top: 20, right: 16, bottom: 32, left: 64 }
const WIDTH = 600
const HEIGHT = 260
const CHART_W = WIDTH - PADDING.left - PADDING.right
const CHART_H = HEIGHT - PADDING.top - PADDING.bottom

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t))
}

export function toX(time: bigint, start: bigint, end: bigint): number {
  const duration = Number(end - start)
  if (duration <= 0) return PADDING.left
  return PADDING.left + (Number(time - start) / duration) * CHART_W
}

export function toY(amount: bigint, total: bigint): number {
  if (total <= 0n) return PADDING.top + CHART_H
  const frac = Number(amount) / Number(total)
  return PADDING.top + CHART_H * (1 - frac)
}

function formatAxisTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function UnlockChart({ stream, nowSeconds, className }: UnlockChartProps) {
  const { unlockPath, withdrawnPath, nowPoint, hasCliff, yTicks, xTicks } = useMemo(() => {
    const { startTime, endTime, cliffTime, cliffAmount, depositedAmount, amountPerSecond, withdrawnAmount } = stream
    const start = startTime
    const end = endTime
    const total = depositedAmount

    const unlockPoints: Point[] = []
    const withdrawnPoints: Point[] = []

    unlockPoints.push({ x: toX(start, start, end), y: toY(0n, total) })

    const cliff = cliffTime > start
    if (cliff) {
      unlockPoints.push({ x: toX(cliffTime, start, end), y: toY(0n, total) })
      unlockPoints.push({ x: toX(cliffTime, start, end), y: toY(cliffAmount, total) })
    }

    const linearStart = cliff ? cliffTime : start
    const linearStartAmount = cliff ? cliffAmount : 0n
    unlockPoints.push({ x: toX(linearStart, start, end), y: toY(linearStartAmount, total) })
    unlockPoints.push({ x: toX(end, start, end), y: toY(total, total) })

    const now = BigInt(nowSeconds)
    let currentUnlocked = 0n
    if (now < cliffTime) {
      currentUnlocked = 0n
    } else if (now >= end) {
      currentUnlocked = total
    } else {
      const elapsed = now - start
      const linear = elapsed > 0n ? elapsed * amountPerSecond : 0n
      currentUnlocked = cliffAmount + linear
      if (currentUnlocked > total) currentUnlocked = total
    }

    const nowX = toX(now < start ? start : now > end ? end : now, start, end)
    const nowY = toY(currentUnlocked, total)
    const nowPt: Point | null =
      now >= start && now <= end ? { x: nowX, y: nowY } : null

    const wFrac = total > 0n ? Number(withdrawnAmount) / Number(total) : 0
    const withdrawnHeight = wFrac * CHART_H

    const wPoints: Point[] = []
    if (withdrawnAmount > 0n && now >= start) {
      const wEndX = nowPt ? nowPt.x : toX(end, start, end)
      const baseY = PADDING.top + CHART_H
      const topY = baseY - withdrawnHeight
      wPoints.push({ x: PADDING.left, y: baseY })
      wPoints.push({ x: PADDING.left, y: topY })
      wPoints.push({ x: wEndX, y: topY })
      wPoints.push({ x: wEndX, y: baseY })
    }

    const yTickCount = 4
    const yTickValues: bigint[] = []
    for (let i = 0; i <= yTickCount; i++) {
      yTickValues.push((total * BigInt(i)) / BigInt(yTickCount))
    }

    const startNum = Number(start)
    const endNum = Number(end)
    const duration = endNum - startNum
    const xTickCount = Math.min(4, Math.max(2, Math.floor(duration / SECONDS_PER_DAY)))
    const xTickValues: number[] = []
    for (let i = 0; i <= Math.min(xTickCount, 4); i++) {
      xTickValues.push(startNum + (duration * i) / Math.min(xTickCount, 4))
    }

    return {
      unlockPath: unlockPoints,
      withdrawnPath: wPoints,
      nowPoint: nowPt,
      hasCliff: cliff,
      yTicks: yTickValues,
      xTicks: xTickValues,
    }
  }, [stream, nowSeconds])

  const unlockD = unlockPath
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
    .join(' ')

  const areaD =
    unlockD +
    ` L${PADDING.left + CHART_W},${PADDING.top + CHART_H} L${PADDING.left},${PADDING.top + CHART_H} Z`

  const withdrawnD =
    withdrawnPath.length > 0
      ? withdrawnPath.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'
      : ''

  return (
    <div className={className}>
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Unlock schedule
      </h2>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Unlock schedule chart for stream #${stream.id}`}
      >
        {/* Grid lines */}
        {yTicks.map((val, i) => {
          const y = toY(val, stream.depositedAmount)
          return (
            <line
              key={`yg-${i}`}
              x1={PADDING.left}
              y1={y}
              x2={PADDING.left + CHART_W}
              y2={y}
              stroke="currentColor"
              className="text-border"
              strokeWidth={0.5}
            />
          )
        })}

        {/* Unlock area fill */}
        <path d={areaD} fill="currentColor" className="text-primary/10" />

        {/* Withdrawn area */}
        {withdrawnD && (
          <path d={withdrawnD} fill="currentColor" className="text-primary/25" />
        )}

        {/* Unlock curve line */}
        <path
          d={unlockD}
          fill="none"
          stroke="currentColor"
          className="text-primary"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Cliff indicator */}
        {hasCliff && (
          <line
            x1={toX(stream.cliffTime, stream.startTime, stream.endTime)}
            y1={PADDING.top}
            x2={toX(stream.cliffTime, stream.startTime, stream.endTime)}
            y2={PADDING.top + CHART_H}
            stroke="currentColor"
            className="text-muted-foreground"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}

        {/* Current position dot */}
        {nowPoint && (
          <>
            <line
              x1={nowPoint.x}
              y1={PADDING.top}
              x2={nowPoint.x}
              y2={PADDING.top + CHART_H}
              stroke="currentColor"
              className="text-primary/40"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle
              cx={nowPoint.x}
              cy={nowPoint.y}
              r={5}
              fill="currentColor"
              className="text-primary"
            />
            <circle
              cx={nowPoint.x}
              cy={nowPoint.y}
              r={8}
              fill="none"
              stroke="currentColor"
              className="text-primary/40"
              strokeWidth={2}
            />
          </>
        )}

        {/* Y-axis labels */}
        {yTicks.map((val, i) => (
          <text
            key={`yl-${i}`}
            x={PADDING.left - 8}
            y={toY(val, stream.depositedAmount) + 4}
            textAnchor="end"
            className="fill-muted-foreground"
            fontSize={10}
          >
            {formatTokenAmount(val, stream.token.decimals, 0)}
          </text>
        ))}

        {/* X-axis labels */}
        {xTicks.map((val, i) => (
          <text
            key={`xl-${i}`}
            x={lerp(
              PADDING.left,
              PADDING.left + CHART_W,
              i / (xTicks.length - 1),
            )}
            y={HEIGHT - 6}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={10}
          >
            {formatAxisTime(val)}
          </text>
        ))}

        {/* Cliff label */}
        {hasCliff && (
          <text
            x={toX(stream.cliffTime, stream.startTime, stream.endTime)}
            y={PADDING.top - 6}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={9}
          >
            Cliff
          </text>
        )}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-primary" />
          Unlocked
        </span>
        {stream.withdrawnAmount > 0n && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full bg-primary/40" />
            Withdrawn
          </span>
        )}
        {hasCliff && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-3 border-t-2 border-dashed border-muted-foreground" />
            Cliff
          </span>
        )}
      </div>
    </div>
  )
}
