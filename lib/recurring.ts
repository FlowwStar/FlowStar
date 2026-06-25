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
  const ms = { weekly: 7, monthly: 30, quarterly: 90 }[cadence] * 24 * 60 * 60 * 1000
  return startTime + ms
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
