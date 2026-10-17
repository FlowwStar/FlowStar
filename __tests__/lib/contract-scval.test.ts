import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Account, Keypair, StrKey, nativeToScVal, xdr } from '@stellar/stellar-sdk'
import { NETWORKS } from '@/lib/stellar'
import { createStream, estimateCreateStreamFee, fetchStream } from '@/lib/contract'

// Issue #928: coverage for scValToStreamData (lib/contract.ts). The decoder is
// module-private, so it is exercised through fetchStream's live path with a
// fake RPC server whose simulation returns a contract-shaped Stream ScVal.

const fakeServer = vi.hoisted(() => ({
  getAccount: vi.fn(),
  getLatestLedger: vi.fn(),
  simulateTransaction: vi.fn(),
}))

vi.mock('@/lib/stellar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/stellar')>()),
  getServer: () => fakeServer,
}))

const CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 1))
const UNKNOWN_TOKEN = StrKey.encodeContract(Buffer.alloc(32, 2))
const SENDER = Keypair.random().publicKey()
const RECIPIENT = Keypair.random().publicKey()
const XLM = NETWORKS.testnet.knownTokens[0]

// Larger than Number.MAX_SAFE_INTEGER — would lose precision if routed through Number.
const HUGE = 2n ** 70n + 12_345n

interface RawStream {
  id: bigint
  sender: string
  recipient: string
  token: string
  deposited_amount: bigint
  withdrawn_amount: bigint
  start_time: bigint
  end_time: bigint
  cliff_time: bigint
  cliff_amount: bigint
  amount_per_second: bigint
  cancelled: boolean
  linear_amount: bigint
  duration: bigint
  [extra: string]: unknown
}

function makeRaw(overrides: Partial<RawStream> = {}): RawStream {
  return {
    id: 42n,
    sender: SENDER,
    recipient: RECIPIENT,
    token: XLM.address,
    deposited_amount: 10_000_000_000n,
    withdrawn_amount: 2_500_000_000n,
    start_time: 1_700_000_000n,
    end_time: 1_700_086_400n,
    cliff_time: 1_700_003_600n,
    cliff_amount: 1_000_000_000n,
    amount_per_second: 104_166n,
    cancelled: false,
    linear_amount: 9_000_000_000n,
    duration: 86_400n,
    ...overrides,
  }
}

/** Encode a stream the way the Soroban `Stream` contracttype is laid out. */
function toScVal(raw: RawStream): xdr.ScVal {
  return nativeToScVal(raw, {
    type: {
      id: ['symbol', 'u64'],
      sender: ['symbol', 'address'],
      recipient: ['symbol', 'address'],
      token: ['symbol', 'address'],
      deposited_amount: ['symbol', 'i128'],
      withdrawn_amount: ['symbol', 'i128'],
      start_time: ['symbol', 'u64'],
      end_time: ['symbol', 'u64'],
      cliff_time: ['symbol', 'u64'],
      cliff_amount: ['symbol', 'i128'],
      amount_per_second: ['symbol', 'i128'],
      cancelled: ['symbol', null],
      linear_amount: ['symbol', 'i128'],
      duration: ['symbol', 'i128'],
      metadata: ['symbol', null],
    },
  })
}

async function decode(val: xdr.ScVal) {
  fakeServer.simulateTransaction.mockResolvedValue({ result: { retval: val } })
  return fetchStream('testnet', '42')
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_STREAM_CONTRACT_ID_TESTNET', CONTRACT_ID)
  fakeServer.getAccount.mockImplementation(async (id: string) => new Account(id, '0'))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('scValToStreamData (via fetchStream)', () => {
  it('round-trips a stream built with nativeToScVal', async () => {
    const raw = makeRaw()
    const stream = await decode(toScVal(raw))

    expect(stream).toEqual({
      id: '42',
      sender: SENDER,
      recipient: RECIPIENT,
      token: XLM,
      depositedAmount: raw.deposited_amount,
      withdrawnAmount: raw.withdrawn_amount,
      startTime: raw.start_time,
      endTime: raw.end_time,
      cliffTime: raw.cliff_time,
      cliffAmount: raw.cliff_amount,
      amountPerSecond: raw.amount_per_second,
      linearAmount: raw.linear_amount,
      duration: raw.duration,
      cancelled: false,
    })
  })

  it('queries get_stream once per fetch', async () => {
    await decode(toScVal(makeRaw()))
    expect(fakeServer.simulateTransaction).toHaveBeenCalledTimes(1)
  })

  it('keeps every amount and timestamp field as bigint without precision loss', async () => {
    const raw = makeRaw({
      deposited_amount: HUGE,
      withdrawn_amount: HUGE - 1n,
      cliff_amount: HUGE - 2n,
      amount_per_second: HUGE - 3n,
      linear_amount: HUGE - 4n,
      duration: HUGE - 5n,
      start_time: 2n ** 63n,
      end_time: 2n ** 64n - 1n, // u64::MAX
      cliff_time: 2n ** 63n + 1n,
    })
    const stream = await decode(toScVal(raw))
    expect(stream).not.toBeNull()

    const bigintFields = [
      'depositedAmount',
      'withdrawnAmount',
      'startTime',
      'endTime',
      'cliffTime',
      'cliffAmount',
      'amountPerSecond',
      'linearAmount',
      'duration',
    ] as const
    for (const field of bigintFields) {
      expect(typeof stream![field], field).toBe('bigint')
    }

    expect(stream!.depositedAmount).toBe(HUGE)
    expect(stream!.duration).toBe(HUGE - 5n)
    expect(stream!.endTime).toBe(2n ** 64n - 1n)
  })

  it('decodes the cancelled flag', async () => {
    const stream = await decode(toScVal(makeRaw({ cancelled: true })))
    expect(stream!.cancelled).toBe(true)
  })

  it('falls back to an UNK token for an unknown token address', async () => {
    const stream = await decode(toScVal(makeRaw({ token: UNKNOWN_TOKEN })))
    expect(stream!.token).toEqual({ address: UNKNOWN_TOKEN, symbol: 'UNK', decimals: 7 })
  })

  it('leaves metadata undefined when the ScVal has none', async () => {
    const stream = await decode(toScVal(makeRaw()))
    expect(stream).not.toHaveProperty('metadata')
  })

  it('still decodes when a metadata entry is present, without mapping it', async () => {
    // The contract's Stream struct carries no metadata — it is stored under a
    // separate key and read via get_stream_metadata — so the decoder ignores
    // any extra entry rather than failing on it.
    const raw = makeRaw({
      metadata: { name: 'Q1 Salary', category: 'payroll', memo: 'Monthly' },
    })
    const stream = await decode(toScVal(raw))

    expect(stream).toMatchObject({ id: '42', depositedAmount: raw.deposited_amount })
    expect(stream!.metadata).toBeUndefined()
  })

  it('returns null when the ScVal is not a stream', async () => {
    // Void retval (e.g. missing stream) → scValToNative gives null → decode throws → null.
    const stream = await decode(xdr.ScVal.scvVoid())
    expect(stream).toBeNull()
  })
})

// Issue #929: coverage for buildCreateStreamInputScVal / buildCreateStreamParamsScVal
// (lib/contract.ts). Both builders are module-private, so they are exercised through
// the public live-mode paths that use them: estimateCreateStreamFee (params map) and
// createStream (input map). The ScVal args are captured from the simulated transaction.

const PARAMS_FIELDS = [
  'cliff_amount',
  'cliff_time',
  'end_time',
  'recipient',
  'start_time',
  'token',
  'total_amount',
]

const INPUT_FIELDS = [
  'recipient',
  'token',
  'total_amount',
  'start_time',
  'end_time',
  'cliff_time',
  'cliff_amount',
]

const TOKEN = XLM.address
const BIG = 2n ** 70n + 12_345n

interface CreateArgs {
  recipient: string
  token: string
  totalAmount: bigint
  startTime: bigint
  endTime: bigint
  cliffTime: bigint
  cliffAmount: bigint
  metadata?: string
}

function makeArgs(overrides: Partial<CreateArgs> = {}): CreateArgs {
  return {
    recipient: RECIPIENT,
    token: TOKEN,
    totalAmount: 10_000_000_000n,
    startTime: 1_700_000_000n,
    endTime: 1_700_086_400n,
    cliffTime: 1_700_003_600n,
    cliffAmount: 1_000_000_000n,
    ...overrides,
  }
}

/** Pull the contract-call operation's args out of the simulated transaction. */
function capturedArgs(): xdr.ScVal[] {
  const tx = fakeServer.simulateTransaction.mock.calls.at(-1)?.[0] as xdr.Transaction
  const op = tx.operations()[0]
  return op.body().invokeHostFunctionOp().hostFunction().invokeContract().args()
}

/** Convert an ScVal map into an ordered list of [key, value] entries. */
function mapEntries(val: xdr.ScVal): Array<[string, xdr.ScVal]> {
  expect(val.switch().name).toBe('scvMap')
  return val
    .map()!
    .map((entry) => [entry.key().sym().toString(), entry.val()] as [string, xdr.ScVal])
}

function expectI128(val: xdr.ScVal, expected: bigint) {
  expect(val.switch().name).toBe('scvI128')
  const parts = val.i128()
  const hi = BigInt(parts.hi().toString())
  const lo = BigInt(parts.lo().toString())
  expect((hi << 64n) + lo).toBe(expected)
}

function expectU64(val: xdr.ScVal, expected: bigint) {
  expect(val.switch().name).toBe('scvU64')
  expect(BigInt(val.u64().toString())).toBe(expected)
}

function expectAddress(val: xdr.ScVal, expected: string) {
  expect(val.switch().name).toBe('scvAddress')
  expect(StrKey.encodeContract(Buffer.from(val.address().contractId()))).toBe(expected)
}

describe('buildCreateStreamParamsScVal (via estimateCreateStreamFee)', () => {
  beforeEach(() => {
    fakeServer.getLatestLedger.mockResolvedValue({ sequence: 1 })
    fakeServer.simulateTransaction.mockResolvedValue({
      result: { retval: nativeToScVal(0, { type: 'i128' }) },
    })
  })

  it('emits the contract field names in the expected order', async () => {
    await estimateCreateStreamFee('testnet', makeArgs())
    const entries = mapEntries(capturedArgs()[0])
    expect(entries.map(([key]) => key)).toEqual(PARAMS_FIELDS)
  })

  it('encodes amounts as i128 and times as u64', async () => {
    const args = makeArgs()
    await estimateCreateStreamFee('testnet', args)
    const map = new Map(mapEntries(capturedArgs()[0]))

    expectI128(map.get('total_amount')!, args.totalAmount)
    expectI128(map.get('cliff_amount')!, args.cliffAmount)
    expectU64(map.get('start_time')!, args.startTime)
    expectU64(map.get('end_time')!, args.endTime)
    expectU64(map.get('cliff_time')!, args.cliffTime)
  })

  it('encodes recipient and token as addresses', async () => {
    const args = makeArgs()
    await estimateCreateStreamFee('testnet', args)
    const map = new Map(mapEntries(capturedArgs()[0]))

    expectAddress(map.get('recipient')!, args.recipient)
    expectAddress(map.get('token')!, args.token)
  })

  it('preserves bigint values above Number.MAX_SAFE_INTEGER', async () => {
    const args = makeArgs({ totalAmount: BIG, cliffAmount: BIG - 1n })
    await estimateCreateStreamFee('testnet', args)
    const map = new Map(mapEntries(capturedArgs()[0]))

    expectI128(map.get('total_amount')!, BIG)
    expectI128(map.get('cliff_amount')!, BIG - 1n)
  })

  it('does not include a metadata entry', async () => {
    await estimateCreateStreamFee('testnet', makeArgs({ metadata: 'Q1 Salary' }))
    const keys = mapEntries(capturedArgs()[0]).map(([key]) => key)
    expect(keys).not.toContain('metadata')
  })
})

describe('buildCreateStreamInputScVal (via createStream)', () => {
  beforeEach(() => {
    fakeServer.getLatestLedger.mockResolvedValue({ sequence: 1 })
    fakeServer.simulateTransaction.mockResolvedValue({
      result: { retval: nativeToScVal(42, { type: 'u64' }) },
    })
  })

  it('emits the contract field names in the expected order', async () => {
    await createStream('testnet', makeArgs())
    const entries = mapEntries(capturedArgs()[0])
    expect(entries.map(([key]) => key)).toEqual(INPUT_FIELDS)
  })

  it('encodes amounts as i128 and times as u64', async () => {
    const args = makeArgs()
    await createStream('testnet', args)
    const map = new Map(mapEntries(capturedArgs()[0]))

    expectI128(map.get('total_amount')!, args.totalAmount)
    expectI128(map.get('cliff_amount')!, args.cliffAmount)
    expectU64(map.get('start_time')!, args.startTime)
    expectU64(map.get('end_time')!, args.endTime)
    expectU64(map.get('cliff_time')!, args.cliffTime)
  })

  it('encodes recipient and token as addresses', async () => {
    const args = makeArgs()
    await createStream('testnet', args)
    const map = new Map(mapEntries(capturedArgs()[0]))

    expectAddress(map.get('recipient')!, args.recipient)
    expectAddress(map.get('token')!, args.token)
  })

  it('preserves bigint values above Number.MAX_SAFE_INTEGER', async () => {
    const args = makeArgs({ totalAmount: BIG, cliffAmount: BIG - 1n })
    await createStream('testnet', args)
    const map = new Map(mapEntries(capturedArgs()[0]))

    expectI128(map.get('total_amount')!, BIG)
    expectI128(map.get('cliff_amount')!, BIG - 1n)
  })

  it('does not include a metadata entry', async () => {
    await createStream('testnet', makeArgs({ metadata: 'Q1 Salary' }))
    const keys = mapEntries(capturedArgs()[0]).map(([key]) => key)
    expect(keys).not.toContain('metadata')
  })
})
