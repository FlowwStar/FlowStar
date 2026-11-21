# ADR-015: Re-anchoring the Vesting Schedule in `top_up` and `partial_cancel`

## Status

Accepted

## Context

Both `top_up` and `partial_cancel` mutate a stream's total balance after the stream has already started. The contract computes how much has vested using five fields: `start_time`, `cliff_time`, `cliff_amount`, `linear_amount`, and `amount_per_second`. When funds are added or removed mid-stream, those fields must be updated — otherwise `get_stream` and `unlocked_amount` return stale or incorrect values, and the recipient's withdrawable balance diverges from reality.

### The re-anchoring problem

Consider a stream created at T=0 with these parameters:

```
deposited_amount   = 10,000 XLM (100,000,000,000 stroops)
cliff_time         = T + 30 days  (cliff_amount = 2,000 XLM)
end_time           = T + 365 days
linear_amount      = 8,000 XLM
amount_per_second  = ~253 stroops/s
start_time         = T
```

At T+60 days (past the cliff) the sender calls `top_up(2,000 XLM)`. Without re-anchoring, the contract would just increment `deposited_amount` to 12,000 XLM and recalculate `amount_per_second` using the **original** `start_time` and `duration`. That produces a wrong rate because the formula `unlocked = cliff_amount + amount_per_second × (now - start_time)` double-counts the time already elapsed.

Three approaches were considered:

1. **Separate tranches** — store each top-up or partial-cancel as an independent sub-stream with its own schedule and sum them at read time.
2. **Keep the original schedule** — record only the delta and fold it into `deposited_amount`, adjusting only `amount_per_second` over the original duration.
3. **Re-anchor at the moment of the call** — freeze whatever is already unlocked as a new `cliff_amount` valued at `now`, set `start_time = cliff_time = now`, and spread the new remaining balance linearly over the time left to `end_time`.

## Decision

**Re-anchor the vesting schedule at the moment of each `top_up` or `partial_cancel` call.**

The re-anchoring algorithm (implemented identically in both functions) is:

```
let already_unlocked = unlocked_amount(&stream, now)
let remaining        = deposited_amount - already_unlocked   // after adding/subtracting the delta

stream.cliff_time        = now
stream.cliff_amount      = already_unlocked
stream.start_time        = now
stream.linear_amount     = remaining
stream.duration          = end_time - now
stream.amount_per_second = remaining / (end_time - now)
```

The exception is calls made **before** the cliff: since nothing has unlocked yet, the cliff bonus is left untouched and only `linear_amount` and `amount_per_second` are updated. Re-anchoring is skipped because `cliff_amount` hasn't been earned and moving the cliff forward would change what the recipient receives at cliff time.

### Worked numeric example

Stream at T+60 days (past the cliff), before `top_up`:

```
deposited_amount   = 10,000 XLM
withdrawn_amount   = 0
already_unlocked   = cliff_amount + amount_per_second × (60d - 30d)
                   ≈ 2,000 + 253 × 2,592,000 ≈ 2,000 + 655,776 = ~8,656 XLM  (capped at deposited)
```

Sender calls `top_up(2,000 XLM)` → `deposited_amount` becomes 12,000 XLM.

After re-anchoring at T+60d (305 days remaining):

```
cliff_time        = T+60d
cliff_amount      = 8,656 XLM   (all that's already unlocked)
start_time        = T+60d
linear_amount     = 12,000 - 8,656 = 3,344 XLM
duration          = 305d = 26,352,000s
amount_per_second = 3,344 XLM / 26,352,000s ≈ 126,920 stroops/s
```

From T+60d onward the recipient sees `cliff_amount` (8,656 XLM) available immediately plus 126,920 stroops/s streaming linearly to T+365d.

The same arithmetic applies to `partial_cancel` — with the sign of the delta reversed.

## Consequences

- **Easier:** `unlocked_amount` and `get_stream` remain correct after any number of top-ups or partial cancels. No separate tranche tracking is required.
- **Harder:** `get_stream` returns a schedule that looks different from the original after a re-anchor. Clients that cached `start_time` or `cliff_time` and use them for display (e.g. "stream started on …") must re-query or store the original values separately for display purposes.
- **Rate changes:** Each `top_up` or `partial_cancel` changes `amount_per_second`. Clients showing a live rate counter should recompute it after any `TopUpEvent` or `PartialCancelEvent`.
- **Dust:** Re-anchoring performs an integer division (`remaining / remaining_seconds`) identical to the original `compute_rate`. The dust behavior described in ADR-007 applies to the re-anchored schedule as well.
- **RateIsZero guard:** If the resulting `amount_per_second` would be zero while `linear_amount > 0`, the transaction is rejected with `RateIsZero`. This prevents dust streams that would never stream out.

## Alternatives Considered

- **Separate tranches.** Each top-up creates an independent sub-schedule. Summing them at read time preserves full history but multiplies the number of fields that must be read and stored, and complicates the `withdraw` and `cancel` path significantly. Rejected for complexity.
- **Keep the original schedule.** Adjust only `amount_per_second` using the original `start_time` and total `duration`. Rejected because `unlocked_amount` uses `now - start_time` as the elapsed duration; recalculating the rate over the full original duration while time has already passed produces an incorrect unlocked value from the moment of the call onward.

## References

- Issue #1209: ADR — re-anchoring the vesting schedule in `top_up` and `partial_cancel`
- ADR-007: Integer Division Dust Handling
- `contracts/streaming/src/lib.rs` — `top_up`, `partial_cancel`, `unlocked_amount`
