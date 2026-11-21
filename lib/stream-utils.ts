import type { StreamData, StreamStatus } from '@/types/stream'

/** Seconds in one day — shared constant for all per-day calculations. */
export const SECONDS_PER_DAY = 86400

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
  // Cancelled streams stop accruing the instant they're cancelled, but the
  // contract doesn't record a `cancelled_at` timestamp (tracked separately),
  // so there's no cliff/linear math we can still run here. The only
  // known-correct, stable figure left is what the recipient actually
  // withdrew — using it freezes the displayed total instead of letting the
  // multiply/divide below keep advancing with wall-clock time (#1147, #1148).
  if (stream.cancelled) return stream.withdrawnAmount

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

/**
 * Derives the current lifecycle status of a stream (cancelled, scheduled, completed, or streaming)
 * based on its start/end times and cancelled flag relative to `nowSeconds`.
 */
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

/** Thrown by `parseTokenAmount` for negative, malformed, or otherwise invalid input. */
export class InvalidTokenAmountError extends Error {
  constructor(value: string) {
    super(`Invalid token amount: "${value}"`)
    this.name = 'InvalidTokenAmountError'
  }
}

/**
 * Parses a human-typed decimal string into a raw bigint of smallest units.
 *
 * Strips commas/whitespace, then validates against a strict unsigned-decimal
 * shape before any `BigInt` conversion — negative signs, scientific notation
 * (`1e5`), multiple decimal points (`1.2.3`), and other non-numeric input are
 * rejected with a typed error rather than silently producing a wrongly-signed
 * amount or throwing a raw `SyntaxError` from `BigInt`.
 */
export function parseTokenAmount(value: string, decimals: number): bigint {
  if (!value) return 0n
  const normalized = value.replace(/[,\s]/g, '')
  if (normalized === '' || !/^\d*(\.\d*)?$/.test(normalized) || normalized === '.') {
    throw new InvalidTokenAmountError(value)
  }

  const [whole, frac = ''] = normalized.split('.')
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

/**
 * Calculates and formats streaming unlock rates across multiple timeframes
 * (second, minute, hour, day, month, year) and selects a human-friendly "best" unit.
 *
 * Rates are derived from the raw `linearAmount`/`duration` pair — the same
 * multiply-then-divide bigint math `getUnlockedAmount` uses — rather than the
 * pre-divided, already-rounded `amountPerSecond`, which drifts from the
 * on-chain value over long-running streams. The bigint ratio is only
 * converted to `Number` for the final formatted value, to avoid losing
 * sub-unit precision.
 */
export function formatRate(
  linearAmount: bigint,
  duration: bigint,
  decimals: number,
  symbol: string,
): FormattedRate {
  // Extra fixed-point precision kept through the bigint division so the
  // conversion to Number at the end doesn't truncate sub-smallest-unit rates.
  const PRECISION = 1_000_000n
  const scale = 10n ** BigInt(decimals)

  const rateFor = (unitSeconds: bigint): number => {
    if (duration <= 0n) return 0
    const scaled = (linearAmount * unitSeconds * PRECISION) / duration
    return Number(scaled) / Number(PRECISION) / Number(scale)
  }

  const rates = {
    perSecond: rateFor(1n),
    perMinute: rateFor(60n),
    perHour: rateFor(3600n),
    perDay: rateFor(BigInt(SECONDS_PER_DAY)),
    perMonth: rateFor(2_592_000n),
    perYear: rateFor(31_536_000n),
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

/**
 * Truncates a Stellar public address or contract ID to a compact display format (e.g. "GABC…WXYZ").
 */
export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 2) return address
  return `${address.slice(0, chars + 1)}…${address.slice(-chars)}`
}

/**
 * Formats a Unix timestamp in seconds to a human-readable date and time string in en-US locale.
 */
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

/** Returns "just now", "Xm ago", "Xh ago", "Xd ago", or a locale date for timestamps older than 7 days. */
export function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(timestamp).toLocaleDateString()
}

/** Returns a compact "2d 4h 13m" style duration from now until `target`. */
export function formatTimeRemaining(
  targetSeconds: bigint,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  let diff = Number(targetSeconds) - nowSeconds
  if (diff <= 0) return 'Ended'

  const days = Math.floor(diff / SECONDS_PER_DAY)
  diff -= days * SECONDS_PER_DAY
  const hours = Math.floor(diff / 3600)
  diff -= hours * 3600
  const minutes = Math.floor(diff / 60)
  const seconds = diff - minutes * 60

  const parts: string[] = []
  if (days) parts.push(`${days}d`)
  if (hours || days) parts.push(`${hours}h`)
  if (!days && (minutes || hours)) parts.push(`${minutes}m`)
  if (!days && !hours) parts.push(`${seconds}s`)
  return parts.join(' ')
}
