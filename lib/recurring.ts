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

/**
 * Reads all recurring stream rules persisted in `localStorage`.
 *
 * Safe to call in SSR contexts — returns an empty array when `window` is
 * unavailable or when the stored value cannot be parsed.
 *
 * @returns Array of {@link RecurringRule} objects, or `[]` if none are stored.
 */
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

/**
 * Persists a recurring stream rule to `localStorage`, replacing any existing
 * rule for the same `streamId`.
 *
 * At most 25 rules are kept; the oldest entries are dropped when the list
 * exceeds that limit. No-ops in SSR environments.
 *
 * @param rule - The {@link RecurringRule} to save. An existing rule with the
 *               same `streamId` is overwritten.
 */
export function saveRecurringRule(rule: RecurringRule): void {
  if (typeof window === 'undefined') return
  const rules = getRecurringRules().filter((item) => item.streamId !== rule.streamId)
  rules.unshift(rule)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rules.slice(0, 25)))
}

/**
 * Removes the recurring rule associated with the given stream ID from
 * `localStorage`. No-ops if no matching rule exists or in SSR environments.
 *
 * @param streamId - The contract stream ID whose recurring rule should be
 *                   deleted.
 */
export function removeRecurringRule(streamId: string): void {
  if (typeof window === 'undefined') return
  const rules = getRecurringRules().filter((item) => item.streamId !== streamId)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

/**
 * Returns all recurring rules whose `nextRunAt` timestamp is in the future,
 * sorted in ascending order by `nextRunAt` (soonest renewal first).
 *
 * Rules whose `nextRunAt` is in the past (i.e. overdue or already processed)
 * are excluded. Use {@link getRecurringRules} to retrieve the full unfiltered
 * list.
 *
 * @returns Subset of stored rules that are pending renewal, ordered by
 *          scheduled time.
 */
export function getUpcomingRenewals(): RecurringRule[] {
  return getRecurringRules()
    .filter((rule) => rule.nextRunAt > Date.now())
    .sort((a, b) => a.nextRunAt - b.nextRunAt)
}

/**
 * Computes the next run timestamp for a recurring stream based on a starting
 * time and a recurrence cadence.
 *
 * **Cadence-to-duration mapping:**
 * - `"weekly"` — adds exactly 7 days (7 × 24 × 60 × 60 × 1000 ms). Fixed
 *   because weeks always have the same length.
 * - `"monthly"` — advances by 1 calendar month using `Date.setMonth()`, which
 *   respects varying month lengths. The original day-of-month is preserved
 *   where possible; if it doesn't exist in the target month (e.g. Jan 31 +
 *   1 month) the date is clamped to the last valid day (e.g. Feb 28/29).
 * - `"quarterly"` — same calendar-aware logic as monthly but advances by 3
 *   calendar months instead of 1.
 *
 * **Implementation note — avoiding month-overflow:** The day is temporarily
 * set to 1 before shifting months so that intermediate states like "Feb 31"
 * are never created (which would silently roll over into March). The original
 * day is re-applied afterward and clamped to the actual number of days in the
 * target month.
 *
 * @param startTime - Unix timestamp (ms) to calculate the next run from.
 * @param cadence   - Recurrence interval: `"weekly"`, `"monthly"`, or
 *                    `"quarterly"`.
 * @returns Unix timestamp (ms) of the next scheduled run.
 *
 * @example
 * // Weekly: exactly 7 days later
 * buildNextRunAt(Date.now(), 'weekly');
 *
 * // Monthly: same day next month (or last day of month if it doesn't exist)
 * buildNextRunAt(new Date('2025-01-31').getTime(), 'monthly');
 * // → 2025-02-28T00:00:00.000 (clamped — Feb has no 31st)
 */
export function buildNextRunAt(startTime: number, cadence: Exclude<RecurrenceCadence, 'none'>): number {
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

/**
 * Builds a new {@link RecurringRule} preset from an existing stream and
 * immediately persists it via {@link saveRecurringRule}.
 *
 * The `nextRunAt` timestamp is calculated from `Date.now()` using
 * {@link buildNextRunAt}, and `lastCreatedAt` is set to the current time.
 *
 * @param stream  - Minimal stream data needed to populate the rule: the
 *                  stream's `id`, `recipient`, `token.symbol`, and
 *                  `depositedAmount`.
 * @param cadence - How often the stream should renew: `"weekly"`,
 *                  `"monthly"`, or `"quarterly"`.
 * @returns The newly created and saved {@link RecurringRule}.
 */
export function createRenewalPreset(stream: { id: string; recipient: string; token: { symbol: string }; depositedAmount: bigint }, cadence: Exclude<RecurrenceCadence, 'none'>): RecurringRule {
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
