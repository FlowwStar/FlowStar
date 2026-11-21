// Centralized UI copy for the streams page (app/app/streams/page.tsx).
// First step toward i18n-readiness — extracted so this component's strings
// live in one place instead of scattered through JSX (issue #792).

import type { StreamStatus } from '@/types/stream'

export type SortOption =
  | 'default'
  | 'amount-desc'
  | 'amount-asc'
  | 'start-desc'
  | 'start-asc'
  | 'end-asc'
  | 'end-desc'

export const streamsCopy = {
  tokenOptions: ['all', 'XLM', 'USDC', 'EURC'] as const,
  header: {
    title: 'Streams',
    description: "All streams you've sent or received.",
    refreshing: 'Refreshing…',
    refreshingAriaLabel: 'Refreshing stream data',
    downloadCSV: 'Download CSV',
  },
  tabs: {
    active: 'Active',
    archived: 'Archived',
  },
  archivedTab: {
    loading: 'Loading archive…',
    empty: 'No archived streams yet. Streams appear here once cancelled or fully withdrawn.',
    streamPrefix: (id: string) => `Stream #${id}`,
    removePrompt: 'Remove permanently?',
    removing: 'Removing…',
    confirmRemove: 'Confirm',
    cancelRemove: 'Cancel',
    removeFromHistory: 'Remove from history',
  },
  views: {
    list: 'List',
    compact: 'Compact',
    timeline: 'Timeline',
    listAriaLabel: 'List view',
    compactAriaLabel: 'Compact view',
    timelineAriaLabel: 'Timeline view',
  },
  hiddenToggle: {
    showingHidden: 'Showing hidden',
    hiddenCount: (count: number) => `Hidden${count > 0 ? ` (${count})` : ''}`,
  },
  bulkSelect: {
    select: 'Select',
    doneSelecting: 'Done selecting',
    selectAll: (count: number) => `Select all (${count})`,
    selectedCount: (count: number) => `${count} selected`,
    withdraw: (count: number) => `Withdraw (${count})`,
    cancel: (count: number) => `Cancel (${count})`,
    hideSelected: (count: number) => `Hide selected (${count})`,
    clear: 'Clear',
    results: (succeeded: number, failed: number) => `${succeeded} succeeded, ${failed} failed`,
    dismiss: 'Dismiss',
  },
  filters: {
    searchPlaceholder: 'Search by ID, address, or token…',
    allTokens: 'All tokens',
    sortByLabel: 'Sort by',
    sortOptions: [
      { label: 'Default order', value: 'default' },
      { label: 'Amount: high to low', value: 'amount-desc' },
      { label: 'Amount: low to high', value: 'amount-asc' },
      { label: 'Start date: newest first', value: 'start-desc' },
      { label: 'Start date: oldest first', value: 'start-asc' },
      { label: 'End date: soonest first', value: 'end-asc' },
      { label: 'End date: latest first', value: 'end-desc' },
    ] as { label: string; value: SortOption }[],
    statusFilters: [
      { label: 'All', value: 'all' },
      { label: 'Streaming', value: 'streaming' },
      { label: 'Scheduled', value: 'scheduled' },
      { label: 'Completed', value: 'completed' },
      { label: 'Cancelled', value: 'cancelled' },
    ] as { label: string; value: StreamStatus | 'all' }[],
  },
  empty: {
    noMatch: 'No streams match your filters',
    clearFilters: 'Clear filters',
  },
}

// Copy for the StreamCard component (components/streams/stream-card.tsx).
export const streamCardCopy = {
  direction: {
    sending: 'Sending',
    receiving: 'Receiving',
    sendingTo: 'Sending to',
    receivingFrom: 'Receiving from',
  },
  ariaLabel: (direction: string, amount: string, symbol: string, status: string, pct: string) =>
    `${direction} ${amount} ${symbol}, ${status}, ${pct}% unlocked`,
  toasts: {
    unpinned: 'Stream unpinned',
    pinned: 'Stream pinned to top',
    unhidden: 'Stream unhidden',
    hidden: 'Stream hidden',
    hiddenDescription: 'Use "Show hidden streams" on the streams page to bring it back.',
    senderUnblocked: 'Sender unblocked',
    senderBlocked: 'Sender blocked',
    senderBlockedDescription: 'Future streams from this address will be hidden automatically.',
    linkCopied: 'Link copied to clipboard',
  },
  pinnedToTop: 'Pinned to top',
  selectStream: (id: string) => `Select stream ${id}`,
  copyLink: 'Copy stream link',
  options: 'Stream options',
  menu: {
    unpin: 'Unpin stream',
    pin: 'Pin to top',
    unhide: 'Unhide stream',
    hide: 'Hide stream',
    unblock: 'Unblock sender',
    block: 'Block sender',
  },
  progressLabel: 'Stream unlock progress',
  cancelling: 'Cancelling…',
  total: 'Total',
  loadingPrice: 'Loading price',
  timing: {
    startsIn: 'Starts in',
    ended: 'Ended',
    endsIn: 'Ends in',
  },
  unlocked: (pct: string) => `${pct}% unlocked`,
  withdrawn: 'withdrawn',
}
