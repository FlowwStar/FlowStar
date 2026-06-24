import {
  Address,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
  rpc as StellarRpc,
} from '@stellar/stellar-sdk'
import { server, NETWORK, STREAM_CONTRACT_ID, IS_MOCK_MODE } from '@/lib/stellar'
import { KNOWN_TOKENS } from '@/lib/stellar'
import { mockStore } from '@/lib/mock-data'
import type { CreateStreamInput, StreamData, TokenInfo } from '@/types/stream'

// ─── Toggle ───────────────────────────────────────────────────────────────────
// Driven by NEXT_PUBLIC_STREAM_CONTRACT_ID: mock mode is on whenever no contract
// ID is configured, and switches to live calls once one is set.
const USE_MOCK = IS_MOCK_MODE

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wallet sign callback — must be set by WalletProvider before any write. */
let _signTransaction: ((xdr: string) => Promise<string>) | null = null

export function setSignTransaction(fn: (xdr: string) => Promise<string>) {
  _signTransaction = fn
}

async function signTx(xdrStr: string): Promise<string> {
  if (!_signTransaction) throw new Error('Wallet not connected')
  return _signTransaction(xdrStr)
}

const FEE_BUFFER = 1.15 // 15% above minimum to ensure inclusion

/** Build and simulate a contract call, returning the prepared tx and estimated fee. */
async function buildAndSimulate(
  method: string,
  args: xdr.ScVal[],
  signerAddress: string,
  contractAddress: string = STREAM_CONTRACT_ID,
) {
  const contract = new Contract(contractAddress)
  const account = await server.getAccount(signerAddress)

  const tx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(180)
    .build()

  const sim = await server.simulateTransaction(tx)
  if (StellarRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`)
  }

  const successSim = sim as StellarRpc.Api.SimulateTransactionSuccessResponse
  const minFee = Number(successSim.minResourceFee ?? 0)
  const estimatedFee = Math.ceil(minFee * FEE_BUFFER)
  const prepared = StellarRpc.assembleTransaction(tx, sim).build()

  return { prepared, estimatedFee, minFee }
}

/** Build, simulate, sign, and submit a contract call. Returns the transaction hash. */
async function invoke(
  method: string,
  args: xdr.ScVal[],
  signerAddress: string,
  contractAddress: string = STREAM_CONTRACT_ID,
): Promise<string> {
  const { prepared } = await buildAndSimulate(method, args, signerAddress, contractAddress)
  const signedXdr = await signTx(prepared.toXDR('base64'))
  // Submit the signed XDR directly via the RPC JSON-RPC endpoint.
  // We bypass TransactionBuilder.fromXDR because Freighter may return a
  // FeeBumpTransaction envelope (type 4) which fromXDR can't handle.
  const rpcResponse = await fetch(NETWORK.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sendTransaction',
      params: { transaction: signedXdr },
    }),
  })
  const rpcJson = await rpcResponse.json() as {
    result?: { hash: string; status: string; errorResultXdr?: string }
    error?: { message: string }
  }

  if (rpcJson.error) {
    throw new Error(`Transaction failed: ${rpcJson.error.message}`)
  }

  const sendResult = rpcJson.result!
  if (sendResult.status === 'ERROR') {
    throw new Error(`Transaction failed: ${sendResult.errorResultXdr ?? 'unknown error'}`)
  }

  // Poll until finalized
  const hash = sendResult.hash
  let pollStatus = 'PENDING'

  while (pollStatus !== 'SUCCESS' && pollStatus !== 'FAILED') {
    await new Promise((r) => setTimeout(r, 2000))
    const pollRes = await fetch(NETWORK.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: { hash },
      }),
    })
    const pollJson = await pollRes.json() as {
      result?: { status: string; resultMetaXdr?: string }
      error?: { message: string }
    }
    if (pollJson.error) throw new Error(`Poll failed: ${pollJson.error.message}`)
    pollStatus = pollJson.result!.status
  }

  if (pollStatus === 'FAILED') throw new Error('Transaction failed on-chain')

  return hash
}

/** Simulate a read-only call (no signing). */
async function query(method: string, args: xdr.ScVal[]): Promise<xdr.ScVal> {
  const contract = new Contract(STREAM_CONTRACT_ID)
  // Use a dummy account for simulation reads
  const dummyKeypair = {
    accountId: () => 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
    sequence: () => BigInt(0),
    incrementSequenceNumber: () => {},
  }
  const account = await server.getAccount(dummyKeypair.accountId())
  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(10)
    .build()

  const sim = await server.simulateTransaction(tx)
  if (StellarRpc.Api.isSimulationError(sim)) {
    throw new Error(`Query failed: ${sim.error}`)
  }
  return (sim as StellarRpc.Api.SimulateTransactionSuccessResponse).result?.retval
    ?? xdr.ScVal.scvVoid()
}

/** Map a contract Stream ScVal → StreamData. */
function scValToStreamData(val: xdr.ScVal): StreamData {
  const raw = scValToNative(val) as Record<string, unknown>

  const tokenAddress = String(raw.token)
  const knownToken = KNOWN_TOKENS.find((t) => t.address === tokenAddress)
  const token: TokenInfo = knownToken ?? {
    address: tokenAddress,
    symbol: 'UNK',
    decimals: 7,
  }

  return {
    id: String(raw.id),
    sender: String(raw.sender),
    recipient: String(raw.recipient),
    token,
    depositedAmount: BigInt(raw.deposited_amount as string | number),
    withdrawnAmount: BigInt(raw.withdrawn_amount as string | number),
    startTime: BigInt(raw.start_time as string | number),
    endTime: BigInt(raw.end_time as string | number),
    cliffTime: BigInt(raw.cliff_time as string | number),
    cliffAmount: BigInt(raw.cliff_amount as string | number),
    amountPerSecond: BigInt(raw.amount_per_second as string | number),
    cancelled: Boolean(raw.cancelled),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface FeeEstimate {
  minFee: number
  estimatedFee: number
  estimatedFeeXlm: string
}

export async function estimateCreateStreamFee(
  input: CreateStreamInput,
  sender: string,
): Promise<FeeEstimate> {
  if (USE_MOCK) {
    return { minFee: 100000, estimatedFee: 115000, estimatedFeeXlm: '0.0115' }
  }

  const params = xdr.ScVal.scvMap(
    [
      ['cliff_amount', nativeToScVal(input.cliffAmount, { type: 'i128' })],
      ['cliff_time',   nativeToScVal(input.cliffTime,   { type: 'u64' })],
      ['end_time',     nativeToScVal(input.endTime,     { type: 'u64' })],
      ['recipient',    new Address(input.recipient).toScVal()],
      ['start_time',   nativeToScVal(input.startTime,   { type: 'u64' })],
      ['token',        new Address(input.token.address).toScVal()],
      ['total_amount', nativeToScVal(input.totalAmount, { type: 'i128' })],
    ].map(([k, v]) =>
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol(k as string),
        val: v as xdr.ScVal,
      }),
    ),
  )

  const { minFee, estimatedFee } = await buildAndSimulate(
    'create_stream',
    [new Address(sender).toScVal(), params],
    sender,
  )

  return {
    minFee,
    estimatedFee,
    estimatedFeeXlm: (estimatedFee / 1e7).toFixed(4),
  }
}

export async function createStream(
  input: CreateStreamInput,
  sender: string,
): Promise<string> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 700))
    return mockStore.create(input, sender).id
  }

  // Step 1: approve the streaming contract to pull `totalAmount` from the sender.
  // The allowance needs to outlast the simulation ledger — set it to current + 500 ledgers.
  const currentLedger = (await server.getLatestLedger()).sequence
  const expirationLedger = currentLedger + 500

  await invoke(
    'approve',
    [
      new Address(sender).toScVal(),                              // from
      new Address(STREAM_CONTRACT_ID).toScVal(),                  // spender
      nativeToScVal(input.totalAmount, { type: 'i128' }),        // amount
      nativeToScVal(expirationLedger, { type: 'u32' }),          // expiration_ledger
    ],
    sender,
    input.token.address, // invoke on the token contract, not the streaming contract
  )

  // Step 2: create the stream.
  const params = xdr.ScVal.scvMap(
    [
      ['cliff_amount', nativeToScVal(input.cliffAmount, { type: 'i128' })],
      ['cliff_time',   nativeToScVal(input.cliffTime,   { type: 'u64' })],
      ['end_time',     nativeToScVal(input.endTime,     { type: 'u64' })],
      ['recipient',    new Address(input.recipient).toScVal()],
      ['start_time',   nativeToScVal(input.startTime,   { type: 'u64' })],
      ['token',        new Address(input.token.address).toScVal()],
      ['total_amount', nativeToScVal(input.totalAmount, { type: 'i128' })],
    ].map(([k, v]) =>
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol(k as string),
        val: v as xdr.ScVal,
      }),
    ),
  )

  const result = await invoke(
    'create_stream',
    [new Address(sender).toScVal(), params],
    sender,
  )

  // SDK v13 can't parse TransactionMetaV4 (protocol 22+) so returnValue is void.
  // Instead, query the sender's stream list and return the highest ID — that's the new stream.
  const sentResult = await query('get_sent_streams', [new Address(sender).toScVal()])
  const ids = scValToNative(sentResult) as bigint[]
  if (!ids || ids.length === 0) throw new Error('Stream created but could not retrieve ID')
  const newId = ids.reduce((a, b) => (a > b ? a : b))
  return String(newId)
}

export async function withdrawFromStream(
  id: string,
  amount: bigint,
): Promise<string | null> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 700))
    mockStore.withdraw(id, amount)
    return null
  }
  const stream = await fetchStream(id)
  if (!stream) throw new Error('Stream not found')

  return invoke(
    'withdraw',
    [
      nativeToScVal(BigInt(id), { type: 'u64' }),
      nativeToScVal(amount,     { type: 'i128' }),
    ],
    stream.recipient,
  )
}

export async function cancelStream(id: string): Promise<string | null> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 700))
    mockStore.cancel(id)
    return null
  }
  const stream = await fetchStream(id)
  if (!stream) throw new Error('Stream not found')

  return invoke(
    'cancel',
    [nativeToScVal(BigInt(id), { type: 'u64' })],
    stream.sender,
  )
}

export async function getTokenMetadata(tokenAddress: string): Promise<TokenInfo | null> {
  try {
    const contract = new Contract(tokenAddress)
    const dummyAccount = await server.getAccount(
      'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
    )

    const buildSimTx = (method: string) => {
      const tx = new TransactionBuilder(dummyAccount, {
        fee: '100',
        networkPassphrase: NETWORK.passphrase,
      })
        .addOperation(contract.call(method))
        .setTimeout(10)
        .build()
      return server.simulateTransaction(tx)
    }

    const [symSim, decSim] = await Promise.all([
      buildSimTx('symbol'),
      buildSimTx('decimals'),
    ])

    if (StellarRpc.Api.isSimulationError(symSim) || StellarRpc.Api.isSimulationError(decSim)) {
      return null
    }

    const symResult = (symSim as StellarRpc.Api.SimulateTransactionSuccessResponse).result?.retval
    const decResult = (decSim as StellarRpc.Api.SimulateTransactionSuccessResponse).result?.retval

    if (!symResult || !decResult) return null

    const symbol = scValToNative(symResult) as string
    const decimals = Number(scValToNative(decResult))

    return { address: tokenAddress, symbol, decimals }
  } catch {
    return null
  }
}

export async function bumpStreamTtl(id: string, signerAddress: string): Promise<void> {
  if (USE_MOCK) return

  await invoke(
    'bump_stream',
    [nativeToScVal(BigInt(id), { type: 'u64' })],
    signerAddress,
  )
}

export async function fetchStream(id: string): Promise<StreamData | null> {
  if (USE_MOCK) return mockStore.getById(id) ?? null

  try {
    const result = await query('get_stream', [
      nativeToScVal(BigInt(id), { type: 'u64' }),
    ])
    return scValToStreamData(result)
  } catch {
    return null
  }
}

export async function fetchStreamsForAddress(
  address: string,
): Promise<StreamData[]> {
  if (USE_MOCK) {
    return mockStore
      .getAll()
      .filter((s) => s.sender === address || s.recipient === address)
  }

  const [sentIds, receivedIds] = await Promise.all([
    query('get_sent_streams', [new Address(address).toScVal()]),
    query('get_received_streams', [new Address(address).toScVal()]),
  ])

  const allIds = [
    ...(scValToNative(sentIds) as bigint[]),
    ...(scValToNative(receivedIds) as bigint[]),
  ]
  // Deduplicate (self-streams appear in both)
  const unique = [...new Set(allIds.map(String))]

  const streams = await Promise.all(unique.map((id) => fetchStream(id)))
  return streams.filter((s): s is StreamData => s !== null)
}
