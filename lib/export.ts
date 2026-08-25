import type { StreamData } from '@/types/stream'
import { formatTokenAmount, getStreamStatus, SECONDS_PER_DAY } from '@/lib/stream-utils'

const SECONDS_PER_DAY_BIGINT = BigInt(SECONDS_PER_DAY)
const DAYS_PER_MONTH = BigInt(30)

function unixToISO(seconds: bigint): string {
  if (seconds === BigInt(0)) return ''
  return new Date(Number(seconds) * 1000).toISOString()
}

function escapeCSV(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function row(values: string[]): string {
  return values.map(escapeCSV).join(',')
}

const HEADERS = [
  'Stream ID',
  'Status',
  'Sender',
  'Recipient',
  'Token',
  'Token Address',
  'Total Amount',
  'Withdrawn Amount',
  'Remaining Amount',
  'Start Date',
  'End Date',
  'Cliff Date',
  'Cliff Amount',
  'Rate (per day)',
  'Rate (per month)',
]

/**
 * Convert streams to CSV with identity, token, amount, date, cliff, and rate columns.
 * A zero cliff time or cliff amount is represented by an empty CSV field.
 */
export function streamsToCSV(
  streams: StreamData[],
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const lines: string[] = [HEADERS.join(',')]

  for (const s of streams) {
    const { decimals, symbol } = s.token
    const status = getStreamStatus(s, nowSeconds)
    const remaining = s.depositedAmount - s.withdrawnAmount

    const ratePerDay = formatTokenAmount(s.amountPerSecond * SECONDS_PER_DAY_BIGINT, decimals, 6)
    const ratePerMonth = formatTokenAmount(
      s.amountPerSecond * SECONDS_PER_DAY_BIGINT * DAYS_PER_MONTH,
      decimals,
      6,
    )

    lines.push(
      row([
        s.id,
        status,
        s.sender,
        s.recipient,
        symbol,
        s.token.address,
        formatTokenAmount(s.depositedAmount, decimals, 6),
        formatTokenAmount(s.withdrawnAmount, decimals, 6),
        formatTokenAmount(remaining > BigInt(0) ? remaining : BigInt(0), decimals, 6),
        unixToISO(s.startTime),
        unixToISO(s.endTime),
        s.cliffTime > s.startTime ? unixToISO(s.cliffTime) : '',
        s.cliffAmount > BigInt(0) ? formatTokenAmount(s.cliffAmount, decimals, 6) : '',
        ratePerDay,
        ratePerMonth,
      ]),
    )
  }

  return lines.join('\n')
}

/** Download CSV content as a file in the browser. */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
