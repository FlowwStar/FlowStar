import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBulkSelect } from '@/hooks/use-bulk-select'

const ITEMS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('useBulkSelect', () => {
  it('starts with nothing selected', () => {
    const { result } = renderHook(() => useBulkSelect(ITEMS))
    expect(result.current.someSelected).toBe(false)
    expect(result.current.allSelected).toBe(false)
    expect(result.current.selectedItems).toEqual([])
  })

  it('toggle adds and removes an id', () => {
    const { result } = renderHook(() => useBulkSelect(ITEMS))

    act(() => result.current.toggle('a'))
    expect(result.current.selectedItems).toEqual([{ id: 'a' }])
    expect(result.current.someSelected).toBe(true)
    expect(result.current.allSelected).toBe(false)

    act(() => result.current.toggle('a'))
    expect(result.current.selectedItems).toEqual([])
    expect(result.current.someSelected).toBe(false)
  })

  it('toggleAll selects everything, then clears when already fully selected', () => {
    const { result } = renderHook(() => useBulkSelect(ITEMS))

    act(() => result.current.toggleAll())
    expect(result.current.allSelected).toBe(true)
    expect(result.current.selectedItems).toHaveLength(3)

    act(() => result.current.toggleAll())
    expect(result.current.allSelected).toBe(false)
    expect(result.current.selectedItems).toEqual([])
  })

  it('clear empties the selection', () => {
    const { result } = renderHook(() => useBulkSelect(ITEMS))

    act(() => {
      result.current.toggle('a')
      result.current.toggle('b')
    })
    expect(result.current.someSelected).toBe(true)

    act(() => result.current.clear())
    expect(result.current.someSelected).toBe(false)
  })
})
