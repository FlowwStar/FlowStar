import { useState, useCallback } from 'react';

export function useBulkSelect<T extends { id: string }>(items: T[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected(prev =>
      prev.size === items.length
        ? new Set()
        : new Set(items.map(i => i.id))
    );
  }, [items]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const selectedItems = items.filter(i => selected.has(i.id));
  const allSelected   = selected.size === items.length && items.length > 0;
  const someSelected  = selected.size > 0;

  return { selected, selectedItems, allSelected, someSelected, toggle, toggleAll, clear };
}