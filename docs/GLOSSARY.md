# Glossary

Domain-specific terms used throughout FlowStar's code, docs, and ADRs.

### Stream

The core object: a token-streaming payment from a **sender** to a
**recipient**, unlocking over time between `startTime` and `endTime`
(`types/stream.ts`'s `StreamData`). See also: **linear unlock**, **cliff**.

### Sender

The address that funded and created a stream. Can cancel it (unless
cancelled already, or fully completed). Referred to as `creator` in some
contract-level code paths.

### Recipient

The address that receives a stream's unlocking funds and can withdraw them.
Can appoint a **delegate** to withdraw on their behalf.

### Cliff

A point before which none of a stream's **linear unlock** applies. A stream
can have a `cliffTime` (absolute) and `cliffAmount` (a lump sum unlocked
exactly at the cliff, on top of whatever the linear schedule would otherwise
release by that point). Common use case: "nothing vests for the first 90
days, then unlock linearly" or "release 10% immediately, then the rest
linearly."

### Vesting

Used interchangeably with "unlocking" in this codebase — the process by which
a stream's deposited funds become withdrawable over time, whether via a
cliff, linear unlock, or both. Not a distinct on-chain mechanism from
streaming; "vesting schedule" and "stream unlock schedule" refer to the same
thing.

### Linear unlock / unlock rate

After any cliff, funds unlock at a constant rate: `amountPerSecond`
(`linearAmount / duration`, per `StreamData`). Because this uses integer
division, a small remainder ("dust", see below) is possible — see
[ADR-007](./adr/ADR-007-integer-division-dust.md).

### Dust

The small amount (`< duration_seconds` stroops, see
[ADR-007](./adr/ADR-007-integer-division-dust.md)) that can be permanently
unwithdrawable due to integer-division truncation when computing
`amount_per_second`. Accepted as negligible for realistic stream amounts
rather than engineered away.

### Delegate withdrawal

A stream's recipient can appoint a **delegate** address as the sole signer
authorized to call `withdraw()` for that stream, without handing over their
own keys — e.g. an ops wallet pulling payroll for a cold-storage recipient.
While a delegate is set, only the delegate (not the recipient directly) can
authorize a withdrawal; funds still go to the recipient regardless of who
triggered it. See [ADR-008](./adr/ADR-008-delegate-withdrawal-authorization.md).

### Archived stream

A stream that has reached a terminal state — cancelled, or fully withdrawn
past its `endTime` — and no longer supports the active-stream actions
(withdraw, cancel, select). Shown in a separate "Archived" tab in the streams
list; can be permanently removed from local history via `cleanup_stream()`.

### Split lock / split stream

Not currently a FlowStar concept (this term appears in the related StellarLock
project's token-locker for multi-beneficiary locks) — FlowStar streams are
always single-sender-to-single-recipient.

### Mock mode

FlowStar's fallback when no contract ID is configured
(`NEXT_PUBLIC_STREAM_CONTRACT_ID_TESTNET`/`_MAINNET`): all data comes from
`lib/mock-data.ts` instead of the real contract, requiring no wallet or
testnet funds. See [ADR-003](./adr/ADR-003-mock-mode.md).

### Hidden stream / blocked sender

A purely client-side (localStorage, this device only) mechanism letting a
recipient declutter their dashboard by hiding specific streams or blocking a
sender's streams from view — with no on-chain effect; the stream still
exists and remains fully cancellable/withdrawable. See
[`lib/hidden-streams.ts`](../lib/hidden-streams.ts).

### Auto-withdraw

An opt-in, per-stream, client-side polling feature that automatically
withdraws unlocked funds on a schedule, using one of several strategies
(`time-based`, `threshold-based`, `gas-optimized`, `max`). Only runs while a
FlowStar tab with the feature enabled is open — there is no background/server
component. See [`hooks/use-auto-withdraw.ts`](../hooks/use-auto-withdraw.ts).
