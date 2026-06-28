# ADR-001: Persistent vs Instance Storage for Streams

## Status

Accepted

## Context

Soroban contracts have two storage tiers: **instance storage** (tied to the contract's own ledger entry, evicted when the contract is evicted) and **persistent storage** (independent ledger entries per key, with their own TTL). Stream data needs to survive for months or years — a vesting stream might run for 4 years. Instance storage TTLs are bound to the contract's own lifetime, which makes long-lived per-stream data fragile: if the contract entry's TTL lapses between interactions the entire instance is evicted, wiping all streams simultaneously.

## Decision

All per-stream data (`DataKey::Stream(stream_id)`, `DataKey::SentStreams(address)`, `DataKey::ReceivedStreams(address)`) is stored in **persistent storage** with TTL extensions on every write. The contract extends TTLs by approximately 30 days on each `create_stream`, `withdraw`, and `cancel` call.

## Consequences

- **Easier:** Streams survive indefinitely as long as they see at least one interaction roughly every 30 days, or until explicit archival/restore is implemented.
- **Harder:** Each stream is a separate ledger entry, so cross-stream queries (e.g., "get all streams for address") require maintaining an index (`SentStreams`/`ReceivedStreams` lists) rather than a single table scan.
- **Risk:** Very old, idle streams may still be evicted if no interaction occurs before the TTL expires. A future archival/restore flow should address this for long-running streams.
