import { describe, it, expect } from 'vitest'
import { toX, toY } from '@/components/streams/unlock-chart'

// Chart layout constants (must match unlock-chart.tsx)
const PADDING_LEFT = 64
const PADDING_TOP = 20
const CHART_W = 520 // 600 - 64 - 16
const CHART_H = 208 // 260 - 20 - 32

describe('toX', () => {
  const start = 1000n
  const end = 2000n

  it('returns PADDING.left at start boundary', () => {
    expect(toX(start, start, end)).toBe(PADDING_LEFT)
  })

  it('returns PADDING.left + CHART_W at end boundary', () => {
    expect(toX(end, start, end)).toBe(PADDING_LEFT + CHART_W)
  })

  it('returns midpoint pixel for midpoint time', () => {
    const mid = 1500n
    expect(toX(mid, start, end)).toBe(PADDING_LEFT + CHART_W / 2)
  })

  it('returns PADDING.left when duration is zero', () => {
    expect(toX(start, start, start)).toBe(PADDING_LEFT)
  })

  it('returns PADDING.left when duration is negative', () => {
    expect(toX(start, end, start)).toBe(PADDING_LEFT)
  })

  it('maps a quarter-way time correctly', () => {
    const quarterTime = 1250n
    expect(toX(quarterTime, start, end)).toBe(PADDING_LEFT + CHART_W * 0.25)
  })
})

describe('toY', () => {
  const total = 1000n

  it('returns bottom of chart (PADDING.top + CHART_H) at zero amount', () => {
    expect(toY(0n, total)).toBe(PADDING_TOP + CHART_H)
  })

  it('returns top of chart (PADDING.top) at full amount', () => {
    expect(toY(total, total)).toBe(PADDING_TOP)
  })

  it('returns midpoint pixel for half amount', () => {
    expect(toY(500n, total)).toBe(PADDING_TOP + CHART_H / 2)
  })

  it('returns bottom of chart when total is zero', () => {
    expect(toY(0n, 0n)).toBe(PADDING_TOP + CHART_H)
  })

  it('maps a quarter amount correctly', () => {
    expect(toY(250n, total)).toBe(PADDING_TOP + CHART_H * 0.75)
  })
})
