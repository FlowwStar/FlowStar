import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  blockSender,
  getBlockedSenders,
  getHiddenStreamIds,
  hideStream,
  subscribeHiddenStreams,
  unblockSender,
  unhideStream,
} from '@/lib/hidden-streams'

describe('hidden streams', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('hides and unhides stream IDs idempotently', () => {
    hideStream('stream-1')
    hideStream('stream-1')
    expect(getHiddenStreamIds()).toEqual(new Set(['stream-1']))

    unhideStream('stream-1')
    unhideStream('stream-1')
    expect(getHiddenStreamIds()).toEqual(new Set())
  })

  it('blocks and unblocks sender addresses idempotently', () => {
    blockSender('G SENDER 1')
    blockSender('G SENDER 1')
    expect(getBlockedSenders()).toEqual(new Set(['G SENDER 1']))

    unblockSender('G SENDER 1')
    unblockSender('G SENDER 1')
    expect(getBlockedSenders()).toEqual(new Set())
  })

  it('notifies subscribers only when a persisted set changes', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeHiddenStreams(listener)

    hideStream('stream-1')
    hideStream('stream-1')
    unhideStream('stream-1')
    unhideStream('stream-1')
    blockSender('G SENDER')
    unblockSender('G SENDER')

    expect(listener).toHaveBeenCalledTimes(4)
    unsubscribe()
    hideStream('stream-2')
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('returns empty sets and does not throw when window is unavailable', () => {
    vi.stubGlobal('window', undefined)

    expect(getHiddenStreamIds()).toEqual(new Set())
    expect(getBlockedSenders()).toEqual(new Set())
    expect(() => hideStream('stream-1')).not.toThrow()
    expect(() => blockSender('G SENDER')).not.toThrow()
  })

  it('ignores malformed stored JSON', () => {
    localStorage.setItem('flowstar:hidden-streams', '{bad json')
    localStorage.setItem('flowstar:blocked-senders', JSON.stringify({ sender: true }))

    expect(getHiddenStreamIds()).toEqual(new Set())
    expect(getBlockedSenders()).toEqual(new Set())
  })
})
