import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBulkSelect } from '@/hooks/useBulkSelect'

const items = [{ id: '1' }, { id: '2' }, { id: '3' }]

describe('useBulkSelect', () => {
  it('starts with nothing selected', () => {
    const { result } = renderHook(() => useBulkSelect(items))
    expect(result.current.someSelected).toBe(false)
    expect(result.current.allSelected).toBe(false)
    expect(result.current.selectedItems).toEqual([])
  })

  it('toggle adds and removes an id', () => {
    const { result } = renderHook(() => useBulkSelect(items))
    act(() => result.current.toggle('1'))
    expect(result.current.selected.has('1')).toBe(true)
    expect(result.current.selectedItems).toEqual([{ id: '1' }])
    act(() => result.current.toggle('1'))
    expect(result.current.selected.has('1')).toBe(false)
  })

  it('toggleAll selects everything when nothing is fully selected', () => {
    const { result } = renderHook(() => useBulkSelect(items))
    act(() => result.current.toggleAll())
    expect(result.current.allSelected).toBe(true)
    expect(result.current.selectedItems).toHaveLength(3)
  })

  it('toggleAll clears selection when everything is already selected', () => {
    const { result } = renderHook(() => useBulkSelect(items))
    act(() => result.current.toggleAll())
    act(() => result.current.toggleAll())
    expect(result.current.allSelected).toBe(false)
    expect(result.current.selected.size).toBe(0)
  })

  it('clear empties the selection', () => {
    const { result } = renderHook(() => useBulkSelect(items))
    act(() => result.current.toggle('1'))
    act(() => result.current.clear())
    expect(result.current.someSelected).toBe(false)
  })
})
