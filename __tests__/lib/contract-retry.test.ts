import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('lib/contract.ts retry helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('isRetryableError', () => {
    it('identifies TypeError as retryable (network failure)', async () => {
      const module = await import('@/lib/contract')
      const isRetryableError = (module as any).isRetryableError

      const error = new TypeError('Failed to fetch')
      expect(isRetryableError(error)).toBe(true)
    })

    it('identifies 503 errors as retryable', async () => {
      const module = await import('@/lib/contract')
      const isRetryableError = (module as any).isRetryableError

      const error503 = { status: 503 }
      expect(isRetryableError(error503)).toBe(true)

      const errorWith503Message = new Error('Server returned 503')
      expect(isRetryableError(errorWith503Message)).toBe(true)
    })

    it('identifies 429 errors as retryable (rate limit)', async () => {
      const module = await import('@/lib/contract')
      const isRetryableError = (module as any).isRetryableError

      const error429 = { status: 429 }
      expect(isRetryableError(error429)).toBe(true)

      const errorWith429Message = new Error('Rate limit: 429')
      expect(isRetryableError(errorWith429Message)).toBe(true)
    })

    it('identifies nested status codes as retryable', async () => {
      const module = await import('@/lib/contract')
      const isRetryableError = (module as any).isRetryableError

      const nestedError = { response: { status: 503 } }
      expect(isRetryableError(nestedError)).toBe(true)
    })

    it('returns false for non-retryable errors', async () => {
      const module = await import('@/lib/contract')
      const isRetryableError = (module as any).isRetryableError

      expect(isRetryableError(new Error('Generic error'))).toBe(false)
      expect(isRetryableError({ status: 404 })).toBe(false)
      expect(isRetryableError({ status: 500 })).toBe(false)
    })
  })

  describe('fetchWithRetry', () => {
    it('returns response on first successful attempt', async () => {
      const mockResponse = { ok: true, status: 200 }
      mockFetch.mockResolvedValueOnce(mockResponse)

      const module = await import('@/lib/contract')
      const fetchWithRetry = (module as any).fetchWithRetry

      const result = await fetchWithRetry('https://api.example.com', {})
      expect(result).toBe(mockResponse)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('retries on 503 errors up to the limit', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: true, status: 200 })

      const module = await import('@/lib/contract')
      const fetchWithRetry = (module as any).fetchWithRetry

      const promise = fetchWithRetry('https://api.example.com', {})

      // Advance through retry delays
      await vi.advanceTimersByTimeAsync(100) // First retry delay
      await vi.advanceTimersByTimeAsync(200) // Second retry delay

      const result = await promise
      expect(result.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('retries on 429 rate limit errors', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({ ok: true, status: 200 })

      const module = await import('@/lib/contract')
      const fetchWithRetry = (module as any).fetchWithRetry

      const promise = fetchWithRetry('https://api.example.com', {})
      await vi.advanceTimersByTimeAsync(100)

      const result = await promise
      expect(result.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('throws after maximum retries exceeded', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: false, status: 503 })

      const module = await import('@/lib/contract')
      const fetchWithRetry = (module as any).fetchWithRetry

      const promise = fetchWithRetry('https://api.example.com', {})

      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(200)

      await expect(promise).rejects.toThrow()
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('handles network errors with retry', async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError('Network failure'))
        .mockResolvedValueOnce({ ok: true, status: 200 })

      const module = await import('@/lib/contract')
      const fetchWithRetry = (module as any).fetchWithRetry

      const promise = fetchWithRetry('https://api.example.com', {})
      await vi.advanceTimersByTimeAsync(100)

      const result = await promise
      expect(result.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('withRetry', () => {
    it('returns result on first successful attempt', async () => {
      const mockFn = vi.fn().mockResolvedValue('success')

      const module = await import('@/lib/contract')
      const withRetry = (module as any).withRetry

      const result = await withRetry(mockFn)
      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('retries on retryable errors and succeeds after transient failure', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Network failure'))
        .mockResolvedValueOnce('success')

      const module = await import('@/lib/contract')
      const withRetry = (module as any).withRetry

      const promise = withRetry(mockFn)
      await vi.advanceTimersByTimeAsync(100)

      const result = await promise
      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledTimes(2)
    })

    it('retries multiple times on 503 errors', async () => {
      const error503 = { status: 503 }
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(error503)
        .mockRejectedValueOnce(error503)
        .mockResolvedValueOnce('success')

      const module = await import('@/lib/contract')
      const withRetry = (module as any).withRetry

      const promise = withRetry(mockFn)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(200)

      const result = await promise
      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledTimes(3)
    })

    it('throws immediately on non-retryable errors', async () => {
      const nonRetryableError = new Error('Bad request')
      const mockFn = vi.fn().mockRejectedValue(nonRetryableError)

      const module = await import('@/lib/contract')
      const withRetry = (module as any).withRetry

      await expect(withRetry(mockFn)).rejects.toThrow('Bad request')
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('throws after maximum retries on retryable errors', async () => {
      const retryableError = { status: 503 }
      const mockFn = vi.fn().mockRejectedValue(retryableError)

      const module = await import('@/lib/contract')
      const withRetry = (module as any).withRetry

      const promise = withRetry(mockFn)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(200)

      await expect(promise).rejects.toEqual(retryableError)
      expect(mockFn).toHaveBeenCalledTimes(3)
    })

    it('respects retry delays using fake timers', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Network failure'))
        .mockResolvedValueOnce('success')

      const module = await import('@/lib/contract')
      const withRetry = (module as any).withRetry

      const promise = withRetry(mockFn)

      // Before advancing timers, only first attempt should have happened
      expect(mockFn).toHaveBeenCalledTimes(1)

      // Advance past the first retry delay (100ms)
      await vi.advanceTimersByTimeAsync(100)

      const result = await promise
      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledTimes(2)
    })
  })
})
