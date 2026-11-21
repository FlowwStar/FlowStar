import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useHiddenStreams } from '@/hooks/use-hidden-streams'

const HIDDEN_KEY = 'flowstar:hidden-streams'
const BLOCKED_KEY = 'flowstar:blocked-senders'
const PINNED_KEY = 'flowstar:pinned-streams'

describe('useHiddenStreams', () => {
  beforeEach(() => localStorage.clear())

  it('hydrates hidden, blocked, and pinned values from localStorage', async () => {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(['stream-1']))
    localStorage.setItem(BLOCKED_KEY, JSON.stringify(['GSENDER']))
    localStorage.setItem(PINNED_KEY, JSON.stringify(['stream-2']))

    const { result } = renderHook(() => useHiddenStreams())
    await waitFor(() => expect(result.current.hiddenIds.has('stream-1')).toBe(true))

    expect(result.current.blockedSenders).toEqual(new Set(['GSENDER']))
    expect(result.current.pinnedIds).toEqual(new Set(['stream-2']))
    expect(result.current.isHidden('stream-1')).toBe(true)
    expect(result.current.isBlocked('GSENDER')).toBe(true)
    expect(result.current.isPinned('stream-2')).toBe(true)
  })

  it('reacts to hide, block, and pin mutations made through the hook', async () => {
    const { result } = renderHook(() => useHiddenStreams())

    act(() => {
      result.current.hideStream('stream-1')
      result.current.blockSender('GSENDER')
      result.current.pinStream('stream-1')
    })
    await waitFor(() => expect(result.current.isHidden('stream-1')).toBe(true))

    expect(result.current.isBlocked('GSENDER')).toBe(true)
    expect(result.current.isPinned('stream-1')).toBe(true)
    expect(JSON.parse(localStorage.getItem(HIDDEN_KEY)!)).toEqual(['stream-1'])
  })

  it('updates state when values are removed', async () => {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(['stream-1']))
    localStorage.setItem(BLOCKED_KEY, JSON.stringify(['GSENDER']))
    localStorage.setItem(PINNED_KEY, JSON.stringify(['stream-1']))
    const { result } = renderHook(() => useHiddenStreams())
    await waitFor(() => expect(result.current.isHidden('stream-1')).toBe(true))

    act(() => {
      result.current.unhideStream('stream-1')
      result.current.unblockSender('GSENDER')
      result.current.unpinStream('stream-1')
    })
    await waitFor(() => expect(result.current.isHidden('stream-1')).toBe(false))

    expect(result.current.isBlocked('GSENDER')).toBe(false)
    expect(result.current.isPinned('stream-1')).toBe(false)
  })
})
