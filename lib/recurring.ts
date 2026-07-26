export type RecurrenceCadence = 'none' | 'weekly' | 'monthly' | 'quarterly'

export interface RecurringRule {
  cadence: Exclude<RecurrenceCadence, 'none'>
  nextRunAt: number
  lastCreatedAt: number
  streamId: string
  recipient: string
  tokenSymbol: string
  amount: string
}

const STORAGE_KEY = 'flowstar:recurring-streams'

export function getRecurringRules(): RecurringRule[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecurringRule[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveRecurringRule(rule: RecurringRule) {
  if (typeof window === 'undefined') return
  const rules = getRecurringRules().filter((item) => item.streamId !== rule.streamId)
  rules.unshift(rule)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rules.slice(0, 25)))
}

export function removeRecurringRule(streamId: string) {
  if (typeof window === 'undefined') return
  const rules = getRecurringRules().filter((item) => item.streamId !== streamId)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

export function getUpcomingRenewals(): RecurringRule[] {
  return getRecurringRules()
    .filter((rule) => rule.nextRunAt > Date.now())
    .sort((a, b) => a.nextRunAt - b.nextRunAt)
}

export function buildNextRunAt(startTime: number, cadence: Exclude<RecurrenceCadence, 'none'>) {
  if (cadence === 'weekly') {
    return startTime + 7 * 24 * 60 * 60 * 1000
  }

  // 'monthly' and 'quarterly' use real calendar-month arithmetic instead of
  // fixed day counts so renewal dates don't drift across months of varying
  // length (e.g. Feb, or 31-day months).
  const monthsToAdd = cadence === 'monthly' ? 1 : 3
  const date = new Date(startTime)
  const originalDay = date.getDate()

  date.setDate(1) // avoid month-length overflow while shifting months
  date.setMonth(date.getMonth() + monthsToAdd)

  // Clamp to the last day of the target month if the original day doesn't
  // exist there (e.g. Jan 31 + 1 month -> Feb 28/29, not Mar 3).
  const daysInTargetMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(originalDay, daysInTargetMonth))

  return date.getTime()
}

export function createRenewalPreset(stream: { id: string; recipient: string; token: { symbol: string }; depositedAmount: bigint }, cadence: Exclude<RecurrenceCadence, 'none'>) {
  const preset = {
    streamId: stream.id,
    recipient: stream.recipient,
    tokenSymbol: stream.token.symbol,
    amount: stream.depositedAmount.toString(),
    cadence,
    nextRunAt: buildNextRunAt(Date.now(), cadence),
    lastCreatedAt: Date.now(),
  }
  saveRecurringRule({ ...preset, streamId: preset.streamId })
  return preset
}
