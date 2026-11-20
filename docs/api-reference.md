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
**Signature:**
```rust
pub fn pause(env: Env)
```

**Parameters:**
- None (admin identity is read from instance storage)

**Authorization Required:**
- The stored admin address must authorize the transaction

**Preconditions:**
- Contract must be initialized

**Returns:**
- `()` on success

**Behavior:**
- **Idempotent:** if the contract is already paused, returns immediately without writing storage or emitting an event. This prevents duplicate `PauseEvent`s that would confuse indexers counting active pause windows.
- Sets `Paused` flag to `true` in instance storage
- Bumps instance storage TTL
- Emits a `PauseEvent` with the current ledger timestamp (only on a real state change)

**Example - CLI:**
```bash
soroban contract invoke \
  --id CXXXXX \
  --source GADMIN \
  -- \
  pause
```

---

### `unpause() → Result<(), StreamError>`

Resume normal operations. Admin only.

- Emits: `UnpauseEvent { timestamp }`
**Parameters:**
- None

**Authorization Required:**
- The stored admin address must authorize the transaction

**Preconditions:**
- Contract must be initialized

**Returns:**
- `()` on success

**Behavior:**
- **Idempotent:** if the contract is already active (not paused), returns immediately without writing storage or emitting an event.
- Sets `Paused` flag to `false` in instance storage
- Bumps instance storage TTL
- Emits an `UnpauseEvent` with the current ledger timestamp (only on a real state change)

**Example - CLI:**
```bash
soroban contract invoke \
  --id CXXXXX \
  --source GADMIN \
  -- \
  unpause
```

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

---

### migrate

Post-upgrade data migration hook. Call this once after `upgrade` when the new contract version requires storage layout changes.

**Signature:**
```rust
pub fn migrate(env: Env)
```

**Parameters:**
- None

**Authorization Required:**
- The stored admin address must authorize the transaction

**Preconditions:**
- Contract must be initialized

**Returns:**
- `()` on success

**Behavior:**
- Sets `Paused` to `false` (unfreezes the contract after an upgrade)
- Extends instance storage TTL to `~1 day` so admin, next-id counter, and pause flag remain accessible immediately after the upgrade
- Rewrites existing streams with any new storage layout fields (idempotent — safe to call multiple times)
- Emits a `MigratedEvent { version, timestamp }` so off-chain indexers know the upgrade completed and the contract version that is now running

**Events:**
- `MigratedEvent` — `version` is the current `CONTRACT_VERSION`; `timestamp` is the current ledger timestamp

**Example - CLI:**
```bash
soroban contract invoke \
  --id CXXXXX \
  --source GADMIN \
  -- \
  migrate
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
### partial_cancel

Partially cancels a stream: refunds part of the still-locked (unvested)
balance to the sender while leaving the stream **active**. It is the
non-terminal counterpart to `cancel`, which refunds the entire locked balance
and ends the stream.

**Signature:**
```rust
pub fn partial_cancel(stream_id: u64, amount: i128) -> Result<(), StreamError>
```

**Parameters:**
- `stream_id: u64` - Stream ID to partially cancel
- `amount: i128` - Amount of locked tokens to refund (in token's smallest unit)

**Authorization Required:**
- The stream sender must authorize the transaction via `require_auth()`; a
  missing or invalid signature aborts the transaction before a `StreamError`
  is returned
- The contract must not be paused

**Preconditions:**
- Stream must exist
- Stream must not already be cancelled, and `end_time` must not have been reached
- `amount > 0` and `amount <= locked balance`, where locked balance is
  `deposited_amount - unlocked_amount(now)`
- The remaining balance must yield a non-zero per-second rate for the rest of
  the stream

**Returns:**
- `Ok(())` on success
- `Err(StreamError)` on failure

**Errors:**
- `StreamNotFound` (5) — stream does not exist
- `ContractPaused` (16) — all write operations are paused
- `StreamCancelled` (6) — stream was already fully cancelled
- `StreamEnded` (9) — the current ledger time is at or past `end_time`
- `InvalidAmount` (1) — `amount` is zero, negative, or exceeds the locked balance
- `RateIsZero` (19) — the reduced balance would stream at zero per second
- `ArithmeticOverflow` (13) — an intermediate `i128` calculation overflowed;
  the stream is left unchanged

**Re-anchoring behavior:**
- Funds already unlocked as of the call are frozen in place; only the locked
  remainder is reduced, and the original `end_time` is preserved. The stream
  stays active (`cancelled = false`) and its TTL is extended.
- When `now >= cliff_time`: `start_time` and `cliff_time` move to `now`,
  `cliff_amount` becomes the unlocked amount, `linear_amount` becomes
  `new_deposited_amount - unlocked`, `duration` becomes `end_time - now`, and
  `amount_per_second` is recalculated as `linear_amount / duration`.
- Before the cliff, nothing has unlocked yet: only `linear_amount` and
  `amount_per_second` are reduced, and `start_time`/`cliff_time` are unchanged.
- The refunded `amount` is transferred from the contract to the sender.

**Event:**
Emits `PartialCancelEvent`:

| Field                  | Type      | Description                                      |
| ---------------------- | --------- | ------------------------------------------------ |
| `stream_id`            | `u64`     | Stream that was partially cancelled              |
| `sender`               | `Address` | Sender who received the refund                   |
| `recipient`            | `Address` | Recipient of the (still active) stream           |
| `amount_refunded`      | `i128`    | Locked amount returned to the sender             |
| `new_deposited_amount` | `i128`    | Stream deposit total after the refund            |
| `timestamp`            | `u64`     | Ledger timestamp of the re-anchoring             |

**Example - JavaScript:**
```typescript
const streamId = 1n;
const refundAmount = 25000000n; // 2.5 USDC (7 decimals)

const result = await invoke('partial_cancel', [
  nativeToScVal(streamId, { type: 'u64' }),
  nativeToScVal(refundAmount, { type: 'i128' }),
]);
```

---

### transfer_stream

Transfers stream ownership to a new recipient.

**Signature:**
```rust
pub fn transfer_stream(stream_id: u64, new_recipient: Address) -> Result<(), StreamError>
```

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
**Signature:**
```rust
pub fn get_sent_streams(sender: Address, offset: u32, limit: u32) -> Vec<u64>
```

**Parameters:**
- `sender: Address` - Sender address
- `offset: u32` - Pagination offset
- `limit: u32` - Maximum results per page. Silently clamped to `MAX_PAGE_SIZE` (100); pass values ≤ 100 or use successive pages to retrieve more.

**Returns:**
- Vector of stream IDs (at most 100 per call)

**Example:**
```typescript
const senderAddress = 'GXXXXX...';
const offset = 0;
const limit = 100; // hard maximum per page

const streamIds = await query('get_sent_streams', [
  new Address(senderAddress).toScVal(),
  nativeToScVal(offset, { type: 'u32' }),
  nativeToScVal(limit, { type: 'u32' }),
]);
```

---

### `transfer_stream(stream_id: u64, new_recipient: Address) → Result<(), StreamError>`

Recipient transfers stream rights to a new address. Any delegate is cleared.

- Emits: `StreamTransferEvent`
**Parameters:**
- `recipient: Address` - Recipient address
- `offset: u32` - Pagination offset
- `limit: u32` - Maximum results per page. Silently clamped to `MAX_PAGE_SIZE` (100).

**Returns:**
- Vector of stream IDs (at most 100 per call)

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
Returns paginated stream IDs for completed or cancelled streams where `address` is the sender. Streams move to the archive index when they are cancelled or fully drained.

**Signature:**
```rust
pub fn get_archived_sent_streams(
    env: Env,
    address: Address,
    offset: u32,
    limit: u32,
) -> Vec<u64>
```

**Parameters:**
- `address: Address` - Sender address to look up
- `offset: u32` - Zero-based pagination offset
- `limit: u32` - Maximum number of IDs to return (clamped to `MAX_PAGE_SIZE` = 100)

**Returns:**
- `Vec<u64>` - Archived stream IDs (may be empty if none exist or offset is out of range; at most 100 per call)

**Example - JavaScript:**
```typescript
const archivedIds = await query('get_archived_sent_streams', [
  new Address(senderAddress).toScVal(),
  nativeToScVal(0, { type: 'u32' }),
  nativeToScVal(100, { type: 'u32' }),
]);
```

---

### `get_sent_streams(address: Address, offset: u32, limit: u32) → Vec<u64>`

Paginated active stream IDs sent by an address.
Returns paginated stream IDs for completed or cancelled streams where `address` is the recipient.

**Signature:**
```rust
pub fn get_archived_received_streams(
    env: Env,
    address: Address,
    offset: u32,
    limit: u32,
) -> Vec<u64>
```

**Parameters:**
- `address: Address` - Recipient address to look up
- `offset: u32` - Zero-based pagination offset
- `limit: u32` - Maximum number of IDs to return (clamped to `MAX_PAGE_SIZE` = 100)

**Returns:**
- `Vec<u64>` - Archived stream IDs (may be empty if none exist or offset is out of range; at most 100 per call)

**Example - JavaScript:**
```typescript
const archivedIds = await query('get_archived_received_streams', [
  new Address(recipientAddress).toScVal(),
  nativeToScVal(0, { type: 'u32' }),
  nativeToScVal(100, { type: 'u32' }),
]);
```

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
### is_paused

Returns `true` if the contract's write operations are currently paused.

**Signature:**
```rust
pub fn is_paused(env: Env) -> bool
```

**Parameters:**
- None

**Authorization Required:**
- None — read-only, any caller

**Returns:**
- `bool` — `true` while paused, `false` otherwise

**Example - JavaScript:**
```typescript
const paused = await query('is_paused', []);
// false
```

---

## Authorization

Extend the TTL of a stream's ledger data (~30 more days). Anyone can call.

```typescript
import { TransactionBuilder, Address } from '@stellar/stellar-sdk';

// The signer's account must match the required authorizer for the operation
const tx = new TransactionBuilder(account, {
  fee: '1000000',
  networkPassphrase: 'Test SDF Network ; September 2015',
})
  .addOperation(contract.call('create_stream', ...args))
  .setTimeout(300)
  .build();

// Sign with the authorized account
const signedXdr = await wallet.sign(tx);
```

---

## Error Codes

| Code | Name | Description | Recovery |
|------|------|-------------|----------|
| 1 | NotFound | Stream does not exist | Verify stream ID exists |
| 2 | Unauthorized | Caller is not authorized for this operation | Use correct wallet address |
| 3 | InvalidAmount | Amount is negative or zero | Use positive amount > 0 |
| 4 | InvalidTime | Start/end times are invalid | Ensure start_time < end_time |
| 5 | InvalidCliff | Cliff configuration is invalid | Ensure cliff_time >= start_time |
| 6 | AlreadyCancelled | Stream is already cancelled | Cannot modify cancelled streams |
| 7 | InsufficientFunds | Insufficient balance to execute operation | Add more funds or reduce amount |
| 8 | InvalidToken | Token contract is not valid SEP-41 | Verify token address |
| 9 | TransferFailed | Token transfer failed (likely insufficient allowance) | Approve contract for amount |
| 10 | InsufficientWithdrawable | No funds available to withdraw | Wait for cliff or unlock period |
| 11 | BatchSizeExceeded | More than 20 streams in a batch | Split into smaller batches |
| 12 | BatchEmpty | Batch contains no streams | Provide at least one stream |
| 13 | ArithmeticOverflow | Vesting calculation overflowed i128 | Report the stream parameters; do not retry silently |
| 14 | AlreadyInitialized | Contract has already been initialized | Only call `initialize` once |
| 15 | NotInitialized | Contract has not been initialized | Call `initialize` before any other operation |
| 16 | ContractPaused | All write operations are paused | Wait for admin to call `unpause` |
| 17 | DurationExceedsMaximum | Stream duration exceeds the 10-year cap | Shorten `end_time − start_time` to ≤ 315,360,000 s |
| 18 | InvalidRecipient | Recipient address is the contract itself | Use a regular account or external contract address |
| 19 | RateIsZero | Total amount is too small for the duration — per-second rate would be zero | Increase `total_amount` or shorten the stream duration |
| 20 | StreamNotEligibleForCleanup | Stream is neither cancelled nor fully drained; cleanup not allowed | Cancel the stream or wait for it to fully drain before calling `cleanup_stream` |
| 21 | PastStartTime | `start_time` is earlier than the current ledger timestamp | Use a `start_time` at or after the current block time |
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

## Storage Keys and TTL Behaviour

The contract uses two Soroban storage tiers. TTL is measured in ledgers (≈ 5 s each).

| Constant | Ledgers | Wall-clock |
|---|---|---|
| `INSTANCE_TTL_LEDGERS` | 17,280 | ≈ 1 day |
| `PERSISTENT_TTL_LEDGERS` | 518,400 | ≈ 30 days |

### Key table

| Key | Storage tier | Type | Written by | TTL extended by |
|---|---|---|---|---|
| `NextId` | Instance | `u64` | `create_stream`, `create_streams_batch` | every write operation |
| `Admin` | Instance | `Address` | `initialize` | every write operation |
| `Paused` | Instance | `bool` | `pause`, `unpause`, `migrate` | every write operation |
| `Stream(id)` | Persistent | `Stream` | `create_stream`, `withdraw`, `cancel`, `transfer_stream`, `top_up` | same write ops + `bump_stream` |
| `StreamMetadata(id)` | Persistent | `StreamMetadata` | `update_stream_metadata` | `update_stream_metadata`, `bump_stream` |
| `SentBy(addr)` | Persistent | `Vec<u64>` (active IDs) | `create_stream`, `cancel`, `cleanup_stream` | any write that touches the stream + `bump_stream` |
| `ReceivedBy(addr)` | Persistent | `Vec<u64>` (active IDs) | `create_stream`, `transfer_stream`, `cancel`, `cleanup_stream` | any write that touches the stream + `bump_stream` |
| `ArchiveSentBy(addr)` | Persistent | `Vec<u64>` (archived IDs) | `cancel`, `withdraw` (on full drain), `cleanup_stream` | `bump_stream` |
| `ArchiveReceivedBy(addr)` | Persistent | `Vec<u64>` (archived IDs) | `cancel`, `withdraw` (on full drain), `cleanup_stream` | `bump_stream` |
| `Delegate(id)` | Persistent | `Address` | `set_delegate` | `set_delegate`, `bump_stream` |

### TTL expiry behaviour

Soroban does not delete expired entries immediately — they become *inaccessible*. A read returns `None`; a write restores the entry with a fresh TTL. For stream data this means a stream that has not been touched in more than 30 days will appear as `StreamNotFound` until `bump_stream` is called to restore its TTL.

Instance keys (`NextId`, `Admin`, `Paused`) share a single ledger entry for the whole contract. Any write to the contract bumps their TTL, so they remain accessible as long as the contract is in active use.

---

## See Also

- [Integration Guide](./integration-guide.md)
- [CLI Examples](./cli-examples.md)
- [Stream Lifecycle](./STREAM_LIFECYCLE.md)
- [Soroban Documentation](https://soroban.stellar.org/)
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
