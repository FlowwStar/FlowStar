# FlowStar Smart Contract API Reference

Complete reference for integrating FlowStar's token streaming smart contract into your dApp.

## Table of Contents

1. [Admin Functions](#admin-functions)
2. [Core Functions](#core-functions)
3. [Query Functions](#query-functions)
4. [Metadata Functions](#metadata-functions)
5. [Delegation Functions](#delegation-functions)
6. [Contract Info Functions](#contract-info-functions)
7. [Authorization](#authorization)
8. [Error Codes](#error-codes)
9. [Gas Estimates](#gas-estimates)
10. [Type Definitions](#type-definitions)

---

## Admin Functions

### initialize

Initializes the contract with an admin address. Must be called exactly once after deployment; subsequent calls panic.

**Signature:**
```rust
pub fn initialize(env: Env, admin: Address)
```

**Parameters:**
- `admin: Address` - The account that will have administrative control over the contract (upgrade, pause, migrate)

**Authorization Required:**
- `admin` must authorize the transaction

**Preconditions:**
- Contract must not already be initialized (no `Admin` key in instance storage)

**Returns:**
- `()` on success
- Panics with `"already initialized"` if called a second time

**Behavior:**
- Sets `Admin` in instance storage to `admin`
- Sets `Paused` flag to `false`
- Bumps instance storage TTL to ~1 day

**Example - CLI:**
```bash
soroban contract invoke \
  --id CXXXXX \
  -- \
  initialize \
  --admin GXXXXXX
```

---

### pause

Halts all write operations contract-wide. While paused, calls to `create_stream`, `create_streams_batch`, `withdraw`, `cancel`, `transfer_stream`, and `top_up` will panic with `"contract is paused"`.

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
- Sets `Paused` flag to `true` in instance storage
- Bumps instance storage TTL
- Emits a `PauseEvent` with the current ledger timestamp

**Example - CLI:**
```bash
soroban contract invoke \
  --id CXXXXX \
  --source GADMIN \
  -- \
  pause
```

---

### unpause

Resumes all write operations after a pause.

**Signature:**
```rust
pub fn unpause(env: Env)
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
- Sets `Paused` flag to `false` in instance storage
- Bumps instance storage TTL
- Emits an `UnpauseEvent` with the current ledger timestamp

**Example - CLI:**
```bash
soroban contract invoke \
  --id CXXXXX \
  --source GADMIN \
  -- \
  unpause
```

---

### upgrade

Replaces the contract's Wasm bytecode with a new version. Only the admin can call this.

**Signature:**
```rust
pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>)
```

**Parameters:**
- `admin: Address` - Must match the stored admin address (validated on-chain)
- `new_wasm_hash: BytesN<32>` - Hash of the new Wasm blob, which must already be uploaded to the network via `soroban contract upload`

**Authorization Required:**
- `admin` must authorize the transaction

**Preconditions:**
- `admin` must equal the stored admin address; panics with `"unauthorized"` otherwise
- New Wasm hash must exist on the network

**Returns:**
- `()` on success

**Behavior:**
- Calls `env.deployer().update_current_contract_wasm(new_wasm_hash)` to perform the in-place upgrade
- Storage layout is not migrated automatically; call `migrate` after upgrading if the new version requires it

**Example - CLI:**
```bash
# 1. Upload new wasm first
soroban contract upload \
  --wasm target/wasm32-unknown-unknown/release/streaming.wasm \
  --source GADMIN

# 2. Upgrade using the returned hash
soroban contract invoke \
  --id CXXXXX \
  --source GADMIN \
  -- \
  upgrade \
  --admin GADMIN \
  --new_wasm_hash <32-byte-hex-hash>
```

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
- Any version-specific storage migrations are implemented here in future contract versions

**Example - CLI:**
```bash
soroban contract invoke \
  --id CXXXXX \
  --source GADMIN \
  -- \
  migrate
```

---

## Core Functions

### create_stream

Creates a new payment stream with optional cliff vesting.

**Signature:**
```rust
pub fn create_stream(sender: Address, params: StreamParams) -> u64
```

**Parameters:**
- `sender: Address` - The account funding and owning the stream (must authorize)
- `params: StreamParams` - Stream configuration object containing:
  - `recipient: Address` - Account receiving the funds
  - `token: Address` - Token contract address (SEP-41)
  - `total_amount: i128` - Total amount to stream (in token's smallest unit)
  - `start_time: u64` - Stream start time (UNIX seconds)
  - `end_time: u64` - Stream end time (UNIX seconds)
  - `cliff_time: u64` - Time before which no funds unlock (except cliff_amount)
  - `cliff_amount: i128` - Amount unlocked immediately at cliff (smallest unit)

**Returns:**
- `u64` - Unique stream ID

**Authorization Required:**
- `sender` must authorize the transaction
- `sender` must have approved the streaming contract to transfer `total_amount` tokens

**Preconditions:**
- `start_time < end_time`
- `cliff_time >= start_time`
- `cliff_amount <= total_amount`
- `total_amount > 0`
- Token contract must be valid SEP-41

**Example - CLI:**
```bash
soroban contract invoke \
  --id CXXXXX \
  -- \
  create_stream \
  --sender GXXXXXX \
  --recipient GXXXXXX \
  --token CXXXXXX \
  --total_amount 1000000000 \
  --start_time 1700000000 \
  --end_time 1702592000 \
  --cliff_time 1700000000 \
  --cliff_amount 100000000
```

**Example - JavaScript (Stellar SDK):**
```typescript
import { Address, Contract, nativeToScVal } from '@stellar/stellar-sdk';

const contract = new Contract(STREAM_CONTRACT_ID);
const params = {
  recipient: new Address(recipientAddress).toScVal(),
  token: new Address(tokenAddress).toScVal(),
  total_amount: nativeToScVal(1000000000n, { type: 'i128' }),
  start_time: nativeToScVal(Math.floor(Date.now() / 1000), { type: 'u64' }),
  end_time: nativeToScVal(Math.floor(Date.now() / 1000) + 86400 * 30, { type: 'u64' }),
  cliff_time: nativeToScVal(Math.floor(Date.now() / 1000), { type: 'u64' }),
  cliff_amount: nativeToScVal(100000000n, { type: 'i128' }),
};

const result = await invoke(
  'create_stream',
  [new Address(senderAddress).toScVal(), nativeToScVal(params, { type: 'map' })],
);
```

---

### create_streams_batch

Creates multiple token streams in a single atomic transaction. All streams are validated before any funds are transferred — if any stream fails validation the entire batch is rejected with no side-effects.

**Signature:**
```rust
pub fn create_streams_batch(
    env: Env,
    sender: Address,
    streams: Vec<CreateStreamInput>,
) -> Result<Vec<u64>, StreamError>
```

**Parameters:**
- `sender: Address` - The account funding all streams in the batch (must authorize)
- `streams: Vec<CreateStreamInput>` - Between 1 and 20 stream definitions. Each `CreateStreamInput` contains:
  - `recipient: Address` - Account receiving the funds
  - `token: Address` - Token contract address (SEP-41)
  - `total_amount: i128` - Total amount for this stream (smallest unit)
  - `start_time: u64` - Stream start time (UNIX seconds)
  - `end_time: u64` - Stream end time (UNIX seconds)
  - `cliff_time: u64` - Cliff time (UNIX seconds)
  - `cliff_amount: i128` - Amount unlocked at cliff (smallest unit)

**Authorization Required:**
- `sender` must authorize the transaction
- `sender` must have approved the contract to spend the **sum** of all `total_amount` values for each token used across the batch (separate approvals per distinct token)

**Preconditions:**
- `streams` must not be empty; returns `StreamError::BatchEmpty` otherwise
- `streams.len() <= 20`; returns `StreamError::BatchSizeExceeded` otherwise
- Each stream entry must satisfy the same per-stream validation rules as `create_stream`

**Returns:**
- `Ok(Vec<u64>)` - Stream IDs in the same order as the input `streams` vector
- `Err(StreamError)` - First validation error encountered (no streams are created)

**Errors:**
- `BatchEmpty` (12) — `streams` vector is empty
- `BatchSizeExceeded` (11) — more than 20 streams in the batch
- `InvalidAmount` (1), `InvalidTimeRange` (2), `InvalidCliff` (3), `SelfStream` (4) — per-stream validation failures

**Example - JavaScript:**
```typescript
const streams = [
  {
    recipient: new Address('GRECIPIENT1...').toScVal(),
    token: new Address(tokenAddress).toScVal(),
    total_amount: nativeToScVal(1000_0000000n, { type: 'i128' }),
    start_time: nativeToScVal(now, { type: 'u64' }),
    end_time: nativeToScVal(now + 86400 * 30, { type: 'u64' }),
    cliff_time: nativeToScVal(now, { type: 'u64' }),
    cliff_amount: nativeToScVal(0n, { type: 'i128' }),
  },
  {
    recipient: new Address('GRECIPIENT2...').toScVal(),
    // ...same fields...
  },
];

const streamIds = await invoke('create_streams_batch', [
  new Address(senderAddress).toScVal(),
  nativeToScVal(streams, { type: 'vec' }),
]);
// Returns [1n, 2n, ...]
```

---

### withdraw

Withdraws available funds from a stream to the recipient's account.

**Signature:**
```rust
pub fn withdraw(stream_id: u64, amount: i128) -> Result<(), StreamError>
```

**Parameters:**
- `stream_id: u64` - Stream ID to withdraw from
- `amount: i128` - Amount to withdraw (in token's smallest unit)

**Authorization Required:**
- The stream recipient must authorize the transaction

**Preconditions:**
- Stream must exist
- Recipient must have at least `amount` withdrawable
- Stream must not be cancelled

**Returns:**
- `Ok(())` on success
- `Err(StreamError)` on failure

**Example - JavaScript:**
```typescript
const streamId = 1n;
const withdrawAmount = 100000000n; // 10 USDC (7 decimals)

const result = await invoke('withdraw', [
  nativeToScVal(streamId, { type: 'u64' }),
  nativeToScVal(withdrawAmount, { type: 'i128' }),
]);
```

---

### cancel

Cancels a stream and returns remaining funds to the sender.

**Signature:**
```rust
pub fn cancel(stream_id: u64) -> Result<(), StreamError>
```

**Parameters:**
- `stream_id: u64` - Stream ID to cancel

**Authorization Required:**
- The stream sender must authorize the transaction

**Preconditions:**
- Stream must exist
- Stream must not already be cancelled

**Returns:**
- `Ok(())` on success
- `Err(StreamError)` on failure

**Example - JavaScript:**
```typescript
const streamId = 1n;

const result = await invoke('cancel', [
  nativeToScVal(streamId, { type: 'u64' }),
]);
```

---

### transfer_stream

Transfers stream ownership to a new recipient.

**Signature:**
```rust
pub fn transfer_stream(stream_id: u64, new_recipient: Address) -> Result<(), StreamError>
```

**Parameters:**
- `stream_id: u64` - Stream ID to transfer
- `new_recipient: Address` - New recipient address

**Authorization Required:**
- The current stream recipient must authorize the transaction

**Preconditions:**
- Stream must exist
- `new_recipient` must be different from current recipient
- Stream must not be cancelled

**Returns:**
- `Ok(())` on success
- `Err(StreamError)` on failure

**Example - JavaScript:**
```typescript
const streamId = 1n;
const newRecipient = 'GXXXXX...';

const result = await invoke('transfer_stream', [
  nativeToScVal(streamId, { type: 'u64' }),
  new Address(newRecipient).toScVal(),
]);
```

---

### top_up

Adds additional funds to an existing stream.

**Signature:**
```rust
pub fn top_up(stream_id: u64, additional_amount: i128) -> Result<(), StreamError>
```

**Parameters:**
- `stream_id: u64` - Stream ID to top up
- `additional_amount: i128` - Additional amount to add (smallest unit)

**Authorization Required:**
- The stream sender must authorize the transaction
- Sender must have approved the contract for `additional_amount` tokens

**Preconditions:**
- Stream must exist
- Stream must not be cancelled
- `additional_amount > 0`

**Returns:**
- `Ok(())` on success
- `Err(StreamError)` on failure

**Example - JavaScript:**
```typescript
const streamId = 1n;
const additionalAmount = 50000000n; // Add 5 USDC

const result = await invoke('top_up', [
  nativeToScVal(streamId, { type: 'u64' }),
  nativeToScVal(additionalAmount, { type: 'i128' }),
]);
```

---

### bump_stream

Extends the stream's time-to-live in storage. Anyone may call this — no authorization required. Useful for keeping a long-running stream accessible without modifying its data.

**Signature:**
```rust
pub fn bump_stream(stream_id: u64) -> Result<(), StreamError>
```

**Parameters:**
- `stream_id: u64` - Stream ID to bump

**Authorization Required:**
- None — any caller may extend a stream's TTL

**Preconditions:**
- Stream must exist

**Returns:**
- `Ok(())` on success
- `Err(StreamError)` on failure

**Behavior:**
- Extends the `Stream(id)` persistent storage entry TTL to ~30 days (`PERSISTENT_TTL_LEDGERS`)
- Emits a `StreamBumpedEvent`
- Does **not** modify any stream data

**Example - JavaScript:**
```typescript
const streamId = 1n;

const result = await invoke('bump_stream', [
  nativeToScVal(streamId, { type: 'u64' }),
]);
```

---

### cleanup_stream

Permanently removes all on-chain data for a completed or cancelled stream, reclaiming storage. Either the sender or recipient may call this.

**Signature:**
```rust
pub fn cleanup_stream(env: Env, caller: Address, stream_id: u64)
```

**Parameters:**
- `caller: Address` - The account initiating cleanup (must be sender or recipient)
- `stream_id: u64` - Stream ID to remove

**Authorization Required:**
- `caller` must authorize the transaction

**Preconditions:**
- Stream must exist
- `caller` must be either `stream.sender` or `stream.recipient`; panics with `"only sender or recipient may clean up a stream"` otherwise
- Stream must be cancelled **or** fully drained after `end_time`; panics with `"stream must be cancelled or fully completed before cleanup"` otherwise

**Returns:**
- `()` on success

**Behavior:**
- Removes the stream from all active and archive index lists for both sender and recipient
- Deletes the `Stream(id)` persistent storage entry
- Deletes the `StreamMetadata(id)` entry if present
- Deletes the `Delegate(id)` entry if present

**Example - JavaScript:**
```typescript
await invoke('cleanup_stream', [
  new Address(senderAddress).toScVal(),
  nativeToScVal(streamId, { type: 'u64' }),
]);
```

---

## Query Functions

### get_stream

Fetches a stream by ID.

**Signature:**
```rust
pub fn get_stream(stream_id: u64) -> Result<Stream, StreamError>
```

**Parameters:**
- `stream_id: u64` - Stream ID to retrieve

**Returns:**
- Stream object with all fields
- `Err(StreamError::NotFound)` if stream doesn't exist

**Example:**
```typescript
const streamId = 1n;
const stream = await query('get_stream', [nativeToScVal(streamId, { type: 'u64' })]);
```

---

### get_withdrawable

Returns the amount available for withdrawal from a stream at current time.

**Signature:**
```rust
pub fn get_withdrawable(stream_id: u64) -> i128
```

**Parameters:**
- `stream_id: u64` - Stream ID

**Returns:**
- `i128` - Withdrawable amount (in token's smallest unit)

**Example:**
```typescript
const streamId = 1n;
const withdrawable = await query('get_withdrawable', [
  nativeToScVal(streamId, { type: 'u64' }),
]);
```

---

### get_sent_streams

Lists stream IDs sent by an address (paginated).

**Signature:**
```rust
pub fn get_sent_streams(sender: Address, offset: u32, limit: u32) -> Vec<u64>
```

**Parameters:**
- `sender: Address` - Sender address
- `offset: u32` - Pagination offset
- `limit: u32` - Maximum results (recommended: 100)

**Returns:**
- Vector of stream IDs

**Example:**
```typescript
const senderAddress = 'GXXXXX...';
const offset = 0;
const limit = 100;

const streamIds = await query('get_sent_streams', [
  new Address(senderAddress).toScVal(),
  nativeToScVal(offset, { type: 'u32' }),
  nativeToScVal(limit, { type: 'u32' }),
]);
```

---

### get_received_streams

Lists stream IDs received by an address (paginated).

**Signature:**
```rust
pub fn get_received_streams(recipient: Address, offset: u32, limit: u32) -> Vec<u64>
```

**Parameters:**
- `recipient: Address` - Recipient address
- `offset: u32` - Pagination offset
- `limit: u32` - Maximum results (recommended: 100)

**Returns:**
- Vector of stream IDs

---

### get_sent_stream_count

Returns total number of streams sent by an address.

**Signature:**
```rust
pub fn get_sent_stream_count(sender: Address) -> u32
```

**Parameters:**
- `sender: Address` - Sender address

**Returns:**
- `u32` - Total count

---

### get_received_stream_count

Returns total number of streams received by an address.

**Signature:**
```rust
pub fn get_received_stream_count(recipient: Address) -> u32
```

**Parameters:**
- `recipient: Address` - Recipient address

**Returns:**
- `u32` - Total count

---

### get_archived_sent_streams

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
- `limit: u32` - Maximum number of IDs to return

**Returns:**
- `Vec<u64>` - Archived stream IDs (may be empty if none exist or offset is out of range)

**Example - JavaScript:**
```typescript
const archivedIds = await query('get_archived_sent_streams', [
  new Address(senderAddress).toScVal(),
  nativeToScVal(0, { type: 'u32' }),
  nativeToScVal(100, { type: 'u32' }),
]);
```

---

### get_archived_received_streams

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
- `limit: u32` - Maximum number of IDs to return

**Returns:**
- `Vec<u64>` - Archived stream IDs (may be empty if none exist or offset is out of range)

**Example - JavaScript:**
```typescript
const archivedIds = await query('get_archived_received_streams', [
  new Address(recipientAddress).toScVal(),
  nativeToScVal(0, { type: 'u32' }),
  nativeToScVal(100, { type: 'u32' }),
]);
```

---

## Metadata Functions

### update_stream_metadata

Attaches or replaces human-readable metadata on a stream. Only the sender can update.

**Signature:**
```rust
pub fn update_stream_metadata(
    env: Env,
    stream_id: u64,
    metadata: StreamMetadata,
) -> Result<(), StreamError>
```

**Parameters:**
- `stream_id: u64` - Stream ID to update
- `metadata: StreamMetadata` - Metadata to store, containing:
  - `name: String` - Short display name for the stream
  - `category: String` - Freeform category label (e.g. `"payroll"`, `"vesting"`)
  - `memo: String` - Longer freeform note

**Authorization Required:**
- `stream.sender` must authorize the transaction

**Preconditions:**
- Stream must exist

**Returns:**
- `Ok(())` on success
- `Err(StreamError::StreamNotFound)` if the stream does not exist

**Behavior:**
- Stores the `StreamMetadata` struct in persistent storage under `StreamMetadata(stream_id)`
- Bumps the metadata entry TTL to ~30 days

**Example - JavaScript:**
```typescript
await invoke('update_stream_metadata', [
  nativeToScVal(streamId, { type: 'u64' }),
  nativeToScVal(
    { name: 'Alice Salary', category: 'payroll', memo: 'Q3 2026' },
    { type: 'map' },
  ),
]);
```

---

### get_stream_metadata

Returns the metadata for a stream, if any has been set.

**Signature:**
```rust
pub fn get_stream_metadata(env: Env, stream_id: u64) -> Option<StreamMetadata>
```

**Parameters:**
- `stream_id: u64` - Stream ID to query

**Returns:**
- `Some(StreamMetadata)` if metadata exists for this stream
- `None` if no metadata has been set

**Example - JavaScript:**
```typescript
const metadata = await query('get_stream_metadata', [
  nativeToScVal(streamId, { type: 'u64' }),
]);
// { name: 'Alice Salary', category: 'payroll', memo: 'Q3 2026' } or null
```

---

## Delegation Functions

### set_delegate

Registers a delegate address that can authorize `withdraw` calls on behalf of the stream's recipient. Useful for automating withdrawals via a bot or smart contract without granting full account control.

**Signature:**
```rust
pub fn set_delegate(
    env: Env,
    stream_id: u64,
    delegate: Address,
) -> Result<(), StreamError>
```

**Parameters:**
- `stream_id: u64` - Stream ID to configure
- `delegate: Address` - Address that will be permitted to call `withdraw`

**Authorization Required:**
- `stream.recipient` must authorize the transaction

**Preconditions:**
- Stream must exist

**Returns:**
- `Ok(())` on success
- `Err(StreamError::StreamNotFound)` if the stream does not exist

**Behavior:**
- Stores `delegate` in persistent storage under `Delegate(stream_id)`
- Bumps the delegate entry TTL to ~30 days
- The delegate is cleared automatically if the stream is transferred via `transfer_stream`

**Example - JavaScript:**
```typescript
await invoke('set_delegate', [
  nativeToScVal(streamId, { type: 'u64' }),
  new Address(delegateAddress).toScVal(),
]);
```

---

### remove_delegate

Removes the registered delegate for a stream. After this call, only the recipient can authorize withdrawals.

**Signature:**
```rust
pub fn remove_delegate(env: Env, stream_id: u64) -> Result<(), StreamError>
```

**Parameters:**
- `stream_id: u64` - Stream ID to update

**Authorization Required:**
- `stream.recipient` must authorize the transaction

**Preconditions:**
- Stream must exist

**Returns:**
- `Ok(())` on success
- `Err(StreamError::StreamNotFound)` if the stream does not exist

**Behavior:**
- Deletes the `Delegate(stream_id)` entry from persistent storage (no-op if no delegate was set)

**Example - JavaScript:**
```typescript
await invoke('remove_delegate', [
  nativeToScVal(streamId, { type: 'u64' }),
]);
```

---

### get_delegate

Returns the delegate address for a stream, if one has been set.

**Signature:**
```rust
pub fn get_delegate(env: Env, stream_id: u64) -> Option<Address>
```

**Parameters:**
- `stream_id: u64` - Stream ID to query

**Returns:**
- `Some(Address)` if a delegate is registered
- `None` if no delegate has been set

**Example - JavaScript:**
```typescript
const delegate = await query('get_delegate', [
  nativeToScVal(streamId, { type: 'u64' }),
]);
// 'GDELEGATE...' or null
```

---

## Contract Info Functions

### version

Returns the contract's version number as a `u32`. Useful for on-chain version checks after an upgrade.

**Signature:**
```rust
pub fn version(_env: Env) -> u32
```

**Parameters:**
- None

**Returns:**
- `u32` - Current contract version (currently `1`)

**Example - JavaScript:**
```typescript
const v = await query('version', []);
// 1
```

---

### name

Returns the human-readable contract name as a Soroban `String`.

**Signature:**
```rust
pub fn name(env: Env) -> soroban_sdk::String
```

**Parameters:**
- None

**Returns:**
- `String` - Contract name (currently `"FlowStar Streaming"`)

**Example - JavaScript:**
```typescript
const contractName = await query('name', []);
// 'FlowStar Streaming'
```

---

## Authorization

All write operations require transaction authorization from a specific account:

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

---

## Gas Estimates

Approximate gas costs on Stellar's Soroban (in stroops = 0.0000001 XLM):

| Operation | Min Fee | Estimated Fee (15% buffer) | Notes |
|-----------|---------|---------------------------|-------|
| create_stream | 500,000 | 575,000 | + token approval (~500k) |
| withdraw | 200,000 | 230,000 | Varies by stream state |
| cancel | 150,000 | 172,500 | Varies by amount returned |
| transfer_stream | 100,000 | 115,000 | Quick operation |
| top_up | 200,000 | 230,000 | Similar to withdraw |
| bump_stream | 100,000 | 115,000 | Minimal cost |
| get_stream | 50,000 | N/A | Read-only, no fee |
| get_withdrawable | 50,000 | N/A | Read-only, no fee |

---

## Type Definitions

```typescript
interface Stream {
  id: u64;
  sender: Address;
  recipient: Address;
  token: Address;
  deposited_amount: i128;
  withdrawn_amount: i128;
  start_time: u64;
  end_time: u64;
  cliff_time: u64;
  cliff_amount: i128;
  amount_per_second: i128;
  cancelled: boolean;
  linear_amount: i128;
  duration: i128;
}

interface StreamParams {
  recipient: Address;
  token: Address;
  total_amount: i128;
  start_time: u64;
  end_time: u64;
  cliff_time: u64;
  cliff_amount: i128;
}

// Used by create_streams_batch; same fields as StreamParams but a distinct type
interface CreateStreamInput {
  recipient: Address;
  token: Address;
  total_amount: i128;
  start_time: u64;
  end_time: u64;
  cliff_time: u64;
  cliff_amount: i128;
}

interface StreamMetadata {
  name: string;
  category: string;
  memo: string;
}
```

---

## See Also

- [Integration Guide](./integration-guide.md)
- [CLI Examples](./cli-examples.md)
- [Soroban Documentation](https://soroban.stellar.org/)
