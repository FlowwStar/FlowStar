'use client'

import { useState, useCallback, useMemo } from 'react'

/**
 * Tracks a set of selected item ids for a bulk-action UI (checkbox lists).
 * `items` only needs to supply `id` — selection survives across re-renders
 * that reorder or filter `items`, since it's keyed by id rather than index.
 */
export function useBulkSelect<T extends { id: string }>(items: T[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === items.length ? new Set() : new Set(items.map((i) => i.id)),
    )
  }, [items])

  const clear = useCallback(() => setSelected(new Set()), [])

  const selectedItems = useMemo(() => items.filter((i) => selected.has(i.id)), [items, selected])
  const allSelected = selected.size > 0 && selected.size === items.length
  const someSelected = selected.size > 0

  return { selected, selectedItems, allSelected, someSelected, toggle, toggleAll, clear }
}
