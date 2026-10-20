# Issue #147 — Frontend Rate Limiting on Stream Creation

## Overview

Stream creation currently has no client-side throttle. A user (or a
malfunctioning script) could click "Confirm & sign" multiple times in quick
succession, fire the same `create_stream` transaction more than once, or
abuse the batch creation path to flood the contract's index storage. The
Stellar network's fee/sequence-number model provides some implicit pressure
but no hard per-session ceiling. This document describes the design and
integration points for adding frontend rate limiting.

---

## Problem statement

| Path | Entry point | Current guard | Gap |
|---|---|---|---|
| Single create | `handleConfirmedCreate()` in `create-form.tsx` | `pending` boolean from `useContract` | No cooldown after success; no session quota |
| Batch create | `handleExecute()` in `batch/page.tsx` | `pending \|\| executing` booleans | No confirmation dialog above a configurable threshold; no session quota |
| Contract layer | `useContract.run()` in `use-contract.ts` | Sets `pending = true` for duration of tx | Only blocks concurrent calls, not rapid sequential ones |

The `pending` flag prevents a second transaction while one is in-flight
(achieving acceptance criterion #1), but nothing enforces a post-success
cooldown, a per-session creation ceiling, or a batch-size confirmation
dialog.

---

## Acceptance criteria (from issue)

1. **In-flight lock** — "Create Stream" button disabled while a transaction is in-flight.
2. **Post-success cooldown** — button remains disabled for 3–5 seconds after a successful creation.
3. **Session quota warning** — a warning is shown if more than 10 streams are created in a 5-minute rolling window.
4. **Batch confirmation threshold** — batch creation shows a confirmation dialog when the pending row count exceeds a configurable threshold (default: 20).
5. **Duplicate prevention** — rapid duplicate clicks do not produce duplicate transactions.

Criterion 1 is already satisfied by the existing `pending` flag. Criteria 2–5 require new code.

---

## Architecture

### `useCreationRateLimit` hook (new)

A single new hook centralises criteria 2, 3, and 5. It lives at
`hooks/use-creation-rate-limit.ts`.

```
useCreationRateLimit
  ├── cooldownActive: boolean        — true for 3–5 s post-success
  ├── sessionCount: number           — streams created this session
  ├── quotaWarning: boolean          — true when sessionCount > QUOTA_THRESHOLD in QUOTA_WINDOW_MS
  ├── record()                       — call after every successful creation
  └── reset()                        — exposed for testing / sign-out
```

Internal storage uses a `useRef`-held array of creation timestamps so the
rolling window calculation does not re-render on every tick. The cooldown
timer is managed with `setTimeout` + a cleanup `useEffect`.

`sessionCount` and the timestamp ring are kept in `localStorage` under
`flowstar_creation_log_<walletAddress>` so a page refresh within the same
session does not reset the quota counter. The entry expires after
`QUOTA_WINDOW_MS` (5 minutes).

### `useContract` updates

`useContract.run()` is the single executor for every mutation. A thin
integration with `useCreationRateLimit` inside `createStream` and
`createStreamsBatch` ensures the hook's `record()` is called on success.
No changes are needed to `lib/contract.ts`.

### `AbortController` deduplication (criterion 5)

`create-form.tsx` already calls `validate()` and then opens a two-step
modal before hitting `handleConfirmedCreate()`. The natural deduplication
path is:

1. Disable the "Confirm & sign" button while `pending` is true (already
   done by the `disabled={pending}` prop on `CreateConfirmation`).
2. Add a `submittingRef = useRef(false)` guard inside
   `handleConfirmedCreate()` that is set to `true` at entry and cleared in
   `finally`. This prevents the extremely unlikely case where two async
   calls race before React re-renders to reflect `pending = true`.

An `AbortController` instance is passed to the `createStream` / `createStreamsBatch`
calls in `lib/contract.ts` (via the `signal` option on the existing
`fetchWithRetry` calls) so a redundant in-flight request can be cancelled if
the component unmounts or the user navigates away before confirmation.

### Batch confirmation threshold

`batch/page.tsx` renders the "Execute batch" button. A new
`BATCH_CONFIRM_THRESHOLD` constant (default `20`) triggers a standard
`<AlertDialog>` before `handleExecute()` is called. The threshold is read
from an optional `NEXT_PUBLIC_BATCH_CONFIRM_THRESHOLD` environment variable
so it can be tuned per deployment without a code change.

---

## Component integration map

```
app/app/create/create-form.tsx
  └── useCreationRateLimit()               ← new
        ├── cooldownActive → disabled prop on "Create Stream" button
        ├── quotaWarning   → inline warning banner (amber, below the form)
        └── record()       ← called in handleConfirmedCreate() on success

app/app/create/batch/page.tsx
  ├── useCreationRateLimit()               ← new
  │     ├── quotaWarning → inline warning banner
  │     └── record(n)    ← called after createStreamsBatch() with row count
  └── BatchConfirmDialog (new, inline)     ← shown when validRows.length > BATCH_CONFIRM_THRESHOLD

hooks/use-contract.ts
  └── no structural changes; createStream / createStreamsBatch callers
      own the record() call so useContract stays generic

hooks/use-creation-rate-limit.ts          ← new file
```

---

## Constants

| Constant | Default | Location |
|---|---|---|
| `COOLDOWN_MS` | `4000` (4 s) | `use-creation-rate-limit.ts` |
| `QUOTA_THRESHOLD` | `10` | `use-creation-rate-limit.ts` |
| `QUOTA_WINDOW_MS` | `300_000` (5 min) | `use-creation-rate-limit.ts` |
| `BATCH_CONFIRM_THRESHOLD` | `20` | `batch/page.tsx` (env-overridable) |

All constants are exported so downstream tests can import and override them.

---

## State transitions — single stream

```
[idle]
  → user clicks "Create Stream" → validate() passes
  → modal opens (TxPreviewDialog → CreateConfirmation)
  → user clicks "Confirm & sign"
  → pending = true   [in-flight]
  → tx succeeds
  → record()                     [cooldown starts, sessionCount++]
  → pending = false, cooldownActive = true  [post-success cooldown]
  → after COOLDOWN_MS
  → cooldownActive = false       [idle]

  if sessionCount > QUOTA_THRESHOLD within QUOTA_WINDOW_MS:
  → quotaWarning = true          [quota warning shown; submissions still allowed]
```

The quota warning is advisory — it does not hard-block creation. This
matches the issue description ("warn after 10 streams") and preserves
legitimate high-frequency use cases (treasury ops, payroll runs).

---

## State transitions — batch

```
[idle]
  → validRows.length > BATCH_CONFIRM_THRESHOLD
  → BatchConfirmDialog shown
  → user confirms
  → pending = true, executing = true  [in-flight]
  → createStreamsBatch() succeeds
  → record(validRows.length)          [sessionCount += n]
  → pending = false, executing = false, cooldownActive = true
  → after COOLDOWN_MS
  → cooldownActive = false  [idle]
```

---

## Non-goals

- **Server-side enforcement** — rate limiting at the contract or RPC layer
  is outside scope. The Stellar network's base fee and sequence number model
  already provides a hard limit at the protocol level.
- **Cross-tab synchronisation** — `localStorage` writes are not coordinated
  across browser tabs. Two tabs can each independently reach the quota
  threshold; this is acceptable given the advisory nature of the warning.
- **Persistent block** — the quota warning never hard-blocks the user. A
  hard block would require server-side session state and is disproportionate
  to the risk.

---

## Related issues

- **#686** — ARIA live region for batch progress (batch page accessibility; already shipped)
- **#676** — Draft-save failure toasts in `create-form.tsx`
- **#155** — Federation address resolution (uses a 500 ms debounce in `create-form.tsx`; independent of rate limiting)
- **`useBatchCreate.ts`** — defines a vestigial `DEFAULT_BATCH_DELAY = 2000` constant with a comment "to avoid rate limiting". Once `useCreationRateLimit` is wired, this constant should be removed or replaced with a reference to the new hook's `COOLDOWN_MS`.
