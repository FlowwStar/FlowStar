import { NETWORK } from '@/lib/stellar'
import type { StreamData } from '@/types/stream'

export interface TokenHolder {
  address: string
  balance: bigint
}

export interface AirdropConfig {
  tokenAddress: string
  amountPerHolder: bigint
  duration: bigint
  cliff: bigint
  cliffAmount: bigint
}

export interface BatchCreateProgress {
  total: number
  completed: number
  failed: number
  current: string
  errors: Map<number, string>
}

const MAX_BATCH_SIZE = 100
const BATCH_TIMEOUT = 30000 // 30 seconds per batch request

export async function fetchTokenHolders(
  tokenAddress: string,
  limit: number = MAX_BATCH_SIZE,
): Promise<TokenHolder[]> {
  try {
    const response = await fetch(
      `${NETWORK.horizonUrl}/accounts?signer=${tokenAddress}&limit=${limit}`,
      { timeout: BATCH_TIMEOUT },
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch token holders: ${response.statusText}`)
    }

    const data = await response.json() as { _embedded?: { records?: Array<{ id: string }> } }
    const records = data._embedded?.records ?? []

    return records
      .slice(0, limit)
      .map((record) => ({
        address: record.id,
        balance: BigInt(0),
      }))
  } catch (error) {
    console.error('Error fetching token holders:', error)
    throw error
  }
}

export function validateBatchConfig(config: AirdropConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!config.tokenAddress || config.tokenAddress.length === 0) {
    errors.push('Token address is required')
  }

  if (config.amountPerHolder <= 0n) {
    errors.push('Amount per holder must be greater than 0')
  }

  if (config.duration <= 0n) {
    errors.push('Duration must be greater than 0')
  }

  if (config.cliff < 0n) {
    errors.push('Cliff time cannot be negative')
  }

  if (config.cliffAmount < 0n) {
    errors.push('Cliff amount cannot be negative')
  }

  if (config.cliffAmount > config.amountPerHolder) {
    errors.push('Cliff amount cannot exceed amount per holder')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function createBatchStreamParams(
  holders: TokenHolder[],
  config: AirdropConfig,
  startTime: bigint = BigInt(Math.floor(Date.now() / 1000)),
): Array<{
  recipient: string
  amount: bigint
  startTime: bigint
  endTime: bigint
  cliffTime: bigint
  cliffAmount: bigint
}> {
  const params: Array<{
    recipient: string
    amount: bigint
    startTime: bigint
    endTime: bigint
    cliffTime: bigint
    cliffAmount: bigint
  }> = []

  for (const holder of holders) {
    params.push({
      recipient: holder.address,
      amount: config.amountPerHolder,
      startTime,
      endTime: startTime + config.duration,
      cliffTime: startTime + config.cliff,
      cliffAmount: config.cliffAmount,
    })
  }

  return params
}

export interface BatchRow {
  index: number
  recipient: string
  amount: string
  startTime: string
  endTime: string
  cliffDuration?: string
  cliffAmount?: string
  errors: string[]
}

export function parseAirdropCsv(csvText: string): { rows: BatchRow[]; errors: string[] } {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const errors: string[] = []
  const rows: BatchRow[] = []

  if (lines.length === 0) {
    return { rows, errors }
  }

  // Parse header to find column indices
  const headerLine = lines[0]
  const headers = headerLine
    .split(',')
    .map((h) => h.trim().toLowerCase())

  const colIndices = {
    recipient: headers.indexOf('recipient'),
    amount: headers.indexOf('amount'),
    startTime: headers.indexOf('start_time'),
    endTime: headers.indexOf('end_time'),
    cliffDuration: headers.indexOf('cliff_duration'),
    cliffAmount: headers.indexOf('cliff_amount'),
  }

  // Validate required columns
  if (
    colIndices.recipient === -1
    || colIndices.amount === -1
    || colIndices.startTime === -1
    || colIndices.endTime === -1
  ) {
    errors.push(
      'CSV must have columns: recipient, amount, start_time, end_time',
    )
    return { rows, errors }
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i += 1) {
    const values = lines[i].split(',').map((v) => v.trim())

    const row: BatchRow = {
      index: i,
      recipient: values[colIndices.recipient] ?? '',
      amount: values[colIndices.amount] ?? '',
      startTime: values[colIndices.startTime] ?? '',
      endTime: values[colIndices.endTime] ?? '',
      cliffDuration: colIndices.cliffDuration !== -1 ? values[colIndices.cliffDuration] : undefined,
      cliffAmount: colIndices.cliffAmount !== -1 ? values[colIndices.cliffAmount] : undefined,
      errors: [],
    }

    // Validate row
    if (!row.recipient) row.errors.push('Missing recipient')
    if (!row.amount) row.errors.push('Missing amount')
    if (!row.startTime) row.errors.push('Missing start_time')
    if (!row.endTime) row.errors.push('Missing end_time')

    // Validate format
    if (row.recipient && !row.recipient.startsWith('G')) {
      row.errors.push('Invalid recipient address format')
    }

    try {
      if (row.amount) BigInt(row.amount)
    } catch {
      row.errors.push('Amount must be a valid integer')
    }

    try {
      if (row.startTime) BigInt(row.startTime)
      if (row.endTime) BigInt(row.endTime)
    } catch {
      row.errors.push('Times must be valid UNIX timestamps')
    }

    rows.push(row)
  }

  return { rows, errors }
}
