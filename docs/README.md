# FlowStar Documentation

Complete documentation for the FlowStar payment streaming smart contract.

## Quick Links

- **[API Reference](./api-reference.md)** - Complete function reference with parameters, returns, and gas costs
- **[Integration Guide](./integration-guide.md)** - Step-by-step guide with 5 practical examples
- **[CLI Examples](./cli-examples.md)** - Command-line interface examples for contract interaction

---

## Overview

FlowStar is a Stellar Soroban smart contract that enables token streaming with flexible vesting schedules. It allows senders to create streams that recipients can withdraw from gradually over time, with optional cliff vesting.

### Key Features

- **Linear Streaming**: Recipients receive tokens continuously throughout the stream duration
- **Cliff Vesting**: Define an amount that unlocks immediately at a specified time
- **Flexible Configuration**: Customize start time, end time, cliff, and amounts
- **Recipient Rights**: Recipients can withdraw available balance at any time
- **Sender Control**: Senders can cancel streams and receive remaining balance
- **Stream Transfer**: Recipients can transfer their stream rights to another address
- **Top-up Support**: Senders can add more funds to existing streams
- **Storage Management**: Built-in TTL bumping for long-term streams

---

## Getting Started

### 1. For Smart Contract Integrators

Start with the **[API Reference](./api-reference.md)** to understand all 12 public functions:

- Stream Creation & Modification
  - `create_stream()` - Create a new payment stream
  - `cancel()` - Cancel a stream
  - `transfer_stream()` - Transfer stream to new recipient
  - `top_up()` - Add funds to existing stream
  - `bump_stream()` - Extend stream TTL

- Recipient Operations
  - `withdraw()` - Withdraw available funds

- Query Functions
  - `get_stream()` - Fetch stream details
  - `get_withdrawable()` - Get available withdrawal amount
  - `get_sent_streams()` - List streams sent by address
  - `get_received_streams()` - List streams received by address
  - `get_sent_stream_count()` - Count of sent streams
  - `get_received_stream_count()` - Count of received streams

### 2. For dApp Developers

Follow the **[Integration Guide](./integration-guide.md)** which includes:

1. Quick Start (5 minutes)
2. 5 Complete Examples:
   - Payroll System
   - Vesting with Cliff
   - Airdrop Distribution
   - Real-time Balance Display
   - Token Approval Flow
3. Error Handling
4. Best Practices

### 3. For CLI Users

Use the **[CLI Examples](./cli-examples.md)** for direct contract interaction via `soroban-cli`:

- Creating streams with various configurations
- Querying stream data
- Withdrawing funds
- Modifying and cancelling streams
- Batch operations
- Debugging tools

---

## Common Use Cases

### Payroll Management

Create monthly salary streams for employees:

```
Employee receives salary gradually over 30 days
- 1 month cliff to verify employment
- Linear vesting for remaining salary
- Automatic withdrawals each period
```

### Token Vesting

Distribute tokens to founders, investors, and employees:

```
Token vesting with staggered release
- 6-month cliff (25% unlocks)
- 4-year linear vesting for remaining 75%
- Investor can transfer stream rights
```

### Airdrop Distribution

Distribute tokens to many recipients fairly:

```
Airdrop tokens over 30 days
- Equal amount per recipient
- Linear distribution
- Batch creation from CSV
```

---

## Authorization & Security

All write operations require authorization from a specific account:

| Operation | Requires |
|-----------|----------|
| `create_stream()` | Sender must authorize |
| `withdraw()` | Recipient must authorize |
| `cancel()` | Sender must authorize |
| `transfer_stream()` | Current recipient must authorize |
| `top_up()` | Sender must authorize |
| `bump_stream()` | Sender must authorize |

Query operations (read-only) do not require authorization or fees.

---

## Error Codes

| Code | Name | Meaning |
|------|------|---------|
| 1 | NotFound | Stream does not exist |
| 2 | Unauthorized | Caller not authorized for operation |
| 3 | InvalidAmount | Amount is invalid (≤0 or > total) |
| 4 | InvalidTime | Time values invalid (start ≥ end) |
| 5 | InvalidCliff | Cliff configuration invalid |
| 6 | AlreadyCancelled | Stream already cancelled |
| 7 | InsufficientFunds | Not enough balance for operation |
| 8 | InvalidToken | Token contract not SEP-41 valid |
| 9 | TransferFailed | Token transfer failed (allowance?) |
| 10 | InsufficientWithdrawable | No funds available yet |

See [API Reference - Error Codes](./api-reference.md#error-codes) for details.

---

## Gas Costs

Approximate costs on Stellar Soroban (in stroops, 1 XLM = 10^7 stroops):

| Operation | Cost |
|-----------|------|
| create_stream | 575,000 stroops (~0.0058 XLM) |
| withdraw | 230,000 stroops (~0.0023 XLM) |
| cancel | 172,500 stroops (~0.0017 XLM) |
| transfer_stream | 115,000 stroops (~0.0012 XLM) |
| top_up | 230,000 stroops (~0.0023 XLM) |
| bump_stream | 115,000 stroops (~0.0012 XLM) |
| get_stream (query) | Free |
| get_withdrawable (query) | Free |

---

## Contract Types

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

## Network Information

### Testnet

- **Network**: Stellar Testnet
- **Passphrase**: `Test SDF Network ; September 2015`
- **RPC Endpoint**: `https://soroban-testnet.stellar.org`
- **Horizon Endpoint**: `https://horizon-testnet.stellar.org`

### Public Network (When Available)

- **Network**: Stellar Public Network
- **Passphrase**: `Public Global Stellar Network ; September 2015`
- **RPC Endpoint**: `https://soroban-mainnet.stellar.org`
- **Horizon Endpoint**: `https://horizon.stellar.org`

---

## FAQ

**Q: What happens if I cancel a stream?**
A: All remaining funds are immediately returned to the sender's token account.

**Q: Can I withdraw partially?**
A: Yes! You can withdraw any amount up to the currently available balance.

**Q: How often should I bump the stream TTL?**
A: Streams last ~6 months before needing a bump. Call `bump_stream()` every 5 months for active streams.

**Q: What tokens are supported?**
A: Any SEP-41 token on Stellar is supported. Common tokens include XLM, USDC, and EURC.

**Q: Can I transfer my stream to someone else?**
A: Yes! Call `transfer_stream()` to transfer your recipient rights to another address.

**Q: What's the maximum stream duration?**
A: Theoretically unlimited, but practical limit is ~6 months before TTL bump needed.

---

## Development

### Testing

Run tests against the contract:

```bash
cd contracts/streaming
cargo test
```

### Deployment

Deploy to Testnet:

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/streaming.wasm \
  --source GXXXXXX
```

---

## Support

For issues, questions, or contributions:

1. Check this documentation
2. Review [API Reference](./api-reference.md) for function details
3. See [Integration Guide](./integration-guide.md) for examples
4. Check [CLI Examples](./cli-examples.md) for command reference

---

## License

FlowStar is open source and available under the MIT License.

---

**Last Updated**: 2026-06-25
**Documentation Version**: 1.0
**Smart Contract Version**: 1.0
