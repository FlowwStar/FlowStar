export type ErrorCategory = 'user' | 'network' | 'contract' | 'wallet'

export interface MappedError {
  message: string
  suggestion: string
  category: ErrorCategory
  details?: string
}

const ERROR_PATTERNS: Array<{
  pattern: RegExp | string
  mapped: Omit<MappedError, 'details'>
}> = [
  // Soroban contract errors: Error(Contract, #N)
  // 1: InvalidAmount
  {
    pattern: /Error\(Contract,\s*1\)/,
    mapped: {
      message: 'Invalid stream amount',
      suggestion: 'The amount is invalid. Check that it is positive and within valid bounds.',
      category: 'contract',
    },
  },
  // 2: InvalidTimeRange
  {
    pattern: /Error\(Contract,\s*2\)/,
    mapped: {
      message: 'Invalid time range',
      suggestion: 'The start and end times are invalid. End time must be after start time.',
      category: 'contract',
    },
  },
  // 3: InvalidCliff
  {
    pattern: /Error\(Contract,\s*3\)/,
    mapped: {
      message: 'Invalid cliff configuration',
      suggestion: 'The cliff time must be between start and end time.',
      category: 'contract',
    },
  },
  // 4: SelfStream
  {
    pattern: /Error\(Contract,\s*4\)/,
    mapped: {
      message: 'Cannot create self-directed stream',
      suggestion: 'You cannot create a stream to yourself. Specify a different recipient.',
      category: 'user',
    },
  },
  // 5: StreamNotFound
  {
    pattern: /Error\(Contract,\s*5\)/,
    mapped: {
      message: 'Stream not found',
      suggestion: 'This stream does not exist. It may have been deleted or the ID is incorrect.',
      category: 'contract',
    },
  },
  // 6: StreamCancelled
  {
    pattern: /Error\(Contract,\s*6\)/,
    mapped: {
      message: 'Stream has been cancelled',
      suggestion: 'This stream was cancelled and no longer accepts withdrawals or modifications.',
      category: 'contract',
    },
  },
  // 7: Unauthorized
  {
    pattern: /Error\(Contract,\s*7\)/,
    mapped: {
      message: 'Unauthorized operation',
      suggestion: 'You do not have permission to perform this action. Only the stream owner can modify it.',
      category: 'user',
    },
  },
  // 8: InsufficientFunds
  {
    pattern: /Error\(Contract,\s*8\)/,
    mapped: {
      message: 'Insufficient funds in stream',
      suggestion: 'The stream balance is too low for this operation. Top up the stream or reduce the amount.',
      category: 'user',
    },
  },
  // 9: StreamEnded
  {
    pattern: /Error\(Contract,\s*9\)/,
    mapped: {
      message: 'Stream has ended',
      suggestion: 'This stream has completed its term. You can only withdraw remaining funds.',
      category: 'contract',
    },
  },
  // 10: SameRecipient
  {
    pattern: /Error\(Contract,\s*10\)/,
    mapped: {
      message: 'Recipient already set',
      suggestion: 'The recipient for this stream is already set and cannot be changed to the same address.',
      category: 'user',
    },
  },
  // 11: BatchSizeExceeded
  {
    pattern: /Error\(Contract,\s*11\)/,
    mapped: {
      message: 'Batch size exceeds maximum',
      suggestion: 'You can create a maximum of 20 streams per batch. Split your request into smaller batches.',
      category: 'user',
    },
  },
  // 12: BatchEmpty
  {
    pattern: /Error\(Contract,\s*12\)/,
    mapped: {
      message: 'Batch cannot be empty',
      suggestion: 'You must specify at least one stream to create in the batch.',
      category: 'user',
    },
  },
  // 13: ArithmeticOverflow
  {
    pattern: /Error\(Contract,\s*13\)/,
    mapped: {
      message: 'Arithmetic overflow in calculation',
      suggestion: 'The stream parameters cause a calculation overflow. Try reducing the amount or duration.',
      category: 'contract',
    },
  },
  // 14: AlreadyInitialized
  {
    pattern: /Error\(Contract,\s*14\)/,
    mapped: {
      message: 'Contract already initialized',
      suggestion: 'The contract has already been set up. Initialization can only happen once.',
      category: 'contract',
    },
  },
  // 15: NotInitialized
  {
    pattern: /Error\(Contract,\s*15\)/,
    mapped: {
      message: 'Contract not initialized',
      suggestion: 'The contract has not been initialized yet. Please try again later.',
      category: 'contract',
    },
  },
  // 16: ContractPaused
  {
    pattern: /Error\(Contract,\s*16\)/,
    mapped: {
      message: 'Contract is paused',
      suggestion: 'The FlowStar contract is currently paused for maintenance. Please try again later.',
      category: 'network',
    },
  },
  // 17: DurationExceedsMaximum
  {
    pattern: /Error\(Contract,\s*17\)/,
    mapped: {
      message: 'Stream duration exceeds maximum',
      suggestion: 'The stream duration is too long. Use a shorter duration or split into multiple streams.',
      category: 'user',
    },
  },
  // 18: InvalidRecipient
  {
    pattern: /Error\(Contract,\s*18\)/,
    mapped: {
      message: 'Invalid recipient address',
      suggestion: 'The recipient address is invalid or cannot receive the stream. Check the address and try again.',
      category: 'user',
    },
  },
  // 19: RateIsZero
  {
    pattern: /Error\(Contract,\s*19\)/,
    mapped: {
      message: 'Stream amount too small for duration',
      suggestion: 'The amount is too small relative to the duration. Increase the amount or reduce the duration.',
      category: 'user',
    },
  },
  // 20: StreamNotEligibleForCleanup
  {
    pattern: /Error\(Contract,\s*20\)/,
    mapped: {
      message: 'Stream not eligible for cleanup',
      suggestion: 'The stream must be fully cancelled or drained before cleanup. Wait until the stream ends.',
      category: 'contract',
    },
  },

  // Insufficient balance (fallback for non-contract errors)
  {
    pattern: /insufficient balance|insufficient funds|balance.*too low|not enough/i,
    mapped: {
      message: 'Insufficient XLM balance',
      suggestion: 'You need more XLM to cover the transaction. Top up your wallet and try again.',
      category: 'user',
    },
  },
  // Token approval expired
  {
    pattern: /approval.*expir|allowance.*expir|expir.*approval|expir.*allowance/i,
    mapped: {
      message: 'Token approval expired',
      suggestion: 'Please approve the token transfer again and retry.',
      category: 'contract',
    },
  },
  // Wallet rejection
  {
    pattern: /user rejected|rejected by user|user denied|transaction rejected|user cancel/i,
    mapped: {
      message: 'Transaction rejected in wallet',
      suggestion: 'No funds were moved. Open your wallet and approve the transaction to proceed.',
      category: 'wallet',
    },
  },
  // Network timeout
  {
    pattern: /timeout|timed out|connection.*timeout|network.*timeout/i,
    mapped: {
      message: 'Network request timed out',
      suggestion: 'Check your internet connection and try again. The Stellar network may be congested.',
      category: 'network',
    },
  },
  // Stream cancelled
  {
    pattern: /stream.*cancel|cancel.*stream|stream is cancel/i,
    mapped: {
      message: 'Stream has been cancelled',
      suggestion: 'This stream has been cancelled and no longer accepts withdrawals.',
      category: 'contract',
    },
  },
  // Invalid withdraw amount
  {
    pattern: /withdraw.*exceed|amount.*exceed.*balance|exceed.*withdrawable/i,
    mapped: {
      message: 'Withdraw amount exceeds available balance',
      suggestion: 'Enter an amount less than or equal to the withdrawable balance shown.',
      category: 'user',
    },
  },
  // Rate limit / 429
  {
    pattern: /429|rate.?limit|too many requests/i,
    mapped: {
      message: 'Rate limit reached',
      suggestion: 'Too many requests to the Stellar network. Wait a few seconds and try again.',
      category: 'network',
    },
  },
  // Service unavailable / 503
  {
    pattern: /503|service unavailable|server.*error|rpc.*unavailable/i,
    mapped: {
      message: 'Stellar network temporarily unavailable',
      suggestion: 'The Stellar RPC is temporarily down. Try again in a few minutes.',
      category: 'network',
    },
  },
  // Wallet not connected
  {
    pattern: /wallet not connected|connect.*wallet first|no wallet/i,
    mapped: {
      message: 'Wallet not connected',
      suggestion: 'Connect your Stellar wallet (e.g. Freighter) before performing this action.',
      category: 'wallet',
    },
  },
  // Simulation failed
  {
    pattern: /simulation failed|simulate.*error/i,
    mapped: {
      message: 'Transaction simulation failed',
      suggestion: 'The transaction parameters are invalid. Check your inputs and try again.',
      category: 'contract',
    },
  },
  // On-chain failure
  {
    pattern: /failed on.?chain|transaction failed on/i,
    mapped: {
      message: 'Transaction rejected by the network',
      suggestion: 'The Stellar network rejected this transaction. Check your balance and contract state.',
      category: 'contract',
    },
  },
]

export function mapError(raw: unknown): MappedError {
  const rawMessage = raw instanceof Error ? raw.message : String(raw)

  for (const { pattern, mapped } of ERROR_PATTERNS) {
    const matches =
      typeof pattern === 'string'
        ? rawMessage.toLowerCase().includes(pattern.toLowerCase())
        : pattern.test(rawMessage)
    if (matches) {
      return { ...mapped, details: rawMessage }
    }
  }

  return {
    message: 'Transaction failed',
    suggestion: 'An unexpected error occurred. Check the details below or try again.',
    category: 'contract',
    details: rawMessage,
  }
}

export function categoryLabel(category: ErrorCategory): string {
  switch (category) {
    case 'user':
      return 'Input error'
    case 'network':
      return 'Network error'
    case 'contract':
      return 'Contract error'
    case 'wallet':
      return 'Wallet error'
  }
}

export function categoryColor(category: ErrorCategory): string {
  switch (category) {
    case 'user':
      return 'text-amber-600 dark:text-amber-400'
    case 'network':
      return 'text-blue-600 dark:text-blue-400'
    case 'contract':
      return 'text-destructive'
    case 'wallet':
      return 'text-purple-600 dark:text-purple-400'
  }
}
