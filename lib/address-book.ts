export interface AddressBookEntry {
  id: string
  label: string
  address: string
  lastUsed: number
  /** Federation address (e.g. `alice*stellarx.com`) this `address` resolved from, if any. */
  federationAddress?: string
}

const STORAGE_KEY = 'flowstar:address-book'

function readEntries(): AddressBookEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored) as AddressBookEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeEntries(entries: AddressBookEntry[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 50)))
}

/**
 * Returns all address book entries stored in `localStorage`, sorted by most
 * recently used first (`lastUsed` descending).
 *
 * Safe to call in SSR contexts — returns an empty array when `window` is
 * unavailable or when the stored value cannot be parsed.
 *
 * @returns Array of {@link AddressBookEntry} objects ordered by recency.
 */
export function getAddressBookEntries(): AddressBookEntry[] {
  return readEntries().sort((a, b) => b.lastUsed - a.lastUsed)
}

/**
 * Adds a new entry to the address book, or replaces an existing entry that
 * shares the same `address`.
 *
 * A unique `id` and a `lastUsed` timestamp (set to `Date.now()`) are
 * generated automatically. `label` and `address` are trimmed; an empty or
 * missing `federationAddress` is stored as `undefined`. At most 50 entries
 * are kept — older duplicates for the same address are removed first.
 *
 * @param entry - New entry data. `id` and `lastUsed` are generated
 *                automatically and must not be supplied.
 * @returns The fully populated {@link AddressBookEntry} that was persisted.
 */
export function addAddressBookEntry(entry: Omit<AddressBookEntry, 'id' | 'lastUsed'>) {
  const entries = readEntries()
  const normalized = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: entry.label.trim(),
    address: entry.address.trim(),
    lastUsed: Date.now(),
    federationAddress: entry.federationAddress?.trim() || undefined,
  }
  const next = [normalized, ...entries.filter((item) => item.address !== normalized.address)].slice(0, 50)
  writeEntries(next)
  return normalized
}

/**
 * Applies a partial update to an existing address book entry identified by
 * `id`. Only the fields present in `patch` are changed; all other fields
 * remain as-is.
 *
 * @param id    - The unique entry ID to update.
 * @param patch - Partial fields to merge into the existing entry. `id` cannot
 *                be changed.
 * @returns The updated {@link AddressBookEntry} if found, or `null` if no
 *          entry with the given `id` exists.
 */
export function updateAddressBookEntry(id: string, patch: Partial<Omit<AddressBookEntry, 'id'>>) {
  const entries = readEntries()
  const next = entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
  writeEntries(next)
  return next.find((entry) => entry.id === id) ?? null
}

/**
 * Permanently removes the address book entry with the given `id` from
 * `localStorage`. No-ops silently if no matching entry exists.
 *
 * @param id - The unique ID of the entry to delete.
 */
export function deleteAddressBookEntry(id: string) {
  const entries = readEntries().filter((entry) => entry.id !== id)
  writeEntries(entries)
}

/**
 * Updates `lastUsed` (and optionally `label` / `federationAddress`) for an
 * existing entry that matches `address`, or creates a new entry if none is
 * found.
 *
 * This is the preferred way to record a recently used address — callers do
 * not need to know whether the address is already in the book.
 *
 * - If a matching entry exists: `lastUsed` is set to now; `label` and
 *   `federationAddress` are overwritten only when non-empty values are
 *   provided.
 * - If no match exists and `address` is non-empty: a new entry is created via
 *   {@link addAddressBookEntry} with `label` defaulting to
 *   `"Saved recipient"`.
 * - If `address` is blank: returns `null` without modifying storage.
 *
 * @param address           - Stellar G-address to touch.
 * @param label             - Optional display label to update or use for the
 *                            new entry.
 * @param federationAddress - Optional Federation address (e.g.
 *                            `alice*stellarx.com`) associated with this
 *                            account.
 * @returns The upserted {@link AddressBookEntry}, or `null` if the address
 *          was blank.
 */
export function touchAddressBookEntry(address: string, label?: string, federationAddress?: string) {
  const entries = readEntries()
  const existing = entries.find((entry) => entry.address === address)
  if (existing) {
    const next = entries.map((entry) =>
      entry.address === address
        ? {
            ...entry,
            label: label?.trim() || entry.label,
            lastUsed: Date.now(),
            federationAddress: federationAddress?.trim() || entry.federationAddress,
          }
        : entry,
    )
    writeEntries(next)
    return next.find((entry) => entry.address === address) ?? null
  }
  if (!address.trim()) return null
  return addAddressBookEntry({ label: label?.trim() || 'Saved recipient', address, federationAddress })
}

/**
 * Reverse Federation lookup: returns the Federation name previously resolved
 * for `address` (stored in the address book when it was first looked up),
 * or `null` if this G-address has no known Federation name.
 *
 * This mirrors what real reverse-Federation lookups do in practice — the
 * protocol has no universal "resolve name for account" endpoint without
 * already knowing the domain, so FlowStar remembers the mapping locally the
 * first time a name is resolved forward.
 */
export function getFederationNameForAddress(address: string): string | null {
  const entry = readEntries().find((item) => item.address === address && item.federationAddress)
  return entry?.federationAddress ?? null
}
