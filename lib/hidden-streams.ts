/**
 * Frontend-only "hide stream" / "block sender" mechanism (issue #151, Option A).
 *
 * Anyone can currently create a stream to any address without the
 * recipient's consent. Since there's no contract-level opt-in yet, this
 * gives recipients a way to declutter their dashboard: hidden stream IDs and
 * blocked sender addresses are persisted in localStorage (this device only,
 * no on-chain effect — the stream still exists and is still cancellable /
 * withdrawable by navigating to it directly).
 */

const HIDDEN_STREAMS_KEY = 'flowstar:hidden-streams'
const BLOCKED_SENDERS_KEY = 'flowstar:blocked-senders'

type Listener = () => void
const listeners = new Set<Listener>()

/** Subscribe to changes made through this module (same-tab reactivity). */
export function subscribeHiddenStreams(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notify() {
  listeners.forEach((l) => l())
}

function readSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = window.localStorage.getItem(key)
    if (!stored) return new Set()
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? new Set(parsed) : new Set()
  } catch {
    return new Set()
  }
}

function writeSet(key: string, value: Set<string>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(Array.from(value)))
  notify()
}

// ─── Hidden streams ──────────────────────────────────────────────────────────

export function getHiddenStreamIds(): Set<string> {
  return readSet(HIDDEN_STREAMS_KEY)
}

export function isStreamHidden(id: string): boolean {
  return getHiddenStreamIds().has(id)
}

export function hideStream(id: string) {
  const ids = getHiddenStreamIds()
  if (ids.has(id)) return
  ids.add(id)
  writeSet(HIDDEN_STREAMS_KEY, ids)
}

export function unhideStream(id: string) {
  const ids = getHiddenStreamIds()
  if (!ids.has(id)) return
  ids.delete(id)
  writeSet(HIDDEN_STREAMS_KEY, ids)
}

// ─── Blocked senders ─────────────────────────────────────────────────────────

export function getBlockedSenders(): Set<string> {
  return readSet(BLOCKED_SENDERS_KEY)
}

export function isSenderBlocked(address: string): boolean {
  return getBlockedSenders().has(address)
}

export function blockSender(address: string) {
  const senders = getBlockedSenders()
  if (senders.has(address)) return
  senders.add(address)
  writeSet(BLOCKED_SENDERS_KEY, senders)
}

export function unblockSender(address: string) {
  const senders = getBlockedSenders()
  if (!senders.has(address)) return
  senders.delete(address)
  writeSet(BLOCKED_SENDERS_KEY, senders)
}
