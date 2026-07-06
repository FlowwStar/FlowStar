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
  // Insufficient balance
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
