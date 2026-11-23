# Token Amount Precision and Rounding in the UI

This document describes how FlowStar stores, computes, and displays token amounts, what rounding occurs at each stage, and what that means for the numbers a user sees.

## On-chain representation

All amounts on the contract are stored and computed as integers in the token's **smallest unit** (stroops for XLM, the equivalent for other SEP-41 tokens). There are no floats or decimals anywhere in the contract.

For XLM, 1 token = 10,000,000 stroops (7 decimal places). A stream of 100 XLM is stored as `1_000_000_000` (one billion stroops).

The frontend receives these values as `i128` (Rust) / `BigInt` (JavaScript) and must convert them for display.

## Display conversion

Conversion is handled by `formatTokenAmount` in `lib/stream-utils.ts`:

```ts
formatTokenAmount(raw: bigint, decimals: number, maxFractionDigits = 4): string
```

Steps:
1. Split `raw` into whole units (`raw / 10^decimals`) and the fractional remainder (`raw % 10^decimals`).
2. Format the whole part with `toLocaleString('en-US')` for thousands separators.
3. Pad the fractional part with leading zeros to `decimals` places, then slice to `maxFractionDigits`.
4. Strip trailing zeros from the fractional string.

**Example:** `1_234_567_890` stroops with `decimals=7`, `maxFractionDigits=4`:
- Whole: `123`
- Fraction: `4567890` → slice to 4 → `4567` → no trailing zeros → `.4567`
- Result: `123.4567`

The `<TokenAmount>` component defaults `maxFractionDigits` to `4`. Callers can pass a different value; `maxFractionDigits=0` suppresses the fractional part entirely.

## Rounding behavior

`formatTokenAmount` **truncates**, it does not round. Digits beyond `maxFractionDigits` are dropped, not rounded up. This means the displayed value is always ≤ the true value.

**Example:** `1_000_000_001` stroops = `100.0000001 XLM`. With `maxFractionDigits=4`, this displays as `100` (the `0001` fractional part is truncated to `0000`, which is then stripped as trailing zeros).

This is intentional: showing a number slightly smaller than the true value is safer than rounding up, which could suggest the user has more funds than they actually do.

## Compact notation

`formatCompactAmount` converts the raw bigint to a JavaScript `number` before formatting:

```ts
const value = Number(raw) / Number(10n ** BigInt(decimals))
```

This conversion loses precision for amounts larger than `Number.MAX_SAFE_INTEGER` (≈ 9 × 10¹⁵). For XLM with 7 decimals, `Number.MAX_SAFE_INTEGER` corresponds to roughly 900 million XLM — well above any realistic stream amount. For tokens with fewer decimals, the threshold is proportionally higher.

Compact amounts are formatted with `maximumFractionDigits: 1` (e.g., `1.2K`, `3.4M`). They are used for the stream card list view where space is limited and exact precision is not required.

## Streaming rate display

`formatRate` in `lib/stream-utils.ts` converts `amountPerSecond` (a bigint of smallest units) to a JavaScript `number` for all rate calculations:

```ts
const perSecond = Number(amountPerSecond) / 10 ** decimals
```

Rates per minute/hour/day/month/year are derived by multiplying `perSecond` by the appropriate constant. The result is a floating-point number and subject to normal floating-point rounding.

For amounts ≥ 1, rates are displayed with `maximumFractionDigits: 2` (e.g., `12.34 XLM/day`). For amounts < 1, `toPrecision(4)` is used to retain 4 significant figures (e.g., `0.001234 XLM/day`), with trailing zeros stripped.

The "best" rate unit is chosen as the smallest unit whose rate value is ≥ 0.01, working up from per-minute. This keeps the displayed number in a readable range.

## Integer division dust

The contract computes `amount_per_second = linear_amount / duration_seconds` using integer division, which truncates. The lost remainder (dust) is permanently locked in the contract and cannot be withdrawn.

The maximum dust per stream is `duration_seconds - 1` stroops. For a 1-year stream that is at most 31,535,999 stroops ≈ 3.15 XLM. For a 10-year stream it is at most ≈ 31.5 XLM.

The same integer division recurs each time the vesting schedule is re-anchored by `top_up` or `partial_cancel` (see ADR-015). Each re-anchor introduces a new dust increment bounded by `remaining_seconds - 1` stroops at the time of the call.

The UI displays a `~` prefix on estimated amounts where dust could make the final withdrawal slightly smaller than the displayed total. See ADR-007 for a full discussion.

## `~` indicator

Where the displayed amount is an estimate (derived from `amount_per_second × elapsed`, which may differ from the actual withdrawable amount due to dust), the UI prefixes the value with `~`. This appears on:

- The live unlock counter on the stream detail page.
- The "estimated total" shown before the stream ends.

After the stream ends and all funds are withdrawn, the final `withdrawn_amount` from the contract is shown without `~`.

## Summary of precision loss points

| Stage | Mechanism | Magnitude |
|---|---|---|
| Contract: rate calculation | Integer division (`linear_amount / duration`) | Up to `duration - 1` stroops per stream creation |
| Contract: re-anchor | Integer division on remaining balance | Up to `remaining_seconds - 1` stroops per `top_up` or `partial_cancel` |
| Display: `formatTokenAmount` | Truncation at `maxFractionDigits` | Up to `10^(decimals - maxFractionDigits) - 1` stroops (e.g. up to 999 stroops for XLM at 4 digits) |
| Display: `formatCompactAmount` / `formatRate` | `Number` conversion | Negligible for realistic amounts (< 900M XLM) |
