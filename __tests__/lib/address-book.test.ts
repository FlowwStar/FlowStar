import { describe, it, expect, beforeEach } from 'vitest'
import {
  addAddressBookEntry,
  deleteAddressBookEntry,
  getAddressBookEntries,
  touchAddressBookEntry,
  updateAddressBookEntry,
} from '@/lib/address-book'

beforeEach(() => {
  window.localStorage.clear()
})

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
    window.localStorage.setItem('flowstar:address-book', 'not-json{')
    expect(getAddressBookEntries()).toEqual([])
  })
})

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
})

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
})

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
})

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

  it('returns null for an empty/whitespace address with no existing entry', () => {
    const touched = touchAddressBookEntry('   ')
    expect(touched).toBeNull()
    expect(getAddressBookEntries()).toHaveLength(0)
  })
})
