# ADR-013: Auto-Withdraw Strategy Pattern

## Status

Accepted (open correctness issues — see #225, #226, #275, #276, #277)

## Context

A stream recipient may want funds withdrawn automatically as they unlock,
rather than remembering to withdraw manually. Different recipients want
different tradeoffs between withdrawal frequency, minimum-worthwhile amounts,
and transaction-fee overhead, so a single fixed policy ("withdraw everything
every hour") doesn't fit everyone. `hooks/use-auto-withdraw.ts` implements
this as a configurable, per-stream, client-side polling strategy.

## Decision

### Strategy options

`WithdrawStrategy` is one of four values, selected per-stream by the user:

| Strategy               | Intended behavior                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `time-based` (default) | Withdraw the full withdrawable amount on every interval tick, no additional condition.                                                                                                        |
| `threshold-based`      | Only withdraw once the withdrawable amount reaches `thresholdPercentage`% of the stream's total `depositedAmount`.                                                                            |
| `gas-optimized`        | Skip a tick if less than 1 day has passed since the last withdrawal (successful or not) — reduces transaction-fee overhead by batching unlocked funds into less-frequent, larger withdrawals. |
| `max`                  | Functionally identical to `time-based` today (see Consequences) — intended as "withdraw the maximum possible amount," which under the current unlock model is already what `time-based` does. |

All strategies are additionally bounded by two settings, applied after the
strategy-specific calculation:

- `minAmountRaw`: skip the withdrawal entirely if the withdrawable amount is
  below this floor (avoids paying a transaction fee to move a trivial amount).
- `maxSafetyLimitRaw`: cap any single automatic withdrawal at this amount,
  regardless of how much is actually withdrawable — a safety ceiling against
  withdrawing more than the user expects in one automated transaction.

### Polling interval bounds

`intervalHours` is clamped to a **minimum of `MIN_INTERVAL_HOURS = 1`** via
`clampIntervalHours`. There is currently **no maximum bound** — a user can
set an arbitrarily large interval (or one could be set via a corrupted
`localStorage` value, since `loadSettings` re-clamps on load but only enforces
the floor, not a ceiling).

### Persistence model

Settings are stored in `localStorage` **per stream**, keyed by
`` `flowstar:auto-withdraw:${streamId}` ``, not globally — enabling
auto-withdraw for one stream has no effect on any other stream's settings,
and each stream's settings (strategy, thresholds, enabled flag, and its own
withdrawal history) persist independently. Withdrawal history is capped at
the 100 most recent entries per stream (success or failure, each with a
timestamp and either a `txHash` or an `error` string).

The polling loop itself (a `setInterval` re-created whenever the relevant
settings or `stream` change) lives only in React state/refs — it does not
persist across a page reload or a closed tab. Auto-withdraw only actually
runs while the Settings/stream page (wherever `useAutoWithdraw` is mounted)
is open in a browser tab; it is not a background service.

## Consequences

**Easier:**

- Recipients get a real automated-withdrawal feature without a backend
  service or keeper network — it's a pure client-side polling loop.
- Per-stream persistence and per-stream settings keys mean streams don't
  interfere with each other's automation config.

**Harder / accepted limitations:**

- **No background execution**: if the user closes the tab, auto-withdraw
  stops. This is a fundamental limitation of a client-only implementation,
  not a bug — a real fix would require a server-side keeper/cron process,
  which is a much larger design change than this ADR covers.
- **`max` strategy currently has no distinct behavior** from `time-based` —
  see #225/#226/#275/#276/#277 for the tracked correctness work needed to
  make each strategy actually distinct and correct (e.g. `max` withdrawing
  more aggressively than `time-based` in some scenario the current code
  doesn't differentiate).
- **No maximum interval bound**: an extremely large `intervalHours` (or a
  corrupted stored value) is accepted as-is; only the 1-hour floor is
  enforced. Whether a ceiling is needed is an open question for whoever picks
  up the linked correctness issues.
- **Fee/gas awareness is approximate**: `gas-optimized` uses a fixed 1-day
  cooldown rather than any actual on-chain fee estimation — it's a heuristic,
  not a real gas-price-aware strategy despite the name.

This ADR documents intended behavior as a reference for the linked
correctness issues; it does not itself resolve them.
