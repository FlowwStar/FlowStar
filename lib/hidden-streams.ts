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

/**
 * IDs of streams the user has hidden on this device. Returns a fresh `Set`
 * each call (mutating it has no effect on storage); empty on the server or if
 * storage is missing/corrupt.
 */
export function getHiddenStreamIds(): Set<string> {
  return readSet(HIDDEN_STREAMS_KEY)
}

/**
 * Hide stream `id` from the dashboard on this device. No-op if already hidden;
 * otherwise persists the change and notifies subscribers.
 */
export function hideStream(id: string) {
  const ids = getHiddenStreamIds()
  if (ids.has(id)) return
  ids.add(id)
  writeSet(HIDDEN_STREAMS_KEY, ids)
}

/**
 * Un-hide stream `id`. No-op if it isn't hidden; otherwise persists the change
 * and notifies subscribers.
 */
export function unhideStream(id: string) {
  const ids = getHiddenStreamIds()
  if (!ids.has(id)) return
  ids.delete(id)
  writeSet(HIDDEN_STREAMS_KEY, ids)
}

// ─── Blocked senders ─────────────────────────────────────────────────────────

/**
 * Sender addresses the user has blocked on this device — streams from these
 * senders are hidden from the dashboard. Returns a fresh `Set` each call; empty
 * on the server or if storage is missing/corrupt.
 */
export function getBlockedSenders(): Set<string> {
  return readSet(BLOCKED_SENDERS_KEY)
}

/**
 * Block `address` so its streams are hidden from the dashboard on this device.
 * Frontend-only: it does not stop the sender creating streams on-chain. No-op
 * if already blocked; otherwise persists the change and notifies subscribers.
 */
export function blockSender(address: string) {
  const senders = getBlockedSenders()
  if (senders.has(address)) return
  senders.add(address)
  writeSet(BLOCKED_SENDERS_KEY, senders)
}

/**
 * Unblock `address`. No-op if it isn't blocked; otherwise persists the change
 * and notifies subscribers.
 */
export function unblockSender(address: string) {
  const senders = getBlockedSenders()
  if (!senders.has(address)) return
  senders.delete(address)
  writeSet(BLOCKED_SENDERS_KEY, senders)
}

// ─── Pinned streams ───────────────────────────────────────────────────────────

const PINNED_STREAMS_KEY = 'flowstar:pinned-streams'

/**
 * IDs of streams the user has pinned on this device. Returns a fresh `Set`
 * each call; empty on the server or if storage is missing/corrupt.
 */
export function getPinnedStreamIds(): Set<string> {
  return readSet(PINNED_STREAMS_KEY)
}

/**
 * Pin stream `id` on this device. No-op if already pinned; otherwise persists
 * the change and notifies subscribers.
 */
export function pinStream(id: string) {
  const ids = getPinnedStreamIds()
  if (ids.has(id)) return
  ids.add(id)
  writeSet(PINNED_STREAMS_KEY, ids)
}

/**
 * Unpin stream `id`. No-op if it isn't pinned; otherwise persists the change
 * and notifies subscribers.
 */
export function unpinStream(id: string) {
  const ids = getPinnedStreamIds()
  if (!ids.has(id)) return
  ids.delete(id)
  writeSet(PINNED_STREAMS_KEY, ids)
}
