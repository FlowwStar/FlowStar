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
  // Error codes from contracts/streaming/src/lib.rs StreamError enum
  // 1: InvalidAmount
  {
    pattern: /Error\(Contract,\s*#?1\)/,
    mapped: {
      message: 'Invalid stream amount',
      suggestion: 'The amount is invalid. Check that it is positive and within valid bounds.',
      category: 'contract',
    },
  },
  // 2: InvalidTimeRange
  {
    pattern: /Error\(Contract,\s*#?2\)/,
    mapped: {
      message: 'Invalid time range',
      suggestion: 'The start and end times are invalid. End time must be after start time.',
      category: 'contract',
    },
  },
  // 3: InvalidCliff
  {
    pattern: /Error\(Contract,\s*#?3\)/,
    mapped: {
      message: 'Invalid cliff configuration',
      suggestion: 'The cliff time must be between start and end time.',
      category: 'contract',
    },
  },
  // 4: SelfStream
  {
    pattern: /Error\(Contract,\s*#?4\)/,
    mapped: {
      message: 'Cannot create self-directed stream',
      suggestion: 'You cannot create a stream to yourself. Specify a different recipient.',
      category: 'user',
    },
  },
  // 5: StreamNotFound
  {
    pattern: /Error\(Contract,\s*#?5\)/,
    mapped: {
      message: 'Stream not found',
      suggestion: 'This stream does not exist. It may have been deleted or the ID is incorrect.',
      category: 'contract',
    },
  },
  // 6: StreamCancelled
  {
    pattern: /Error\(Contract,\s*#?6\)/,
    mapped: {
      message: 'Stream has been cancelled',
      suggestion: 'This stream was cancelled and no longer accepts withdrawals or modifications.',
      category: 'contract',
    },
  },
  // 7: Unauthorized
  {
    pattern: /Error\(Contract,\s*#?7\)/,
    mapped: {
      message: 'Unauthorized operation',
      suggestion: 'You do not have permission to perform this action. Only the stream owner can modify it.',
      category: 'user',
    },
  },
  // 8: InsufficientFunds
  {
    pattern: /Error\(Contract,\s*#?8\)/,
    mapped: {
      message: 'Insufficient funds in stream',
      suggestion: 'The stream balance is too low for this operation. Top up the stream or reduce the amount.',
      category: 'user',
    },
  },
  // 9: StreamEnded
  {
    pattern: /Error\(Contract,\s*#?9\)/,
    mapped: {
      message: 'Stream has ended',
      suggestion: 'This stream has completed its term. You can only withdraw remaining funds.',
      category: 'contract',
    },
  },
  // 10: SameRecipient
  {
    pattern: /Error\(Contract,\s*#?10\)/,
    mapped: {
      message: 'Recipient already set',
      suggestion: 'The recipient for this stream is already set and cannot be changed to the same address.',
      category: 'user',
    },
  },
  // 11: BatchSizeExceeded
  {
    pattern: /Error\(Contract,\s*#?11\)/,
    mapped: {
      message: 'Batch size exceeds maximum',
      suggestion: 'You can create a maximum of 20 streams per batch. Split your request into smaller batches.',
      category: 'user',
    },
  },
  // 12: BatchEmpty
  {
    pattern: /Error\(Contract,\s*#?12\)/,
    mapped: {
      message: 'Batch cannot be empty',
      suggestion: 'You must specify at least one stream to create in the batch.',
      category: 'user',
    },
  },
  // 13: ArithmeticOverflow
  {
    pattern: /Error\(Contract,\s*#?13\)/,
    mapped: {
      message: 'Arithmetic overflow in calculation',
      suggestion: 'The stream parameters cause a calculation overflow. Try reducing the amount or duration.',
      category: 'contract',
    },
  },
  // 14: AlreadyInitialized
  {
    pattern: /Error\(Contract,\s*#?14\)/,
    mapped: {
      message: 'Contract already initialized',
      suggestion: 'The contract has already been set up. Initialization can only happen once.',
      category: 'contract',
    },
  },
  // 15: NotInitialized
  {
    pattern: /Error\(Contract,\s*#?15\)/,
    mapped: {
      message: 'Contract not initialized',
      suggestion: 'The contract has not been initialized yet. Please try again later.',
      category: 'contract',
    },
  },
  // 16: ContractPaused
  {
    pattern: /Error\(Contract,\s*#?16\)/,
    mapped: {
      message: 'Contract is paused',
      suggestion: 'The FlowStar contract is currently paused for maintenance. Please try again later.',
      category: 'network',
    },
  },
  // 17: DurationExceedsMaximum
  {
    pattern: /Error\(Contract,\s*#?17\)/,
    mapped: {
      message: 'Stream duration exceeds maximum',
      suggestion: 'The stream duration is too long. Use a shorter duration or split into multiple streams.',
      category: 'user',
    },
  },
  // 18: InvalidRecipient
  {
    pattern: /Error\(Contract,\s*#?18\)/,
    mapped: {
      message: 'Invalid recipient address',
      suggestion: 'The recipient address is invalid or cannot receive the stream. Check the address and try again.',
      category: 'user',
    },
  },
  // 19: RateIsZero
  {
    pattern: /Error\(Contract,\s*#?19\)/,
    mapped: {
      message: 'Stream amount too small for duration',
      suggestion: 'The amount is too small relative to the duration. Increase the amount or reduce the duration.',
      category: 'user',
    },
  },
  // 20: StreamNotEligibleForCleanup
  {
    pattern: /Error\(Contract,\s*#?20\)/,
    mapped: {
      message: 'Stream not eligible for cleanup',
      suggestion: 'The stream must be fully cancelled or drained before cleanup. Wait until the stream ends.',
      category: 'contract',
    },
  },
  // 21: PastStartTime
  {
    pattern: /Error\(Contract,\s*#?21\)/,
    mapped: {
      message: 'Stream start time cannot be in the past',
      suggestion: 'Choose a start time in the future. Backdating a stream is not allowed.',
      category: 'user',
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

/**
 * Maps a raw error value thrown during a Soroban transaction (or any other
 * operation) to a structured {@link MappedError} with a user-friendly message,
 * an actionable suggestion, an {@link ErrorCategory}, and the original error
 * string as `details`.
 *
 * **Matching strategy:**
 * The function iterates through `ERROR_PATTERNS` in declaration order. Each
 * pattern is either a `RegExp` (tested with `RegExp.test()`) or a plain
 * `string` (matched with a case-insensitive `includes()` check). The first
 * matching pattern wins. Patterns are ordered so that specific Soroban
 * contract error codes (`Error(Contract, #N)`) appear before broader
 * catch-all patterns (e.g. "insufficient balance").
 *
 * If no pattern matches, a generic `"Transaction failed"` fallback is
 * returned with `category: "contract"` and the raw message as `details`.
 *
 * **Known limitation:** The numeric contract error codes (#1–#21) are mapped
 * by hand to the `StreamError` enum in `contracts/streaming/src/lib.rs`. Run
 * `node scripts/check-error-mappings.mjs` after changing either file to verify
 * that every enum variant still has a mapping (see `docs/ERROR_CODE_SYNC.md`).
 *
 * @param raw - The thrown value. Accepts an `Error` instance (uses
 *              `.message`) or any other type (coerced to a string via
 *              `String()`).
 * @returns A {@link MappedError} with `message`, `suggestion`, `category`,
 *          and `details` (the original raw message).
 */
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

/**
 * Returns a short, human-readable label for an {@link ErrorCategory} suitable
 * for display in UI headings or badges (e.g. `"Input error"`,
 * `"Network error"`).
 *
 * @param category - The error category to label.
 * @returns A display-ready string for the given category.
 */
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

/**
 * Returns a Tailwind CSS text-colour class pair for the given
 * {@link ErrorCategory}, one for light mode and one for dark mode (e.g.
 * `"text-amber-600 dark:text-amber-400"`).
 *
 * Intended to be applied directly to a JSX element's `className` prop so that
 * error labels are colour-coded consistently across the UI.
 *
 * @param category - The error category to colour.
 * @returns A Tailwind CSS class string for the matching text colour.
 */
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
