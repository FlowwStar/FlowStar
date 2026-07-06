# FlowStar Smart Contract API Reference

Complete reference for integrating FlowStar's token streaming smart contract into your dApp.

## Table of Contents

1. [Core Functions](#core-functions)
2. [Query Functions](#query-functions)
3. [Authorization](#authorization)
4. [Error Codes](#error-codes)
5. [Gas Estimates](#gas-estimates)
6. [Type Definitions](#type-definitions)

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

Extends the stream's time-to-live in storage (required every ~6 months).

**Signature:**
```rust
pub fn bump_stream(stream_id: u64) -> Result<(), StreamError>
```

**Parameters:**
- `stream_id: u64` - Stream ID to bump

**Authorization Required:**
- The stream sender must authorize the transaction

**Preconditions:**
- Stream must exist

**Returns:**
- `Ok(())` on success
- `Err(StreamError)` on failure

**Example - JavaScript:**
```typescript
const streamId = 1n;

const result = await invoke('bump_stream', [
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
```

---

## See Also

- [Integration Guide](./integration-guide.md)
- [CLI Examples](./cli-examples.md)
- [Soroban Documentation](https://soroban.stellar.org/)
