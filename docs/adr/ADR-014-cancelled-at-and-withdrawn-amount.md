# ADR-014: Record Cancellation Time and Fold Cancel Payout into `withdrawn_amount`

## Status

Accepted

## Context

The streaming contract's `Stream` struct tracks whether a stream has been cancelled via a boolean `cancelled` flag. However, `cancel` only sets `cancelled = true`. It does not record:

- **When** the stream was cancelled (no timestamp), and
- **How much** the recipient was paid out at cancellation time.

Additionally, when a stream is cancelled, the recipient's payout is transferred but `withdrawn_amount` is not updated to reflect it. This means `withdrawn_amount` does not equal the total amount the recipient actually received, so clients (notably the frontend) cannot recompute the recipient's total received amount from on-chain state alone. As a result, the frontend keeps "unlocking" cancelled streams because it cannot determine that a cancelled stream has already paid out its recipient.

We need to:

1. Store the cancellation timestamp so clients can reason about when a stream stopped.
2. Make `withdrawn_amount` reflect the total the recipient received, including the cancel payout, so clients can compute the recipient's total without off-chain bookkeeping.

## Decision

### Schema change

Add a new field to the `Stream` struct:

```rust
pub cancelled_at: u64,
```

- `cancelled_at == 0` means the stream has not been cancelled.
- `cancelled_at > 0` is the ledger timestamp at which `cancel` was executed.

The existing `cancelled: bool` flag is retained for backward compatibility and as a fast boolean check; `cancelled_at` is the authoritative source of the cancellation time.

### Behavior change in `cancel`

When `cancel` is invoked:

1. Compute the recipient payout as before (based on elapsed time, cliff, and streamed amount).
2. Transfer the payout to the recipient.
3. **Add the payout to `withdrawn_amount`** so that `withdrawn_amount` equals the total amount the recipient has received (withdrawals plus the cancel payout).
4. Set `cancelled = true` and `cancelled_at = <current ledger timestamp>`.

After this change, for any stream (cancelled or not):

```
recipient_total_received == withdrawn_amount
```

Clients can therefore compute the recipient's total received amount directly from `withdrawn_amount` and detect cancellation via `cancelled_at != 0`.

### `get_stream`

`get_stream` returns the full `Stream` struct, so `cancelled_at` is automatically exposed to clients. No signature change is required.

## Storage Migration

Existing `Stream` entries were persisted without the `cancelled_at` field. Adding a field to a `#[contracttype]` struct changes its serialized layout, so existing entries must be migrated.

The migration is performed in `migrate()`:

1. Iterate over all known stream IDs (tracked via a counter or an index key).
2. For each stream, read the existing entry.
3. If the entry was written under the old schema, deserialize it into the old layout, then re-serialize into the new layout with:
   - `cancelled_at = 0` if the stream was not cancelled, or
   - `cancelled_at = <best available timestamp>` if the stream was cancelled. Because the old schema did not record the cancellation time, cancelled streams are migrated with `cancelled_at = 0` and `cancelled = true`; clients must treat `cancelled == true && cancelled_at == 0` as "cancelled at an unknown time" (legacy stream).
4. Write the migrated entry back under the same key.

### Migration invariants

- Migration is idempotent: running `migrate()` multiple times produces the same result.
- Migration does not alter `withdrawn_amount` for already-cancelled legacy streams, because the historical cancel payout cannot be recovered from the old schema. For these legacy streams, `withdrawn_amount` reflects only explicit withdrawals, not the cancel payout. New cancellations after the migration correctly fold the payout into `withdrawn_amount`.
- Migration is guarded by a version key so it runs at most once per deployed contract instance.

### Versioning

A storage version key is introduced:

```rust
const STORAGE_VERSION: u32 = 2;
```

`migrate()` checks the stored version and only performs the migration when the stored version is less than `STORAGE_VERSION`, then writes the new version.

## Consequences

### Positive

- Clients can determine when a stream was cancelled via `cancelled_at`.
- `withdrawn_amount` now equals the recipient's total received amount for streams cancelled after this change, enabling the frontend to stop "unlocking" cancelled streams.
- `get_stream` exposes the new field without an API change.

### Negative

- Legacy cancelled streams cannot recover their original cancellation timestamp or cancel payout; they are migrated with `cancelled_at = 0` and an unchanged `withdrawn_amount`. Clients must handle this legacy case explicitly.
- The migration adds a one-time cost to the first invocation of `migrate()` after upgrade.

### Neutral

- The `cancelled` boolean is retained alongside `cancelled_at` for compatibility; `cancelled_at != 0` is the authoritative cancellation indicator going forward.

## Alternatives Considered

- **Replace `cancelled: bool` with `cancelled_at: u64` only.** Rejected to avoid breaking existing clients that read the boolean and to keep the migration simpler.
- **Store the cancel payout in a separate field.** Rejected because folding it into `withdrawn_amount` directly satisfies the invariant `withdrawn_amount == recipient_total_received` and avoids redundant state.
- **No migration; require redeployment.** Rejected because existing streams would be lost or unreadable.

## References

- Issue #1095: Contract: record when a stream was cancelled
- `contracts/streaming/src/lib.rs` — `Stream` struct and `cancel`
- ADR-000 template