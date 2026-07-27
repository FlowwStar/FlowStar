# ADR-005: BigInt for Token Amounts

## Status

Accepted

## Context

Soroban contracts represent token amounts as `i128` (signed 128-bit integer) in stroops (1 XLM = 10,000,000 stroops). JavaScript's `number` type is a 64-bit IEEE 754 float, which can only represent integers exactly up to 2^53 − 1 (≈ 9 × 10^15). A stream of 1 billion XLM expressed in stroops is 10^16, which exceeds the safe integer range and would introduce silent rounding errors.

## Decision

All token amounts throughout the codebase use JavaScript's native **`bigint`** type. The Stellar JS SDK returns `i128` values as `bigint`. Formatting for display (e.g., "1,234.56 XLM") is done by explicit division with controlled decimal rounding in `lib/stream-utils.ts` — never by converting to `number` first.

## Consequences

- **Easier:** No precision loss for any realistic token amount. The math matches the contract exactly.
- **Harder:** `bigint` and `number` cannot be mixed in arithmetic — all numeric operations in the stream layer must use `bigint` literals and explicit conversions. UI code must call formatter functions rather than doing inline math.
- **Risk:** Developer error (accidentally casting to `number` via `parseInt` or `parseFloat`) can silently reintroduce precision loss. Code review should flag any `Number(amount)` or `+amount` cast applied to a token amount variable.
