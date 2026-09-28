import { beforeEach, describe, expect, it, vi } from 'vitest'

const sentry = vi.hoisted(() => ({
  withScope: vi.fn(),
  captureException: vi.fn(),
  setUser: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => sentry)

import { captureError, setSentryUser } from '@/lib/sentry'

describe('lib/sentry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sentry.withScope.mockImplementation((callback: (scope: unknown) => void) =>
      callback({ setUser: vi.fn(), setTag: vi.fn(), setExtra: vi.fn() }),
    )
  })

  it('captures an error through the SDK', async () => {
    const error = new Error('request failed')
    await captureError(error)

    expect(sentry.withScope).toHaveBeenCalledOnce()
    expect(sentry.captureException).toHaveBeenCalledWith(error)
  })

  it('adds redacted wallet, operation, and extra context to the scope', async () => {
    const scope = { setUser: vi.fn(), setTag: vi.fn(), setExtra: vi.fn() }
    sentry.withScope.mockImplementation((callback: (value: typeof scope) => void) =>
      callback(scope),
    )

    await captureError('failure', {
      walletAddress: 'GABCDEF123456789',
      operation: 'withdraw',
      extra: { streamId: '42', retryable: true },
    })

    expect(scope.setUser).toHaveBeenCalledWith({ id: 'GABCDEF1…' })
    expect(scope.setTag).toHaveBeenCalledWith('operation', 'withdraw')
    expect(scope.setExtra).toHaveBeenCalledWith('streamId', '42')
    expect(scope.setExtra).toHaveBeenCalledWith('retryable', true)
    expect(sentry.captureException).toHaveBeenCalledWith('failure')
  })

  it('sets and clears the connected wallet user', async () => {
    await setSentryUser('GABCDEF123456789')
    await setSentryUser(null)

    expect(sentry.setUser).toHaveBeenNthCalledWith(1, { id: 'GABCDEF1…' })
    expect(sentry.setUser).toHaveBeenNthCalledWith(2, null)
  })
})
