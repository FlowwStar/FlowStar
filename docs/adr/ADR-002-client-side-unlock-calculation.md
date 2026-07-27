# ADR-002: Client-Side Unlock Calculation

## Status

Accepted

## Context

The UI shows a live "unlocked so far" counter that updates every second. Two approaches were considered:

1. **Poll the contract** — call `get_withdrawable` on every tick via RPC.
2. **Calculate client-side** — read stream parameters once, then compute `unlocked = cliffAmount + elapsed × amountPerSecond` locally in JavaScript on every tick.

Polling every second would generate one RPC call per second per open stream detail page. Stellar's Soroban RPC is rate-limited and adds 200–600 ms of latency per call, making a smooth per-second counter impossible via polling.

## Decision

Unlock math runs **client-side** in `lib/stream-utils.ts`. The frontend fetches the stream record once (or on explicit refresh) and derives the current unlocked amount using `Date.now()` as the clock. The contract is only queried at action time (withdraw/cancel) and on page load.

## Consequences

- **Easier:** Smooth, real-time counter with zero additional RPC load. Works offline or under poor connectivity.
- **Harder:** The client clock can drift from the ledger's close time. In practice the drift is small (< 1 ledger close interval ≈ 5 s), and the contract is authoritative at transaction time anyway.
- **Risk:** If a user's system clock is significantly wrong, the displayed amount may differ from the contract's result. The withdraw button always shows the contract-confirmed amount after the transaction.
