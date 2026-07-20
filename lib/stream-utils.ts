import type { StreamData, StreamStatus } from '@/types/stream'

/**
 * Computes how much of the stream has unlocked as of `nowSeconds`.
 *
 * This is the client-side mirror of the contract's unlock math. It must use
 * the same multiply-then-divide over the raw `linearAmount`/`duration` that
 * `unlocked_amount` in lib.rs uses — NOT `amountPerSecond`, which is a
 * pre-divided, already-rounded rate and drifts from the on-chain value over
 * long-running streams. This is still only a visual approximation between
 * polls; withdraw amounts must come from `get_withdrawable` on-chain.
 */
export function getUnlockedAmount(
  stream: StreamData,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): bigint {
  const now = BigInt(nowSeconds)
  if (now < stream.cliffTime) return 0n
  if (now >= stream.endTime) return stream.depositedAmount

  const elapsed = now - stream.startTime
  const linear =
    elapsed > 0n && stream.duration > 0n ? (elapsed * stream.linearAmount) / stream.duration : 0n
  const unlocked = stream.cliffAmount + linear

  // Never report more than was deposited.
  return unlocked > stream.depositedAmount ? stream.depositedAmount : unlocked
}

/** Amount currently available for the recipient to withdraw. */
export function getWithdrawableAmount(stream: StreamData, nowSeconds?: number): bigint {
  const unlocked = getUnlockedAmount(stream, nowSeconds)
  const available = unlocked - stream.withdrawnAmount
  return available > 0n ? available : 0n
}

/** Amount still locked in the stream. */
export function getLockedAmount(stream: StreamData, nowSeconds?: number): bigint {
  return stream.depositedAmount - getUnlockedAmount(stream, nowSeconds)
}

export function getStreamStatus(
  stream: StreamData,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): StreamStatus {
  if (stream.cancelled) return 'cancelled'
  const now = BigInt(nowSeconds)
  if (now < stream.startTime) return 'scheduled'
  if (now >= stream.endTime) return 'completed'
  return 'streaming'
}

/** Progress (0–1) of unlocked vs deposited. */
export function getStreamProgress(stream: StreamData, nowSeconds?: number): number {
  if (stream.depositedAmount === 0n) return 0
  const unlocked = getUnlockedAmount(stream, nowSeconds)
  return clamp(Number((unlocked * 10000n) / stream.depositedAmount) / 10000, 0, 1)
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max)
}

/**
 * Formats a raw bigint amount (smallest unit) into a human-readable string,
 * respecting the token's decimals. Keeps full precision but trims trailing
 * zeros down to `maxFractionDigits`.
 */
export function formatTokenAmount(raw: bigint, decimals: number, maxFractionDigits = 4): string {
  const negative = raw < 0n
  const abs = negative ? -raw : raw
  const base = 10n ** BigInt(decimals)
  const whole = abs / base
  const frac = abs % base

  const wholeStr = whole.toLocaleString('en-US')

  if (decimals === 0 || maxFractionDigits === 0) {
    return `${negative ? '-' : ''}${wholeStr}`
  }

  let fracStr = frac.toString().padStart(decimals, '0').slice(0, maxFractionDigits)
  fracStr = fracStr.replace(/0+$/, '')

  return `${negative ? '-' : ''}${wholeStr}${fracStr ? '.' + fracStr : ''}`
}

/**
 * Formats a raw bigint amount into a compact human-readable string (e.g. "1.2K", "3.4M").
 */
export function formatCompactAmount(raw: bigint, decimals: number): string {
  const value = Number(raw) / Number(10n ** BigInt(decimals))
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

/** Parses a human-typed decimal string into a raw bigint of smallest units. */
export function parseTokenAmount(value: string, decimals: number): bigint {
  if (!value) return 0n
  const [whole, frac = ''] = value.replace(/,/g, '').split('.')
  const fracPadded = frac.slice(0, decimals).padEnd(decimals, '0')
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(fracPadded || '0')
}

export interface FormattedRate {
  perSecond: string
  perMinute: string
  perHour: string
  perDay: string
  perMonth: string
  perYear: string
  best: string
  bestUnit: string
}

export function formatRate(
  amountPerSecond: bigint,
  decimals: number,
  symbol: string,
): FormattedRate {
  const perSecond = Number(amountPerSecond) / 10 ** decimals

  const rates = {
    perSecond,
    perMinute: perSecond * 60,
    perHour: perSecond * 3600,
    perDay: perSecond * 86400,
    perMonth: perSecond * 2_592_000,
    perYear: perSecond * 31_536_000,
  }

  const fmt = (n: number) =>
    n >= 1
      ? n.toLocaleString('en-US', { maximumFractionDigits: 2 })
      : n.toPrecision(4).replace(/\.?0+$/, '')

  const units: { key: keyof typeof rates; label: string }[] = [
    { key: 'perMinute', label: '/min' },
    { key: 'perHour', label: '/hr' },
    { key: 'perDay', label: '/day' },
    { key: 'perMonth', label: '/mo' },
    { key: 'perYear', label: '/yr' },
  ]

  let bestUnit = '/day'
  let bestValue = rates.perDay
  for (const u of units) {
    if (rates[u.key] >= 0.01) {
      bestUnit = u.label
      bestValue = rates[u.key]
      break
    }
  }

  return {
    perSecond: `${fmt(rates.perSecond)} ${symbol}/s`,
    perMinute: `${fmt(rates.perMinute)} ${symbol}/min`,
    perHour: `${fmt(rates.perHour)} ${symbol}/hr`,
    perDay: `${fmt(rates.perDay)} ${symbol}/day`,
    perMonth: `${fmt(rates.perMonth)} ${symbol}/mo`,
    perYear: `${fmt(rates.perYear)} ${symbol}/yr`,
    best: `${fmt(bestValue)} ${symbol}${bestUnit}`,
    bestUnit,
  }
}

export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 2) return address
  return `${address.slice(0, chars + 1)}…${address.slice(-chars)}`
}

export function formatDateTime(unixSeconds: bigint | number): string {
  const ms = Number(unixSeconds) * 1000
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Returns a compact "2d 4h 13m" style duration from now until `target`. */
export function formatTimeRemaining(
  targetSeconds: bigint,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  let diff = Number(targetSeconds) - nowSeconds
  if (diff <= 0) return 'Ended'

  const days = Math.floor(diff / 86400)
  diff -= days * 86400
  const hours = Math.floor(diff / 3600)
  diff -= hours * 3600
  const minutes = Math.floor(diff / 60)
  const seconds = diff - minutes * 60

  const parts: string[] = []
  if (days) parts.push(`${days}d`)
  if (hours || days) parts.push(`${hours}h`)
  if (!days) parts.push(`${minutes}m`)
  if (!days && !hours) parts.push(`${seconds}s`)
  return parts.join(' ')
}
