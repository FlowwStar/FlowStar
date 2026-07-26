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
}: TokenAmountProps) {
  const formattedAmount = compact
    ? formatCompactAmount(amount, token.decimals)
    : formatTokenAmount(amount, token.decimals, maxFractionDigits)

  return (
    <span className={cn('font-mono tabular-nums', className)}>
      {formattedAmount}
      {showSymbol && (
        <span className={cn('ml-1 text-muted-foreground', symbolClassName)}>
          {token.symbol}
        </span>
      )}
    </span>
  )
}
