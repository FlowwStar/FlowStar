import { cn } from '@/lib/utils'
import { formatTokenAmount, formatCompactAmount } from '@/lib/stream-utils'
import type { TokenInfo } from '@/types/stream'

interface TokenAmountProps {
  amount: bigint
  token: TokenInfo
  className?: string
  symbolClassName?: string
  maxFractionDigits?: number
  showSymbol?: boolean
  /** Display amount in compact notation (e.g., "1.2K"). @default false */
  compact?: boolean
  /** Truncate the display with ellipsis. @default false */
  truncate?: boolean
}

/** Formats a raw bigint token amount with correct decimals + symbol. */
export function TokenAmount({
  amount,
  token,
  className,
  symbolClassName,
  maxFractionDigits = 4,
  showSymbol = true,
  compact = false,
  truncate = false,
}: TokenAmountProps) {
  const formattedAmount = compact
    ? formatCompactAmount(amount, token.decimals)
    : formatTokenAmount(amount, token.decimals, maxFractionDigits)

  const fullValue = `${formattedAmount}${showSymbol ? ` ${token.symbol}` : ''}`

  return (
    <span
      className={cn('font-mono tabular-nums', truncate && 'truncate', className)}
      title={truncate ? fullValue : undefined}
    >
      {formattedAmount}
      {showSymbol && (
        <span className={cn('ml-1 text-muted-foreground', symbolClassName)}>
          {token.symbol}
        </span>
      )}
    </span>
  )
}
