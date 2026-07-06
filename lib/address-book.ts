export interface AddressBookEntry {
  id: string
  label: string
  address: string
  lastUsed: number
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

export function getAddressBookEntries(): AddressBookEntry[] {
  return readEntries().sort((a, b) => b.lastUsed - a.lastUsed)
}

export function addAddressBookEntry(entry: Omit<AddressBookEntry, 'id' | 'lastUsed'>) {
  const entries = readEntries()
  const normalized = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: entry.label.trim(),
    address: entry.address.trim(),
    lastUsed: Date.now(),
  }
  const next = [normalized, ...entries.filter((item) => item.address !== normalized.address)].slice(0, 50)
  writeEntries(next)
  return normalized
}

export function updateAddressBookEntry(id: string, patch: Partial<Omit<AddressBookEntry, 'id'>>) {
  const entries = readEntries()
  const next = entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
  writeEntries(next)
  return next.find((entry) => entry.id === id) ?? null
}

export function deleteAddressBookEntry(id: string) {
  const entries = readEntries().filter((entry) => entry.id !== id)
  writeEntries(entries)
}

export function touchAddressBookEntry(address: string, label?: string) {
  const entries = readEntries()
  const existing = entries.find((entry) => entry.address === address)
  if (existing) {
    const next = entries.map((entry) =>
      entry.address === address ? { ...entry, label: label?.trim() || entry.label, lastUsed: Date.now() } : entry,
    )
    writeEntries(next)
    return next.find((entry) => entry.address === address) ?? null
  }
  if (!address.trim()) return null
  return addAddressBookEntry({ label: label?.trim() || 'Saved recipient', address })
}
