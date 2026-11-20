# ADR-016: Active vs Archive Stream Indexes

## Status

Accepted

## Context

The contract needs to let the frontend list all streams for a given address. It stores stream IDs in four per-address index lists:

| Key                    | Contents                                              |
| ---------------------- | ----------------------------------------------------- |
| `SentBy(addr)`         | IDs of active streams where `addr` is the sender      |
| `ReceivedBy(addr)`     | IDs of active streams where `addr` is the recipient   |
| `ArchiveSentBy(addr)`  | IDs of ended/cancelled streams where `addr` is sender |
| `ArchiveReceivedBy(addr)` | IDs of ended/cancelled streams where `addr` is recipient |

Keeping a single flat list per address was considered but rejected: mixing active and ended streams forces the frontend to fetch and filter every stream before it can render the dashboard. Separate active and archive lists let the UI load the common case (active streams) cheaply, and load the archive on demand.

### When IDs move between indexes

A stream starts in `SentBy` and `ReceivedBy`. It is moved to `ArchiveSentBy` and `ArchiveReceivedBy` exactly once, when one of two terminal conditions is reached:

**1. Full drain via `withdraw`**

```
withdrawn_amount >= deposited_amount  AND  now >= end_time
```

Both conditions must hold. A stream that reaches `end_time` but still has unwithdrawn balance stays in the active indexes until the recipient withdraws the remainder.

**2. Cancellation via `cancel`**

`cancel` immediately moves the stream from both active indexes to both archive indexes, regardless of how much has been withdrawn. The stream is not reachable from active indexes after this point.

`partial_cancel` does **not** move the stream — it leaves the stream active.

### Edge cases

**Transfer:** `transfer_stream` replaces the recipient. It removes the stream ID from `ReceivedBy(old_recipient)` and inserts it into `ReceivedBy(new_recipient)`. The sender-side index (`SentBy`) is not touched. If the stream was already fully drained and archived before the transfer, the transfer is rejected with `StreamEnded` to prevent the ID from being re-added to an active index after it was archived.

**Cancel after partial drain:** When a recipient has made some withdrawals before the sender cancels, `cancel` still moves the stream to the archive indexes immediately. The partial `withdrawn_amount` remains on the stream struct; the cancel payout is folded into `withdrawn_amount` as described in ADR-014.

**Cleanup:** `cleanup` removes expired or terminated streams from storage. It is only callable after a stream has been moved to the archive (i.e., after cancel or full drain). It does not modify the index lists — it removes the `Stream(id)` entry from persistent storage. The archive index entries remain as a lightweight record that the stream existed.

**TTL / expiry:** Index lists are stored in persistent storage with the same 30-day TTL as stream entries. If an address goes inactive for more than 30 days its index list may expire. Calling `bump_stream` on any stream belonging to that address restores the stream entry's TTL, but index lists are only bumped when they are written. If an index list expires, the frontend will see an empty list; the underlying stream entries are unaffected and can be fetched directly by ID.

## Decision

Maintain separate active (`SentBy`, `ReceivedBy`) and archive (`ArchiveSentBy`, `ArchiveReceivedBy`) index lists. Move a stream ID from active to archive exactly once: on `cancel`, or on the final `withdraw` that fully drains the stream after `end_time`. Never remove an ID from the archive; it is append-only after the transition.

## Consequences

- **Easier:** The frontend can query active and archive lists independently. Active-stream dashboard rendering is not slowed by historical data.
- **Harder:** The contract must update up to four index lists on certain operations (cancel and drain move IDs; transfer swaps recipient entries). Each list write is a separate persistent-storage write, which costs additional Soroban fees.
- **Index growth:** Archive lists grow indefinitely for active users. Soroban persistent entries have a maximum size; very active addresses that have created and cancelled thousands of streams may eventually hit entry-size limits. No mitigation is currently implemented; this is tracked as a known limitation.
- **Partial cancel does not archive:** Callers expecting a `partial_cancel` to move the stream to the archive (as a full `cancel` does) will be surprised. The stream stays active and continues streaming.

## References

- Issue #1210: ADR — active vs archive stream indexes
- ADR-014: Record Cancellation Time and Fold Cancel Payout into `withdrawn_amount`
- `contracts/streaming/src/lib.rs` — `cancel`, `withdraw`, `transfer_stream`, `cleanup`, `push_to_index`, `remove_from_index`
