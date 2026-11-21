import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEMO_ADDRESS, mockStore } from '@/lib/mock-data'
import type { CreateStreamInput } from '@/types/stream'

const token = { address: 'CTOKEN', symbol: 'TEST', decimals: 7 }
const makeInput = (overrides: Partial<CreateStreamInput> = {}): CreateStreamInput => ({
  recipient: 'GRECIPIENT',
  token,
  totalAmount: 10_000n,
  startTime: 100n,
  endTime: 200n,
  cliffTime: 100n,
  cliffAmount: 1_000n,
  ...overrides,
})

function cleanup(id: string) {
  mockStore.cleanup(id)
}

describe('mockStore', () => {
  const createdIds: string[] = []
  afterEach(() => {
    createdIds.splice(0).forEach(cleanup)
  })

  it('creates a stream with derived duration, linear amount, and rate', () => {
    const stream = mockStore.create(makeInput(), 'GSENDER')
    createdIds.push(stream.id)

    expect(stream.sender).toBe('GSENDER')
    expect(stream.depositedAmount).toBe(10_000n)
    expect(stream.duration).toBe(100n)
    expect(stream.linearAmount).toBe(9_000n)
    expect(stream.amountPerSecond).toBe(90n)
    expect(mockStore.getById(stream.id)).toEqual(stream)
    expect(mockStore.getAll()).toContainEqual(stream)
  })

  it('emits updates for create, withdraw, cancel, and cleanup', () => {
    const listener = vi.fn()
    const unsubscribe = mockStore.subscribe(listener)
    const stream = mockStore.create(makeInput(), 'GSENDER')
    createdIds.push(stream.id)
    expect(listener).toHaveBeenCalledTimes(1)

    mockStore.withdraw(stream.id, 500n)
    mockStore.cancel(stream.id)
    expect(listener).toHaveBeenCalledTimes(3)
    expect(mockStore.getById(stream.id)).toMatchObject({ withdrawnAmount: 500n, cancelled: true })

    mockStore.cleanup(stream.id)
    expect(listener).toHaveBeenCalledTimes(4)
    expect(mockStore.getById(stream.id)).toBeUndefined()
    unsubscribe()
    mockStore.cancel(stream.id)
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('returns archived streams for either participant and excludes unrelated streams', () => {
    const senderStream = mockStore.create(makeInput({ recipient: 'GRECIPIENT' }), 'GSENDER')
    const recipientStream = mockStore.create(makeInput({ recipient: DEMO_ADDRESS }), 'GOTHER')
    const activeStream = mockStore.create(makeInput({ recipient: 'GACTIVE' }), 'GSENDER')
    createdIds.push(senderStream.id, recipientStream.id, activeStream.id)
    mockStore.cancel(senderStream.id)
    mockStore.cancel(recipientStream.id)

    expect(mockStore.getArchived('GSENDER').map((stream) => stream.id)).toContain(senderStream.id)
    expect(mockStore.getArchived(DEMO_ADDRESS).map((stream) => stream.id)).toContain(
      recipientStream.id,
    )
    expect(mockStore.getArchived('GUNRELATED')).toEqual([])
    expect(mockStore.getArchived('GSENDER').map((stream) => stream.id)).not.toContain(
      activeStream.id,
    )
  })
})
