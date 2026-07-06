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
  --recipient GYYYYYY... \
  --token CTOKEN... \
  --total_amount 1000000000 \
  --start_time 1700000000 \
  --end_time 1702592000 \
  --cliff_time 1700000000 \
  --cliff_amount 100000000
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
  --recipient $RECIPIENT \
  --token $TOKEN \
  --total_amount $MONTHLY_SALARY \
  --start_time $START \
  --end_time $END \
  --cliff_time $CLIFF \
  --cliff_amount $((MONTHLY_SALARY / 4))
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

## See Also

- [API Reference](./api-reference.md)
- [Integration Guide](./integration-guide.md)
- [Soroban CLI Docs](https://soroban.stellar.org/docs/learn/cli)
