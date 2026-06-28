import {
  Address,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
  rpc as StellarRpc,
} from '@stellar/stellar-sdk'
import { type NetworkName, getNetworkConfig, getServer, getAllTokens } from '@/lib/stellar'
import { mockStore } from '@/lib/mock-data'
import type { CreateStreamInput, StreamData, TokenInfo } from '@/types/stream'

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

// ─── Retry / timeout ──────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 30_000
const POLL_TIMEOUT_MS    = 60_000
const MAX_RETRIES        = 3
const RETRY_DELAYS_MS    = [1_000, 2_000, 4_000] as const

function isRetryableError(err: unknown): boolean {
  if (err instanceof TypeError) return true // network failure
  if (err instanceof Error && (err.message.includes('503') || err.message.includes('429'))) return true
  const status =
    (err as { status?: number })?.status ??
    (err as { response?: { status?: number } })?.response?.status
  return status === 429 || status === 503
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(url, { ...init, signal: controller.signal })
      if (res.status !== 429 && res.status !== 503) return res
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (err) {
      lastErr = err
    } finally {
      clearTimeout(timer)
    }
    if (attempt < MAX_RETRIES) await new Promise<void>((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]))
  }
  throw lastErr
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isRetryableError(err)) throw err
    }
    if (attempt < MAX_RETRIES) await new Promise<void>((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]))
  }
  throw lastErr
}

/** Build and simulate a contract call, returning the prepared tx and estimated fee. */
async function buildAndSimulate(
  network: NetworkName,
  method: string,
  args: xdr.ScVal[],
  signerAddress: string,
  contractAddress: string,
) {
  const config = getNetworkConfig(network)
  const server = getServer(network)
  const contract = new Contract(contractAddress)
  const account = await withRetry(() => server.getAccount(signerAddress))

  const tx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: config.passphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(180)
    .build()

  const sim = await withRetry(() => server.simulateTransaction(tx))
  if (StellarRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`)
  }

  const successSim = sim as StellarRpc.Api.SimulateTransactionSuccessResponse
  const minFee = Number(successSim.minResourceFee ?? 0)
  const estimatedFee = Math.ceil(minFee * FEE_BUFFER)
  const prepared = StellarRpc.assembleTransaction(tx, sim).build()

  return { prepared, estimatedFee, minFee }
}

export type TxStep = 'simulating' | 'signing' | 'submitting' | 'confirming'

/** Build, simulate, sign, and submit a contract call. Returns the transaction hash. */
async function invoke(
  network: NetworkName,
  method: string,
  args: xdr.ScVal[],
  signerAddress: string,
  contractAddress: string,
  onStep?: (step: TxStep) => void,
): Promise<string> {
  const config = getNetworkConfig(network)
  onStep?.('simulating')
  const { prepared } = await buildAndSimulate(network, method, args, signerAddress, contractAddress)
  onStep?.('signing')
  const signedXdr = await signTx(prepared.toXDR())
  onStep?.('submitting')
  // Submit the signed XDR directly via the RPC JSON-RPC endpoint.
  // We bypass TransactionBuilder.fromXDR because Freighter may return a
  // FeeBumpTransaction envelope (type 4) which fromXDR can't handle.
  const rpcResponse = await fetchWithRetry(config.rpcUrl, {
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

  // Poll until finalized (max 60 s)
  const hash = sendResult.hash
  onStep?.('confirming')
  let pollStatus = 'PENDING'
  const pollDeadline = Date.now() + POLL_TIMEOUT_MS

  while (pollStatus !== 'SUCCESS' && pollStatus !== 'FAILED') {
    if (Date.now() >= pollDeadline) throw new Error('Transaction confirmation timed out after 60s')
    await new Promise<void>((r) => setTimeout(r, 2000))
    const pollRes = await fetchWithRetry(config.rpcUrl, {
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
async function query(
  network: NetworkName,
  method: string,
  args: xdr.ScVal[],
  contractAddress: string,
): Promise<xdr.ScVal> {
  const config = getNetworkConfig(network)
  const server = getServer(network)
  const contract = new Contract(contractAddress)
  // Use a dummy account for simulation reads
  const dummyKeypair = {
    accountId: () => 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
    sequence: () => BigInt(0),
    incrementSequenceNumber: () => {},
  }
  const account = await withRetry(() => server.getAccount(dummyKeypair.accountId()))
  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: config.passphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(10)
    .build()

  const sim = await withRetry(() => server.simulateTransaction(tx))
  if (StellarRpc.Api.isSimulationError(sim)) {
    throw new Error(`Query failed: ${sim.error}`)
  }
  return (sim as StellarRpc.Api.SimulateTransactionSuccessResponse).result?.retval
    ?? xdr.ScVal.scvVoid()
}

/** Map a contract Stream ScVal → StreamData. */
function scValToStreamData(network: NetworkName, val: xdr.ScVal): StreamData {
  const raw = scValToNative(val) as Record<string, unknown>

  const tokenAddress = String(raw.token)
  const knownTokens = getAllTokens(network)
  const knownToken = knownTokens.find((t) => t.address === tokenAddress)
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

export interface SimulationPreview {
  success: boolean
  estimatedFeeXlm: string
  estimatedFeeUsd: string
  cpuInstructions: number
  memoryBytes: number
  errorMessage?: string
}

/** Run a dry-run simulation and return a structured preview for display. */
export async function simulateCreateStreamPreview(
  network: NetworkName,
  input: CreateStreamInput,
  sender: string,
): Promise<SimulationPreview> {
  const config = getNetworkConfig(network)
  const isMockMode = !config.streamContractId

  if (isMockMode) {
    return {
      success: true,
      estimatedFeeXlm: '0.0115',
      estimatedFeeUsd: '~$0.001',
      cpuInstructions: 42_000,
      memoryBytes: 128,
    }
  }

  try {
    const server = getServer(network)
    const contract = new Contract(config.streamContractId)
    const account = await withRetry(() => server.getAccount(sender))

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

    const tx = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase: config.passphrase,
    })
      .addOperation(contract.call('create_stream', new Address(sender).toScVal(), params))
      .setTimeout(180)
      .build()

    const sim = await withRetry(() => server.simulateTransaction(tx))

    if (StellarRpc.Api.isSimulationError(sim)) {
      return {
        success: false,
        estimatedFeeXlm: '0',
        estimatedFeeUsd: '—',
        cpuInstructions: 0,
        memoryBytes: 0,
        errorMessage: sim.error,
      }
    }

    const successSim = sim as StellarRpc.Api.SimulateTransactionSuccessResponse
    const minFee = Number(successSim.minResourceFee ?? 0)
    const estimatedFee = Math.ceil(minFee * FEE_BUFFER)
    const feeXlm = (estimatedFee / 1e7).toFixed(4)
    const feeUsd = `~$${(estimatedFee / 1e7 * 0.08).toFixed(4)}`
    const cost = successSim.cost ?? { cpuInsns: '0', memBytes: '0' }

    return {
      success: true,
      estimatedFeeXlm: feeXlm,
      estimatedFeeUsd: feeUsd,
      cpuInstructions: Number(cost.cpuInsns ?? 0),
      memoryBytes: Number(cost.memBytes ?? 0),
    }
  } catch (err) {
    return {
      success: false,
      estimatedFeeXlm: '0',
      estimatedFeeUsd: '—',
      cpuInstructions: 0,
      memoryBytes: 0,
      errorMessage: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function estimateCreateStreamFee(
  network: NetworkName,
  input: CreateStreamInput,
  sender: string,
): Promise<FeeEstimate> {
  const config = getNetworkConfig(network)
  const isMockMode = !config.streamContractId
  
  if (isMockMode) {
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
    network,
    'create_stream',
    [new Address(sender).toScVal(), params],
    sender,
    config.streamContractId,
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
  network: NetworkName = 'testnet',
  onStep?: (step: TxStep) => void,
): Promise<string> {
  const config = getNetworkConfig(network)
  const isMockMode = !config.streamContractId
  
  if (isMockMode) {
    await new Promise((r) => setTimeout(r, 700))
    return mockStore.create(input, sender).id
  }

  // Step 1: approve the streaming contract to pull `totalAmount` from the sender.
  // The allowance needs to outlast the simulation ledger — set it to current + 500 ledgers.
  const server = getServer(network)
  const currentLedger = (await withRetry(() => server.getLatestLedger())).sequence
  const expirationLedger = currentLedger + 500

  await invoke(
    network,
    'approve',
    [
      new Address(sender).toScVal(),                              // from
      new Address(config.streamContractId).toScVal(),                  // spender
      nativeToScVal(input.totalAmount, { type: 'i128' }),        // amount
      nativeToScVal(expirationLedger, { type: 'u32' }),          // expiration_ledger
    ],
    sender,
    input.token.address, // invoke on the token contract, not the streaming contract
    onStep,
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

  await invoke(
    network,
    'create_stream',
    [new Address(sender).toScVal(), params],
    sender,
    config.streamContractId,
    onStep,
  )

  // SDK v13 can't parse TransactionMetaV4 (protocol 22+) so returnValue is void.
  // Instead, query the sender's stream list and return the highest ID — that's the new stream.
  const sentResult = await query(network, 'get_sent_streams', [new Address(sender).toScVal(), nativeToScVal(0, { type: 'u32' }), nativeToScVal(1000, { type: 'u32' })], config.streamContractId)
  const ids = scValToNative(sentResult) as bigint[]
  if (!ids || ids.length === 0) throw new Error('Stream created but could not retrieve ID')
  const newId = ids.reduce((a, b) => (a > b ? a : b))
  return String(newId)
}

export async function withdrawFromStream(
  id: string,
  amount: bigint,
  network: NetworkName = 'testnet',
  onStep?: (step: TxStep) => void,
): Promise<string | null> {
  const config = getNetworkConfig(network)
  const isMockMode = !config.streamContractId
  
  if (isMockMode) {
    await new Promise((r) => setTimeout(r, 700))
    mockStore.withdraw(id, amount)
    return null
  }
  const stream = await fetchStream(network, id)
  if (!stream) throw new Error('Stream not found')

  return invoke(
    network,
    'withdraw',
    [
      nativeToScVal(BigInt(id), { type: 'u64' }),
      nativeToScVal(amount,     { type: 'i128' }),
    ],
    stream.recipient,
    config.streamContractId,
    onStep,
  )
}

export async function cancelStream(
  id: string,
  network: NetworkName = 'testnet',
  onStep?: (step: TxStep) => void,
): Promise<string | null> {
  const config = getNetworkConfig(network)
  const isMockMode = !config.streamContractId
  
  if (isMockMode) {
    await new Promise((r) => setTimeout(r, 700))
    mockStore.cancel(id)
    return null
  }
  const stream = await fetchStream(network, id)
  if (!stream) throw new Error('Stream not found')

  return invoke(
    network,
    'cancel',
    [nativeToScVal(BigInt(id), { type: 'u64' })],
    stream.sender,
    config.streamContractId,
    onStep,
  )
}

export async function getTokenMetadata(
  tokenAddress: string,
  network: NetworkName = 'testnet',
): Promise<TokenInfo | null> {
  try {
    const config = getNetworkConfig(network)
    const server = getServer(network)
    const contract = new Contract(tokenAddress)
    const dummyAccount = await withRetry(() =>
      server.getAccount('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN'),
    )

    const buildSimTx = (method: string) => {
      const tx = new TransactionBuilder(dummyAccount, {
        fee: '100',
        networkPassphrase: config.passphrase,
      })
        .addOperation(contract.call(method))
        .setTimeout(10)
        .build()
      return withRetry(() => server.simulateTransaction(tx))
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

export async function getTokenBalance(
  tokenAddress: string,
  accountAddress: string,
  network: NetworkName = 'testnet',
): Promise<bigint> {
  const config = getNetworkConfig(network)
  const isMockMode = !config.streamContractId
  
  if (isMockMode) return BigInt(1_000_000_0000000) // 1,000,000 units mock

  try {
    const server = getServer(network)
    const contract = new Contract(tokenAddress)
    const account = await withRetry(() =>
      server.getAccount('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN'),
    )
    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: config.passphrase,
    })
      .addOperation(contract.call('balance', new Address(accountAddress).toScVal()))
      .setTimeout(10)
      .build()

    const sim = await withRetry(() => server.simulateTransaction(tx))
    if (StellarRpc.Api.isSimulationError(sim)) return 0n
    const retval = (sim as StellarRpc.Api.SimulateTransactionSuccessResponse).result?.retval
    if (!retval) return 0n
    return BigInt(scValToNative(retval) as string | number)
  } catch {
    return 0n
  }
}

export async function bumpStreamTtl(
  network: NetworkName,
  id: string,
  signerAddress: string,
): Promise<void> {
  const config = getNetworkConfig(network)
  const isMockMode = !config.streamContractId
  
  if (isMockMode) return

  await invoke(
    network,
    'bump_stream',
    [nativeToScVal(BigInt(id), { type: 'u64' })],
    signerAddress,
    config.streamContractId,
  )
}

export async function fetchStream(
  network: NetworkName,
  id: string,
): Promise<StreamData | null> {
  const config = getNetworkConfig(network)
  const isMockMode = !config.streamContractId
  
  if (isMockMode) return mockStore.getById(id) ?? null

  try {
    const result = await query(network, 'get_stream', [
      nativeToScVal(BigInt(id), { type: 'u64' }),
    ], config.streamContractId)
    return scValToStreamData(network, result)
  } catch {
    return null
  }
}

export async function fetchStreamsForAddress(
  network: NetworkName,
  address: string,
): Promise<StreamData[]> {
  const config = getNetworkConfig(network)
  const isMockMode = !config.streamContractId
  
  if (isMockMode) {
    return mockStore
      .getAll()
      .filter((s) => s.sender === address || s.recipient === address)
  }

  const [sentIds, receivedIds] = await Promise.all([
    query(network, 'get_sent_streams', [new Address(address).toScVal(), nativeToScVal(0, { type: 'u32' }), nativeToScVal(1000, { type: 'u32' })], config.streamContractId),
    query(network, 'get_received_streams', [new Address(address).toScVal(), nativeToScVal(0, { type: 'u32' }), nativeToScVal(1000, { type: 'u32' })], config.streamContractId),
  ])

  const allIds = [
    ...(scValToNative(sentIds) as bigint[]),
    ...(scValToNative(receivedIds) as bigint[]),
  ]
  // Deduplicate (self-streams appear in both)
  const unique = [...new Set(allIds.map(String))]

  const streams = await Promise.all(unique.map((id) => fetchStream(network, id)))
  return streams.filter((s): s is StreamData => s !== null)
}
