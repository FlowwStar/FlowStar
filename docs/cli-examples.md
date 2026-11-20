# FlowStar CLI Examples

Command-line interface examples for interacting with the FlowStar streaming contract.

## Setup

```bash
# Install Soroban CLI
curl https://github.com/stellar/rs-soroban-sdk/releases/download/20.5.0/soroban-cli-20.5.0-x86_64-unknown-linux-gnu.tar.gz | tar xz

# Set environment variables
export SOROBAN_RPC_URL="https://soroban-testnet.stellar.org"
export SOROBAN_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
export CONTRACT_ID="CXXXXX..."
```

---

## Creating Streams

### Basic Stream Creation

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $USER_KEYPAIR \
  -- \
  create_stream \
  --sender GXXXXXX... \
  --params '{"recipient":"GYYYYYY...","token":"CTOKEN...","total_amount":1000000000,"start_time":1700000000,"end_time":1702592000,"cliff_time":1700000000,"cliff_amount":100000000}'
```

### 30-Day Monthly Salary Stream

```bash
SENDER="GCOMPANY..."
RECIPIENT="GEMPLOYEE..."
TOKEN="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" # XLM
MONTHLY_SALARY=50000000000 # 5000 XLM

START=$(date +%s)
END=$((START + 30 * 24 * 60 * 60))
CLIFF=$((START + 24 * 60 * 60))

soroban contract invoke \
  --id $CONTRACT_ID \
  --source $USER_KEYPAIR \
  -- \
  create_stream \
  --sender $SENDER \
  --params "{\"recipient\":\"$RECIPIENT\",\"token\":\"$TOKEN\",\"total_amount\":$MONTHLY_SALARY,\"start_time\":$START,\"end_time\":$END,\"cliff_time\":$CLIFF,\"cliff_amount\":$((MONTHLY_SALARY / 4))}"
```

### 1-Year Vesting with 6-Month Cliff

```bash
SENDER="GFOUNDER..."
RECIPIENT="GINVESTOR..."
TOKEN="CUSDC..." # USDC
TOTAL_TOKENS=1000000000 # 100 USDC (7 decimals)

START=$(date +%s)
CLIFF=$((START + 6 * 30 * 24 * 60 * 60)) # 6 months
END=$((START + 365 * 24 * 60 * 60)) # 1 year
CLIFF_AMOUNT=$((TOTAL_TOKENS / 4)) # 25% at cliff

soroban contract invoke \
  --id $CONTRACT_ID \
  --source $USER_KEYPAIR \
  -- \
  create_stream \
  --sender $SENDER \
  --recipient $RECIPIENT \
  --token $TOKEN \
  --total_amount $TOTAL_TOKENS \
  --start_time $START \
  --end_time $END \
  --cliff_time $CLIFF \
  --cliff_amount $CLIFF_AMOUNT
```

---

## Querying Streams

### Get Stream Details

```bash
STREAM_ID="123"

soroban contract invoke \
  --id $CONTRACT_ID \
  -- \
  get_stream \
  --stream_id $STREAM_ID
```

### Check Withdrawable Amount

```bash
STREAM_ID="123"

soroban contract invoke \
  --id $CONTRACT_ID \
  -- \
  get_withdrawable \
  --stream_id $STREAM_ID
```

### List Sent Streams

```bash
SENDER="GXXXXX..."

soroban contract invoke \
  --id $CONTRACT_ID \
  -- \
  get_sent_streams \
  --sender $SENDER \
  --offset 0 \
  --limit 100
```

### List Received Streams

```bash
RECIPIENT="GXXXXX..."

soroban contract invoke \
  --id $CONTRACT_ID \
  -- \
  get_received_streams \
  --recipient $RECIPIENT \
  --offset 0 \
  --limit 100
```

### Get Stream Count

```bash
ADDRESS="GXXXXX..."

# Sent streams
soroban contract invoke \
  --id $CONTRACT_ID \
  -- \
  get_sent_stream_count \
  --sender $ADDRESS

# Received streams
soroban contract invoke \
  --id $CONTRACT_ID \
  -- \
  get_received_stream_count \
  --recipient $ADDRESS
```

---

## Withdrawing Funds

### Withdraw Available Amount

```bash
STREAM_ID="123"
AMOUNT=100000000 # Amount in smallest unit

soroban contract invoke \
  --id $CONTRACT_ID \
  --source $USER_KEYPAIR \
  -- \
  withdraw \
  --stream_id $STREAM_ID \
  --amount $AMOUNT
```

### Withdraw to Maximum Available

```bash
STREAM_ID="123"

# First get the withdrawable amount
WITHDRAWABLE=$(soroban contract invoke \
  --id $CONTRACT_ID \
  -- \
  get_withdrawable \
  --stream_id $STREAM_ID)

# Then withdraw
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $USER_KEYPAIR \
  -- \
  withdraw \
  --stream_id $STREAM_ID \
  --amount $WITHDRAWABLE
```

---

## Modifying Streams

### Cancel Stream

```bash
STREAM_ID="123"

soroban contract invoke \
  --id $CONTRACT_ID \
  --source $USER_KEYPAIR \
  -- \
  cancel \
  --stream_id $STREAM_ID
```

### Transfer Stream to New Recipient

```bash
STREAM_ID="123"
NEW_RECIPIENT="GNEW..."

soroban contract invoke \
  --id $CONTRACT_ID \
  --source $USER_KEYPAIR \
  -- \
  transfer_stream \
  --stream_id $STREAM_ID \
  --new_recipient $NEW_RECIPIENT
```

### Top Up Stream

```bash
STREAM_ID="123"
ADDITIONAL_AMOUNT=500000000 # Amount to add

soroban contract invoke \
  --id $CONTRACT_ID \
  --source $USER_KEYPAIR \
  -- \
  top_up \
  --stream_id $STREAM_ID \
  --additional_amount $ADDITIONAL_AMOUNT
```

### Bump Stream TTL

```bash
STREAM_ID="123"

soroban contract invoke \
  --id $CONTRACT_ID \
  --source $USER_KEYPAIR \
  -- \
  bump_stream \
  --stream_id $STREAM_ID
```

---

## Token Operations

### Approve Tokens for Streaming

```bash
TOKEN_CONTRACT="CTOKEN..."
AMOUNT=1000000000

soroban contract invoke \
  --id $TOKEN_CONTRACT \
  --source $USER_KEYPAIR \
  -- \
  approve \
  --from $USER_ADDRESS \
  --spender $CONTRACT_ID \
  --amount $AMOUNT \
  --expiration_ledger 10000000
```

### Check Token Balance

```bash
TOKEN_CONTRACT="CTOKEN..."
ACCOUNT="GXXXXX..."

soroban contract invoke \
  --id $TOKEN_CONTRACT \
  -- \
  balance \
  --id $ACCOUNT
```

### Get Token Metadata

```bash
TOKEN_CONTRACT="CTOKEN..."

# Symbol
soroban contract invoke \
  --id $TOKEN_CONTRACT \
  -- \
  symbol

# Decimals
soroban contract invoke \
  --id $TOKEN_CONTRACT \
  -- \
  decimals

# Name
soroban contract invoke \
  --id $TOKEN_CONTRACT \
  -- \
  name
```

---

## Batch Operations

### Create Multiple Streams from CSV

```bash
# Create a CSV file: streams.csv
# recipient,amount,start_time,end_time,cliff_time,cliff_amount
# GAAAA...,1000000000,1700000000,1702592000,1700000000,100000000
# GBBBB...,1000000000,1700000000,1702592000,1700000000,100000000

# Process each row
while IFS=',' read -r recipient amount start end cliff cliff_amt; do
  echo "Creating stream for $recipient..."

  soroban contract invoke \
    --id $CONTRACT_ID \
    --source $USER_KEYPAIR \
    -- \
    create_stream \
    --sender $SENDER \
    --recipient $recipient \
    --token $TOKEN \
    --total_amount $amount \
    --start_time $start \
    --end_time $end \
    --cliff_time $cliff \
    --cliff_amount $cliff_amt

  # Delay to avoid rate limiting
  sleep 2
done < streams.csv
```

### Batch Withdraw from Multiple Streams

```bash
# Stream IDs to withdraw from
STREAM_IDS=(123 124 125 126 127)
WITHDRAWAL_AMOUNT=100000000

for STREAM_ID in "${STREAM_IDS[@]}"; do
  echo "Withdrawing from stream $STREAM_ID..."

  soroban contract invoke \
    --id $CONTRACT_ID \
    --source $USER_KEYPAIR \
    -- \
    withdraw \
    --stream_id $STREAM_ID \
    --amount $WITHDRAWAL_AMOUNT

  sleep 2
done
```

---

## Debugging

### Get Full Transaction Details

```bash
TX_HASH="abc123..."

soroban contract invoke \
  --id $CONTRACT_ID \
  -- \
  get_transaction \
  --hash $TX_HASH
```

### Check Account State

```bash
ACCOUNT="GXXXXX..."

curl -X GET "$SOROBAN_RPC_URL/accounts/$ACCOUNT"
```

### Parse Contract Call

```bash
# Convert XDR to human-readable format
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $USER_KEYPAIR \
  --dry-run \
  -- \
  create_stream \
  --sender $SENDER \
  --recipient $RECIPIENT \
  --token $TOKEN \
  --total_amount 1000000000 \
  --start_time $(date +%s) \
  --end_time $(($(date +%s) + 86400 * 30)) \
  --cliff_time $(date +%s) \
  --cliff_amount 100000000
```

---

## Useful Scripts

### Check All Streams for Address

```bash
#!/bin/bash

ADDRESS="GXXXXX..."
CONTRACT_ID="CXXXXX..."

echo "Sent Streams:"
soroban contract invoke \
  --id $CONTRACT_ID \
  -- \
  get_sent_stream_count \
  --sender $ADDRESS

echo "Received Streams:"
soroban contract invoke \
  --id $CONTRACT_ID \
  -- \
  get_received_stream_count \
  --recipient $ADDRESS

echo ""
echo "Getting sent streams..."
soroban contract invoke \
  --id $CONTRACT_ID \
  -- \
  get_sent_streams \
  --sender $ADDRESS \
  --offset 0 \
  --limit 100 | jq '.'

echo ""
echo "Getting received streams..."
soroban contract invoke \
  --id $CONTRACT_ID \
  -- \
  get_received_streams \
  --recipient $ADDRESS \
  --offset 0 \
  --limit 100 | jq '.'
```

### Monitor Stream Progress

```bash
#!/bin/bash

STREAM_ID="123"
CONTRACT_ID="CXXXXX..."
INTERVAL=5

while true; do
  clear
  echo "=== Stream #$STREAM_ID ==="
  echo "Updated at: $(date)"
  echo ""

  STREAM=$(soroban contract invoke \
    --id $CONTRACT_ID \
    -- \
    get_stream \
    --stream_id $STREAM_ID)

  echo "$STREAM" | jq '.'

  echo ""
  WITHDRAWABLE=$(soroban contract invoke \
    --id $CONTRACT_ID \
    -- \
    get_withdrawable \
    --stream_id $STREAM_ID)

  echo "Currently withdrawable: $WITHDRAWABLE"

  sleep $INTERVAL
done
```

---

## Delegate Operations

A delegate can withdraw on behalf of the recipient. While a delegate is active, only the delegate may call `withdraw` — the recipient is locked out until the delegate is removed.

### Set a Delegate

```bash
STREAM_ID="123"
DELEGATE="GDELEGATE..."

# Must be signed by the stream recipient
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $RECIPIENT_KEYPAIR \
  -- \
  set_delegate \
  --stream_id $STREAM_ID \
  --delegate $DELEGATE
```

### Remove a Delegate

```bash
STREAM_ID="123"

# Must be signed by the stream recipient
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $RECIPIENT_KEYPAIR \
  -- \
  remove_delegate \
  --stream_id $STREAM_ID
```

### Get the Current Delegate

```bash
STREAM_ID="123"

soroban contract invoke \
  --id $CONTRACT_ID \
  -- \
  get_delegate \
  --stream_id $STREAM_ID
```

### Withdraw as a Delegate

```bash
STREAM_ID="123"
AMOUNT=100000000

# Must be signed by the registered delegate, not the recipient
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $DELEGATE_KEYPAIR \
  -- \
  withdraw \
  --stream_id $STREAM_ID \
  --amount $AMOUNT
```

---

## Partial Cancel

`partial_cancel` returns part of the still-locked (unvested) balance to the sender while keeping the stream active. The vesting schedule re-anchors at the moment of the call.

### Partially Cancel a Stream

```bash
STREAM_ID="123"
REFUND_AMOUNT=250000000 # Amount of locked tokens to reclaim

# Must be signed by the sender
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $SENDER_KEYPAIR \
  -- \
  partial_cancel \
  --stream_id $STREAM_ID \
  --amount $REFUND_AMOUNT
```

### Check Locked Balance Before Partial Cancel

```bash
STREAM_ID="123"

# Get full stream details to calculate locked amount
STREAM=$(soroban contract invoke \
  --id $CONTRACT_ID \
  -- \
  get_stream \
  --stream_id $STREAM_ID)

WITHDRAWABLE=$(soroban contract invoke \
  --id $CONTRACT_ID \
  -- \
  get_withdrawable \
  --stream_id $STREAM_ID)

echo "Stream data: $STREAM"
echo "Withdrawable (unlocked): $WITHDRAWABLE"
# Locked = deposited_amount - unlocked_amount
# You can partially cancel up to the locked portion
```

---

## Admin Operations

### Pause the Contract

Pauses all write operations (`create_stream`, `withdraw`, `cancel`, `transfer_stream`, `top_up`, etc.). Read operations remain available. Must be signed by the admin.

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $ADMIN_KEYPAIR \
  -- \
  pause
```

### Unpause the Contract

Resumes all write operations. Must be signed by the admin.

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $ADMIN_KEYPAIR \
  -- \
  unpause
```

### Upgrade the Contract WASM

Replaces the contract's WASM bytecode. The new WASM must already be uploaded to the network. Must be signed by the admin.

```bash
# 1. Upload the new WASM and capture its hash
NEW_WASM_HASH=$(soroban contract upload \
  --source $ADMIN_KEYPAIR \
  --wasm path/to/new_contract.wasm)

echo "New WASM hash: $NEW_WASM_HASH"

# 2. Upgrade the contract
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $ADMIN_KEYPAIR \
  -- \
  upgrade \
  --admin $ADMIN_ADDRESS \
  --new_wasm_hash $NEW_WASM_HASH
```

---

## Archived Streams

Streams are moved to the archive indexes automatically when they are cancelled or fully drained after `end_time`. The archive is append-only; streams are never removed from it except by `cleanup_stream`.

### List Archived Sent Streams

```bash
ADDRESS="GXXXXX..."

soroban contract invoke \
  --id $CONTRACT_ID \
  -- \
  get_archived_sent_streams \
  --address $ADDRESS \
  --offset 0 \
  --limit 100
```

### List Archived Received Streams

```bash
ADDRESS="GXXXXX..."

soroban contract invoke \
  --id $CONTRACT_ID \
  -- \
  get_archived_received_streams \
  --address $ADDRESS \
  --offset 0 \
  --limit 100
```

---

## Cleanup Stream

`cleanup_stream` removes all on-chain storage for a completed or cancelled stream, reclaiming ledger space. Either the sender or the recipient may call it. The stream must be cancelled or fully drained before cleanup is allowed.

```bash
STREAM_ID="123"
CALLER="GSENDER_OR_RECIPIENT..."

# Check eligibility first: stream must be cancelled or fully withdrawn after end_time
soroban contract invoke \
  --id $CONTRACT_ID \
  -- \
  get_stream \
  --stream_id $STREAM_ID

# Then clean up
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $CALLER_KEYPAIR \
  -- \
  cleanup_stream \
  --caller $CALLER \
  --stream_id $STREAM_ID
```

### Batch Cleanup Script

```bash
#!/bin/bash

# Clean up a list of completed stream IDs to reclaim storage
STREAM_IDS=(201 202 203 204 205)
CALLER="GXXXXX..."

for STREAM_ID in "${STREAM_IDS[@]}"; do
  echo "Cleaning up stream $STREAM_ID..."

  soroban contract invoke \
    --id $CONTRACT_ID \
    --source $CALLER_KEYPAIR \
    -- \
    cleanup_stream \
    --caller $CALLER \
    --stream_id $STREAM_ID

  sleep 1
done

echo "Cleanup complete."
```

---

## See Also

- [API Reference](./api-reference.md)
- [Integration Guide](./integration-guide.md)
- [Soroban CLI Docs](https://soroban.stellar.org/docs/learn/cli)
