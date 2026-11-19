# FlowStar Streaming Contract — API Reference

Contract source: `contracts/streaming/src/lib.rs`

---

## Admin Functions

### `initialize(admin: Address) → Result<(), StreamError>`

One-time contract initialization. Sets the admin address and clears the pause flag.

- Errors: `AlreadyInitialized` if called more than once.

---

### `pause() → Result<(), StreamError>`

Prevent new stream creation and all write operations. Admin only.

- Emits: `PauseEvent { timestamp }`

---

### `unpause() → Result<(), StreamError>`

Resume normal operations. Admin only.

- Emits: `UnpauseEvent { timestamp }`

---

### `is_paused(env: Env) → bool` *(Issue #1102)*

Read-only check of the pause state. Returns `true` when the contract is paused, `false` otherwise. Never panics — defaults to `false` before `initialize` is called.

Frontends should call this before asking a user to sign any write transaction so they can display a "contract is paused" banner instead of letting the transaction fail with `ContractPaused`.

```
// stellar-cli example
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source-account <KEY> \
  --network testnet \
  -- is_paused
```

---

### `get_admin(env: Env) → Result<Address, StreamError>` *(Issue #1101)*

Returns the current admin address stored in instance storage.

- Errors: `NotInitialized` when `initialize` has never been called.

Frontends and scripts can use this to verify who controls upgrades and pausing without reading raw ledger entries via RPC.

```
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source-account <KEY> \
  --network testnet \
  -- get_admin
```

---

### `upgrade(admin: Address, new_wasm_hash: BytesN<32>) → Result<(), StreamError>` *(Issue #1099)*

Replace the contract WASM. Admin only.

Emits `ContractUpgradedEvent` **before** the WASM is swapped, so the event is always indexed against the current contract version.

- Errors: `NotInitialized`, `Unauthorized`.
- Emits: `ContractUpgradedEvent { new_wasm_hash, timestamp }`

---

### `migrate() → Result<(), StreamError>`

Post-upgrade data migration hook. Call once after each upgrade to rewrite stream storage layouts. Idempotent and safe to call multiple times.

---

### `propose_admin(new_admin: Address) → Result<(), StreamError>` *(Issue #1103)*

Propose a new admin address. The current admin must authorize the call. The proposal is stored as `PendingAdmin` in instance storage and **does not** take effect until the proposed address calls `accept_admin`.

A second `propose_admin` call before acceptance overwrites the first proposal silently — only the latest proposal is active at any time.

- Errors: `NotInitialized`, `Unauthorized`.
- Emits: `AdminProposedEvent { current_admin, proposed_admin, timestamp }`

---

### `accept_admin() → Result<(), StreamError>` *(Issue #1103)*

Accept a pending admin proposal. The caller must be the address stored in `PendingAdmin`. On success the pending proposal is cleared and the caller becomes the new admin.

- Errors: `NoPendingAdmin` if no proposal exists; `NotInitialized`.
- Emits: `AdminTransferredEvent { old_admin, new_admin, timestamp }`

#### Two-step admin transfer — why it matters

A direct one-call transfer risks sending the admin role to a mistyped address (or a key the recipient cannot sign with), permanently locking the contract. The two-step pattern — propose then accept — ensures the new admin can demonstrate they control the key before the transfer completes.

```
# Step 1 — current admin proposes
stellar contract invoke --id <CONTRACT_ID> --source-account <ADMIN_KEY> \
  --network testnet -- propose_admin --new_admin <NEW_ADMIN_ADDRESS>

# Step 2 — proposed admin accepts (signs with NEW key)
stellar contract invoke --id <CONTRACT_ID> --source-account <NEW_ADMIN_KEY> \
  --network testnet -- accept_admin
```

---

## Core Stream Functions

### `create_stream(sender: Address, params: CreateStreamParams) → Result<u64, StreamError>`

Fund a new stream. Requires a prior `approve` on the token contract for `total_amount`.

Returns the new stream ID.

**`CreateStreamParams` fields:**

| Field | Type | Description |
|---|---|---|
| `recipient` | `Address` | Stream recipient |
| `token` | `Address` | SEP-41 token contract |
| `total_amount` | `i128` | Total tokens deposited |
| `start_time` | `u64` | UNIX timestamp — stream start |
| `end_time` | `u64` | UNIX timestamp — stream end |
| `cliff_time` | `u64` | Nothing unlocks before this |
| `cliff_amount` | `i128` | Lump-sum unlocked at cliff |

- Emits: `StreamCreatedEvent`

---

### `create_streams_batch(sender: Address, streams: Vec<CreateStreamParams>) → Result<Vec<u64>, StreamError>`

Create up to 20 streams in one atomic transaction. All streams are validated before any funds move; a single invalid entry rejects the whole batch.

- Errors: `BatchEmpty`, `BatchSizeExceeded` (> 20).
- Emits: one `StreamCreatedEvent` per stream.

---

### `withdraw(stream_id: u64, amount: i128) → Result<(), StreamError>`

Recipient (or delegate) withdraws unlocked tokens.

- Emits: `WithdrawEvent`

---

### `cancel(stream_id: u64) → Result<(), StreamError>`

Sender cancels a stream. Recipient receives unlocked portion; sender receives remainder.

- Emits: `CancelEvent`

---

### `partial_cancel(stream_id: u64, amount: i128) → Result<(), StreamError>`

Sender reduces a stream's locked balance without terminating it.

- Emits: `PartialCancelEvent`

---

### `transfer_stream(stream_id: u64, new_recipient: Address) → Result<(), StreamError>`

Recipient transfers stream rights to a new address. Any delegate is cleared.

- Emits: `StreamTransferEvent`

---

### `top_up(stream_id: u64, additional_amount: i128) → Result<(), StreamError>`

Sender adds additional funds to an active stream. Rate is recalculated over remaining time.

- Emits: `TopUpEvent`

---

## Query Functions

### `get_stream(stream_id: u64) → Result<Stream, StreamError>`

Read full stream details by ID.

---

### `get_withdrawable(stream_id: u64) → Result<i128, StreamError>`

Current withdrawable amount for a stream at the current ledger time.

---

### `get_sent_streams(address: Address, offset: u32, limit: u32) → Vec<u64>`

Paginated active stream IDs sent by an address.

---

### `get_received_streams(address: Address, offset: u32, limit: u32) → Vec<u64>`

Paginated active stream IDs received by an address.

---

### `get_sent_stream_count(address: Address) → u32`

Total count of active streams sent by an address.

---

### `get_received_stream_count(address: Address) → u32`

Total count of active streams received by an address.

---

### `get_archived_sent_streams(address: Address, offset: u32, limit: u32) → Vec<u64>`

Paginated archived (cancelled/completed) stream IDs sent by an address.

---

### `get_archived_received_streams(address: Address, offset: u32, limit: u32) → Vec<u64>`

Paginated archived stream IDs received by an address.

---

### `get_stream_metadata(stream_id: u64) → Option<StreamMetadata>`

Read optional metadata (name, category, memo) for a stream.

---

### `version() → u32`

Get the contract version number.

---

### `name() → String`

Get the contract name string.

---

## Metadata & Delegation

### `update_stream_metadata(stream_id: u64, metadata: StreamMetadata) → Result<(), StreamError>`

Sender sets optional metadata fields (name, category, memo). Paused-aware.

- Emits: `StreamMetadataUpdatedEvent`

---

### `set_delegate(stream_id: u64, delegate: Address) → Result<(), StreamError>`

Recipient designates a delegate who can withdraw on their behalf.

- Emits: `DelegateSetEvent`

---

### `remove_delegate(stream_id: u64) → Result<(), StreamError>`

Recipient revokes delegation.

- Emits: `DelegateRemovedEvent`

---

### `get_delegate(stream_id: u64) → Option<Address>`

Read the delegate address for a stream, if set.

---

### `cleanup_stream(caller: Address, stream_id: u64) → Result<(), StreamError>`

Either party removes a fully-drained or cancelled stream from storage. Allowed even when paused.

- Emits: `StreamCleanedUpEvent`

---

### `bump_stream(stream_id: u64) → Result<(), StreamError>`

Extend the TTL of a stream's ledger data (~30 more days). Anyone can call.

- Emits: `StreamBumpedEvent`

---

## Error Reference

| Code | Name | Meaning |
|---|---|---|
| 1 | `InvalidAmount` | Zero, negative, or insufficient amount |
| 2 | `InvalidTimeRange` | `end_time ≤ start_time` or duration > 10 years |
| 3 | `InvalidCliff` | Cliff outside `[start_time, end_time]` or bad cliff amount |
| 4 | `SelfStream` | Sender and recipient are the same address |
| 5 | `StreamNotFound` | ID does not exist or TTL has expired |
| 6 | `StreamCancelled` | Stream already cancelled |
| 7 | `Unauthorized` | Caller not permitted for this operation |
| 8 | `InsufficientFunds` | Withdrawal exceeds withdrawable balance |
| 9 | `StreamEnded` | Stream has already reached `end_time` |
| 10 | `SameRecipient` | Transfer target equals current recipient |
| 11 | `BatchSizeExceeded` | Batch > 20 streams |
| 12 | `BatchEmpty` | Batch has zero streams |
| 13 | `ArithmeticOverflow` | Intermediate vesting calculation overflowed i128 |
| 14 | `AlreadyInitialized` | `initialize` called more than once |
| 15 | `NotInitialized` | Contract not yet initialized |
| 16 | `ContractPaused` | Write rejected because contract is paused |
| 17 | `DurationExceedsMaximum` | Stream duration > 10 years |
| 18 | `InvalidRecipient` | Recipient is the contract address itself |
| 19 | `RateIsZero` | Amount too small — per-second rate would be zero |
| 20 | `StreamNotEligibleForCleanup` | Stream still active |
| 21 | `PastStartTime` | `start_time` is before the current ledger timestamp |
| 22 | `NoPendingAdmin` | `accept_admin` called with no pending proposal |

---

## Vesting Math

```
unlocked = cliff_amount + (elapsed × linear_amount / duration)
```

Capped at `deposited_amount`. Nothing unlocks before `cliff_time`.

`elapsed = now - start_time` (seconds).

---

## Events Reference

| Event | Emitted by | Key fields |
|---|---|---|
| `StreamCreatedEvent` | `create_stream`, `create_streams_batch` | `stream_id`, `sender`, `recipient`, `deposited_amount` |
| `WithdrawEvent` | `withdraw` | `stream_id`, `amount`, `remaining_withdrawable` |
| `CancelEvent` | `cancel` | `stream_id`, `recipient_amount`, `sender_refund` |
| `PartialCancelEvent` | `partial_cancel` | `stream_id`, `amount_refunded`, `new_deposited_amount` |
| `StreamTransferEvent` | `transfer_stream` | `stream_id`, `old_recipient`, `new_recipient` |
| `TopUpEvent` | `top_up` | `stream_id`, `additional_amount`, `new_amount_per_second` |
| `StreamBumpedEvent` | `bump_stream` | `stream_id` |
| `StreamMetadataUpdatedEvent` | `update_stream_metadata` | `stream_id`, `sender` |
| `PauseEvent` | `pause` | `timestamp` |
| `UnpauseEvent` | `unpause` | `timestamp` |
| `ContractUpgradedEvent` | `upgrade` | `new_wasm_hash`, `timestamp` *(#1099)* |
| `AdminProposedEvent` | `propose_admin` | `current_admin`, `proposed_admin`, `timestamp` *(#1103)* |
| `AdminTransferredEvent` | `accept_admin` | `old_admin`, `new_admin`, `timestamp` *(#1103)* |
| `DelegateSetEvent` | `set_delegate` | `stream_id`, `delegate` |
| `DelegateRemovedEvent` | `remove_delegate` | `stream_id` |
| `StreamCleanedUpEvent` | `cleanup_stream` | `stream_id`, `caller` |
