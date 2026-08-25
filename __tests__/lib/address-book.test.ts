import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  addAddressBookEntry,
  deleteAddressBookEntry,
  getAddressBookEntries,
  touchAddressBookEntry,
  updateAddressBookEntry,
} from '@/lib/address-book'

// ---------------------------------------------------------------------------
// localStorage mock — gives us spy access and full store isolation
// ---------------------------------------------------------------------------

function makeLocalStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
}

const localStorageMock = makeLocalStorageMock()
vi.stubGlobal('localStorage', localStorageMock)

const STORAGE_KEY = 'flowstar:address-book'

beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function seed(entries: object[]) {
  localStorageMock.setItem(STORAGE_KEY, JSON.stringify(entries))
}

// ---------------------------------------------------------------------------
// getAddressBookEntries
// ---------------------------------------------------------------------------

describe('getAddressBookEntries', () => {
  it('returns an empty array when nothing is stored', () => {
    expect(getAddressBookEntries()).toEqual([])
  })

  it('returns entries sorted by lastUsed descending', () => {
    addAddressBookEntry({ label: 'Alice', address: 'GALICE' })
    addAddressBookEntry({ label: 'Bob', address: 'GBOB' })
    const entries = getAddressBookEntries()
    expect(entries).toHaveLength(2)
    // Most recently added (Bob) should come first.
    expect(entries[0].label).toBe('Bob')
    expect(entries[1].label).toBe('Alice')
  })

  it('returns [] when stored JSON is malformed', () => {
    localStorageMock.setItem(STORAGE_KEY, 'not-json{')
    expect(getAddressBookEntries()).toEqual([])
  })

  it('returns [] when stored JSON is not an array', () => {
    seed({ foo: 'bar' } as unknown as object[])
    expect(getAddressBookEntries()).toEqual([])
  })

  it('returns [] when stored value is null', () => {
    // getItem returns null for missing keys by default
    expect(getAddressBookEntries()).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// addAddressBookEntry
// ---------------------------------------------------------------------------

describe('addAddressBookEntry', () => {
  it('trims label and address', () => {
    const entry = addAddressBookEntry({ label: '  Alice  ', address: '  GALICE  ' })
    expect(entry.label).toBe('Alice')
    expect(entry.address).toBe('GALICE')
  })

  it('assigns a unique id and lastUsed timestamp', () => {
    const entry = addAddressBookEntry({ label: 'Alice', address: 'GALICE' })
    expect(entry.id).toBeTruthy()
    expect(typeof entry.lastUsed).toBe('number')
  })

  it('replaces an existing entry with the same address instead of duplicating', () => {
    addAddressBookEntry({ label: 'Alice', address: 'GALICE' })
    addAddressBookEntry({ label: 'Alice V2', address: 'GALICE' })
    const entries = getAddressBookEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].label).toBe('Alice V2')
  })

  it('caps stored entries at 50', () => {
    for (let i = 0; i < 55; i += 1) {
      addAddressBookEntry({ label: `Person ${i}`, address: `GADDR${i}` })
    }
    expect(getAddressBookEntries()).toHaveLength(50)
  })

  it('prepends the new entry so it appears first in storage', () => {
    seed([{ id: 'old', label: 'Bob', address: 'GBOB', lastUsed: 1 }])
    addAddressBookEntry({ label: 'Alice', address: 'GALICE' })
    const stored = JSON.parse(localStorageMock.getItem(STORAGE_KEY) as string)
    expect(stored[0].label).toBe('Alice')
    expect(stored[1].label).toBe('Bob')
  })

  it('generates unique ids for rapid successive calls', () => {
    const a = addAddressBookEntry({ label: 'A', address: 'GAAA' })
    const b = addAddressBookEntry({ label: 'B', address: 'GBBB' })
    expect(a.id).not.toBe(b.id)
  })

  it('persists the new entry to localStorage', () => {
    addAddressBookEntry({ label: 'Alice', address: 'GALICE' })
    const stored = JSON.parse(localStorageMock.getItem(STORAGE_KEY) as string)
    expect(stored).toHaveLength(1)
    expect(stored[0].label).toBe('Alice')
  })
})

// ---------------------------------------------------------------------------
// updateAddressBookEntry
// ---------------------------------------------------------------------------

describe('updateAddressBookEntry', () => {
  it('updates the matching entry and returns it', () => {
    const created = addAddressBookEntry({ label: 'Alice', address: 'GALICE' })
    const updated = updateAddressBookEntry(created.id, { label: 'Alice Updated' })
    expect(updated?.label).toBe('Alice Updated')
    expect(getAddressBookEntries()[0].label).toBe('Alice Updated')
  })

  it('returns null when the id does not exist', () => {
    const result = updateAddressBookEntry('nonexistent', { label: 'x' })
    expect(result).toBeNull()
  })

  it('leaves other entries unchanged', () => {
    const alice = addAddressBookEntry({ label: 'Alice', address: 'GALICE' })
    addAddressBookEntry({ label: 'Bob', address: 'GBOB' })
    updateAddressBookEntry(alice.id, { label: 'Alice Updated' })
    const entries = getAddressBookEntries()
    const bob = entries.find((e) => e.label.startsWith('Bob'))
    expect(bob?.label).toBe('Bob')
  })

  it('can update address field', () => {
    const created = addAddressBookEntry({ label: 'Alice', address: 'GALICE' })
    const updated = updateAddressBookEntry(created.id, { address: 'GNEW' })
    expect(updated?.address).toBe('GNEW')
  })

  it('can update lastUsed directly', () => {
    const created = addAddressBookEntry({ label: 'Alice', address: 'GALICE' })
    const updated = updateAddressBookEntry(created.id, { lastUsed: 999 })
    expect(updated?.lastUsed).toBe(999)
  })

  it('persists the update to localStorage', () => {
    const created = addAddressBookEntry({ label: 'Alice', address: 'GALICE' })
    updateAddressBookEntry(created.id, { label: 'Persisted' })
    const stored = JSON.parse(localStorageMock.getItem(STORAGE_KEY) as string)
    expect(stored[0].label).toBe('Persisted')
  })
})

// ---------------------------------------------------------------------------
// deleteAddressBookEntry
// ---------------------------------------------------------------------------

describe('deleteAddressBookEntry', () => {
  it('removes only the matching entry', () => {
    const alice = addAddressBookEntry({ label: 'Alice', address: 'GALICE' })
    addAddressBookEntry({ label: 'Bob', address: 'GBOB' })
    deleteAddressBookEntry(alice.id)
    const entries = getAddressBookEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].label).toBe('Bob')
  })

  it('is a no-op when the id does not exist', () => {
    addAddressBookEntry({ label: 'Alice', address: 'GALICE' })
    deleteAddressBookEntry('nonexistent')
    expect(getAddressBookEntries()).toHaveLength(1)
  })

  it('results in an empty list when deleting the only entry', () => {
    const entry = addAddressBookEntry({ label: 'Alice', address: 'GALICE' })
    deleteAddressBookEntry(entry.id)
    expect(getAddressBookEntries()).toEqual([])
  })

  it('persists the deletion to localStorage', () => {
    const entry = addAddressBookEntry({ label: 'Alice', address: 'GALICE' })
    deleteAddressBookEntry(entry.id)
    const stored = JSON.parse(localStorageMock.getItem(STORAGE_KEY) as string)
    expect(stored).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// touchAddressBookEntry
// ---------------------------------------------------------------------------

describe('touchAddressBookEntry', () => {
  it('updates lastUsed and optional label for an existing address', async () => {
    addAddressBookEntry({ label: 'Alice', address: 'GALICE' })
    const before = getAddressBookEntries()[0].lastUsed
    await new Promise((resolve) => setTimeout(resolve, 2))
    const touched = touchAddressBookEntry('GALICE', 'Alice Renamed')
    expect(touched?.label).toBe('Alice Renamed')
    expect(touched!.lastUsed).toBeGreaterThanOrEqual(before)
  })

  it('keeps the existing label when no label override is given', () => {
    addAddressBookEntry({ label: 'Alice', address: 'GALICE' })
    const touched = touchAddressBookEntry('GALICE')
    expect(touched?.label).toBe('Alice')
  })

  it('keeps the existing label when label override is an empty string', () => {
    addAddressBookEntry({ label: 'Alice', address: 'GALICE' })
    const touched = touchAddressBookEntry('GALICE', '')
    expect(touched?.label).toBe('Alice')
  })

  it('trims the new label', () => {
    addAddressBookEntry({ label: 'Alice', address: 'GALICE' })
    const touched = touchAddressBookEntry('GALICE', '  Trimmed  ')
    expect(touched?.label).toBe('Trimmed')
  })

  it('creates a new entry when the address is not already saved', () => {
    const touched = touchAddressBookEntry('GNEWADDR', 'New Contact')
    expect(touched?.address).toBe('GNEWADDR')
    expect(touched?.label).toBe('New Contact')
    expect(getAddressBookEntries()).toHaveLength(1)
  })

  it('defaults label to "Saved recipient" when creating without a label', () => {
    const touched = touchAddressBookEntry('GNEWADDR2')
    expect(touched?.label).toBe('Saved recipient')
  })

  it('returns null for a whitespace-only address with no existing entry', () => {
    expect(touchAddressBookEntry('   ')).toBeNull()
    expect(getAddressBookEntries()).toHaveLength(0)
  })

  it('returns null for an empty string address with no existing entry', () => {
    expect(touchAddressBookEntry('')).toBeNull()
  })

  it('persists the touch update to localStorage', () => {
    addAddressBookEntry({ label: 'Alice', address: 'GALICE' })
    touchAddressBookEntry('GALICE', 'Alice Updated')
    const stored = JSON.parse(localStorageMock.getItem(STORAGE_KEY) as string)
    expect(stored[0].label).toBe('Alice Updated')
  })

  it('does not affect other entries when touching one', () => {
    addAddressBookEntry({ label: 'Alice', address: 'GALICE' })
    addAddressBookEntry({ label: 'Bob', address: 'GBOB' })
    touchAddressBookEntry('GALICE', 'Alice Updated')
    const entries = getAddressBookEntries()
    const bob = entries.find((e) => e.address === 'GBOB')
    expect(bob?.label).toBe('Bob')
  })
})
