'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getHiddenStreamIds,
  getBlockedSenders,
  hideStream as hideStreamStorage,
  unhideStream as unhideStreamStorage,
  blockSender as blockSenderStorage,
  unblockSender as unblockSenderStorage,
  subscribeHiddenStreams,
} from '@/lib/hidden-streams'

/**
 * Reactive access to the localStorage-backed "hidden streams" / "blocked
 * senders" lists (see `lib/hidden-streams.ts`). Values start empty on the
 * server/first render and hydrate from localStorage on mount to avoid SSR
 * mismatches, matching the pattern used by `useShowUsd`.
 */
export function useHiddenStreams() {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [blockedSenders, setBlockedSenders] = useState<Set<string>>(new Set())

  const sync = useCallback(() => {
    setHiddenIds(getHiddenStreamIds())
    setBlockedSenders(getBlockedSenders())
  }, [])

  useEffect(() => {
    sync()
    return subscribeHiddenStreams(sync)
  }, [sync])

  return {
    hiddenIds,
    blockedSenders,
    isHidden: useCallback((id: string) => hiddenIds.has(id), [hiddenIds]),
    isBlocked: useCallback((address: string) => blockedSenders.has(address), [blockedSenders]),
    hideStream: hideStreamStorage,
    unhideStream: unhideStreamStorage,
    blockSender: blockSenderStorage,
    unblockSender: unblockSenderStorage,
  }
}
