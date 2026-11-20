# Cancelled-stream display semantics

This document records the intended values of the pure stream helpers for
**cancelled** streams. The fixtures live in
`tests/fixtures/stream-utils-cancelled.fixtures.ts`; they are data only, not
Vitest tests.

## What the current helpers do

`getUnlockedAmount`, `getWithdrawableAmount`, `getLockedAmount` and
`getStreamProgress` in `lib/stream-utils.ts` are **time-based** functions. They
do not branch on `StreamData.cancelled`:

- `getUnlockedAmount` returns `0n` before the cliff, `depositedAmount` at or
  after `endTime`, and `cliffAmount + elapsed × linearAmount / duration`
  in between (capped at `depositedAmount`).
- `getWithdrawableAmount` is `max(0, unlocked - withdrawnAmount)`.
- `getLockedAmount` is `depositedAmount - unlocked`.
- `getStreamProgress` is `unlocked / depositedAmount`, clamped to `[0, 1]`
  (`0` when `depositedAmount` is `0n`).

`getStreamStatus` is the only helper that checks the flag: a cancelled stream
always reports `'cancelled'`, regardless of the clock.

For a stream cancelled through the current contract, `withdrawnAmount`
includes the cancel payout (see `docs/adr/ADR-014-cancelled-at-and-withdrawn-amount.md`).
That is what makes `getWithdrawableAmount` return `0n` at the cancellation
moment even though the helpers themselves ignore `cancelled`.

## Fixture scenarios

All three snapshots use the same base stream: 100 USDC deposited
(`1_000_000_000n` at 7 decimals), `startTime = 1000`, `cliffTime = 1500`,
`endTime = 2000`, `cliffAmount = 100_000_000n`, `linearAmount = 900_000_000n`,
`duration = 1000`, `cancelled = true`.

| Scenario | `nowSeconds` | `withdrawnAmount` | unlocked | withdrawable | locked | progress |
| --- | --- | --- | --- | --- | --- | --- |
| Cancelled before cliff | 1200 | `0n` | `0n` | `0n` | `1_000_000_000n` | `0` |
| Cancelled mid-stream | 1500 | `550_000_000n` | `550_000_000n` | `0n` | `450_000_000n` | `0.55` |
| Cancelled after end | 2500 | `1_000_000_000n` | `1_000_000_000n` | `0n` | `0n` | `1` |

The mid-stream payout is `100_000_000n` cliff plus
`500 × 900_000_000n / 1000 = 450_000_000n` linear.

## Known caveat — cancelled-display fix

On chain, `withdrawable_amount` short-circuits to `0` for any cancelled stream,
and `cancel` pays out the unlocked amount at the cancellation timestamp. The
client helpers do **not** freeze the unlock curve at that timestamp: if a
cancelled stream has a stale `withdrawnAmount` (for example a legacy stream
migrated before `cancelled_at` existed, or a mock stream whose `cancel` only
flips the flag), they can keep reporting a growing unlocked amount and a
non-zero withdrawable balance after cancellation.

Until the cancelled-display fix lands, treat these numbers as a display
approximation only:

- Use `getStreamStatus(stream) === 'cancelled'` to suppress withdraw/cancel
  actions and live counters.
- Trust `get_withdrawable` on chain for any transaction amount.
- When the fix updates the helpers (freezing unlocked/locked at cancellation
  and forcing withdrawable to `0n`), update the fixture expectations above in
  the same change.
