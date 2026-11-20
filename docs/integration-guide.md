# FlowStar Integration Guide

Guide for integrating FlowStar payment streams into your dApp.

## Quick Start (5 minutes)

### 1. Install Dependencies

```bash
npm install @stellar/stellar-sdk @stellar/freighter-api
```

### 2. Create a Stream

```typescript
import { Address, Contract, TransactionBuilder, nativeToScVal } from '@stellar/stellar-sdk';

const STREAM_CONTRACT_ID = 'CXXXXX...'; // Your contract ID
const NETWORK = {
  passphrase: 'Test SDF Network ; September 2015',
  rpcUrl: 'https://soroban-testnet.stellar.org',
};

async function createPayrollStream(
  senderAddress: string,
  recipientAddress: string,
  monthlyAmount: bigint, // in token's smallest unit
) {
  // Connect wallet
  const response = await window.freighter.requestTransaction({
    operations: [],
  }); // Just to check connection
  
  const server = new rpc.Server(NETWORK.rpcUrl);
  const account = await server.getAccount(senderAddress);

  // Prepare stream parameters
  const now = BigInt(Math.floor(Date.now() / 1000));
  const oneMonthLater = now + BigInt(30 * 24 * 60 * 60);
  const oneYearLater = now + BigInt(365 * 24 * 60 * 60);

  const streamParams = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('recipient'),
      val: new Address(recipientAddress).toScVal(),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('token'),
      val: new Address('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC').toScVal(),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('total_amount'),
      val: nativeToScVal(monthlyAmount * BigInt(12), { type: 'i128' }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('start_time'),
      val: nativeToScVal(now, { type: 'u64' }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('end_time'),
      val: nativeToScVal(oneYearLater, { type: 'u64' }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('cliff_time'),
      val: nativeToScVal(oneMonthLater, { type: 'u64' }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('cliff_amount'),
      val: nativeToScVal(monthlyAmount, { type: 'i128' }),
    }),
  ]);

  // Build transaction
  const contract = new Contract(STREAM_CONTRACT_ID);
  const tx = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(
      contract.call('create_stream', [
        new Address(senderAddress).toScVal(),
        streamParams,
      ])
    )
    .setTimeout(300)
    .build();

  // Sign and submit
  const signedXdr = await window.freighter.signTransaction(tx.toXDR());
  const txObj = TransactionBuilder.fromXDR(signedXdr, NETWORK.passphrase);
  
  const response = await server.sendTransaction(txObj);
  return response.hash;
}
```

---

## Integration Examples

### Example 1: Payroll System

Create monthly salary streams for employees:

```typescript
async function createPayroll(
  companyAddress: string,
  employees: Array<{ address: string; monthlySalary: number }>,
) {
  const server = new rpc.Server(NETWORK.rpcUrl);
  const tokenDecimals = 7;
  const salaryInSmallestUnit = (salary: number) => 
    BigInt(Math.floor(salary * (10 ** tokenDecimals)));

  for (const employee of employees) {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const oneMonth = BigInt(30 * 24 * 60 * 60);

    // Create 1-year stream with 1-month cliff
    await createPayrollStream(
      companyAddress,
      employee.address,
      salaryInSmallestUnit(employee.monthlySalary),
    );

    console.log(`Stream created for ${employee.address}`);
  }
}

// Usage
createPayroll('GCOMPANY...', [
  { address: 'GEMPLOYEE1...', monthlySalary: 5000 },
  { address: 'GEMPLOYEE2...', monthlySalary: 6000 },
]);
```

---

### Example 2: Vesting with Cliff

Create a vesting stream with a 6-month cliff:

```typescript
async function createVestingStream(
  grantorAddress: string,
  recipientAddress: string,
  totalTokens: number,
  vestingYears: number = 4,
  cliffMonths: number = 6,
) {
  const server = new rpc.Server(NETWORK.rpcUrl);
  const decimals = 7;
  const amount = BigInt(Math.floor(totalTokens * (10 ** decimals)));

  const now = BigInt(Math.floor(Date.now() / 1000));
  const cliffTime = now + BigInt(cliffMonths * 30 * 24 * 60 * 60);
  const endTime = now + BigInt(vestingYears * 365 * 24 * 60 * 60);

  // At cliff, recipient gets 25% of tokens
  const cliffAmount = amount / BigInt(4);

  // Remaining tokens vest linearly over the rest of the period
  const vestingDuration = endTime - cliffTime;
  const linearVestAmount = amount - cliffAmount;
  const amountPerSecond = linearVestAmount / vestingDuration;

  console.log(`Vesting schedule:`);
  console.log(`  Cliff: ${cliffMonths} months (${cliffAmount / BigInt(10 ** decimals)} tokens)`);
  console.log(`  Linear vesting: ${vestingYears - cliffMonths / 12} years`);
  console.log(`  Rate: ${amountPerSecond / BigInt(10 ** decimals)} tokens/second`);

  // Create stream using the vesting parameters
}
```

---

### Example 3: Airdrop Distribution

Create streams for multiple recipients in bulk:

```typescript
async function createAirdropStreams(
  airdropAddress: string,
  recipients: string[],
  tokensPerRecipient: number,
  durationDays: number = 30,
) {
  const server = new rpc.Server(NETWORK.rpcUrl);
  const decimals = 7;
  const amount = BigInt(Math.floor(tokensPerRecipient * (10 ** decimals)));
  const now = BigInt(Math.floor(Date.now() / 1000));
  const duration = BigInt(durationDays * 24 * 60 * 60);

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < recipients.length; i += 1) {
    try {
      const recipient = recipients[i];
      
      // Create stream with no cliff (immediate unlock)
      const streamId = await createPayrollStream(
        airdropAddress,
        recipient,
        amount,
      );

      successCount += 1;
      console.log(`[${i + 1}/${recipients.length}] Stream ${streamId} created for ${recipient}`);

      // Delay between transactions to avoid rate limiting
      if (i < recipients.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      failureCount += 1;
      console.error(`Failed to create stream for recipient ${i}:`, error);
    }
  }

  console.log(`\nAirdrop complete: ${successCount} succeeded, ${failureCount} failed`);
}

// Usage
createAirdropStreams(
  'GAIRDROP...',
  [
    'GRECIPIENT1...',
    'GRECIPIENT2...',
    'GRECIPIENT3...',
  ],
  100, // 100 tokens per recipient
  30,  // 30 day vesting
);
```

---

### Example 4: Real-time Balance Display

Display remaining balance and withdrawal progress:

```typescript
async function displayStreamProgress(streamId: string) {
  const server = new rpc.Server(NETWORK.rpcUrl);
  const contract = new Contract(STREAM_CONTRACT_ID);

  // Fetch stream details
  const streamData = await query('get_stream', [
    nativeToScVal(BigInt(streamId), { type: 'u64' }),
  ]);

  // Calculate progress
  const now = BigInt(Math.floor(Date.now() / 1000));
  const stream = parseStream(streamData);

  const totalDuration = stream.endTime - stream.startTime;
  const elapsed = now - stream.startTime;
  const progress = Number((elapsed * BigInt(100)) / totalDuration);

  // Get withdrawable amount
  const withdrawable = await query('get_withdrawable', [
    nativeToScVal(BigInt(streamId), { type: 'u64' }),
  ]);

  console.log(`Stream ${streamId}:`);
  console.log(`  Progress: ${Math.min(progress, 100).toFixed(1)}%`);
  console.log(`  Withdrawn: ${stream.withdrawnAmount / BigInt(10 ** 7)}`);
  console.log(`  Available: ${withdrawable / BigInt(10 ** 7)}`);
  console.log(`  Remaining: ${(stream.depositedAmount - stream.withdrawnAmount) / BigInt(10 ** 7)}`);
}
```

---

### Example 5: Token Approval Flow

Approve tokens before creating streams:

```typescript
async function approveTokens(
  userAddress: string,
  tokenAddress: string,
  amount: bigint,
) {
  const server = new rpc.Server(NETWORK.rpcUrl);
  const currentLedger = (await server.getLatestLedger()).sequence;
  const expirationLedger = currentLedger + 500;

  const account = await server.getAccount(userAddress);
  const tokenContract = new Contract(tokenAddress);

  // Build approval transaction
  const tx = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(
      tokenContract.call('approve', [
        new Address(userAddress).toScVal(),
        new Address(STREAM_CONTRACT_ID).toScVal(),
        nativeToScVal(amount, { type: 'i128' }),
        nativeToScVal(expirationLedger, { type: 'u32' }),
      ])
    )
    .setTimeout(300)
    .build();

  // Sign and submit
  const signedXdr = await window.freighter.signTransaction(tx.toXDR());
  const txObj = TransactionBuilder.fromXDR(signedXdr, NETWORK.passphrase);
  
  const response = await server.sendTransaction(txObj);
  console.log(`Approval submitted: ${response.hash}`);

  // Poll for confirmation
  let pollStatus = 'PENDING';
  while (pollStatus === 'PENDING') {
    await new Promise((r) => setTimeout(r, 2000));
    const result = await server.getTransaction(response.hash);
    pollStatus = result.status;
  }

  return pollStatus === 'SUCCESS';
}
```

---

### Example 6: Top Up a Stream

Add more funds to an active stream. The vesting rate is recalculated over the remaining time from the moment of the top-up.

```typescript
async function topUpStream(
  senderAddress: string,
  streamId: bigint,
  additionalAmount: bigint,
) {
  const server = new rpc.Server(NETWORK.rpcUrl);
  const account = await server.getAccount(senderAddress);
  const contract = new Contract(STREAM_CONTRACT_ID);

  // Approve the additional tokens first
  await approveTokens(
    senderAddress,
    'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC', // token address
    additionalAmount,
  );

  const tx = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(
      contract.call('top_up', [
        nativeToScVal(streamId, { type: 'u64' }),
        nativeToScVal(additionalAmount, { type: 'i128' }),
      ])
    )
    .setTimeout(300)
    .build();

  const signedXdr = await window.freighter.signTransaction(tx.toXDR());
  const txObj = TransactionBuilder.fromXDR(signedXdr, NETWORK.passphrase);
  const response = await server.sendTransaction(txObj);

  console.log(`Top-up submitted: ${response.hash}`);
  return response.hash;
}

// Usage: add 500 XLM to stream 42
topUpStream('GSENDER...', 42n, 500n * 10_000_000n);
```

---

### Example 7: Transfer a Stream to a New Recipient

The current recipient can transfer their stream rights to another address at any time. Any delegate registered on the stream is cleared on transfer.

```typescript
async function transferStream(
  currentRecipientAddress: string,
  streamId: bigint,
  newRecipientAddress: string,
) {
  const server = new rpc.Server(NETWORK.rpcUrl);
  const account = await server.getAccount(currentRecipientAddress);
  const contract = new Contract(STREAM_CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(
      contract.call('transfer_stream', [
        nativeToScVal(streamId, { type: 'u64' }),
        new Address(newRecipientAddress).toScVal(),
      ])
    )
    .setTimeout(300)
    .build();

  const signedXdr = await window.freighter.signTransaction(tx.toXDR());
  const txObj = TransactionBuilder.fromXDR(signedXdr, NETWORK.passphrase);
  const response = await server.sendTransaction(txObj);

  console.log(`Transfer submitted: ${response.hash}`);
  return response.hash;
}

// Usage
transferStream('GCURRENT_RECIPIENT...', 42n, 'GNEW_RECIPIENT...');
```

---

### Example 8: Delegation

A recipient can register a delegate who withdraws on their behalf — useful for smart-contract treasuries or automated payout bots. While a delegate is active, only the delegate can call `withdraw`; the recipient must remove the delegate first to regain direct access.

```typescript
async function setDelegate(
  recipientAddress: string,
  streamId: bigint,
  delegateAddress: string,
) {
  const server = new rpc.Server(NETWORK.rpcUrl);
  const account = await server.getAccount(recipientAddress);
  const contract = new Contract(STREAM_CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(
      contract.call('set_delegate', [
        nativeToScVal(streamId, { type: 'u64' }),
        new Address(delegateAddress).toScVal(),
      ])
    )
    .setTimeout(300)
    .build();

  const signedXdr = await window.freighter.signTransaction(tx.toXDR());
  const txObj = TransactionBuilder.fromXDR(signedXdr, NETWORK.passphrase);
  const response = await server.sendTransaction(txObj);

  console.log(`Delegate set: ${response.hash}`);
  return response.hash;
}

async function removeDelegate(
  recipientAddress: string,
  streamId: bigint,
) {
  const server = new rpc.Server(NETWORK.rpcUrl);
  const account = await server.getAccount(recipientAddress);
  const contract = new Contract(STREAM_CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(
      contract.call('remove_delegate', [
        nativeToScVal(streamId, { type: 'u64' }),
      ])
    )
    .setTimeout(300)
    .build();

  const signedXdr = await window.freighter.signTransaction(tx.toXDR());
  const txObj = TransactionBuilder.fromXDR(signedXdr, NETWORK.passphrase);
  const response = await server.sendTransaction(txObj);

  console.log(`Delegate removed: ${response.hash}`);
  return response.hash;
}

async function getDelegate(streamId: bigint): Promise<string | null> {
  // getDelegate is a read-only call — no signing needed
  const server = new rpc.Server(NETWORK.rpcUrl);
  const contract = new Contract(STREAM_CONTRACT_ID);

  const result = await server.simulateTransaction(
    new TransactionBuilder(
      await server.getAccount(STREAM_CONTRACT_ID), // dummy source for simulation
      { fee: '100', networkPassphrase: NETWORK.passphrase }
    )
      .addOperation(
        contract.call('get_delegate', [nativeToScVal(streamId, { type: 'u64' })])
      )
      .setTimeout(30)
      .build()
  );

  // Returns the delegate address string, or null if none is set
  return result ? scValToNative(result) : null;
}

// Usage
async function delegatedWithdrawal(
  delegateAddress: string,
  streamId: bigint,
  amount: bigint,
) {
  const server = new rpc.Server(NETWORK.rpcUrl);
  const account = await server.getAccount(delegateAddress);
  const contract = new Contract(STREAM_CONTRACT_ID);

  // Delegate authorizes the withdrawal; tokens still go to the recipient
  const tx = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(
      contract.call('withdraw', [
        nativeToScVal(streamId, { type: 'u64' }),
        nativeToScVal(amount, { type: 'i128' }),
      ])
    )
    .setTimeout(300)
    .build();

  const signedXdr = await window.freighter.signTransaction(tx.toXDR());
  const txObj = TransactionBuilder.fromXDR(signedXdr, NETWORK.passphrase);
  const response = await server.sendTransaction(txObj);

  console.log(`Delegated withdrawal submitted: ${response.hash}`);
  return response.hash;
}
```

---

## Event Handling

Monitor stream changes:

```typescript
async function subscribeToStreamUpdates(streamId: string, onUpdate: (stream: any) => void) {
  const pollInterval = setInterval(async () => {
    try {
      const stream = await query('get_stream', [
        nativeToScVal(BigInt(streamId), { type: 'u64' }),
      ]);
      onUpdate(stream);
    } catch (error) {
      console.error('Failed to fetch stream:', error);
    }
  }, 5000); // Poll every 5 seconds

  return () => clearInterval(pollInterval);
}

// Usage
const unsubscribe = await subscribeToStreamUpdates('123', (stream) => {
  console.log('Stream updated:', stream);
  updateUI(stream);
});

// Later: unsubscribe();
```

---

## Error Handling

Properly handle errors:

```typescript
async function safeCreateStream(
  sender: string,
  recipient: string,
  amount: bigint,
) {
  try {
    // Validate inputs
    if (!sender.startsWith('G') || !recipient.startsWith('G')) {
      throw new Error('Invalid Stellar address format');
    }

    if (amount <= 0n) {
      throw new Error('Amount must be positive');
    }

    // Create stream
    const streamId = await createPayrollStream(sender, recipient, amount);
    return { success: true, streamId };

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return {
          success: false,
          error: 'User cancelled the transaction',
        };
      }

      if (error.message.includes('InsufficientFunds')) {
        return {
          success: false,
          error: 'Insufficient balance. Approve more tokens.',
        };
      }

      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: 'An unknown error occurred',
    };
  }
}
```

---

## Best Practices

### 1. Always Validate Input

```typescript
function validateStreamParams(params: StreamParams): string | null {
  if (params.start_time >= params.end_time) {
    return 'Start time must be before end time';
  }

  if (params.cliff_time > params.end_time) {
    return 'Cliff time cannot be after stream end';
  }

  if (params.cliff_amount > params.total_amount) {
    return 'Cliff amount cannot exceed total amount';
  }

  return null;
}
```

### 2. Use Proper Fee Estimation

```typescript
async function estimateStreamCreationFee(amount: bigint): Promise<number> {
  // Include buffer for token approval (~500k) + stream creation (~500k)
  const baseFee = 500000;
  const approvalFee = 500000;
  const buffer = 1.15; // 15% buffer

  return Math.ceil((baseFee + approvalFee) * buffer);
}
```

### 3. Implement Retry Logic

```typescript
async function createStreamWithRetry(
  sender: string,
  recipient: string,
  amount: bigint,
  maxRetries: number = 3,
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await createPayrollStream(sender, recipient, amount);
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error('Failed after max retries');
}
```

---

## See Also

- [API Reference](./api-reference.md)
- [CLI Examples](./cli-examples.md)
- [Soroban Documentation](https://soroban.stellar.org/)
