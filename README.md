![FlowStar](./flowstar-banner.png)

# FlowStar

Real-time token streaming on Stellar. Send tokens that unlock continuously by the second — perfect for payroll, token vesting, and grants. Built on Soroban smart contracts.

Inspired by [Streamflow](https://streamflow.finance) on Solana.

---

## Live Demo

**Testnet deployment** — connect a [Freighter](https://www.freighter.app/) wallet set to Stellar testnet to try it.

**Contract:** [`CBNDCZTRFNTDAPQLPK2ESOKO4XFMSC4PX37QE75BBYFOYIEWIPMHAKFV`](https://stellar.expert/explorer/testnet/contract/CBNDCZTRFNTDAPQLPK2ESOKO4XFMSC4PX37QE75BBYFOYIEWIPMHAKFV) (Testnet)

---

## Features

- **Per-second unlocking** — funds stream continuously, recipients withdraw anytime
- **Cliff support** — set a cliff date with an optional lump-sum unlock
- **Cancel anytime** — sender cancels and gets unstreamed tokens back, recipient keeps what unlocked
- **Non-custodial** — contract holds funds, no intermediary
- **Multi-token** — XLM, USDC, EURC (any SEP-41 token)

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| Smart Contract | Rust, Soroban SDK v26 |
| Blockchain | Stellar (Soroban) |
| Wallet | Freighter via `@stellar/freighter-api` |
| RPC | Stellar Soroban Testnet RPC |

---

## Project Structure

```
├── app/                    # Next.js app router pages
│   └── app/                # Protected app area
│       ├── page.tsx        # Dashboard
│       ├── streams/        # All streams list
│       ├── create/         # Create stream form
│       └── stream/[id]/    # Stream detail + withdraw/cancel
├── components/
│   ├── landing/            # Marketing landing page
│   ├── layout/             # Navbar, wallet button, auth gate
│   ├── streams/            # Stream card, stats, empty state
│   └── ui/                 # shadcn/ui primitives
├── contracts/
│   └── streaming/          # Soroban smart contract (Rust)
│       └── src/
│           ├── lib.rs       # Contract logic
│           ├── test.rs      # Unit tests (13 tests)
│           └── test_security.rs  # Security tests (31 tests)
├── hooks/                  # useStreams, useContract, useWallet, useNow
├── lib/
│   ├── contract.ts         # Contract integration layer
│   ├── stellar.ts          # Network config + RPC client
│   ├── stream-utils.ts     # Unlock math, formatters
│   └── mock-data.ts        # Dev mock store
└── types/stream.ts         # StreamData, TokenInfo, CreateStreamInput
```

---

## Contract

The Soroban contract is at `contracts/streaming/`. Full API reference: see [`docs/api-reference.md`](./docs/api-reference.md).

### Core Functions

| Function | Description |
|---|---|
| `create_stream` | Fund a new stream (requires prior `approve` on token) |
| `create_streams_batch` | Create multiple streams in one atomic transaction (up to 20 per batch) |
| `withdraw` | Recipient (or delegate) withdraws unlocked tokens |
| `cancel` | Sender cancels — recipient gets unlocked portion, sender gets remainder |
| `partial_cancel` | Sender reduces a stream's locked balance, releasing funds back |
| `transfer_stream` | Recipient transfers stream rights to another address |
| `top_up` | Sender adds additional funds to an active stream |

### Query Functions

| Function | Description |
|---|---|
| `get_stream` | Read full stream details by ID |
| `get_withdrawable` | Current withdrawable amount for a stream |
| `get_sent_streams` | Paginated stream IDs sent by an address |
| `get_received_streams` | Paginated stream IDs received by an address |
| `get_sent_stream_count` | Total count of streams sent by an address |
| `get_received_stream_count` | Total count of streams received by an address |
| `get_archived_sent_streams` | Paginated archived (cancelled/completed) streams sent by an address |
| `get_archived_received_streams` | Paginated archived streams received by an address |
| `get_stream_metadata` | Read optional metadata (name, category, memo) for a stream |

### Metadata & Delegation

| Function | Description |
|---|---|
| `update_stream_metadata` | Set optional metadata (name, category, memo) for a stream |
| `set_delegate` | Designate a delegate who can withdraw on the recipient's behalf |
| `remove_delegate` | Revoke delegation for a stream |
| `get_delegate` | Read the delegate address for a stream, if set |
| `cleanup_stream` | Either party removes a fully-drained or cancelled stream from storage |
| `bump_stream` | Extend the TTL of a stream's ledger data (anyone can call) |

### Admin Functions

| Function | Description |
|---|---|
| `initialize` | One-time contract initialization, sets admin address |
| `pause` | Prevent new stream creation (admin only) |
| `unpause` | Resume normal operations (admin only) |
| `upgrade` | Deploy a new contract wasm (admin only) |
| `migrate` | Post-upgrade data migration hook (admin only) |
| `version` | Get contract version number |
| `name` | Get contract name |

### Vesting math

```
unlocked = cliffAmount + (elapsed × amountPerSecond)
```

Capped at `depositedAmount`. The cliff blocks any unlock until `cliffTime` is reached.

### Running contract tests

```bash
cd contracts
cargo test
```

44 tests pass covering the full lifecycle, authorization, overdraw protection, cliff edge cases, integer math, and self-streams.

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Freighter](https://www.freighter.app/) browser extension (set to Testnet)

### Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

```bash
# .env.local
NEXT_PUBLIC_STREAM_CONTRACT_ID_TESTNET=CBNDCZTRFNTDAPQLPK2ESOKO4XFMSC4PX37QE75BBYFOYIEWIPMHAKFV
# NEXT_PUBLIC_STREAM_CONTRACT_ID_MAINNET=<your mainnet contract id>
```

The contract is already deployed to testnet — use the value above as-is. The app reads
`NEXT_PUBLIC_STREAM_CONTRACT_ID_TESTNET` (or `_MAINNET`) depending on
`NEXT_PUBLIC_STELLAR_NETWORK`. If the variable is absent the app runs in **mock mode**
automatically (no wallet or testnet funds required); see [Architecture notes](#architecture-notes).

### Deploy the contract yourself

```bash
# Install stellar-cli
cargo install stellar-cli --locked

# Generate a deployer key and fund it
stellar keys generate deployer --network testnet
stellar keys fund deployer --network testnet

# Build
cd contracts/streaming
stellar contract build

# Deploy
stellar contract deploy \
  --wasm contracts/target/wasm32v1-none/release/flowstar_streaming.wasm \
  --source deployer \
  --network testnet
```

---

## Testing a stream end-to-end

1. Install [Freighter](https://www.freighter.app/) and switch to **Testnet**
2. Fund your wallet at [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#account-creator?network=test)
3. Open the app at `localhost:3000`
4. Connect Freighter → Create a stream → use this as the recipient address for testing:

```
GBWEDYWFGPNPAWCYOKWMCRPTR4IMV4SNZ7CVOZHPUXGHVXXPJSCFKVXQ
```

You'll sign two transactions: one `approve` on the token contract, then `create_stream`.

---

## Architecture notes

- `lib/contract.ts` is the single integration boundary — mock mode is automatic: `isMockMode = !config.streamContractId`. Set `NEXT_PUBLIC_STREAM_CONTRACT_ID_TESTNET` (or `_MAINNET`) to connect to the real contract; omit it to run on mock data with no wallet needed
- Stream unlock math runs client-side in `lib/stream-utils.ts` for live UI counters without polling
- The contract uses `Persistent` storage with TTL extensions on every write (~30 days per stream)
- All token amounts use `bigint` (i128/u64) to match Soroban types exactly — no precision loss

---

## Architecture Decision Records

Key design choices are documented in [`docs/adr/`](./docs/adr/README.md). Start there if you're wondering "why was it done this way?" before changing something fundamental.

---

## Security

Found a suspected vulnerability? Please report it privately rather than opening a
public issue. See [SECURITY.md](./SECURITY.md) for the supported scope, reporting
process, response timeline, and safe harbor policy. We prefer private disclosure
via [GitHub Security Advisories](https://github.com/FlowwStar/FlowStar/security/advisories/new).

---

## Contributing

Want to contribute? Read our [Contributing Guide](./CONTRIBUTING.md) to get your local environment set up and learn the development workflow.

---

## License

MIT
