# ADR-007: Integer Division Dust Handling

## Status

Accepted

## Context

The contract computes `amount_per_second = deposited_amount / duration_seconds` using integer division. For a stream of 100 XLM (1,000,000,000 stroops) over 86,400 seconds (1 day), the exact rate is 11,574.074… stroops/second. Integer division truncates to 11,574. Over 86,400 seconds that releases 999,993,600 stroops — leaving 6,400 stroops (0.00064 XLM) permanently locked in the contract as **dust**.

Options considered:
1. **Refund dust to sender at creation** — requires the contract to call back into the token contract at creation time, adding complexity and a second token transfer.
2. **Credit dust to recipient on final withdraw** — requires tracking whether a full-duration withdraw has occurred.
3. **Accept dust** — document the behavior and bound the maximum loss.

## Decision

**Accept the dust.** The maximum dust per stream is `duration_seconds - 1` stroops, which for even a 10-year stream (315,360,000 seconds) is less than 0.032 XLM. This is well within acceptable rounding tolerance for any realistic stream amount. The behavior is documented in contract comments.

## Consequences

- **Easier:** No additional contract logic or extra token transfers. The contract remains simple and auditable.
- **Harder:** Power users streaming very small amounts over very long durations will see a slightly smaller final withdrawal than expected. The frontend should display a "~" on estimated amounts to signal this.
- **Bounded risk:** The maximum dust is always `< duration_seconds` stroops — approximately 1 stroop per second of stream duration — which is negligible compared to any meaningful stream amount.
