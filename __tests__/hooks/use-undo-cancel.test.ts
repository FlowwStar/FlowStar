import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/hooks/use-contract', () => ({
  useContract: vi.fn(),
}))

vi.mock('sonner', () => {
  const toast = vi.fn() as unknown as { (...args: unknown[]): void; dismiss: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> }
  toast.dismiss = vi.fn()
  toast.info = vi.fn()
  return { toast }
})

import { useContract } from '@/hooks/use-contract'
import { toast } from 'sonner'
import { useUndoableCancel, useIsStreamCancelling, CANCEL_UNDO_DELAY_MS } from '@/hooks/use-undo-cancel'

const cancelMock = vi.fn()

describe('useUndoableCancel / useIsStreamCancelling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    cancelMock.mockReset().mockResolvedValue(undefined)
    vi.mocked(useContract).mockReturnValue({ cancel: cancelMock } as unknown as ReturnType<typeof useContract>)
    vi.mocked(toast).mockClear()
    vi.mocked(toast.dismiss).mockClear()
    vi.mocked(toast.info).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('marks the stream as cancelling immediately when scheduled', () => {
    const { result: cancelHook } = renderHook(() => useUndoableCancel())
    const { result: isCancelling } = renderHook(() => useIsStreamCancelling('stream-1'))

    expect(isCancelling.current).toBe(false)

    act(() => {
      cancelHook.current.scheduleCancel('stream-1')
    })

    expect(isCancelling.current).toBe(true)
    expect(cancelMock).not.toHaveBeenCalled()
  })

  it('submits the cancel transaction once the undo delay elapses (cancel-on-timeout)', async () => {
    const { result: cancelHook } = renderHook(() => useUndoableCancel())
    const { result: isCancelling } = renderHook(() => useIsStreamCancelling('stream-1'))

    act(() => {
      cancelHook.current.scheduleCancel('stream-1')
    })
    expect(isCancelling.current).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CANCEL_UNDO_DELAY_MS)
    })

    expect(cancelMock).toHaveBeenCalledWith('stream-1')
    expect(isCancelling.current).toBe(false)
    expect(toast.dismiss).toHaveBeenCalledWith('cancel-undo-stream-1')
  })

  it('aborting before the delay elapses cancels the countdown and never submits the transaction (undo-before-timeout)', async () => {
    const { result: cancelHook } = renderHook(() => useUndoableCancel())
    const { result: isCancelling } = renderHook(() => useIsStreamCancelling('stream-1'))

    act(() => {
      cancelHook.current.scheduleCancel('stream-1')
    })

    act(() => {
      vi.advanceTimersByTime(CANCEL_UNDO_DELAY_MS / 2)
    })
    expect(isCancelling.current).toBe(true)

    act(() => {
      const aborted = cancelHook.current.abortCancel('stream-1')
      expect(aborted).toBe(true)
    })

    expect(isCancelling.current).toBe(false)

    // Advancing past the original delay must not retroactively submit the
    // cancel — the timers backing it were cleared by abortCancel.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CANCEL_UNDO_DELAY_MS)
    })
    expect(cancelMock).not.toHaveBeenCalled()
  })

  it('abortCancel returns false when there is nothing pending for that stream', () => {
    const { result: cancelHook } = renderHook(() => useUndoableCancel())

    act(() => {
      const aborted = cancelHook.current.abortCancel('never-scheduled')
      expect(aborted).toBe(false)
    })
  })

  it('useIsStreamCancelling reacts to a cancellation scheduled by a different hook instance', () => {
    const { result: cancelHookA } = renderHook(() => useUndoableCancel())
    const { result: isCancellingB } = renderHook(() => useIsStreamCancelling('shared-stream'))

    expect(isCancellingB.current).toBe(false)

    act(() => {
      cancelHookA.current.scheduleCancel('shared-stream')
    })

    // A separate hook instance subscribed to the same stream id observes the
    // change via the shared pub/sub, without any prop-drilling between them.
    expect(isCancellingB.current).toBe(true)
  })

  it('unmounting the scheduling component aborts any in-flight countdown', async () => {
    const { result: cancelHook, unmount } = renderHook(() => useUndoableCancel())
    const { result: isCancelling } = renderHook(() => useIsStreamCancelling('stream-1'))

    act(() => {
      cancelHook.current.scheduleCancel('stream-1')
    })
    expect(isCancelling.current).toBe(true)

    unmount()
    expect(isCancelling.current).toBe(false)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CANCEL_UNDO_DELAY_MS)
    })
    expect(cancelMock).not.toHaveBeenCalled()
  })
})
